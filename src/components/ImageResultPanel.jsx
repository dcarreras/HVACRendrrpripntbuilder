import { useEffect, useMemo, useRef, useState } from 'react'

function createDownloadName(projectName) {
  const slug = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${slug || 'hvac-render'}.png`
}

export function ImageResultPanel({
  isGenerating,
  error,
  imageResult,
  projectName,
  onGenerate,
  tokenEstimate,
  maxPromptTokens,
  attemptCount,
  maxAttempts,
  blockReason = '',
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [completedSeconds, setCompletedSeconds] = useState(0)
  const startedAtRef = useRef(0)
  const hasImage = Boolean(imageResult?.imageDataUrl)
  const promptUsage = Math.min(100, Math.round((tokenEstimate / maxPromptTokens) * 100))
  const remainingAttempts = Math.max(0, maxAttempts - attemptCount)
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
      <div className="usage-meter">
        <div className="usage-meter__row">
          <span className="t-small">Prompt budget</span>
          <strong>
            {tokenEstimate} / {maxPromptTokens} tokens
          </strong>
        </div>
        <div className="usage-meter__track" aria-hidden="true">
          <span
            className={`usage-meter__fill ${promptUsage >= 100 ? 'usage-meter__fill--danger' : ''}`.trim()}
            style={{ width: `${promptUsage}%` }}
          />
        </div>
        <p className="t-small usage-meter__caption">
          {remainingAttempts} of {maxAttempts} attempts left in this browser.
        </p>
      </div>

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
            Live estimate while the server prepares the render output.
          </p>
        </div>
      )}

      {blockReason ? <p className="image-panel__warning">{blockReason}</p> : null}

      <div className="image-panel__actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onGenerate}
          disabled={isGenerating || Boolean(blockReason)}
        >
          {isGenerating
            ? 'Generating image...'
            : hasImage
              ? 'Generate again'
              : 'Generate image'}
        </button>
        {hasImage ? (
          <a
            className="btn btn-ghost"
            href={imageResult.imageDataUrl}
            download={createDownloadName(projectName)}
          >
            Download image
          </a>
        ) : null}
      </div>

      {error ? <p className="image-panel__error">{error}</p> : null}

      {hasImage ? (
        <figure className="image-panel__result">
          <img
            src={imageResult.imageDataUrl}
            alt="Generated HVAC render"
            className="image-panel__image"
          />
          <figcaption className="t-small image-panel__caption">
            Final render generated with the server-side OpenAI pipeline.
          </figcaption>
        </figure>
      ) : (
        <div className="prompt-placeholder t-small">
          The app builds the technical prompt in the background. Generate the
          image to preview and download the final render here.
        </div>
      )}
    </div>
  )
}
