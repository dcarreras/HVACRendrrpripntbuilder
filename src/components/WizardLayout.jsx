import { ValtriaLogo } from './ValtriaLogo'

export function WizardLayout({
  steps,
  activeStep,
  onStepClick,
  onPrimaryAction,
  primaryActionLabel,
  primaryActionDisabled = false,
  headerEyebrow = 'HVAC Render Builder',
  headerTitle = 'Valtria Render Studio',
  headerSubtitle = 'Guided vertical workflow for teams with no AI prompting experience.',
  headerActions = null,
  children,
}) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <div className="valtria-logo" aria-label="Valtria brand">
            <ValtriaLogo />
          </div>
          <div>
            <p className="t-label">{headerEyebrow}</p>
            <h1 className="t-hero">{headerTitle}</h1>
            <p className="t-body app-header__subtitle">{headerSubtitle}</p>
          </div>
        </div>
        <div className="app-header__actions">
          {headerActions}
          {primaryActionLabel && onPrimaryAction ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onPrimaryAction}
              disabled={primaryActionDisabled}
            >
              {primaryActionLabel}
            </button>
          ) : null}
        </div>
      </header>

      <main className="wizard-main">
        <aside className="progress-rail card" aria-label="Progress rail">
          <h2 className="t-section">Progress</h2>
          <ol className="progress-rail__list">
            {steps.map((step, index) => {
              const active = step.id === activeStep
              const completed = index < steps.findIndex((item) => item.id === activeStep)
              const className = [
                'nav-item',
                active ? 'active' : '',
                completed ? 'is-completed' : '',
              ]
                .filter(Boolean)
                .join(' ')

              return (
                <li key={step.id}>
                  <button
                    type="button"
                    className={className}
                    onClick={() => onStepClick(step.id)}
                  >
                    <span className="nav-item__index">{index + 1}</span>
                    <span>{step.title}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </aside>

        <section className="wizard-content">{children}</section>
      </main>

      {primaryActionLabel && onPrimaryAction ? (
        <div className="mobile-cta">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onPrimaryAction}
            disabled={primaryActionDisabled}
          >
            {primaryActionLabel}
          </button>
        </div>
      ) : null}
    </div>
  )
}
