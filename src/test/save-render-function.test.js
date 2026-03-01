import { describe, expect, it, vi } from 'vitest'
import { handler } from '../../netlify/functions/save-render'

function createRequest(body, authorization = 'Bearer token-123') {
  const headers = authorization ? { Authorization: authorization } : undefined

  return new Request('https://example.com/.netlify/functions/save-render', {
    method: 'POST',
    body,
    headers,
  })
}

function createSupabaseAdminClient({
  user = { id: 'user-1' },
  existingRender = null,
  authError = null,
} = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: existingRender,
    error: null,
  })
  const eqImage = vi.fn(() => ({
    maybeSingle,
  }))
  const eqUser = vi.fn(() => ({
    eq: eqImage,
  }))
  const selectExisting = vi.fn(() => ({
    eq: eqUser,
  }))

  const single = vi.fn().mockResolvedValue({
    data: {
      id: 'render-1',
      image_url: 'user-1/save-key-1.png',
    },
    error: null,
  })
  const selectInserted = vi.fn(() => ({
    single,
  }))
  const insert = vi.fn(() => ({
    select: selectInserted,
  }))

  const upload = vi.fn().mockResolvedValue({
    data: {
      path: 'user-1/save-key-1.png',
    },
    error: null,
  })

  return {
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: authError ? null : user,
          },
          error: authError,
        }),
      },
      storage: {
        from: vi.fn(() => ({
          upload,
        })),
      },
      from: vi.fn((table) => {
        if (table !== 'renders') {
          throw new Error(`Unexpected table: ${table}`)
        }

        return {
          select: selectExisting,
          insert,
        }
      }),
    },
    spies: {
      upload,
      insert,
      maybeSingle,
    },
  }
}

describe('save-render handler', () => {
  it('returns 400 when required fields are missing', async () => {
    const { client } = createSupabaseAdminClient()

    const response = await handler(
      createRequest(
        JSON.stringify({
          projectId: '',
        }),
      ),
      {
        supabaseClient: client,
      },
    )

    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe(
      'projectId, imageDataUrl, and saveKey are required.',
    )
  })

  it('uploads and persists the render when it has not been saved yet', async () => {
    const { client, spies } = createSupabaseAdminClient()

    const response = await handler(
      createRequest(
        JSON.stringify({
          projectId: 'project-1',
          systemType: 'Clean Room',
          prompt: 'test prompt',
          imageDataUrl: 'data:image/png;base64,QUJD',
          saveKey: 'save-key-1',
        }),
      ),
      {
        supabaseClient: client,
      },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      renderId: 'render-1',
      storagePath: 'user-1/save-key-1.png',
      message: 'Saved to your gallery.',
    })
    expect(spies.maybeSingle).toHaveBeenCalledTimes(1)
    expect(spies.upload).toHaveBeenCalledWith(
      'user-1/save-key-1.png',
      expect.any(Buffer),
      {
        contentType: 'image/png',
        upsert: false,
      },
    )
    expect(spies.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      project_id: 'project-1',
      system_type: 'Clean Room',
      prompt_used: 'test prompt',
      image_url: 'user-1/save-key-1.png',
      cost_usd: 0.04,
    })
  })

  it('returns the existing render when the image was already saved', async () => {
    const { client, spies } = createSupabaseAdminClient({
      existingRender: {
        id: 'render-9',
        image_url: 'user-1/save-key-1.png',
      },
    })

    const response = await handler(
      createRequest(
        JSON.stringify({
          projectId: 'project-1',
          imageDataUrl: 'data:image/png;base64,QUJD',
          saveKey: 'save-key-1',
        }),
      ),
      {
        supabaseClient: client,
      },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      renderId: 'render-9',
      storagePath: 'user-1/save-key-1.png',
      message: 'This render is already saved in your gallery.',
    })
    expect(spies.upload).not.toHaveBeenCalled()
    expect(spies.insert).not.toHaveBeenCalled()
  })
})
