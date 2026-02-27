import { useEffect, useState } from 'react'
import { ValtriaLogo } from './ValtriaLogo'

const COPY = {
  user: {
    badge: 'User workspace',
    title: 'Generate a render',
    description:
      'Complete the short brief, paste the Dalux BIM image, and download the final render.',
    submitLabel: 'Enter workspace',
    fallbackName: 'Valtria user',
  },
  admin: {
    badge: 'Admin access',
    title: 'Configure the technical engine',
    description:
      'Manage OpenAI defaults, prompt guardrails, and the approved HEX palette.',
    submitLabel: 'Enter as admin',
    fallbackName: 'Valtria admin',
  },
}

export function AuthScreen({ onLogin, preferredRole = 'user' }) {
  const [selectedRole, setSelectedRole] = useState(preferredRole)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    setSelectedRole(preferredRole)
  }, [preferredRole])

  const handleSubmit = (event) => {
    event.preventDefault()
    const profile = COPY[selectedRole]

    onLogin(selectedRole, {
      displayName: displayName.trim() || profile.fallbackName,
      email: email.trim(),
    })
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <div className="valtria-logo" aria-label="Valtria brand">
            <ValtriaLogo />
          </div>
          <div>
            <p className="t-label">HVAC Render Builder</p>
            <h1 className="t-hero">Valtria Render Studio</h1>
            <p className="t-body app-header__subtitle">
              Mock access flow for the proof of concept. User and admin roles are
              visually separated, while the OpenAI key stays server-side.
            </p>
          </div>
        </div>
      </header>

      <main className="auth-layout">
        <section className="card card--hvac auth-card">
          <div className="card__body auth-card__body">
            <div className="auth-panel">
              <span className="badge badge--accent">{COPY[selectedRole].badge}</span>
              <strong className="auth-panel__title">{COPY[selectedRole].title}</strong>
              <p className="t-small auth-panel__copy">
                {COPY[selectedRole].description}
              </p>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="field-control">
                <label className="label" htmlFor="auth-display-name">
                  Display name
                </label>
                <input
                  id="auth-display-name"
                  className="input"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Example: David"
                />
              </div>

              <div className="field-control">
                <label className="label" htmlFor="auth-email">
                  Email (optional)
                </label>
                <input
                  id="auth-email"
                  className="input"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@company.com"
                />
              </div>

              <button type="submit" className="btn btn-primary">
                {COPY[selectedRole].submitLabel}
              </button>
            </form>

            <div className="auth-switch">
              {selectedRole === 'admin' ? (
                <>
                  <span className="t-small">Return to the normal user flow.</span>
                  <button
                    type="button"
                    className="btn btn-link"
                    onClick={() => setSelectedRole('user')}
                  >
                    Back to user access
                  </button>
                </>
              ) : (
                <>
                  <span className="t-small">
                    Admin controls stay tucked away for technical staff only.
                  </span>
                  <button
                    type="button"
                    className="btn btn-link"
                    onClick={() => setSelectedRole('admin')}
                  >
                    Admin access
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
