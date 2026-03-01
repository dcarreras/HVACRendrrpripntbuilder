import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { DEFAULT_ADMIN_CONFIG, DEFAULT_FIELDS } from './data/defaults'
import { mergeAdminConfig } from './lib/storage'

function createDeferred() {
  let resolve

  return {
    promise: new Promise((nextResolve) => {
      resolve = nextResolve
    }),
    resolve,
  }
}

function createSession(overrides = {}) {
  const userOverrides = overrides.user || {}

  return {
    access_token: overrides.access_token || 'token-123',
    user: {
      id: 'user-1',
      email: 'user@example.com',
      user_metadata: {},
      app_metadata: {},
      ...userOverrides,
    },
  }
}

function createSupabaseClient({
  initialSession = null,
  getSessionPromise = null,
  passwordSession = createSession(),
  magicLinkError = null,
} = {}) {
  let listener = () => {}

  const client = {
    auth: {
      getSession: vi.fn().mockImplementation(async () => {
        if (getSessionPromise) {
          return getSessionPromise
        }

        return {
          data: { session: initialSession },
          error: null,
        }
      }),
      onAuthStateChange: vi.fn((callback) => {
        listener = callback

        return {
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        }
      }),
      signInWithPassword: vi.fn(async () => {
        listener('SIGNED_IN', passwordSession)
        return {
          data: {
            session: passwordSession,
            user: passwordSession.user,
          },
          error: null,
        }
      }),
      signInWithOtp: vi.fn(async () => ({
        data: {},
        error: magicLinkError,
      })),
      signOut: vi.fn(async () => {
        listener('SIGNED_OUT', null)
        return {
          error: null,
        }
      }),
    },
  }

  return client
}

function createDataApi(overrides = {}) {
  return {
    ensureProject: vi.fn().mockResolvedValue({
      id: 'project-1',
      name: DEFAULT_FIELDS.project_name,
      company: 'Valtria',
    }),
    getProjectConfig: vi.fn().mockResolvedValue(
      mergeAdminConfig(DEFAULT_ADMIN_CONFIG),
    ),
    saveProjectConfig: vi.fn().mockResolvedValue(
      mergeAdminConfig(DEFAULT_ADMIN_CONFIG),
    ),
    getRenders: vi.fn().mockResolvedValue([]),
    listProjects: vi.fn().mockResolvedValue([]),
    getProjectRenderHistory: vi.fn().mockResolvedValue([]),
    loadAttemptCount: vi.fn().mockReturnValue(0),
    saveAttemptCount: vi.fn(),
    ...overrides,
  }
}

function createAdminApi(overrides = {}) {
  return {
    listManagedUsers: vi.fn().mockResolvedValue([]),
    createManagedUser: vi.fn().mockResolvedValue({
      message: 'User created.',
    }),
    updateManagedUser: vi.fn().mockResolvedValue({
      message: 'User updated.',
    }),
    clearManagedUserGallery: vi.fn().mockResolvedValue({
      message: 'Gallery cleared.',
    }),
    deleteManagedUser: vi.fn().mockResolvedValue({
      message: 'User deleted.',
    }),
    ...overrides,
  }
}

describe('App', () => {
  it('shows the auth gate in loading mode until Supabase hydration resolves', async () => {
    const deferred = createDeferred()
    const supabaseClient = createSupabaseClient({
      getSessionPromise: deferred.promise,
    })

    render(
      <App
        supabaseClient={supabaseClient}
        dataApi={createDataApi()}
        adminApi={createAdminApi()}
        generateImage={vi.fn()}
      />,
    )

    expect(screen.getByText('Checking the active Supabase session.')).toBeVisible()

    deferred.resolve({
      data: { session: null },
      error: null,
    })

    await waitFor(() => {
      expect(
        screen.queryByText('Checking the active Supabase session.'),
      ).not.toBeInTheDocument()
    })
  })

  it('signs in with password and opens the user workspace', async () => {
    const user = userEvent.setup()
    const supabaseClient = createSupabaseClient()

    render(
      <App
        supabaseClient={supabaseClient}
        dataApi={createDataApi()}
        adminApi={createAdminApi()}
        generateImage={vi.fn()}
      />,
    )

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.type(screen.getByLabelText('Password (optional for magic link)'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Sign in with password' }))

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Upload image' }),
      ).toBeVisible()
    })

    expect(supabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'secret',
    })
  })

  it('shows the admin console when the session user metadata marks the user as admin', async () => {
    const supabaseClient = createSupabaseClient({
      initialSession: createSession({
        user: {
          user_metadata: {
            role: 'admin',
          },
        },
      }),
    })
    const dataApi = createDataApi({
      listProjects: vi.fn().mockResolvedValue([
        {
          id: 'project-1',
          name: 'Edwards Lifescience 305',
          company: 'Valtria',
        },
      ]),
    })
    const adminApi = createAdminApi({
      listManagedUsers: vi.fn().mockResolvedValue([
        {
          id: 'user-2',
          email: 'staff@example.com',
          role: 'user',
          renderCount: 0,
          latestRenderAt: '',
          lastSignInAt: '',
        },
      ]),
    })

    render(
      <App
        supabaseClient={supabaseClient}
        dataApi={dataApi}
        adminApi={adminApi}
        generateImage={vi.fn()}
      />,
    )

    expect(
      await screen.findByRole('heading', { name: 'Platform settings and user access' }),
    ).toBeVisible()
    expect(dataApi.listProjects).toHaveBeenCalledTimes(1)
    expect(adminApi.listManagedUsers).toHaveBeenCalledTimes(1)
  })

  it('shows the admin console when the session app metadata marks the user as admin', async () => {
    const supabaseClient = createSupabaseClient({
      initialSession: createSession({
        user: {
          app_metadata: {
            role: 'admin',
          },
        },
      }),
    })

    render(
      <App
        supabaseClient={supabaseClient}
        dataApi={createDataApi()}
        adminApi={createAdminApi()}
        generateImage={vi.fn()}
      />,
    )

    expect(
      await screen.findByRole('heading', { name: 'Platform settings and user access' }),
    ).toBeVisible()
  })

  it('lets an admin-capable account enter the user workspace when logging in through user access', async () => {
    const user = userEvent.setup()
    const supabaseClient = createSupabaseClient({
      passwordSession: createSession({
        user: {
          app_metadata: {
            role: 'admin',
          },
        },
      }),
    })

    render(
      <App
        supabaseClient={supabaseClient}
        dataApi={createDataApi()}
        adminApi={createAdminApi()}
        generateImage={vi.fn()}
      />,
    )

    await user.type(screen.getByLabelText('Email'), 'david.carreras@valtria.com')
    await user.type(screen.getByLabelText('Password (optional for magic link)'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Sign in with password' }))

    expect(
      await screen.findByRole('heading', { name: 'Upload image' }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Admin console' })).toBeVisible()
  })

  it('lets an admin-capable account enter the admin console when logging in through admin access', async () => {
    const user = userEvent.setup()
    const supabaseClient = createSupabaseClient({
      passwordSession: createSession({
        user: {
          app_metadata: {
            role: 'admin',
          },
        },
      }),
    })

    render(
      <App
        supabaseClient={supabaseClient}
        dataApi={createDataApi()}
        adminApi={createAdminApi()}
        generateImage={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Admin access' }))
    await user.type(screen.getByLabelText('Email'), 'david.carreras@valtria.com')
    await user.type(screen.getByLabelText('Password (optional for magic link)'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Admin sign in' }))

    expect(
      await screen.findByRole('heading', { name: 'Platform settings and user access' }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'User workspace' })).toBeVisible()
  })

  it('signs out and returns to the auth screen', async () => {
    const user = userEvent.setup()
    const supabaseClient = createSupabaseClient({
      initialSession: createSession(),
    })

    render(
      <App
        supabaseClient={supabaseClient}
        dataApi={createDataApi()}
        adminApi={createAdminApi()}
        generateImage={vi.fn()}
      />,
    )

    expect(
      await screen.findByRole('heading', { name: 'Upload image' }),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sign in with password' })).toBeVisible()
    })
  })

  it('opens the user gallery from the workspace navigation', async () => {
    const user = userEvent.setup()
    const supabaseClient = createSupabaseClient({
      initialSession: createSession(),
    })

    render(
      <App
        supabaseClient={supabaseClient}
        dataApi={createDataApi()}
        adminApi={createAdminApi()}
        generateImage={vi.fn()}
      />,
    )

    await screen.findByRole('heading', { name: 'Upload image' })
    await user.click(screen.getByRole('button', { name: 'My gallery' }))

    expect(
      await screen.findByRole('heading', { name: 'Overview' }),
    ).toBeVisible()
    expect(
      screen.getByText(
        'Your gallery is ready now. Save any image you want to keep and come back here anytime.',
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Create your first render' }),
    ).toBeVisible()
  })

  it('creates the project and hydrates the project config after the user provides the company', async () => {
    const user = userEvent.setup()
    const supabaseClient = createSupabaseClient({
      initialSession: createSession(),
    })
    const dataApi = createDataApi({
      getProjectConfig: vi.fn().mockResolvedValue(
        mergeAdminConfig({
          ...DEFAULT_ADMIN_CONFIG,
          generation: {
            ...DEFAULT_ADMIN_CONFIG.generation,
            model: 'gpt-image-1',
          },
        }),
      ),
    })

    render(
      <App
        supabaseClient={supabaseClient}
        dataApi={dataApi}
        adminApi={createAdminApi()}
        generateImage={vi.fn()}
      />,
    )

    await screen.findByRole('heading', { name: 'Upload image' })
    await user.click(screen.getByRole('button', { name: /Setup/ }))
    await screen.findByRole('heading', { name: 'Project details' })
    await user.type(screen.getByLabelText('Company'), 'Valtria')

    await waitFor(() => {
      expect(dataApi.ensureProject).toHaveBeenLastCalledWith({
        name: DEFAULT_FIELDS.project_name,
        company: 'Valtria',
      })
    })

    await waitFor(() => {
      expect(dataApi.getProjectConfig).toHaveBeenCalledWith('project-1')
    })
  })

  it('saves the generated preview to the gallery on demand', async () => {
    const user = userEvent.setup()
    const supabaseClient = createSupabaseClient({
      initialSession: createSession(),
    })
    const dataApi = createDataApi({
      getRenders: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'render-1',
            created_at: '2026-02-28T08:00:00.000Z',
            system_type: 'Clean Room',
            imageUrl: 'https://example.com/render.png',
          },
        ]),
    })
    const generateImage = vi.fn().mockResolvedValue({
      imageDataUrl: 'data:image/png;base64,AAA',
    })
    const saveRender = vi.fn().mockResolvedValue({
      renderId: 'render-1',
      storagePath: 'user-1/render-1.png',
      message: 'Saved to your gallery.',
    })
    const readReferenceFile = vi.fn().mockResolvedValue({
      dataUrl: 'data:image/png;base64,AAA',
      mimeType: 'image/png',
      name: 'dalux.png',
    })

    render(
      <App
        supabaseClient={supabaseClient}
        dataApi={dataApi}
        adminApi={createAdminApi()}
        generateImage={generateImage}
        saveRender={saveRender}
        readReferenceFile={readReferenceFile}
      />,
    )

    await screen.findByRole('heading', { name: 'Upload image' })

    const fileInput = screen.getByLabelText('Reference image file input')
    const file = new File(['reference'], 'dalux.png', { type: 'image/png' })

    fireEvent.change(fileInput, {
      target: {
        files: [file],
      },
    })

    await waitFor(() => {
      expect(screen.getByAltText('Reference preview')).toBeVisible()
    })

    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('heading', { name: 'Project details' })
    await user.type(screen.getByLabelText('Company'), 'Valtria')

    await waitFor(() => {
      expect(dataApi.ensureProject).toHaveBeenCalled()
    })

    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('heading', { name: 'Confirm render' })
    await user.click(screen.getByRole('button', { name: 'Open confirmation' }))

    expect(screen.getByRole('dialog')).toBeVisible()
    expect(generateImage).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Generate now' })).toBeDisabled()

    await user.click(screen.getByRole('checkbox'))

    await user.click(screen.getByRole('button', { name: 'Generate now' }))

    await waitFor(() => {
      expect(generateImage).toHaveBeenCalledTimes(1)
    })

    expect(
      await screen.findByRole('heading', { name: 'Review result' }),
    ).toBeVisible()

    await waitFor(() => {
      expect(
        screen.getByRole('link', { name: 'Download' }),
      ).toHaveAttribute('href', 'data:image/png;base64,AAA')
    })

    expect(screen.getByRole('button', { name: 'Save to gallery' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Save to gallery' }))

    await waitFor(() => {
      expect(saveRender).toHaveBeenCalledTimes(1)
    })

    expect(saveRender).toHaveBeenCalledWith(
      expect.objectContaining({
        imageDataUrl: 'data:image/png;base64,AAA',
        projectId: 'project-1',
        systemType: 'Clean Room',
      }),
      'token-123',
    )

    await waitFor(() => {
      expect(
        screen.getByText('Saved to your gallery.'),
      ).toBeVisible()
    })

    await user.click(screen.getByRole('button', { name: 'My gallery' }))

    await waitFor(() => {
      expect(
        screen.getByRole('link', { name: 'Download' }),
      ).toHaveAttribute('href', 'https://example.com/render.png')
    })

    expect(generateImage.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        projectId: 'project-1',
        systemType: 'Clean Room',
        autoSave: false,
      }),
    )
    expect(typeof generateImage.mock.calls[0][0].saveKey).toBe('string')
    expect(generateImage.mock.calls[0][1]).toBe('token-123')
  })
})
