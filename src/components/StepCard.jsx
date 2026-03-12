export function StepCard({
  stepId,
  stepNumber,
  title,
  whatThisAffects,
  isCurrent,
  isCompleted,
  onFocusStep,
  stepRef,
  children,
}) {
  const stateClass = isCurrent
    ? 'step-card--current'
    : isCompleted
      ? 'step-card--completed'
      : ''

  return (
    <section
      ref={stepRef}
      id={stepId}
      className={`card card--hvac step-card ${stateClass}`.trim()}
      aria-label={`Step ${stepNumber}: ${title}`}
      onFocusCapture={() => onFocusStep(stepId)}
    >
      <header className="card__header step-card__header">
        <span className="step-index t-label">Step {stepNumber}</span>
        <h2 className="t-title step-title">{title}</h2>
      </header>
      <div className="card__body">
        {whatThisAffects ? <p className="step-help t-small">{whatThisAffects}</p> : null}
        {children}
      </div>
    </section>
  )
}
