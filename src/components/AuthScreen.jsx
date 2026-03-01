import { useEffect, useState } from 'react'
import { ValtriaLogo } from './ValtriaLogo'

const COPY = {
  user: {
    badge: 'User access',
    title: 'Sign in',
    description: 'Use your email to continue to the render workspace.',
    submitLabel: 'Sign in with password',
    magicLabel: 'Send magic link',
  },
  admin: {
    badge: 'Admin access',
    title: 'Admin sign in',
    description: 'Use your admin account to manage platform settings.',
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
    <div className="app-shell app-shell--auth">
      <header className="app-header app-header--auth">
        <div className="app-header__brand">
          <div>
            <p className="t-label">HVAC Render Builder</p>
            <h1 className="t-hero">Sign in to your workspace</h1>
            <p className="t-body app-header__subtitle">
              Access your renders and keep everything in one place.
            </p>
          </div>
        </div>
      </header>

      <main className="auth-layout auth-layout--centered">
        <section className="card card--hvac auth-card">
          <div className="card__body auth-card__body">
            <div className="auth-panel">
              <div
                className="valtria-logo valtria-logo--light auth-panel__logo"
                aria-label="Valtria brand"
              >
                <ValtriaLogo variant="light" />
              </div>
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
