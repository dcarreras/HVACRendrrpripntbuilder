import { Icon } from '@iconify/react'
import { createIcon } from '../lib/uiIcons'

function createSavedRenderName(projectName, renderId) {
  const slug = (projectName || 'hvac-render')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${slug || 'hvac-render'}-${renderId || 'saved-render'}.png`
}

function formatDate(value) {
  if (!value) {
    return 'No saved images yet'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'No saved images yet'
  }

  return date.toLocaleString()
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

export function UserGalleryPage({
  recentRenders = [],
  projectName,
  recentSpendUsd = 0,
  lastRenderAt = '',
  onCreateNew,
}) {
  return (
    <div className="workspace-stack">
      <section className="card card--hvac workspace-section">
        <header className="card__header">
          <h2 className="card__title">Overview</h2>
        </header>
        <div className="card__body">
          <div className="gallery-overview">
            <article className="gallery-overview__item">
              <span className="t-label">Saved images</span>
              <strong>{recentRenders.length}</strong>
            </article>
            <article className="gallery-overview__item">
              <span className="t-label">Spent</span>
              <strong>{formatCurrency(recentSpendUsd)}</strong>
            </article>
            <article className="gallery-overview__item">
              <span className="t-label">Last image</span>
              <strong>{formatDate(lastRenderAt)}</strong>
            </article>
          </div>

          <div className="gallery-overview__actions">
            <button type="button" className="btn btn-primary" onClick={onCreateNew}>
              <Icon icon={createIcon} width="16" height="16" aria-hidden="true" />
              Create new render
            </button>
          </div>
        </div>
      </section>

      <section className="card card--hvac workspace-section">
        <header className="card__header">
          <h2 className="card__title">My gallery</h2>
        </header>
        <div className="card__body">
          {recentRenders.length ? (
            <div className="gallery-grid">
              {recentRenders.map((render) => (
                <article key={render.id} className="gallery-card">
                  {render.imageUrl ? (
                    <img
                      src={render.imageUrl}
                      alt={`Saved ${render.system_type || 'HVAC'} render`}
                      className="image-panel__image"
                    />
                  ) : (
                    <div className="prompt-placeholder t-small">Preview unavailable.</div>
                  )}

                  <div className="gallery-card__meta">
                    <p className="t-small">{render.system_type || 'Saved render'}</p>
                    <p className="t-small">{formatDate(render.created_at)}</p>
                    {render.imageUrl ? (
                      <a
                        className="btn btn-ghost"
                        href={render.imageUrl}
                        download={createSavedRenderName(projectName, render.id)}
                      >
                        Download
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="gallery-empty-state prompt-placeholder">
              <p className="t-small">
                Your gallery is ready now. Save any image you want to keep and
                come back here anytime.
              </p>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onCreateNew}
              >
                Create your first render
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
