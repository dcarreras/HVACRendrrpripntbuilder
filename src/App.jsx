import { useEffect, useMemo, useRef, useState } from 'react'
import { AdminConsole } from './components/AdminConsole'
import { AuthScreen } from './components/AuthScreen'
import { FieldControl } from './components/FieldControl'
import { ImageResultPanel } from './components/ImageResultPanel'
import { ReferenceImageInput } from './components/ReferenceImageInput'
import { PresetStrip } from './components/PresetStrip'
import { StepCard } from './components/StepCard'
import { WizardLayout } from './components/WizardLayout'
import {
  DEFAULT_ADMIN_CONFIG,
  DEFAULT_FIELDS,
} from './data/defaults'
import { OPTIONS } from './data/options'
import { PRESETS } from './data/presets'
import {
  buildGenerationRequest,
  generateImageRequest,
} from './lib/imageClient'
import { buildPrompt } from './lib/promptBuilder'
import { readFileAsReferenceImage } from './lib/referenceImage'
import {
  clearSession,
  DEFAULT_SESSION,
  loadAdminConfig,
  loadSession,
  mergeAdminConfig,
  saveAdminConfig,
  saveSession,
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
    title: 'Generate and download',
    help: 'Runs the server-side OpenAI workflow and exposes the final output image.',
  },
]

function getDefaultStorage() {
  if (typeof window === 'undefined') {
    return undefined
  }

  return window.localStorage
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

function createSession(role, profile) {
  return {
    role,
    isAuthenticated: true,
    displayName: profile.displayName,
    email: profile.email,
  }
}

function App({
  storage = getDefaultStorage(),
  generateImage = generateImageRequest,
  readReferenceFile = readFileAsReferenceImage,
}) {
  const [session, setSession] = useState(() => loadSession(storage))
  const [fields, setFields] = useState(() => cloneDefaults())
  const [savedAdminConfig, setSavedAdminConfig] = useState(() =>
    loadAdminConfig(storage),
  )
  const [adminDraft, setAdminDraft] = useState(() => loadAdminConfig(storage))
  const [adminNotice, setAdminNotice] = useState('')
  const [showAdminPreview, setShowAdminPreview] = useState(false)
  const [referenceImage, setReferenceImage] = useState(null)
  const [imageResult, setImageResult] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const [activeStep, setActiveStep] = useState(USER_STEPS[0].id)
  const stepRefs = useRef({})

  const prompt = useMemo(
    () => buildPrompt(fields, savedAdminConfig),
    [fields, savedAdminConfig],
  )

  const adminPreviewPrompt = useMemo(
    () => buildPrompt(DEFAULT_FIELDS, adminDraft),
    [adminDraft],
  )

  const resetUserWorkspace = () => {
    setFields(cloneDefaults())
    setReferenceImage(null)
    setImageResult(null)
    setGenerationError('')
    setIsGenerating(false)
    setActiveStep(USER_STEPS[0].id)
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
    if (session.role !== 'user') {
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
  }, [session.role])

  const handleLogin = (role, profile) => {
    const nextSession = createSession(role, profile)
    setSession(nextSession)
    saveSession(storage, nextSession)
    setAdminNotice('')
    setShowAdminPreview(false)

    if (role === 'admin') {
      setAdminDraft(savedAdminConfig)
      return
    }

    resetUserWorkspace()
  }

  const handleLogout = () => {
    setSession(DEFAULT_SESSION)
    clearSession(storage)
    setAdminDraft(savedAdminConfig)
    setAdminNotice('')
    setShowAdminPreview(false)
    resetUserWorkspace()
  }

  const handleGenerateImage = async () => {
    scrollToStep('generate')
    setGenerationError('')
    setIsGenerating(true)

    try {
      const request = buildGenerationRequest({
        prompt,
        aspect: fields.aspect,
        adminConfig: savedAdminConfig,
        referenceImage,
      })
      const result = await generateImage(request)
      setImageResult(result)
    } catch (error) {
      setGenerationError(getErrorMessage(error))
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveAdmin = () => {
    const nextConfig = mergeAdminConfig(adminDraft)
    setSavedAdminConfig(nextConfig)
    setAdminDraft(nextConfig)
    saveAdminConfig(storage, nextConfig)
    setAdminNotice('Configuration saved locally for this browser.')
  }

  const handleResetAdmin = () => {
    setAdminDraft(mergeAdminConfig(DEFAULT_ADMIN_CONFIG))
    setAdminNotice('Defaults restored in the editor. Save to apply them.')
  }

  const userHeaderActions = (
    <>
      <div className="session-meta">
        <span className="badge badge--accent">User</span>
        <p className="t-small">{session.displayName || 'Valtria user'}</p>
      </div>
      <button type="button" className="btn btn-ghost" onClick={handleLogout}>
        Sign out
      </button>
    </>
  )

  if (!session.isAuthenticated) {
    return <AuthScreen onLogin={handleLogin} />
  }

  if (session.role === 'admin') {
    return (
      <AdminConsole
        session={session}
        config={adminDraft}
        options={OPTIONS}
        previewPrompt={adminPreviewPrompt}
        showPreview={showAdminPreview}
        notice={adminNotice}
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
      onPrimaryAction={handleGenerateImage}
      primaryActionLabel="Generate image"
      primaryActionDisabled={isGenerating}
      headerEyebrow="User workspace"
      headerTitle="Generate a Valtria render"
      headerSubtitle="Technical parameters are managed by admin. Complete the brief, paste the Dalux BIM image, and generate the final render."
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
          <p className="t-section">Quick presets</p>
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
          id="room_type"
          label="Room type"
          value={fields.room_type}
          options={OPTIONS.room_type}
          onChange={(value) =>
            setFields((previous) => ({ ...previous, room_type: value }))
          }
        />
        <FieldControl
          id="building_use"
          label="Building use"
          value={fields.building_use}
          options={OPTIONS.building_use}
          onChange={(value) =>
            setFields((previous) => ({ ...previous, building_use: value }))
          }
        />
        <FieldControl
          id="industry"
          label="Industry"
          value={fields.industry}
          options={OPTIONS.industry}
          onChange={(value) =>
            setFields((previous) => ({ ...previous, industry: value }))
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
          id="color_temp"
          label="Color temperature"
          value={fields.color_temp}
          options={OPTIONS.color_temp}
          onChange={(value) =>
            setFields((previous) => ({ ...previous, color_temp: value }))
          }
        />
        <FieldControl
          id="illumination"
          label="Illumination"
          value={fields.illumination}
          options={OPTIONS.illumination}
          onChange={(value) =>
            setFields((previous) => ({ ...previous, illumination: value }))
          }
        />
        <FieldControl
          id="shadows"
          label="Shadows"
          value={fields.shadows}
          options={OPTIONS.shadows}
          onChange={(value) =>
            setFields((previous) => ({ ...previous, shadows: value }))
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
          id="large_pipe"
          label="Main pipe material"
          value={fields.large_pipe}
          options={OPTIONS.large_pipe}
          onChange={(value) =>
            setFields((previous) => ({ ...previous, large_pipe: value }))
          }
        />
        <FieldControl
          id="struct_steel"
          label="Structural steel"
          value={fields.struct_steel}
          options={OPTIONS.struct_steel}
          onChange={(value) =>
            setFields((previous) => ({ ...previous, struct_steel: value }))
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
        title="Generate and download"
        whatThisAffects={USER_STEPS[4].help}
        isCurrent={activeStep === 'generate'}
        isCompleted={false}
        onFocusStep={setActiveStep}
      >
        <ImageResultPanel
          isGenerating={isGenerating}
          error={generationError}
          imageResult={imageResult}
          projectName={fields.project_name}
          onGenerate={handleGenerateImage}
        />
      </StepCard>
    </WizardLayout>
  )
}

export default App
