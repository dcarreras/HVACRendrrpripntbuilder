import { useState } from 'react'
import { ValtriaLogo } from './ValtriaLogo'

const ROLES = [
  {
    id: 'user',
    label: 'User workspace',
    title: 'Generate a render',
    description:
      'Paste a Dalux BIM image, complete the guided brief, and download a final render.',
  },
  {
    id: 'admin',
    label: 'Admin console',
    title: 'Configure the technical engine',
    description:
      'Manage OpenAI defaults, prompt restrictions, and the approved HEX palette.',
  },
]

export function AuthScreen({ onLogin }) {
  const [selectedRole, setSelectedRole] = useState('user')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    onLogin(selectedRole, {
      displayName: displayName.trim() || 'Valtria user',
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
            <div className="auth-grid" role="radiogroup" aria-label="Select access role">
              {ROLES.map((role) => {
                const active = role.id === selectedRole
                return (
                  <button
                    key={role.id}
                    type="button"
                    className={`auth-role ${active ? 'auth-role--active' : ''}`.trim()}
                    onClick={() => setSelectedRole(role.id)}
                    aria-pressed={active}
                  >
                    <span className="t-label">{role.label}</span>
                    <strong>{role.title}</strong>
                    <span className="t-small">{role.description}</span>
                  </button>
                )
              })}
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
                {selectedRole === 'admin' ? 'Enter as admin' : 'Enter as user'}
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  )
}
