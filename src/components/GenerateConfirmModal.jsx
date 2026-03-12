import { useState } from 'react'
import { Icon } from '@iconify/react'
import { checkIcon, clockIcon, walletIcon } from '../lib/uiIcons'

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

export function GenerateConfirmModal({
  isOpen,
  projectName,
  company,
  systemType,
  hasReferenceImage,
  estimatedCostUsd,
  estimatedTimeLabel,
  onCancel,
  onConfirm,
  isGenerating = false,
}) {
  const [isConfirmed, setIsConfirmed] = useState(false)

  const handleCancel = () => {
    if (isGenerating) {
      return
    }

    setIsConfirmed(false)
    onCancel()
  }

  const handleConfirm = () => {
    if (!isConfirmed || isGenerating) {
      return
    }

    setIsConfirmed(false)
    onConfirm()
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={handleCancel}>
      <div
        className="confirm-modal card card--hvac"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-render-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="card__header">Ready to render?</header>
        <div className="card__body confirm-modal__body">
          <div className="confirm-modal__intro">
            <h2 id="confirm-render-title" className="t-title">
              Confirm render
            </h2>
            <p className="t-small">
              This render will use your current image and project settings.
            </p>
          </div>

          <div className="confirm-modal__summary">
            <p className="t-small">
              <strong>{projectName || 'Untitled project'}</strong>
              {company ? ` for ${company}` : ''} | {systemType || 'No system selected'}
            </p>
            <p className="t-small">
              {hasReferenceImage
                ? 'Reference image attached.'
                : 'No reference image attached.'}
            </p>
          </div>

          <div className="confirm-modal__metrics">
            <div className="confirm-modal__metric">
              <span className="confirm-modal__metric-label">
                <Icon icon={walletIcon} width="16" height="16" aria-hidden="true" />
                <span className="t-label">Estimated cost</span>
              </span>
              <strong>{formatCurrency(estimatedCostUsd)}</strong>
            </div>
            <div className="confirm-modal__metric">
              <span className="confirm-modal__metric-label">
                <Icon icon={clockIcon} width="16" height="16" aria-hidden="true" />
                <span className="t-label">Estimated time</span>
              </span>
              <strong>{estimatedTimeLabel}</strong>
            </div>
          </div>

          <label className="confirm-modal__check">
            <input
              type="checkbox"
              checked={isConfirmed}
              onChange={(event) => setIsConfirmed(event.target.checked)}
              disabled={isGenerating}
            />
            <span className="confirm-modal__check-copy">
              <Icon icon={checkIcon} width="16" height="16" aria-hidden="true" />
              <span className="t-small">I confirm the image and details are correct.</span>
            </span>
          </label>

          <div className="confirm-modal__actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleCancel}
              disabled={isGenerating}
            >
              Go back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirm}
              disabled={isGenerating || !isConfirmed}
            >
              {isGenerating ? 'Generating image...' : 'Generate now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
