import { FieldControl } from './FieldControl'
import { PaletteEditor } from './PaletteEditor'
import { ValtriaLogo } from './ValtriaLogo'

function getUserLabel(user) {
  return (
    user?.user_metadata?.displayName ||
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.email ||
    'Valtria admin'
  )
}

function formatCurrency(value) {
  const amount = Number.parseFloat(value)

  if (!Number.isFinite(amount)) {
    return '$0.00'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function formatDate(value) {
  if (!value) {
    return 'Unknown'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return date.toLocaleString()
}

function formatUserId(userId) {
  if (!userId) {
    return 'Unknown'
  }

  if (userId.length <= 12) {
    return userId
  }

  return `${userId.slice(0, 8)}...`
}

export function AdminConsole({
  user,
  config,
  options,
  previewPrompt,
  showPreview,
  notice,
  projects,
  selectedProjectId,
  renderHistory,
  projectCostTotal,
  isLoadingProjects,
  isLoadingHistory,
  isSaving,
  onGenerationChange,
  onLimitChange,
  onPromptDefaultsChange,
  onPaletteChange,
  onProjectChange,
  onSave,
  onReset,
  onTogglePreview,
  onLogout,
}) {
  const hasProjects = projects.length > 0
  const selectedProject = projects.find((project) => project.id === selectedProjectId)
  const overBudget =
    projectCostTotal > Number.parseFloat(config.limits.budgetLimitUsd || 0)

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <div className="valtria-logo" aria-label="Valtria brand">
            <ValtriaLogo />
          </div>
          <div>
            <p className="t-label">Admin console</p>
            <h1 className="t-hero">Technical generation settings</h1>
            <p className="t-body app-header__subtitle">
              OpenAI defaults, prompt constraints, and the approved color system
              stay under admin control only.
            </p>
          </div>
        </div>
        <div className="app-header__actions">
          <div className="session-meta">
            <span className="badge badge--accent">Admin</span>
            <p className="t-small">{getUserLabel(user)}</p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="admin-layout">
        <section className="card card--hvac">
          <header className="card__header">Project scope</header>
          <div className="card__body">
            <div className="field-control">
              <label className="label" htmlFor="admin-project-select">
                Project
              </label>
              <select
                id="admin-project-select"
                className="input"
                value={selectedProjectId}
                onChange={(event) => onProjectChange(event.target.value)}
                disabled={!hasProjects}
              >
                {hasProjects ? null : <option value="">No projects yet</option>}
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} - {project.company}
                  </option>
                ))}
              </select>
            </div>
            {isLoadingProjects ? (
              <p className="t-small">Loading the project list from Supabase.</p>
            ) : null}
            {!hasProjects ? (
              <p className="t-small">
                Projects appear here after a user creates one from the main
                workspace.
              </p>
            ) : null}
            {selectedProject ? (
              <p className="t-small">
                Editing configuration for {selectedProject.name} ({selectedProject.company}).
              </p>
            ) : null}
          </div>
        </section>

        <section className="card card--hvac">
          <header className="card__header">OpenAI generation settings</header>
          <div className="card__body">
            <FieldControl
              id="admin-model"
              label="Image model"
              value={config.generation.model}
              options={options.admin_model}
              onChange={(value) => onGenerationChange('model', value)}
            />
            <FieldControl
              id="admin-quality"
              label="Quality"
              value={config.generation.quality}
              options={options.admin_quality}
              onChange={(value) => onGenerationChange('quality', value)}
            />
            <FieldControl
              id="admin-background"
              label="Background policy"
              value={config.generation.background}
              options={options.admin_background}
              onChange={(value) => onGenerationChange('background', value)}
            />
            <FieldControl
              id="admin-moderation"
              label="Moderation"
              value={config.generation.moderation}
              options={options.admin_moderation}
              onChange={(value) => onGenerationChange('moderation', value)}
            />
            <FieldControl
              id="admin-input-fidelity"
              label="Input fidelity"
              value={config.generation.inputFidelity}
              options={options.admin_input_fidelity}
              onChange={(value) => onGenerationChange('inputFidelity', value)}
            />
          </div>
        </section>

        <section className="card card--hvac">
          <header className="card__header">Usage guardrails</header>
          <div className="card__body">
            <FieldControl
              id="admin-max-prompt-tokens"
              label="Prompt token ceiling"
              type="number"
              value={config.limits.maxPromptTokens}
              onChange={(value) => onLimitChange('maxPromptTokens', value)}
              hint="Approximate prompt-token budget enforced before each image request."
            />
            <FieldControl
              id="admin-max-attempts"
              label="Max attempts per browser"
              type="number"
              value={config.limits.maxAttemptsPerSession}
              onChange={(value) => onLimitChange('maxAttemptsPerSession', value)}
              hint="After this cap is reached, the user must wait for a new session or for admin to raise the limit."
            />
            <FieldControl
              id="admin-budget-limit"
              label="Budget limit (USD)"
              type="number"
              value={config.limits.budgetLimitUsd}
              onChange={(value) => onLimitChange('budgetLimitUsd', value)}
              hint="Passive warning threshold for the selected project."
            />
          </div>
        </section>

        <section className="card card--hvac">
          <header className="card__header">Prompt defaults</header>
          <div className="card__body">
            <FieldControl
              id="admin-reference-fidelity"
              label="Reference fidelity"
              value={config.promptDefaults.referenceFidelity}
              options={options.reference_fidelity}
              onChange={(value) => onPromptDefaultsChange('referenceFidelity', value)}
            />
            <FieldControl
              id="admin-negative"
              label="Negative prompt"
              type="text"
              value={config.promptDefaults.negative}
              onChange={(value) => onPromptDefaultsChange('negative', value)}
              placeholder="cartoon, lens flare, dramatic lighting"
            />
          </div>
        </section>

        <section className="card card--hvac">
          <header className="card__header">Palette manager</header>
          <div className="card__body">
            <PaletteEditor palette={config.palette} onCommitHex={onPaletteChange} />
          </div>
        </section>

        <section className="card">
          <header className="card__header">Admin actions</header>
          <div className="card__body admin-actions">
            <div className="admin-actions__buttons">
              <button
                type="button"
                className="btn btn-primary"
                onClick={onSave}
                disabled={!selectedProjectId || isSaving}
              >
                {isSaving ? 'Saving...' : 'Save configuration'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={onReset}>
                Reset to defaults
              </button>
              <button type="button" className="btn btn-ghost" onClick={onTogglePreview}>
                {showPreview ? 'Hide prompt preview' : 'Show prompt preview'}
              </button>
            </div>
            {notice ? <p className="t-small admin-actions__notice">{notice}</p> : null}
            {showPreview ? (
              <pre className="prompt-output t-code">{previewPrompt}</pre>
            ) : null}
          </div>
        </section>

        <section className="card">
          <header className="card__header">Historial de renders</header>
          <div className="card__body">
            <p className="t-small">
              Total project cost: {formatCurrency(projectCostTotal)} /{' '}
              {formatCurrency(config.limits.budgetLimitUsd)}
            </p>
            {overBudget ? (
              <p className="image-panel__warning">
                The selected project is above the configured budget limit.
              </p>
            ) : null}
            {!selectedProjectId ? (
              <p className="t-small">
                Select a project to load its render history.
              </p>
            ) : isLoadingHistory ? (
              <p className="t-small">Loading render history from Supabase.</p>
            ) : renderHistory.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Usuario</th>
                    <th>Sistema</th>
                    <th>Coste</th>
                  </tr>
                </thead>
                <tbody>
                  {renderHistory.map((render) => (
                    <tr key={render.id}>
                      <td>{formatDate(render.created_at)}</td>
                      <td>{formatUserId(render.user_id)}</td>
                      <td>{render.system_type || 'Unknown'}</td>
                      <td>{formatCurrency(render.cost_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="t-small">
                No renders have been saved for this project yet.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
