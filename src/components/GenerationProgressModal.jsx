import { useEffect, useMemo, useState } from 'react'
import { Icon } from '@iconify/react'
import { clockIcon, imageIcon } from '../lib/uiIcons'

function parseEstimatedSeconds(label) {
  const numbers = String(label || '')
    .match(/\d+/g)
    ?.map((value) => Number.parseInt(value, 10))
    .filter(Number.isFinite)

  if (!numbers?.length) {
    return 45
  }

  return numbers[numbers.length - 1]
}

export function GenerationProgressModal({
  estimatedTimeLabel = '20-45 seconds',
  projectName = '',
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const expectedSeconds = useMemo(
    () => Math.max(12, parseEstimatedSeconds(estimatedTimeLabel)),
    [estimatedTimeLabel],
  )

  useEffect(() => {
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      setElapsedSeconds(
        Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
      )
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  const progressPercent = Math.min(
    96,
    Math.max(10, Math.round((elapsedSeconds / expectedSeconds) * 100)),
  )

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="progress-modal card card--hvac"
        role="dialog"
        aria-modal="true"
        aria-labelledby="generation-progress-title"
      >
        <header className="card__header">Generation in progress</header>
        <div className="card__body progress-modal__body">
          <span className="progress-modal__icon" aria-hidden="true">
            <Icon icon={imageIcon} width="22" height="22" />
          </span>

          <div className="progress-modal__intro">
            <h2 id="generation-progress-title" className="t-title">
              Please wait
            </h2>
            <p className="t-small">
              {projectName
                ? `Rendering ${projectName}. Your image is being generated now.`
                : 'Your image is being generated now.'}
            </p>
            <p className="t-small">
              Keep this window open while generation is in progress.
            </p>
          </div>

          <div className="progress-modal__meter" aria-live="polite">
            <div className="load-meter__row">
              <span className="t-small">Estimated time</span>
              <strong>{estimatedTimeLabel}</strong>
            </div>
            <div className="load-meter__track" aria-hidden="true">
              <span
                className="load-meter__fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="load-meter__row">
              <span className="t-small">Elapsed</span>
              <strong>{elapsedSeconds}s</strong>
            </div>
          </div>

          <p className="t-small progress-modal__footer">
            <Icon icon={clockIcon} width="15" height="15" aria-hidden="true" />
            The preview will appear automatically as soon as the render is ready.
          </p>
        </div>
      </div>
    </div>
  )
}
