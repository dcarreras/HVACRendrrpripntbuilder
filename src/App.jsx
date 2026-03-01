import { useEffect, useMemo, useState } from 'react'
import { Icon } from '@iconify/react'
import { AdminConsole } from './components/AdminConsole'
import { AuthScreen } from './components/AuthScreen'
import { FieldControl } from './components/FieldControl'
import { GenerationProgressModal } from './components/GenerationProgressModal'
import { GenerateConfirmModal } from './components/GenerateConfirmModal'
import { ImageResultPanel } from './components/ImageResultPanel'
import { PresetStrip } from './components/PresetStrip'
import { ReferenceImageInput } from './components/ReferenceImageInput'
import { UserGalleryPage } from './components/UserGalleryPage'
import { WizardLayout } from './components/WizardLayout'
import { DEFAULT_ADMIN_CONFIG, DEFAULT_FIELDS } from './data/defaults'
import { OPTIONS } from './data/options'
import { PRESETS } from './data/presets'
import {
  buildGenerationRequest,
  generateImageRequest,
  saveRenderRequest,
} from './lib/imageClient'
import {
  clearManagedUserGallery,
  createManagedUser,
  deleteManagedUser,
  listManagedUsers,
  updateManagedUser,
} from './lib/adminApi'
import { buildPrompt, estimatePromptTokens } from './lib/promptBuilder'
import { readFileAsReferenceImage } from './lib/referenceImage'
import { supabase } from './lib/supabaseClient'
import {
  arrowLeftIcon,
  arrowRightIcon,
  checkIcon,
  createIcon,
  galleryIcon,
  resultIcon,
  settingsIcon,
  uploadIcon,
} from './lib/uiIcons'
import {
  ensureProject,
  getProjectConfig,
  getRenders,
  listProjects,
  loadAttemptCount,
  mergeAdminConfig,
  saveAttemptCount,
  saveProjectConfig,
} from './lib/storage'

const USER_VIEWS = {
  create: 'create',
  gallery: 'gallery',
}

const CREATE_STEPS = [
  {
    id: 'upload',
    title: 'Image',
    icon: uploadIcon,
    headerTitle: 'Step 1. Upload image',
    headerSubtitle: 'Add the image you want to transform into a render.',
  },
  {
    id: 'configure',
    title: 'Setup',
    icon: settingsIcon,
    headerTitle: 'Step 2. Configure',
    headerSubtitle: 'Fill in only the details needed for this render.',
  },
  {
    id: 'confirm',
    title: 'Confirm',
    icon: checkIcon,
    headerTitle: 'Step 3. Confirm',
    headerSubtitle: 'Check the summary and approve the render.',
  },
  {
    id: 'result',
    title: 'Result',
    icon: resultIcon,
    headerTitle: 'Step 4. Review result',
    headerSubtitle: 'Check the result and decide if you want another version.',
  },
]

const CREATE_STEP_IDS = {
  upload: CREATE_STEPS[0].id,
  configure: CREATE_STEPS[1].id,
  confirm: CREATE_STEPS[2].id,
  result: CREATE_STEPS[3].id,
}

const ESTIMATED_RENDER_COST_USD = 0.04
const DEFAULT_MANAGED_USER_DRAFT = {
  role: 'user',
  password: '',
}
const DEFAULT_NEW_USER_DRAFT = {
  email: '',
  password: '',
  role: 'user',
}

const DEFAULT_DATA_API = {
  ensureProject,
  getProjectConfig,
  saveProjectConfig,
  getRenders,
  listProjects,
  loadAttemptCount,
  saveAttemptCount,
}

const DEFAULT_ADMIN_API = {
  listManagedUsers,
  createManagedUser,
  updateManagedUser,
  clearManagedUserGallery,
  deleteManagedUser,
}

function getDefaultAttemptStorage() {
  if (typeof window === 'undefined') {
    return undefined
  }

  return window.sessionStorage
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

function createRenderSaveKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getEstimatedRenderTimeLabel({ hasReferenceImage, quality }) {
  const ranges = {
    low: hasReferenceImage ? [20, 35] : [15, 28],
    medium: hasReferenceImage ? [30, 50] : [20, 40],
    high: hasReferenceImage ? [40, 70] : [30, 55],
  }
  const [minimum, maximum] = ranges[quality] || ranges.medium

  return `${minimum}-${maximum} seconds`
}

function isAdminUser(user) {
  return (
    user?.app_metadata?.role === 'admin' ||
    user?.user_metadata?.role === 'admin'
  )
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
  const canAccessAdmin = isAdminUser(user)

  if (!user) {
    return {
      role: null,
      canAccessAdmin: false,
      isAuthenticated: false,
      displayName: '',
      email: '',
    }
  }

  return {
    role: canAccessAdmin ? 'admin' : 'user',
    canAccessAdmin,
    isAuthenticated: true,
    displayName: getUserLabel(user),
    email: user.email || '',
  }
}

function getCreateStepIndex(stepId) {
  const index = CREATE_STEPS.findIndex((step) => step.id === stepId)

  return index >= 0 ? index : 0
}

function createManagedUserDraft() {
  return {
    ...DEFAULT_MANAGED_USER_DRAFT,
  }
}

function createNewUserDraft() {
  return {
    ...DEFAULT_NEW_USER_DRAFT,
  }
}

function getPreferredManagedUserId(users, previousId, currentAdminId) {
  if (previousId && users.some((account) => account.id === previousId)) {
    return previousId
  }

  const firstNonCurrent = users.find((account) => account.id !== currentAdminId)

  return firstNonCurrent?.id || users[0]?.id || ''
}

function App({
  supabaseClient = supabase,
  dataApi = DEFAULT_DATA_API,
  adminApi = DEFAULT_ADMIN_API,
  generateImage = generateImageRequest,
  saveRender = saveRenderRequest,
  readReferenceFile = readFileAsReferenceImage,
  attemptStorage = getDefaultAttemptStorage(),
}) {
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [authSession, setAuthSession] = useState(null)
  const [authMessage, setAuthMessage] = useState('')
  const [authAction, setAuthAction] = useState('')
  const [selectedAccessRole, setSelectedAccessRole] = useState('user')
  const [hasSelectedAccessRole, setHasSelectedAccessRole] = useState(false)
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
  const [adminUsers, setAdminUsers] = useState([])
  const [selectedAdminUserId, setSelectedAdminUserId] = useState('')
  const [isLoadingAdminUsers, setIsLoadingAdminUsers] = useState(false)
  const [isMutatingAdminUsers, setIsMutatingAdminUsers] = useState(false)
  const [managedUserDraft, setManagedUserDraft] = useState(() =>
    createManagedUserDraft(),
  )
  const [newUserDraft, setNewUserDraft] = useState(() => createNewUserDraft())
  const [isSavingToGallery, setIsSavingToGallery] = useState(false)
  const [saveToGalleryMessage, setSaveToGalleryMessage] = useState('')
  const [referenceImage, setReferenceImage] = useState(null)
  const [imageResult, setImageResult] = useState(null)
  const [recentRenders, setRecentRenders] = useState([])
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const [userView, setUserView] = useState(USER_VIEWS.create)
  const [createStep, setCreateStep] = useState(CREATE_STEP_IDS.upload)
  const [adminProjects, setAdminProjects] = useState([])
  const [selectedAdminProjectId, setSelectedAdminProjectId] = useState('')
  const [isLoadingAdminProjects, setIsLoadingAdminProjects] = useState(false)
  const [isLoadingAdminConfig, setIsLoadingAdminConfig] = useState(false)
  const [isSavingAdmin, setIsSavingAdmin] = useState(false)

  const user = authSession?.user || null
  const userId = user?.id || ''
  const baseSessionView = useMemo(() => createSessionView(user), [user])
  const sessionView = useMemo(() => {
    if (!baseSessionView.isAuthenticated) {
      return baseSessionView
    }

    if (!baseSessionView.canAccessAdmin) {
      return {
        ...baseSessionView,
        role: 'user',
      }
    }

    return {
      ...baseSessionView,
      role: hasSelectedAccessRole
        ? selectedAccessRole === 'admin'
          ? 'admin'
          : 'user'
        : 'admin',
    }
  }, [baseSessionView, hasSelectedAccessRole, selectedAccessRole])
  const isAdminWorkspace = sessionView.role === 'admin'
  const authAccessToken = authSession?.access_token || ''
  const createStepIndex = getCreateStepIndex(createStep)
  const activeCreateStep = CREATE_STEPS[createStepIndex]

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
    ? 'The optional note is too long for the current render settings. Shorten it and try again.'
    : isAttemptLimitReached
      ? 'You have reached the render limit for this browser session.'
      : ''
  const recentSpendUsd = useMemo(
    () =>
      recentRenders.reduce((total, render) => {
        const cost = Number.parseFloat(render.cost_usd)
        return total + (Number.isFinite(cost) ? cost : 0)
      }, 0),
    [recentRenders],
  )
  const lastRenderAt = recentRenders[0]?.created_at || ''
  const estimatedTimeLabel = useMemo(
    () =>
      getEstimatedRenderTimeLabel({
        hasReferenceImage: Boolean(referenceImage),
        quality: savedAdminConfig.generation.quality,
      }),
    [referenceImage, savedAdminConfig.generation.quality],
  )
  const projectCompanyHint = projectLoadError
    ? projectLoadError
    : isUserProjectLoading
      ? 'Loading project settings from Supabase.'
      : 'We save this with the project so your gallery and settings stay linked.'
  const canContinueFromUpload = Boolean(referenceImage)
  const canContinueFromConfigure = Boolean(
    fields.project_name.trim() && projectCompany.trim(),
  )

  const resetUserWorkspace = () => {
    setFields(cloneDefaults())
    setProjectCompany('')
    setUserProjectId('')
    setProjectLoadError('')
    setReferenceImage(null)
    setImageResult(null)
    setRecentRenders([])
    setIsSavingToGallery(false)
    setSaveToGalleryMessage('')
    setIsConfirmOpen(false)
    setGenerationError('')
    setIsGenerating(false)
    setUserView(USER_VIEWS.create)
    setCreateStep(CREATE_STEP_IDS.upload)
    setSavedAdminConfig(mergeAdminConfig(DEFAULT_ADMIN_CONFIG))
  }

  const goToCreateStep = (stepId) => {
    setUserView(USER_VIEWS.create)
    setCreateStep(stepId)
  }

  const goToNextCreateStep = () => {
    const nextStep = CREATE_STEPS[createStepIndex + 1]

    if (nextStep) {
      goToCreateStep(nextStep.id)
    }
  }

  const goToPreviousCreateStep = () => {
    const previousStep = CREATE_STEPS[createStepIndex - 1]

    if (previousStep) {
      goToCreateStep(previousStep.id)
    }
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
    if (!userId || isAdminWorkspace) {
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
    isAdminWorkspace,
    dataApi,
    fields.project_name,
    projectCompany,
    userId,
  ])

  useEffect(() => {
    if (!userId || isAdminWorkspace) {
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
  }, [dataApi, isAdminWorkspace, userId])

  useEffect(() => {
    if (!userId || !isAdminWorkspace) {
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
  }, [dataApi, isAdminWorkspace, userId])

  useEffect(() => {
    if (!userId || !isAdminWorkspace || !selectedAdminProjectId) {
      setAdminDraft(mergeAdminConfig(DEFAULT_ADMIN_CONFIG))
      return undefined
    }

    let isCurrent = true

    async function loadAdminConfig() {
      setIsLoadingAdminConfig(true)
      setAdminNotice('')

      try {
        const config = await dataApi.getProjectConfig(selectedAdminProjectId)

        if (!isCurrent) {
          return
        }

        setAdminDraft(config)
      } catch (error) {
        if (!isCurrent) {
          return
        }

        setAdminNotice(getErrorMessage(error))
      } finally {
        if (isCurrent) {
          setIsLoadingAdminConfig(false)
        }
      }
    }

    loadAdminConfig()

    return () => {
      isCurrent = false
    }
  }, [dataApi, isAdminWorkspace, selectedAdminProjectId, userId])

  useEffect(() => {
    if (!userId || !isAdminWorkspace || !authAccessToken) {
      setAdminUsers([])
      setSelectedAdminUserId('')
      setManagedUserDraft(createManagedUserDraft())
      return undefined
    }

    let isCurrent = true

    async function loadManagedUsers() {
      setIsLoadingAdminUsers(true)

      try {
        const users = await adminApi.listManagedUsers(authAccessToken)
        if (!isCurrent) {
          return
        }

        setAdminUsers(users)
        setSelectedAdminUserId((previous) =>
          getPreferredManagedUserId(users, previous, userId),
        )
      } catch (error) {
        if (!isCurrent) {
          return
        }

        setAdminNotice(getErrorMessage(error))
      } finally {
        if (isCurrent) {
          setIsLoadingAdminUsers(false)
        }
      }
    }

    loadManagedUsers()

    return () => {
      isCurrent = false
    }
  }, [adminApi, authAccessToken, isAdminWorkspace, userId])

  useEffect(() => {
    const selectedUser = adminUsers.find((account) => account.id === selectedAdminUserId)

    if (!selectedUser) {
      setManagedUserDraft(createManagedUserDraft())
      return
    }

    setManagedUserDraft({
      role: selectedUser.role || 'user',
      password: '',
    })
  }, [adminUsers, selectedAdminUserId])

  const handlePasswordLogin = async ({ email, password, role = 'user' }) => {
    setSelectedAccessRole(role === 'admin' ? 'admin' : 'user')
    setHasSelectedAccessRole(true)
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

  const handleMagicLinkLogin = async ({ email, role = 'user' }) => {
    setSelectedAccessRole(role === 'admin' ? 'admin' : 'user')
    setHasSelectedAccessRole(true)
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
    setAdminUsers([])
    setAdminNotice('')
    setSelectedAdminProjectId('')
    setSelectedAdminUserId('')
    setManagedUserDraft(createManagedUserDraft())
    setNewUserDraft(createNewUserDraft())
    setShowAdminPreview(false)
    resetUserWorkspace()
  }

  const openAdminWorkspace = () => {
    setSelectedAccessRole('admin')
    setHasSelectedAccessRole(true)
    setAuthMessage('')
  }

  const openUserWorkspace = () => {
    setSelectedAccessRole('user')
    setHasSelectedAccessRole(true)
    setAuthMessage('')
  }

  const refreshManagedUsers = async (preferredUserId = selectedAdminUserId) => {
    const users = await adminApi.listManagedUsers(authAccessToken)

    setAdminUsers(users)
    setSelectedAdminUserId(
      getPreferredManagedUserId(users, preferredUserId, userId),
    )

    return users
  }

  const handleOpenGenerateConfirm = () => {
    goToCreateStep(CREATE_STEP_IDS.confirm)

    if (generationBlockReason) {
      setGenerationError(generationBlockReason)
      return
    }

    if (!referenceImage) {
      setGenerationError('Add an image before continuing.')
      goToCreateStep(CREATE_STEP_IDS.upload)
      return
    }

    if (!fields.project_name.trim() || !projectCompany.trim()) {
      setGenerationError('Add the project name and company before generating.')
      goToCreateStep(CREATE_STEP_IDS.configure)
      return
    }

    setGenerationError('')
    setIsConfirmOpen(true)
  }

  const handleCloseGenerateConfirm = () => {
    if (isGenerating) {
      return
    }

    setIsConfirmOpen(false)
  }

  const handleGenerateImage = async () => {
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

    if (!referenceImage) {
      setGenerationError('A reference image is required before generating.')
      setIsConfirmOpen(false)
      goToCreateStep(CREATE_STEP_IDS.upload)
      return
    }

    const projectName = fields.project_name.trim()
    const company = projectCompany.trim()

    if (!projectName || !company) {
      setGenerationError('Project name and company are required before generating.')
      return
    }

    setGenerationError('')
    setSaveToGalleryMessage('')
    setIsConfirmOpen(false)
    setIsGenerating(true)

    const nextAttemptCount = attemptCount + 1
    setAttemptCount(nextAttemptCount)
    dataApi.saveAttemptCount?.(attemptStorage, nextAttemptCount)

    let activeProjectId = userProjectId
    let activeConfig = savedAdminConfig
    let activePrompt = prompt
    const saveKey = createRenderSaveKey()

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
        saveKey,
      })
      const result = await generateImage(request, authAccessToken)
      setImageResult({
        ...result,
        saveKey: result.saveKey || saveKey,
        promptUsed: activePrompt,
        projectId: activeProjectId,
        systemType: fields.room_type,
        isSavedToGallery: Boolean(result.renderId || result.storagePath),
      })
      setCreateStep(CREATE_STEP_IDS.result)
    } catch (error) {
      setGenerationError(getErrorMessage(error))
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveToGallery = async () => {
    if (!imageResult?.imageDataUrl) {
      setGenerationError('Generate an image before saving it to the gallery.')
      return
    }

    if (!authAccessToken) {
      setGenerationError('The Supabase session is missing a valid access token.')
      return
    }

    if (!imageResult?.projectId || !imageResult?.saveKey) {
      setGenerationError('This render is missing the data required to save it.')
      return
    }

    if (imageResult.isSavedToGallery) {
      setSaveToGalleryMessage('This render is already saved in your gallery.')
      return
    }

    setIsSavingToGallery(true)
    setSaveToGalleryMessage('')
    setGenerationError('')

    try {
      const saveResult = await saveRender(
        {
          imageDataUrl: imageResult.imageDataUrl,
          projectId: imageResult.projectId,
          systemType: imageResult.systemType,
          prompt: imageResult.promptUsed || prompt,
          saveKey: imageResult.saveKey,
        },
        authAccessToken,
      )

      setImageResult((previous) =>
        previous
          ? {
              ...previous,
              isSavedToGallery: true,
              renderId: saveResult.renderId || previous.renderId,
              storagePath: saveResult.storagePath || previous.storagePath,
            }
          : previous,
      )

      const latestRenders = await dataApi.getRenders({
        userId,
      })
      setRecentRenders(latestRenders)
      setSaveToGalleryMessage(saveResult.message || 'Saved to your gallery.')
    } catch (error) {
      setGenerationError(getErrorMessage(error))
    } finally {
      setIsSavingToGallery(false)
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

  const handleCreateManagedUser = async () => {
    if (!authAccessToken) {
      setAdminNotice('The admin session has expired. Sign in again.')
      return
    }

    setIsMutatingAdminUsers(true)
    setAdminNotice('')

    const nextEmail = newUserDraft.email.trim()

    try {
      const result = await adminApi.createManagedUser(
        {
          email: nextEmail,
          password: newUserDraft.password,
          role: newUserDraft.role,
        },
        authAccessToken,
      )

      const users = await refreshManagedUsers()
      const createdUser = users.find((account) => account.email === nextEmail)

      if (createdUser) {
        setSelectedAdminUserId(createdUser.id)
      }

      setNewUserDraft(createNewUserDraft())
      setAdminNotice(result.message)
    } catch (error) {
      setAdminNotice(getErrorMessage(error))
    } finally {
      setIsMutatingAdminUsers(false)
    }
  }

  const handleSaveManagedUser = async () => {
    if (!authAccessToken) {
      setAdminNotice('The admin session has expired. Sign in again.')
      return
    }

    if (!selectedAdminUserId) {
      setAdminNotice('Select a user before updating access.')
      return
    }

    setIsMutatingAdminUsers(true)
    setAdminNotice('')

    try {
      const result = await adminApi.updateManagedUser(
        {
          userId: selectedAdminUserId,
          password: managedUserDraft.password,
          role: managedUserDraft.role,
        },
        authAccessToken,
      )

      await refreshManagedUsers(selectedAdminUserId)
      setAdminNotice(result.message)
    } catch (error) {
      setAdminNotice(getErrorMessage(error))
    } finally {
      setIsMutatingAdminUsers(false)
    }
  }

  const handleClearManagedUserGallery = async () => {
    if (!authAccessToken) {
      setAdminNotice('The admin session has expired. Sign in again.')
      return
    }

    if (!selectedAdminUserId) {
      setAdminNotice('Select a user before clearing the gallery.')
      return
    }

    setIsMutatingAdminUsers(true)
    setAdminNotice('')

    try {
      const result = await adminApi.clearManagedUserGallery(
        {
          userId: selectedAdminUserId,
        },
        authAccessToken,
      )

      await refreshManagedUsers(selectedAdminUserId)
      setAdminNotice(result.message)
    } catch (error) {
      setAdminNotice(getErrorMessage(error))
    } finally {
      setIsMutatingAdminUsers(false)
    }
  }

  const handleDeleteManagedUser = async () => {
    if (!authAccessToken) {
      setAdminNotice('The admin session has expired. Sign in again.')
      return
    }

    if (!selectedAdminUserId) {
      setAdminNotice('Select a user before deleting the account.')
      return
    }

    if (selectedAdminUserId === userId) {
      setAdminNotice('You cannot delete the active admin account.')
      return
    }

    const deletedUserId = selectedAdminUserId

    setIsMutatingAdminUsers(true)
    setAdminNotice('')

    try {
      const result = await adminApi.deleteManagedUser(
        {
          userId: deletedUserId,
        },
        authAccessToken,
      )

      await refreshManagedUsers('')
      setAdminNotice(result.message)
    } catch (error) {
      setAdminNotice(getErrorMessage(error))
    } finally {
      setIsMutatingAdminUsers(false)
    }
  }

  const userWorkspaceMeta =
    userView === USER_VIEWS.gallery
      ? {
          title: 'My gallery',
          subtitle: 'See your saved images and recent usage in one place.',
        }
      : {
          title: activeCreateStep.headerTitle,
          subtitle: activeCreateStep.headerSubtitle,
        }

  const userHeaderActions = (
    <>
      <div className="workspace-nav" role="navigation" aria-label="User workspace">
        <button
          type="button"
          className={`workspace-nav__button ${
            userView === USER_VIEWS.create ? 'is-active' : ''
          }`.trim()}
          onClick={() => setUserView(USER_VIEWS.create)}
        >
          <Icon icon={createIcon} width="16" height="16" aria-hidden="true" />
          Create
        </button>
        <button
          type="button"
          className={`workspace-nav__button ${
            userView === USER_VIEWS.gallery ? 'is-active' : ''
          }`.trim()}
          onClick={() => setUserView(USER_VIEWS.gallery)}
        >
          <Icon icon={galleryIcon} width="16" height="16" aria-hidden="true" />
          My gallery
        </button>
        {sessionView.canAccessAdmin ? (
          <button
            type="button"
            className="workspace-nav__button"
            onClick={openAdminWorkspace}
          >
            Admin console
          </button>
        ) : null}
      </div>
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
        preferredRole={selectedAccessRole}
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
        preferredRole={selectedAccessRole}
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
        isLoadingProjects={isLoadingAdminProjects}
        isLoadingConfig={isLoadingAdminConfig}
        isSavingConfig={isSavingAdmin}
        managedUsers={adminUsers}
        selectedUserId={selectedAdminUserId}
        isLoadingUsers={isLoadingAdminUsers}
        isMutatingUsers={isMutatingAdminUsers}
        managedUserDraft={managedUserDraft}
        newUserDraft={newUserDraft}
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
        onSelectUser={setSelectedAdminUserId}
        onManagedUserDraftChange={(key, value) => {
          setManagedUserDraft((previous) => ({
            ...previous,
            [key]: value,
          }))
          setAdminNotice('')
        }}
        onNewUserDraftChange={(key, value) => {
          setNewUserDraft((previous) => ({
            ...previous,
            [key]: value,
          }))
          setAdminNotice('')
        }}
        onCreateUser={handleCreateManagedUser}
        onSaveUser={handleSaveManagedUser}
        onClearUserGallery={handleClearManagedUserGallery}
        onDeleteUser={handleDeleteManagedUser}
        onOpenUserWorkspace={openUserWorkspace}
        onLogout={handleLogout}
      />
    )
  }

  return (
    <WizardLayout
      steps={[]}
      activeStep=""
      onStepClick={() => {}}
      headerEyebrow="User workspace"
      headerTitle={userWorkspaceMeta.title}
      headerSubtitle={userWorkspaceMeta.subtitle}
      headerActions={userHeaderActions}
    >
      {userView === USER_VIEWS.gallery ? (
        <UserGalleryPage
          recentRenders={recentRenders}
          projectName={fields.project_name}
          recentSpendUsd={recentSpendUsd}
          lastRenderAt={lastRenderAt}
          onCreateNew={() => goToCreateStep(CREATE_STEP_IDS.upload)}
        />
      ) : (
        <div className="workspace-stack">
          <nav className="step-flow" aria-label="Create render steps">
            {CREATE_STEPS.map((step, index) => {
              const isActive = step.id === createStep
              const isCompleted = index < createStepIndex
              const stepClassName = [
                'step-flow__button',
                isActive ? 'is-active' : '',
                isCompleted ? 'is-complete' : '',
              ]
                .filter(Boolean)
                .join(' ')

              return (
                <button
                  key={step.id}
                  type="button"
                  className={stepClassName}
                  onClick={() => goToCreateStep(step.id)}
                  aria-label={`Step ${index + 1}: ${step.title}`}
                  title={`Step ${index + 1}: ${step.title}`}
                >
                  <span className="step-flow__icon" aria-hidden="true">
                    <Icon icon={step.icon} width="18" height="18" />
                  </span>
                  <span className="step-flow__count" aria-hidden="true">
                    {index + 1}
                  </span>
                </button>
              )
            })}
          </nav>

          <section className="card card--hvac workspace-section step-page">
            <div className="card__body">
              {createStep === CREATE_STEP_IDS.upload ? (
                <>
                  <h2 className="t-title page-step-title">Upload image</h2>
                  <p className="section-intro t-small">
                    Start with one reference image.
                  </p>
                  <ReferenceImageInput
                    referenceImage={referenceImage}
                    onChange={setReferenceImage}
                    readReferenceFile={readReferenceFile}
                  />
                  <div className="step-page__actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setUserView(USER_VIEWS.gallery)}
                    >
                      <Icon icon={galleryIcon} width="16" height="16" aria-hidden="true" />
                      Open gallery
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={goToNextCreateStep}
                      disabled={!canContinueFromUpload}
                    >
                      <Icon icon={arrowRightIcon} width="16" height="16" aria-hidden="true" />
                      Continue
                    </button>
                  </div>
                </>
              ) : null}

              {createStep === CREATE_STEP_IDS.configure ? (
                <>
                  <h2 className="t-title page-step-title">Project details</h2>
                  <p className="section-intro t-small">
                    Choose a preset and add the basics.
                  </p>

                  <div className="step-block">
                    <p className="t-section">Style</p>
                    <PresetStrip
                      presets={PRESETS}
                      fields={fields}
                      onApplyPreset={(preset) =>
                        setFields((previous) => ({ ...previous, ...preset.overrides }))
                      }
                    />
                  </div>

                  <div className="form-grid form-grid--compact">
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
                  </div>

                  <div className="form-grid">
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
                      label="Image purpose"
                      value={fields.output_use}
                      options={OPTIONS.output_use}
                      onChange={(value) =>
                        setFields((previous) => ({ ...previous, output_use: value }))
                      }
                    />
                  </div>

                  <FieldControl
                    id="extra_detail"
                    label="Simple note (optional)"
                    type="textarea"
                    value={fields.extra_detail}
                    rows={3}
                    onChange={(value) =>
                      setFields((previous) => ({ ...previous, extra_detail: value }))
                    }
                    placeholder="Example: bright, clean, and easy to read."
                    hint="Use one short sentence if needed."
                  />

                  <details className="advanced-drawer">
                    <summary>More options</summary>
                    <div className="advanced-drawer__content">
                      <div className="form-grid">
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
                      </div>

                      <div className="form-grid">
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
                      </div>
                    </div>
                  </details>

                  <div className="step-page__actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={goToPreviousCreateStep}
                    >
                      <Icon icon={arrowLeftIcon} width="16" height="16" aria-hidden="true" />
                      Back
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={goToNextCreateStep}
                      disabled={!canContinueFromConfigure}
                    >
                      <Icon icon={arrowRightIcon} width="16" height="16" aria-hidden="true" />
                      Continue
                    </button>
                  </div>
                </>
              ) : null}

              {createStep === CREATE_STEP_IDS.confirm ? (
                <>
                  <h2 className="t-title page-step-title">Confirm render</h2>
                  <p className="section-intro t-small">
                    Check the summary, then confirm.
                  </p>

                  <div className="page-summary">
                    <article className="page-summary__item">
                      <span className="t-label">Project</span>
                      <strong>{fields.project_name || 'Add the project name'}</strong>
                    </article>
                    <article className="page-summary__item">
                      <span className="t-label">Company</span>
                      <strong>{projectCompany || 'Add the company name'}</strong>
                    </article>
                    <article className="page-summary__item">
                      <span className="t-label">System</span>
                      <strong>{fields.room_type}</strong>
                    </article>
                    <article className="page-summary__item">
                      <span className="t-label">Image</span>
                      <strong>{referenceImage ? 'Ready' : 'Missing'}</strong>
                    </article>
                  </div>

                  <div className="render-estimate">
                    <article className="render-estimate__item">
                      <span className="t-label">Cost</span>
                      <strong>${ESTIMATED_RENDER_COST_USD.toFixed(2)}</strong>
                    </article>
                    <article className="render-estimate__item">
                      <span className="t-label">Time</span>
                      <strong>{estimatedTimeLabel}</strong>
                    </article>
                  </div>

                  {generationError ? (
                    <p className="image-panel__error">{generationError}</p>
                  ) : null}

                  <div className="step-page__actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={goToPreviousCreateStep}
                    >
                      <Icon icon={arrowLeftIcon} width="16" height="16" aria-hidden="true" />
                      Back
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleOpenGenerateConfirm}
                      disabled={
                        Boolean(generationBlockReason) ||
                        !referenceImage ||
                        !canContinueFromConfigure
                      }
                    >
                      <Icon icon={checkIcon} width="16" height="16" aria-hidden="true" />
                      Open confirmation
                    </button>
                  </div>
                </>
              ) : null}

              {createStep === CREATE_STEP_IDS.result ? (
                <>
                  <h2 className="t-title page-step-title">Review result</h2>
                  <p className="section-intro t-small">
                    Keep it, adjust something, or repeat the render.
                  </p>
                  <ImageResultPanel
                    isGenerating={isGenerating}
                    error={generationError}
                    imageResult={imageResult}
                    projectName={fields.project_name}
                    onGenerate={() => goToCreateStep(CREATE_STEP_IDS.confirm)}
                    onAdjust={() => goToCreateStep(CREATE_STEP_IDS.configure)}
                    onSaveToGallery={handleSaveToGallery}
                    onOpenGallery={() => setUserView(USER_VIEWS.gallery)}
                    blockReason={generationBlockReason}
                    estimatedCostUsd={ESTIMATED_RENDER_COST_USD}
                    estimatedTimeLabel={estimatedTimeLabel}
                    canSaveToGallery={Boolean(
                      imageResult?.imageDataUrl && !imageResult?.isSavedToGallery,
                    )}
                    isSavingToGallery={isSavingToGallery}
                    saveMessage={saveToGalleryMessage}
                  />
                </>
              ) : null}
            </div>
          </section>
        </div>
      )}

      <GenerateConfirmModal
        isOpen={isConfirmOpen}
        projectName={fields.project_name}
        company={projectCompany}
        systemType={fields.room_type}
        hasReferenceImage={Boolean(referenceImage)}
        estimatedCostUsd={ESTIMATED_RENDER_COST_USD}
        estimatedTimeLabel={estimatedTimeLabel}
        onCancel={handleCloseGenerateConfirm}
        onConfirm={handleGenerateImage}
        isGenerating={isGenerating}
      />
      {isGenerating ? (
        <GenerationProgressModal
          estimatedTimeLabel={estimatedTimeLabel}
          projectName={fields.project_name}
        />
      ) : null}
    </WizardLayout>
  )
}

export default App
