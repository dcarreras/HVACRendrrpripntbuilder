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
}) {
  const hasImage = Boolean(imageResult?.imageDataUrl)

  return (
    <div className="image-panel">
      <div className="image-panel__actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onGenerate}
          disabled={isGenerating}
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
