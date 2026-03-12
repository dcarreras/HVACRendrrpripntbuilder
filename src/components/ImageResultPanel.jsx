import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import {
  arrowLeftIcon,
  checkIcon,
  clockIcon,
  galleryIcon,
  walletIcon,
} from '../lib/uiIcons'

function createDownloadName(projectName) {
  const slug = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${slug || 'hvac-render'}.png`
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

export function ImageResultPanel({
  isGenerating,
  error,
  imageResult,
  projectName,
  onGenerate,
  onAdjust,
  onSaveToGallery,
  onOpenGallery,
  blockReason = '',
  estimatedCostUsd = 0.04,
  estimatedTimeLabel = '20-45 seconds',
  canSaveToGallery = false,
  isSavingToGallery = false,
  saveMessage = '',
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [completedSeconds, setCompletedSeconds] = useState(0)
  const startedAtRef = useRef(0)
  const hasImage = Boolean(imageResult?.imageDataUrl)
  const progressPercent = useMemo(() => {
    if (isGenerating) {
      return Math.min(94, 18 + elapsedSeconds * 7)
    }

    if (hasImage) {
      return 100
    }

    return 0
  }, [elapsedSeconds, hasImage, isGenerating])

  useEffect(() => {
    if (!isGenerating) {
      if (startedAtRef.current) {
        setCompletedSeconds(
          Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)),
        )
        startedAtRef.current = 0
      }

      return undefined
    }

    startedAtRef.current = Date.now()
    setElapsedSeconds(0)
    const timer = window.setInterval(() => {
      setElapsedSeconds(
        Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)),
      )
    }, 1000)

    return () => window.clearInterval(timer)
  }, [isGenerating])

  return (
    <div className="image-panel">
      <div className="result-badges">
        <article className="render-estimate__item">
          <span className="confirm-modal__metric-label">
            <Icon icon={walletIcon} width="16" height="16" aria-hidden="true" />
            <span className="t-label">Cost</span>
          </span>
          <strong>{formatCurrency(estimatedCostUsd)}</strong>
        </article>
        <article className="render-estimate__item">
          <span className="confirm-modal__metric-label">
            <Icon icon={clockIcon} width="16" height="16" aria-hidden="true" />
            <span className="t-label">Time</span>
          </span>
          <strong>{estimatedTimeLabel}</strong>
        </article>
      </div>

      <p className="t-small render-estimate__caption">
        Review the result below. You can change settings, render again, or open
        your gallery.
      </p>

      {(isGenerating || hasImage) && (
        <div className="load-meter" aria-live="polite">
          <div className="load-meter__row">
            <span className="t-small">Render progress</span>
            <strong>
              {isGenerating
                ? `${elapsedSeconds}s elapsed`
                : `Completed in ${completedSeconds}s`}
            </strong>
          </div>
          <div className="load-meter__track" aria-hidden="true">
            <span
              className="load-meter__fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="t-small load-meter__caption">
            Your image appears here as soon as it is ready.
          </p>
        </div>
      )}

      {blockReason ? <p className="image-panel__warning">{blockReason}</p> : null}

      {error ? <p className="image-panel__error">{error}</p> : null}

      {saveMessage ? <p className="image-panel__notice">{saveMessage}</p> : null}

      {hasImage ? (
        <figure className="image-panel__result">
          <img
            src={imageResult.imageDataUrl}
            alt="Generated HVAC render"
            className="image-panel__image"
          />
          <figcaption className="t-small image-panel__caption">
            Latest render preview.
          </figcaption>
        </figure>
      ) : (
        <div className="prompt-placeholder t-small">
          Your render will appear here after confirmation.
        </div>
      )}

      <div className="image-panel__actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onAdjust}
        >
          <Icon icon={arrowLeftIcon} width="16" height="16" aria-hidden="true" />
          Adjust settings
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onGenerate}
          disabled={isGenerating || Boolean(blockReason)}
        >
          <Icon icon={checkIcon} width="16" height="16" aria-hidden="true" />
          {isGenerating ? 'Generating image...' : 'Repeat process'}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onSaveToGallery}
          disabled={!hasImage || !canSaveToGallery || isSavingToGallery}
        >
          {isSavingToGallery
            ? 'Saving...'
            : imageResult?.isSavedToGallery
              ? 'Saved to gallery'
              : 'Save to gallery'}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onOpenGallery}
        >
          <Icon icon={galleryIcon} width="16" height="16" aria-hidden="true" />
          Open gallery
        </button>
        {hasImage ? (
          <a
            className="btn btn-ghost"
            href={imageResult.imageDataUrl}
            download={createDownloadName(projectName)}
          >
            Download
          </a>
        ) : null}
      </div>
    </div>
  )
}
