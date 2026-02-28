import { useEffect, useMemo, useRef, useState } from 'react'
import { AdminConsole } from './components/AdminConsole'
import { AuthScreen } from './components/AuthScreen'
import { FieldControl } from './components/FieldControl'
import { ImageResultPanel } from './components/ImageResultPanel'
import { PresetStrip } from './components/PresetStrip'
import { ReferenceImageInput } from './components/ReferenceImageInput'
import { StepCard } from './components/StepCard'
import { WizardLayout } from './components/WizardLayout'
import { DEFAULT_ADMIN_CONFIG, DEFAULT_FIELDS } from './data/defaults'
import { OPTIONS } from './data/options'
import { PRESETS } from './data/presets'
import {
  buildGenerationRequest,
  generateImageRequest,
} from './lib/imageClient'
import { buildPrompt, estimatePromptTokens } from './lib/promptBuilder'
import { readFileAsReferenceImage } from './lib/referenceImage'
import { supabase } from './lib/supabaseClient'
import {
  ensureProject,
  getProjectConfig,
  getProjectRenderHistory,
  getRenders,
  listProjects,
  loadAttemptCount,
  mergeAdminConfig,
  saveAttemptCount,
  saveProjectConfig,
} from './lib/storage'

const USER_STEPS = [
  {
    id: 'project',
    title: 'Project basics',
    help: 'Defines the project context and the communication purpose for the final render.',
  },
  {
    id: 'render',
    title: 'Render style and camera',
    help: 'Controls visual language, lighting, framing, and the export aspect ratio.',
  },
  {
    id: 'materials',
    title: 'Material setup',
    help: 'Sets finish quality for ducts, pipes, structure, and floor surfaces.',
  },
  {
    id: 'reference',
    title: 'Reference image',
    help: 'Accepts the Dalux BIM image by paste first, with file upload as backup.',
  },
  {
    id: 'generate',
    title: 'Final detail and generate',
    help: 'Adds one last optional note, applies admin guardrails, and generates the final output image.',
  },
]

const DEFAULT_DATA_API = {
  ensureProject,
  getProjectConfig,
  saveProjectConfig,
  getRenders,
  listProjects,
  getProjectRenderHistory,
  loadAttemptCount,
  saveAttemptCount,
}

function getDefaultAttemptStorage() {
  if (typeof window === 'undefined') {
    return undefined
  }

  return window.sessionStorage
}

function createObserver(onActive) {
  return new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)

      if (visible.length > 0) {
        onActive(visible[0].target.id)
      }
    },
    {
      threshold: [0.4, 0.65],
      rootMargin: '-5% 0px -45% 0px',
    },
  )
}

function getCompletedStep(activeStep, targetStep) {
  return (
    USER_STEPS.findIndex((step) => step.id === activeStep) >
    USER_STEPS.findIndex((step) => step.id === targetStep)
  )
}

function getErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Image generation failed.'
}

function cloneDefaults() {
  return {
    ...DEFAULT_FIELDS,
  }
}

function wait(delayMs) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delayMs)
  })
}

function isAdminUser(user) {
  return user?.user_metadata?.role === 'admin'
}

function getUserLabel(user) {
  return (
    user?.user_metadata?.displayName ||
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.email ||
    'Valtria user'
  )
}

function createSessionView(user) {
  if (!user) {
    return {
      role: null,
      isAuthenticated: false,
      displayName: '',
      email: '',
    }
  }

  return {
    role: isAdminUser(user) ? 'admin' : 'user',
    isAuthenticated: true,
    displayName: getUserLabel(user),
    email: user.email || '',
  }
}

function App({
  supabaseClient = supabase,
  dataApi = DEFAULT_DATA_API,
  generateImage = generateImageRequest,
  readReferenceFile = readFileAsReferenceImage,
  attemptStorage = getDefaultAttemptStorage(),
}) {
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [authSession, setAuthSession] = useState(null)
  const [authMessage, setAuthMessage] = useState('')
  const [authAction, setAuthAction] = useState('')
  const [fields, setFields] = useState(() => cloneDefaults())
  const [projectCompany, setProjectCompany] = useState('')
  const [userProjectId, setUserProjectId] = useState('')
  const [isUserProjectLoading, setIsUserProjectLoading] = useState(false)
  const [projectLoadError, setProjectLoadError] = useState('')
  const [savedAdminConfig, setSavedAdminConfig] = useState(() =>
    mergeAdminConfig(DEFAULT_ADMIN_CONFIG),
  )
  const [adminDraft, setAdminDraft] = useState(() =>
    mergeAdminConfig(DEFAULT_ADMIN_CONFIG),
  )
  const [attemptCount, setAttemptCount] = useState(() =>
    dataApi.loadAttemptCount?.(attemptStorage) || 0,
  )
  const [adminNotice, setAdminNotice] = useState('')
  const [showAdminPreview, setShowAdminPreview] = useState(false)
  const [referenceImage, setReferenceImage] = useState(null)
  const [imageResult, setImageResult] = useState(null)
  const [recentRenders, setRecentRenders] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const [activeStep, setActiveStep] = useState(USER_STEPS[0].id)
  const [adminProjects, setAdminProjects] = useState([])
  const [selectedAdminProjectId, setSelectedAdminProjectId] = useState('')
  const [renderHistory, setRenderHistory] = useState([])
  const [isLoadingAdminProjects, setIsLoadingAdminProjects] = useState(false)
  const [isLoadingAdminHistory, setIsLoadingAdminHistory] = useState(false)
  const [isSavingAdmin, setIsSavingAdmin] = useState(false)
  const stepRefs = useRef({})

  const user = authSession?.user || null
  const userId = user?.id || ''
  const sessionView = useMemo(() => createSessionView(user), [user])
  const currentIsAdmin = isAdminUser(user)
  const authAccessToken = authSession?.access_token || ''

  const prompt = useMemo(
    () => buildPrompt(fields, savedAdminConfig),
    [fields, savedAdminConfig],
  )
  const adminPreviewPrompt = useMemo(
    () => buildPrompt(DEFAULT_FIELDS, adminDraft),
    [adminDraft],
  )
  const promptTokenEstimate = useMemo(
    () => estimatePromptTokens(prompt),
    [prompt],
  )
  const maxPromptTokens = savedAdminConfig.limits.maxPromptTokens
  const maxAttempts = savedAdminConfig.limits.maxAttemptsPerSession
  const attemptsRemaining = Math.max(0, maxAttempts - attemptCount)
  const isPromptOverLimit = promptTokenEstimate > maxPromptTokens
  const isAttemptLimitReached = attemptsRemaining <= 0
  const generationBlockReason = isPromptOverLimit
    ? `The prompt is above the admin ceiling (${promptTokenEstimate}/${maxPromptTokens} approx. tokens). Shorten the extra detail or ask admin to increase the limit.`
    : isAttemptLimitReached
      ? `The render attempt cap for this browser session has been reached (${maxAttempts}/${maxAttempts}).`
      : ''
  const projectCostTotal = useMemo(
    () =>
      renderHistory.reduce((total, render) => {
        const cost = Number.parseFloat(render.cost_usd)
        return total + (Number.isFinite(cost) ? cost : 0)
      }, 0),
    [renderHistory],
  )
  const projectCompanyHint = projectLoadError
    ? projectLoadError
    : isUserProjectLoading
      ? 'Loading project settings from Supabase.'
      : 'Required to save renders and load project-specific admin settings.'

  const resetUserWorkspace = () => {
    setFields(cloneDefaults())
    setProjectCompany('')
    setUserProjectId('')
    setProjectLoadError('')
    setReferenceImage(null)
    setImageResult(null)
    setRecentRenders([])
    setGenerationError('')
    setIsGenerating(false)
    setActiveStep(USER_STEPS[0].id)
    setSavedAdminConfig(mergeAdminConfig(DEFAULT_ADMIN_CONFIG))
  }

  const registerStepRef = (stepId) => (node) => {
    if (node) {
      stepRefs.current[stepId] = node
    }
  }

  const scrollToStep = (stepId) => {
    setActiveStep(stepId)
    stepRefs.current[stepId]?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  useEffect(() => {
    let isMounted = true

    async function loadSession() {
      const { data, error } = await supabaseClient.auth.getSession()
      if (!isMounted) {
        return
      }

      if (error) {
        setAuthMessage(error.message)
      }

      setAuthSession(data?.session || null)
      setIsAuthReady(true)
    }

    loadSession()

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return
      }

      setAuthSession(nextSession || null)
      setIsAuthReady(true)
      setAuthAction('')

      if (nextSession?.user) {
        setAuthMessage('')
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [supabaseClient])

  useEffect(() => {
    if (sessionView.role !== 'user') {
      return undefined
    }

    const nodes = USER_STEPS.map((step) => stepRefs.current[step.id]).filter(Boolean)
    if (!nodes.length) {
      return undefined
    }

    const observer = createObserver((id) => {
      setActiveStep(id)
    })

    nodes.forEach((node) => observer.observe(node))

    return () => observer.disconnect()
  }, [sessionView.role])

  useEffect(() => {
    if (!userId || currentIsAdmin) {
      setUserProjectId('')
      setProjectLoadError('')
      return undefined
    }

    const projectName = fields.project_name.trim()
    const company = projectCompany.trim()

    if (!projectName || !company) {
      setUserProjectId('')
      setSavedAdminConfig(mergeAdminConfig(DEFAULT_ADMIN_CONFIG))
      return undefined
    }

    let isCurrent = true
    const timer = window.setTimeout(async () => {
      setIsUserProjectLoading(true)
      setProjectLoadError('')

      try {
        const project = await dataApi.ensureProject({
          name: projectName,
          company,
        })
        if (!isCurrent) {
          return
        }

        const config = await dataApi.getProjectConfig(project.id)
        if (!isCurrent) {
          return
        }

        setUserProjectId(project.id)
        setSavedAdminConfig(config)
      } catch (error) {
        if (!isCurrent) {
          return
        }

        setProjectLoadError(getErrorMessage(error))
      } finally {
        if (isCurrent) {
          setIsUserProjectLoading(false)
        }
      }
    }, 300)

    return () => {
      isCurrent = false
      window.clearTimeout(timer)
    }
  }, [
    currentIsAdmin,
    dataApi,
    fields.project_name,
    projectCompany,
    userId,
  ])

  useEffect(() => {
    if (!userId || currentIsAdmin) {
      setRecentRenders([])
      return undefined
    }

    let isCurrent = true

    async function loadRecentRenders() {
      try {
        const renders = await dataApi.getRenders({
          userId,
        })
        if (!isCurrent) {
          return
        }

        setRecentRenders(renders)
      } catch (error) {
        if (!isCurrent) {
          return
        }

        setGenerationError(getErrorMessage(error))
      }
    }

    loadRecentRenders()

    return () => {
      isCurrent = false
    }
  }, [currentIsAdmin, dataApi, userId])

  useEffect(() => {
    if (!userId || !currentIsAdmin) {
      setAdminProjects([])
      setSelectedAdminProjectId('')
      return undefined
    }

    let isCurrent = true

    async function loadProjects() {
      setIsLoadingAdminProjects(true)

      try {
        const projects = await dataApi.listProjects()
        if (!isCurrent) {
          return
        }

        setAdminProjects(projects)
        setSelectedAdminProjectId((previous) => {
          if (previous && projects.some((project) => project.id === previous)) {
            return previous
          }

          return projects[0]?.id || ''
        })
      } catch (error) {
        if (!isCurrent) {
          return
        }

        setAdminNotice(getErrorMessage(error))
      } finally {
        if (isCurrent) {
          setIsLoadingAdminProjects(false)
        }
      }
    }

    loadProjects()

    return () => {
      isCurrent = false
    }
  }, [currentIsAdmin, dataApi, userId])

  useEffect(() => {
    if (!userId || !currentIsAdmin || !selectedAdminProjectId) {
      setAdminDraft(mergeAdminConfig(DEFAULT_ADMIN_CONFIG))
      setRenderHistory([])
      return undefined
    }

    let isCurrent = true

    async function loadAdminProjectData() {
      setIsLoadingAdminHistory(true)
      setAdminNotice('')

      try {
        const [config, history] = await Promise.all([
          dataApi.getProjectConfig(selectedAdminProjectId),
          dataApi.getProjectRenderHistory({
            projectId: selectedAdminProjectId,
          }),
        ])

        if (!isCurrent) {
          return
        }

        setAdminDraft(config)
        setRenderHistory(history)
      } catch (error) {
        if (!isCurrent) {
          return
        }

        setAdminNotice(getErrorMessage(error))
      } finally {
        if (isCurrent) {
          setIsLoadingAdminHistory(false)
        }
      }
    }

    loadAdminProjectData()

    return () => {
      isCurrent = false
    }
  }, [currentIsAdmin, dataApi, selectedAdminProjectId, userId])

  const handlePasswordLogin = async ({ email, password }) => {
    const normalizedEmail = email.trim()

    if (!normalizedEmail) {
      setAuthMessage('Email is required.')
      return
    }

    if (!password) {
      setAuthMessage('Password is required for password login.')
      return
    }

    setAuthAction('password')
    setAuthMessage('')

    try {
      const { error } = await supabaseClient.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (error) {
        setAuthMessage(error.message)
      }
    } finally {
      setAuthAction('')
    }
  }

  const handleMagicLinkLogin = async ({ email }) => {
    const normalizedEmail = email.trim()

    if (!normalizedEmail) {
      setAuthMessage('Email is required.')
      return
    }

    setAuthAction('magic')
    setAuthMessage('')

    try {
      const { error } = await supabaseClient.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo:
            typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      })

      if (error) {
        setAuthMessage(error.message)
        return
      }

      setAuthMessage('Magic link sent. Check your inbox to finish signing in.')
    } finally {
      setAuthAction('')
    }
  }

  const handleLogout = async () => {
    const { error } = await supabaseClient.auth.signOut()

    if (error) {
      setAuthMessage(error.message)
      return
    }

    setAuthSession(null)
    setAuthMessage('')
    setAuthAction('')
    setAdminDraft(mergeAdminConfig(DEFAULT_ADMIN_CONFIG))
    setAdminProjects([])
    setAdminNotice('')
    setRenderHistory([])
    setSelectedAdminProjectId('')
    setShowAdminPreview(false)
    resetUserWorkspace()
  }

  const handleGenerateImage = async () => {
    scrollToStep('generate')

    if (generationBlockReason) {
      return
    }

    if (!user) {
      setGenerationError('You must be signed in before generating images.')
      return
    }

    if (!authAccessToken) {
      setGenerationError('The Supabase session is missing a valid access token.')
      return
    }

    const projectName = fields.project_name.trim()
    const company = projectCompany.trim()

    if (!projectName || !company) {
      setGenerationError('Project name and company are required before generating.')
      return
    }

    setGenerationError('')
    setIsGenerating(true)

    const nextAttemptCount = attemptCount + 1
    setAttemptCount(nextAttemptCount)
    dataApi.saveAttemptCount?.(attemptStorage, nextAttemptCount)

    let activeProjectId = userProjectId
    let activeConfig = savedAdminConfig
    let activePrompt = prompt
    const previousLatestRenderId = recentRenders[0]?.id || ''

    try {
      if (!activeProjectId || isUserProjectLoading) {
        const ensuredProject = await dataApi.ensureProject({
          name: projectName,
          company,
        })

        activeProjectId = ensuredProject.id
        setUserProjectId(ensuredProject.id)

        activeConfig = await dataApi.getProjectConfig(ensuredProject.id)
        activePrompt = buildPrompt(fields, activeConfig)
        setSavedAdminConfig(activeConfig)
      }

      const request = buildGenerationRequest({
        prompt: activePrompt,
        aspect: fields.aspect,
        adminConfig: activeConfig,
        referenceImage,
        projectId: activeProjectId,
        systemType: fields.room_type,
      })
      const result = await generateImage(request, authAccessToken)
      setImageResult(result)

      try {
        let latestRenders = []

        for (let attempt = 0; attempt < 6; attempt += 1) {
          latestRenders = await dataApi.getRenders({
            userId,
          })
          setRecentRenders(latestRenders)

          const latestRenderId = latestRenders[0]?.id || ''
          const hasNewRender =
            latestRenderId &&
            (!previousLatestRenderId || latestRenderId !== previousLatestRenderId)

          if (hasNewRender || !result?.imageDataUrl) {
            break
          }

          if (attempt < 5) {
            await wait(1500)
          }
        }
      } catch (refreshError) {
        setGenerationError(getErrorMessage(refreshError))
      }
    } catch (error) {
      setGenerationError(getErrorMessage(error))
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveAdmin = async () => {
    if (!selectedAdminProjectId) {
      setAdminNotice('Select a project before saving configuration.')
      return
    }

    setIsSavingAdmin(true)
    setAdminNotice('')

    try {
      const nextConfig = mergeAdminConfig(adminDraft)
      const savedConfig = await dataApi.saveProjectConfig({
        projectId: selectedAdminProjectId,
        config: nextConfig,
      })

      setAdminDraft(savedConfig)
      setAdminNotice('Configuration saved to Supabase.')
    } catch (error) {
      setAdminNotice(getErrorMessage(error))
    } finally {
      setIsSavingAdmin(false)
    }
  }

  const handleResetAdmin = () => {
    setAdminDraft(mergeAdminConfig(DEFAULT_ADMIN_CONFIG))
    setAdminNotice('Defaults restored in the editor. Save to apply them.')
  }

  const handleAdminProjectChange = (projectId) => {
    setSelectedAdminProjectId(projectId)
    setAdminNotice('')
  }

  const userHeaderActions = (
    <>
      <div className="session-meta">
        <span className="badge badge--accent">User</span>
        <p className="t-small">{sessionView.displayName || 'Valtria user'}</p>
      </div>
      <button type="button" className="btn btn-ghost" onClick={handleLogout}>
        Sign out
      </button>
    </>
  )

  if (!isAuthReady) {
    return (
      <AuthScreen
        onPasswordLogin={handlePasswordLogin}
        onMagicLinkLogin={handleMagicLinkLogin}
        isSubmitting={Boolean(authAction)}
        activeAction={authAction}
        errorMessage={authMessage}
        isInitializing
      />
    )
  }

  if (!sessionView.isAuthenticated) {
    return (
      <AuthScreen
        onPasswordLogin={handlePasswordLogin}
        onMagicLinkLogin={handleMagicLinkLogin}
        isSubmitting={Boolean(authAction)}
        activeAction={authAction}
        errorMessage={authMessage}
      />
    )
  }

  if (sessionView.role === 'admin') {
    return (
      <AdminConsole
        user={user}
        config={adminDraft}
        options={OPTIONS}
        previewPrompt={adminPreviewPrompt}
        showPreview={showAdminPreview}
        notice={adminNotice}
        projects={adminProjects}
        selectedProjectId={selectedAdminProjectId}
        renderHistory={renderHistory}
        projectCostTotal={projectCostTotal}
        isLoadingProjects={isLoadingAdminProjects}
        isLoadingHistory={isLoadingAdminHistory}
        isSaving={isSavingAdmin}
        onProjectChange={handleAdminProjectChange}
        onGenerationChange={(key, value) => {
          setAdminDraft((previous) => ({
            ...previous,
            generation: {
              ...previous.generation,
              [key]: value,
            },
          }))
          setAdminNotice('')
        }}
        onLimitChange={(key, value) => {
          const parsed =
            key === 'budgetLimitUsd'
              ? Number.parseFloat(value)
              : Number.parseInt(value, 10)

          if (!Number.isFinite(parsed)) {
            return
          }

          setAdminDraft((previous) => ({
            ...previous,
            limits: {
              ...previous.limits,
              [key]: parsed,
            },
          }))
          setAdminNotice('')
        }}
        onPromptDefaultsChange={(key, value) => {
          setAdminDraft((previous) => ({
            ...previous,
            promptDefaults: {
              ...previous.promptDefaults,
              [key]: value,
            },
          }))
          setAdminNotice('')
        }}
        onPaletteChange={(key, hex) => {
          setAdminDraft((previous) => ({
            ...previous,
            palette: {
              ...previous.palette,
              [key]: {
                ...previous.palette[key],
                hex,
              },
            },
          }))
          setAdminNotice('')
        }}
        onSave={handleSaveAdmin}
        onReset={handleResetAdmin}
        onTogglePreview={() => setShowAdminPreview((previous) => !previous)}
        onLogout={handleLogout}
      />
    )
  }

  return (
    <WizardLayout
      steps={USER_STEPS}
      activeStep={activeStep}
      onStepClick={scrollToStep}
      headerEyebrow="User workspace"
      headerTitle="Generate a Valtria render"
      headerSubtitle="A shortened guided brief for cleanroom renders. The technical guardrails stay under admin control."
      headerActions={userHeaderActions}
    >
      <StepCard
        stepRef={registerStepRef('project')}
        stepId="project"
        stepNumber={1}
        title="Project basics"
        whatThisAffects={USER_STEPS[0].help}
        isCurrent={activeStep === 'project'}
        isCompleted={getCompletedStep(activeStep, 'project')}
        onFocusStep={setActiveStep}
      >
        <div className="step-block">
          <p className="t-section">Cleanroom presets</p>
          <PresetStrip
            presets={PRESETS}
            fields={fields}
            onApplyPreset={(preset) =>
              setFields((previous) => ({ ...previous, ...preset.overrides }))
            }
          />
        </div>

        <FieldControl
          id="project_name"
          label="Project name"
          type="text"
          value={fields.project_name}
          onChange={(value) =>
            setFields((previous) => ({ ...previous, project_name: value }))
          }
          placeholder="Example: Edwards Lifescience 305"
        />
        <FieldControl
          id="project_company"
          label="Company"
          type="text"
          value={projectCompany}
          onChange={setProjectCompany}
          placeholder="Example: Valtria"
          hint={projectCompanyHint}
        />
        <FieldControl
          id="room_type"
          label="Room type"
          value={fields.room_type}
          options={OPTIONS.room_type}
          onChange={(value) =>
            setFields((previous) => ({ ...previous, room_type: value }))
          }
        />
        <FieldControl
          id="output_use"
          label="Output use"
          value={fields.output_use}
          options={OPTIONS.output_use}
          onChange={(value) =>
            setFields((previous) => ({ ...previous, output_use: value }))
          }
        />
      </StepCard>

      <StepCard
        stepRef={registerStepRef('render')}
        stepId="render"
        stepNumber={2}
        title="Render style and camera"
        whatThisAffects={USER_STEPS[1].help}
        isCurrent={activeStep === 'render'}
        isCompleted={getCompletedStep(activeStep, 'render')}
        onFocusStep={setActiveStep}
      >
        <FieldControl
          id="visual_style"
          label="Visual style"
          value={fields.visual_style}
          options={OPTIONS.visual_style}
          onChange={(value) =>
            setFields((previous) => ({ ...previous, visual_style: value }))
          }
        />
        <FieldControl
          id="mood"
          label="Mood"
          value={fields.mood}
          options={OPTIONS.mood}
          onChange={(value) =>
            setFields((previous) => ({ ...previous, mood: value }))
          }
        />
        <FieldControl
          id="camera"
          label="Camera angle"
          value={fields.camera}
          options={OPTIONS.camera}
          onChange={(value) =>
            setFields((previous) => ({ ...previous, camera: value }))
          }
        />
        <FieldControl
          id="framing"
          label="Framing"
          value={fields.framing}
          options={OPTIONS.framing}
          onChange={(value) =>
            setFields((previous) => ({ ...previous, framing: value }))
          }
        />
        <FieldControl
          id="aspect"
          label="Aspect ratio"
          value={fields.aspect}
          options={OPTIONS.aspect}
          onChange={(value) =>
            setFields((previous) => ({ ...previous, aspect: value }))
          }
        />
      </StepCard>

      <StepCard
        stepRef={registerStepRef('materials')}
        stepId="materials"
        stepNumber={3}
        title="Material setup"
        whatThisAffects={USER_STEPS[2].help}
        isCurrent={activeStep === 'materials'}
        isCompleted={getCompletedStep(activeStep, 'materials')}
        onFocusStep={setActiveStep}
      >
        <FieldControl
          id="duct_mat"
          label="HVAC duct material"
          value={fields.duct_mat}
          options={OPTIONS.duct_mat}
          onChange={(value) =>
            setFields((previous) => ({ ...previous, duct_mat: value }))
          }
        />
        <FieldControl
          id="equip_casing"
          label="Equipment casing"
          value={fields.equip_casing}
          options={OPTIONS.equip_casing}
          onChange={(value) =>
            setFields((previous) => ({ ...previous, equip_casing: value }))
          }
        />
        <FieldControl
          id="floor_mat"
          label="Floor material"
          value={fields.floor_mat}
          options={OPTIONS.floor_mat}
          onChange={(value) =>
            setFields((previous) => ({ ...previous, floor_mat: value }))
          }
        />
      </StepCard>

      <StepCard
        stepRef={registerStepRef('reference')}
        stepId="reference"
        stepNumber={4}
        title="Reference image"
        whatThisAffects={USER_STEPS[3].help}
        isCurrent={activeStep === 'reference'}
        isCompleted={getCompletedStep(activeStep, 'reference')}
        onFocusStep={setActiveStep}
      >
        <ReferenceImageInput
          referenceImage={referenceImage}
          onChange={setReferenceImage}
          readReferenceFile={readReferenceFile}
        />
      </StepCard>

      <StepCard
        stepRef={registerStepRef('generate')}
        stepId="generate"
        stepNumber={5}
        title="Final detail and generate"
        whatThisAffects={USER_STEPS[4].help}
        isCurrent={activeStep === 'generate'}
        isCompleted={false}
        onFocusStep={setActiveStep}
      >
        <FieldControl
          id="extra_detail"
          label="Do you want to add any extra detail?"
          type="textarea"
          value={fields.extra_detail}
          rows={4}
          onChange={(value) =>
            setFields((previous) => ({ ...previous, extra_detail: value }))
          }
          placeholder="Example: keep the room envelope ultra-clean and add subtle ceiling coves."
          hint={`Optional. Current prompt budget: ${promptTokenEstimate} / ${maxPromptTokens} approximate tokens.`}
        />
        <ImageResultPanel
          isGenerating={isGenerating}
          error={generationError}
          imageResult={imageResult}
          projectName={fields.project_name}
          onGenerate={handleGenerateImage}
          tokenEstimate={promptTokenEstimate}
          maxPromptTokens={maxPromptTokens}
          attemptCount={attemptCount}
          maxAttempts={maxAttempts}
          blockReason={generationBlockReason}
          recentRenders={recentRenders}
        />
      </StepCard>
    </WizardLayout>
  )
}

export default App
