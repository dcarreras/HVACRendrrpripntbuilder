import { FieldControl } from './FieldControl'
import { PaletteEditor } from './PaletteEditor'
import { ValtriaLogo } from './ValtriaLogo'

const USER_ROLE_OPTIONS = ['user', 'admin']

function getUserLabel(user) {
  return (
    user?.user_metadata?.displayName ||
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.email ||
    'Valtria admin'
  )
}

function formatDate(value) {
  if (!value) {
    return 'No activity yet'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return date.toLocaleString()
}

export function AdminConsole({
  user,
  config,
  options,
  previewPrompt,
  showPreview,
  notice,
  projects,
  selectedProjectId,
  isLoadingProjects,
  isLoadingConfig,
  isSavingConfig,
  managedUsers,
  selectedUserId,
  isLoadingUsers,
  isMutatingUsers,
  managedUserDraft,
  newUserDraft,
  onGenerationChange,
  onLimitChange,
  onPromptDefaultsChange,
  onPaletteChange,
  onProjectChange,
  onSave,
  onReset,
  onTogglePreview,
  onSelectUser,
  onManagedUserDraftChange,
  onNewUserDraftChange,
  onCreateUser,
  onSaveUser,
  onClearUserGallery,
  onDeleteUser,
  onOpenUserWorkspace,
  onLogout,
}) {
  const hasProjects = projects.length > 0
  const selectedProject = projects.find((project) => project.id === selectedProjectId)
  const selectedManagedUser = managedUsers.find((account) => account.id === selectedUserId)
  const isEditingCurrentAdmin = selectedManagedUser?.id === user?.id

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <div className="valtria-logo" aria-label="Valtria brand">
            <ValtriaLogo />
          </div>
          <div>
            <p className="t-label">Admin control panel</p>
            <h1 className="t-hero">Platform settings and user access</h1>
            <p className="t-body app-header__subtitle">
              Admins control technical render settings, user accounts, and gallery cleanup.
            </p>
          </div>
        </div>
        <div className="app-header__actions">
          <div className="session-meta">
            <span className="badge badge--accent">Admin</span>
            <p className="t-small">{getUserLabel(user)}</p>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onOpenUserWorkspace}
          >
            User workspace
          </button>
          <button type="button" className="btn btn-ghost" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="admin-layout">
        <section className="card card--hvac">
          <header className="card__header">Project scope</header>
          <div className="card__body">
            <div className="field-control">
              <label className="label" htmlFor="admin-project-select">
                Active project
              </label>
              <select
                id="admin-project-select"
                className="input"
                value={selectedProjectId}
                onChange={(event) => onProjectChange(event.target.value)}
                disabled={!hasProjects}
              >
                {hasProjects ? null : <option value="">No projects yet</option>}
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} - {project.company}
                  </option>
                ))}
              </select>
            </div>
            {isLoadingProjects ? (
              <p className="t-small">Loading the project list from Supabase.</p>
            ) : null}
            {!hasProjects ? (
              <p className="t-small">
                Projects appear here after a user creates one from the workspace.
              </p>
            ) : null}
            {selectedProject ? (
              <p className="t-small">
                Editing technical defaults for {selectedProject.name} ({selectedProject.company}).
              </p>
            ) : null}
            {isLoadingConfig ? (
              <p className="t-small">Loading the saved technical configuration.</p>
            ) : null}
          </div>
        </section>

        <section className="card card--hvac">
          <header className="card__header">Image generation defaults</header>
          <div className="card__body">
            <FieldControl
              id="admin-model"
              label="Image model"
              value={config.generation.model}
              options={options.admin_model}
              onChange={(value) => onGenerationChange('model', value)}
            />
            <FieldControl
              id="admin-quality"
              label="Quality"
              value={config.generation.quality}
              options={options.admin_quality}
              onChange={(value) => onGenerationChange('quality', value)}
            />
            <FieldControl
              id="admin-background"
              label="Background policy"
              value={config.generation.background}
              options={options.admin_background}
              onChange={(value) => onGenerationChange('background', value)}
            />
            <FieldControl
              id="admin-moderation"
              label="Moderation"
              value={config.generation.moderation}
              options={options.admin_moderation}
              onChange={(value) => onGenerationChange('moderation', value)}
            />
            <FieldControl
              id="admin-input-fidelity"
              label="Input fidelity"
              value={config.generation.inputFidelity}
              options={options.admin_input_fidelity}
              onChange={(value) => onGenerationChange('inputFidelity', value)}
            />
          </div>
        </section>

        <section className="card card--hvac">
          <header className="card__header">Usage guardrails</header>
          <div className="card__body">
            <FieldControl
              id="admin-max-prompt-tokens"
              label="Prompt token ceiling"
              type="number"
              value={config.limits.maxPromptTokens}
              onChange={(value) => onLimitChange('maxPromptTokens', value)}
              hint="Approximate prompt-token budget enforced before each image request."
            />
            <FieldControl
              id="admin-max-attempts"
              label="Max attempts per browser"
              type="number"
              value={config.limits.maxAttemptsPerSession}
              onChange={(value) => onLimitChange('maxAttemptsPerSession', value)}
              hint="This is the maximum amount of renders allowed in one browser session."
            />
            <FieldControl
              id="admin-budget-limit"
              label="Budget limit (USD)"
              type="number"
              value={config.limits.budgetLimitUsd}
              onChange={(value) => onLimitChange('budgetLimitUsd', value)}
              hint="Internal control threshold for the selected project."
            />
          </div>
        </section>

        <section className="card card--hvac">
          <header className="card__header">Prompt defaults</header>
          <div className="card__body">
            <FieldControl
              id="admin-reference-fidelity"
              label="Reference fidelity"
              value={config.promptDefaults.referenceFidelity}
              options={options.reference_fidelity}
              onChange={(value) => onPromptDefaultsChange('referenceFidelity', value)}
            />
            <FieldControl
              id="admin-negative"
              label="Negative prompt"
              type="text"
              value={config.promptDefaults.negative}
              onChange={(value) => onPromptDefaultsChange('negative', value)}
              placeholder="cartoon, lens flare, dramatic lighting"
            />
          </div>
        </section>

        <section className="card card--hvac">
          <header className="card__header">Color palette</header>
          <div className="card__body">
            <PaletteEditor palette={config.palette} onCommitHex={onPaletteChange} />
          </div>
        </section>

        <section className="card">
          <header className="card__header">Save technical settings</header>
          <div className="card__body admin-actions">
            <div className="admin-actions__buttons">
              <button
                type="button"
                className="btn btn-primary"
                onClick={onSave}
                disabled={!selectedProjectId || isSavingConfig}
              >
                {isSavingConfig ? 'Saving...' : 'Save settings'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={onReset}>
                Reset editor
              </button>
              <button type="button" className="btn btn-ghost" onClick={onTogglePreview}>
                {showPreview ? 'Hide prompt preview' : 'Show prompt preview'}
              </button>
            </div>
            {showPreview ? (
              <pre className="prompt-output t-code">{previewPrompt}</pre>
            ) : null}
          </div>
        </section>

        <section className="card">
          <header className="card__header">User access management</header>
          <div className="card__body admin-users">
            <div className="admin-users__section">
              <h2 className="t-title admin-users__title">Create user</h2>
              <div className="form-grid">
                <FieldControl
                  id="admin-new-user-email"
                  label="Email"
                  type="email"
                  value={newUserDraft.email}
                  onChange={(value) => onNewUserDraftChange('email', value)}
                  placeholder="name@company.com"
                />
                <FieldControl
                  id="admin-new-user-password"
                  label="Temporary password"
                  type="password"
                  value={newUserDraft.password}
                  onChange={(value) => onNewUserDraftChange('password', value)}
                  placeholder="At least 4 characters"
                />
                <FieldControl
                  id="admin-new-user-role"
                  label="Role"
                  value={newUserDraft.role}
                  options={USER_ROLE_OPTIONS}
                  onChange={(value) => onNewUserDraftChange('role', value)}
                />
              </div>
              <div className="admin-actions__buttons">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onCreateUser}
                  disabled={isMutatingUsers}
                >
                  {isMutatingUsers ? 'Working...' : 'Create user'}
                </button>
              </div>
            </div>

            <div className="admin-users__section">
              <h2 className="t-title admin-users__title">Manage existing user</h2>
              {isLoadingUsers ? (
                <p className="t-small">Loading user accounts from Supabase.</p>
              ) : managedUsers.length ? (
                <>
                  <div className="field-control">
                    <label className="label" htmlFor="admin-managed-user-select">
                      User
                    </label>
                    <select
                      id="admin-managed-user-select"
                      className="input"
                      value={selectedUserId}
                      onChange={(event) => onSelectUser(event.target.value)}
                    >
                      {managedUsers.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.email} ({account.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedManagedUser ? (
                    <>
                      <div className="admin-users__summary">
                        <article className="page-summary__item">
                          <span className="t-label">Role</span>
                          <strong>{selectedManagedUser.role}</strong>
                        </article>
                        <article className="page-summary__item">
                          <span className="t-label">Saved renders</span>
                          <strong>{selectedManagedUser.renderCount}</strong>
                        </article>
                        <article className="page-summary__item">
                          <span className="t-label">Last render</span>
                          <strong>{formatDate(selectedManagedUser.latestRenderAt)}</strong>
                        </article>
                        <article className="page-summary__item">
                          <span className="t-label">Last sign-in</span>
                          <strong>{formatDate(selectedManagedUser.lastSignInAt)}</strong>
                        </article>
                      </div>

                      <div className="form-grid">
                        <FieldControl
                          id="admin-managed-user-role"
                          label="Role"
                          value={managedUserDraft.role}
                          options={USER_ROLE_OPTIONS}
                          onChange={(value) => onManagedUserDraftChange('role', value)}
                        />
                        <FieldControl
                          id="admin-managed-user-password"
                          label="New password (optional)"
                          type="password"
                          value={managedUserDraft.password}
                          onChange={(value) =>
                            onManagedUserDraftChange('password', value)
                          }
                          placeholder="Leave blank to keep the current password"
                        />
                      </div>

                      <div className="admin-actions__buttons">
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={onSaveUser}
                          disabled={isMutatingUsers}
                        >
                          {isMutatingUsers ? 'Working...' : 'Save user access'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={onClearUserGallery}
                          disabled={isMutatingUsers}
                        >
                          Clear gallery
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={onDeleteUser}
                          disabled={isMutatingUsers || isEditingCurrentAdmin}
                        >
                          Delete user
                        </button>
                      </div>
                      {isEditingCurrentAdmin ? (
                        <p className="t-small admin-actions__notice">
                          The active admin account can be edited, but it cannot be deleted.
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </>
              ) : (
                <p className="t-small">
                  No user accounts found yet. Create the first user from this panel.
                </p>
              )}
            </div>
          </div>
        </section>

        {notice ? (
          <section className="card">
            <header className="card__header">Status</header>
            <div className="card__body">
              <p className="t-small admin-actions__notice">{notice}</p>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  )
}
