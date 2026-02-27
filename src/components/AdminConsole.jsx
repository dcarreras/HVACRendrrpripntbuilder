import { FieldControl } from './FieldControl'
import { PaletteEditor } from './PaletteEditor'
import { ValtriaLogo } from './ValtriaLogo'

export function AdminConsole({
  session,
  config,
  options,
  previewPrompt,
  showPreview,
  notice,
  onGenerationChange,
  onPromptDefaultsChange,
  onPaletteChange,
  onSave,
  onReset,
  onTogglePreview,
  onLogout,
}) {
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
            <p className="t-small">{session.displayName || 'Valtria admin'}</p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="admin-layout">
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
              <button type="button" className="btn btn-primary" onClick={onSave}>
                Save configuration
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
      </main>
    </div>
  )
}
