import { useEffect, useState } from 'react'
import { ValtriaLogo } from './ValtriaLogo'

const COPY = {
  user: {
    badge: 'User workspace',
    title: 'Generate a render',
    description:
      'Complete the short brief, paste the Dalux BIM image, and download the final render.',
    submitLabel: 'Sign in with password',
    magicLabel: 'Send magic link',
  },
  admin: {
    badge: 'Admin access',
    title: 'Configure the technical engine',
    description:
      'Manage OpenAI defaults, prompt guardrails, and the approved HEX palette.',
    submitLabel: 'Admin sign in',
    magicLabel: 'Admin magic link',
  },
}

export function AuthScreen({
  onPasswordLogin,
  onMagicLinkLogin,
  preferredRole = 'user',
  isSubmitting = false,
  activeAction = '',
  errorMessage = '',
  isInitializing = false,
}) {
  const [selectedRole, setSelectedRole] = useState(preferredRole)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    setSelectedRole(preferredRole)
  }, [preferredRole])

  const handleSubmit = (event) => {
    event.preventDefault()
    onPasswordLogin?.({
      email: email.trim(),
      password,
      role: selectedRole,
    })
  }

  const handleMagicLink = () => {
    onMagicLinkLogin?.({
      email: email.trim(),
      role: selectedRole,
    })
  }

  const canSubmitPassword =
    !isInitializing && !isSubmitting && Boolean(email.trim()) && Boolean(password)
  const canSubmitMagic =
    !isInitializing && !isSubmitting && Boolean(email.trim())
  const statusMessage = isInitializing
    ? 'Checking the active Supabase session.'
    : activeAction === 'password'
      ? 'Signing in with your password.'
      : activeAction === 'magic'
        ? 'Sending the magic link email.'
        : ''

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
              Sign in with Supabase to access the user or admin workspace while
              keeping the OpenAI key server-side.
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
                <label className="label" htmlFor="auth-email">
                  Email
                </label>
                <input
                  id="auth-email"
                  type="email"
                  className="input"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@company.com"
                  autoComplete="email"
                />
              </div>

              <div className="field-control">
                <label className="label" htmlFor="auth-password">
                  Password (optional for magic link)
                </label>
                <input
                  id="auth-password"
                  type="password"
                  className="input"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Use your Supabase password"
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={!canSubmitPassword}
              >
                {COPY[selectedRole].submitLabel}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleMagicLink}
                disabled={!canSubmitMagic}
              >
                {COPY[selectedRole].magicLabel}
              </button>
            </form>

            {statusMessage ? (
              <p className="t-small auth-panel__copy">{statusMessage}</p>
            ) : null}
            {errorMessage ? <p className="image-panel__error">{errorMessage}</p> : null}

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
