import { describe, expect, it, vi } from 'vitest'
import {
  clearManagedUserGallery,
  createManagedUser,
  deleteManagedUser,
  handler,
  listManagedUsers,
  updateManagedUser,
} from '../../netlify/functions/admin-users'

function createRequest({
  method = 'GET',
  body = '',
  authorization = 'Bearer token-123',
} = {}) {
  const headers = authorization ? { Authorization: authorization } : undefined
  const init = {
    method,
    headers,
  }

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = body
  }

  return new Request('https://example.com/.netlify/functions/admin-users', init)
}

function createAdminClient({
  requester = {
    id: 'admin-1',
    email: 'admin@example.com',
    user_metadata: { role: 'admin' },
    app_metadata: { role: 'admin' },
  },
  users = [
    {
      id: 'user-1',
      email: 'user@example.com',
      created_at: '2026-03-01T12:00:00.000Z',
      last_sign_in_at: '2026-03-01T13:00:00.000Z',
      user_metadata: { role: 'user' },
      app_metadata: { role: 'user' },
    },
  ],
  renderRows = [
    {
      id: 'render-1',
      user_id: 'user-1',
      image_url: 'user-1/123.png',
      created_at: '2026-03-01T14:00:00.000Z',
    },
  ],
} = {}) {
  const renderSelectEq = vi.fn().mockResolvedValue({
    data: renderRows,
    error: null,
  })
  const renderSelect = vi.fn((columns) => {
    if (columns === 'user_id, created_at') {
      return Promise.resolve({
        data: renderRows.map((row) => ({
          user_id: row.user_id,
          created_at: row.created_at,
        })),
        error: null,
      })
    }

    return {
      eq: renderSelectEq,
    }
  })
  const renderDeleteEq = vi.fn().mockResolvedValue({
    error: null,
  })
  const renderDelete = vi.fn(() => ({
    eq: renderDeleteEq,
  }))
  const from = vi.fn(() => ({
    select: renderSelect,
    delete: renderDelete,
  }))
  const remove = vi.fn().mockResolvedValue({
    data: {},
    error: null,
  })
  const getUserById = vi.fn(async (userId) => ({
    data: {
      user: users.find((user) => user.id === userId) || null,
    },
    error: null,
  }))
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: requester,
        },
        error: null,
      }),
      admin: {
        listUsers: vi.fn().mockResolvedValue({
          data: {
            users,
          },
          error: null,
        }),
        getUserById,
        createUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'user-2',
              email: 'new@example.com',
            },
          },
          error: null,
        }),
        updateUserById: vi.fn().mockResolvedValue({
          data: {},
          error: null,
        }),
        deleteUser: vi.fn().mockResolvedValue({
          data: {},
          error: null,
        }),
      },
    },
    storage: {
      from: vi.fn(() => ({
        remove,
      })),
    },
    from,
  }

  return {
    client,
    spies: {
      renderSelect,
      renderSelectEq,
      renderDelete,
      renderDeleteEq,
      remove,
      getUserById,
    },
  }
}

describe('listManagedUsers', () => {
  it('returns users with render stats', async () => {
    const { client } = createAdminClient()

    const result = await listManagedUsers(client)

    expect(result).toEqual([
      expect.objectContaining({
        id: 'user-1',
        email: 'user@example.com',
        role: 'user',
        renderCount: 1,
        latestRenderAt: '2026-03-01T14:00:00.000Z',
      }),
    ])
  })
})

describe('createManagedUser', () => {
  it('creates a user with synced role metadata', async () => {
    const { client } = createAdminClient()

    const result = await createManagedUser(client, {
      email: 'new@example.com',
      password: 'secret',
      role: 'admin',
    })

    expect(client.auth.admin.createUser).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'secret',
      email_confirm: true,
      user_metadata: {
        role: 'admin',
      },
      app_metadata: {
        role: 'admin',
      },
    })
    expect(result.message).toContain('new@example.com')
  })
})

describe('updateManagedUser', () => {
  it('updates password and role metadata', async () => {
    const { client } = createAdminClient()

    const result = await updateManagedUser(client, {
      userId: 'user-1',
      password: 'freshpass',
      role: 'admin',
    })

    expect(client.auth.admin.updateUserById).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        password: 'freshpass',
        user_metadata: {
          role: 'admin',
        },
        app_metadata: {
          role: 'admin',
        },
      }),
    )
    expect(result.message).toContain('Access updated')
  })
})

describe('clearManagedUserGallery', () => {
  it('removes storage objects and render rows', async () => {
    const { client, spies } = createAdminClient()

    const result = await clearManagedUserGallery(client, {
      userId: 'user-1',
    })

    expect(spies.remove).toHaveBeenCalledWith(['user-1/123.png'])
    expect(spies.renderDeleteEq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(result.message).toContain('Deleted 1 render records')
  })
})

describe('deleteManagedUser', () => {
  it('clears gallery data before deleting a user', async () => {
    const { client } = createAdminClient()

    const result = await deleteManagedUser(
      client,
      {
        userId: 'user-1',
      },
      {
        id: 'admin-1',
      },
    )

    expect(client.auth.admin.deleteUser).toHaveBeenCalledWith('user-1')
    expect(result.message).toContain('deleted')
  })
})

describe('handler', () => {
  it('returns 401 when the bearer token is missing', async () => {
    const { client } = createAdminClient()
    const response = await handler(createRequest({ authorization: '' }), {
      adminClient: client,
    })

    expect(response.status).toBe(401)
    expect((await response.json()).error).toBe(
      'Authorization header must use a Bearer token.',
    )
  })

  it('lists users for admin GET requests', async () => {
    const { client } = createAdminClient()
    const response = await handler(createRequest(), {
      adminClient: client,
    })

    expect(response.status).toBe(200)
    expect((await response.json()).users).toHaveLength(1)
  })

  it('runs create actions for admin POST requests', async () => {
    const { client } = createAdminClient()
    const response = await handler(
      createRequest({
        method: 'POST',
        body: JSON.stringify({
          action: 'create',
          email: 'new@example.com',
          password: 'secret',
          role: 'user',
        }),
      }),
      {
        adminClient: client,
      },
    )

    expect(response.status).toBe(200)
    expect(client.auth.admin.createUser).toHaveBeenCalledTimes(1)
  })
})
