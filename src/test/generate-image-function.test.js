import { describe, expect, it, vi } from 'vitest'
import {
  createImageResult,
  handler,
  normalizeGenerationRequest,
  parseReferenceImage,
} from '../../netlify/functions/generate-image'

function createRequest(body, authorization = 'Bearer token-123') {
  const headers = authorization ? { Authorization: authorization } : undefined

  return new Request('https://example.com/.netlify/functions/generate-image', {
    method: 'POST',
    body,
    headers,
  })
}

function createSupabaseAdminClient({
  user = { id: 'user-1' },
  authError = null,
  insertResponse = {
    id: 'render-1',
    image_url: 'user-1/123456.png',
  },
  uploadError = null,
} = {}) {
  const upload = vi.fn().mockResolvedValue({
    data: uploadError ? null : { path: insertResponse.image_url },
    error: uploadError,
  })
  const single = vi.fn().mockResolvedValue({
    data: insertResponse,
    error: null,
  })
  const select = vi.fn(() => ({
    single,
  }))
  const insert = vi.fn(() => ({
    select,
  }))

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
          insert,
        }
      }),
    },
    spies: {
      insert,
      upload,
    },
  }
}

describe('normalizeGenerationRequest', () => {
  it('falls back to safe defaults for unsupported values', () => {
    const result = normalizeGenerationRequest(
      {
        model: 'unknown',
        size: '200x200',
        quality: 'ultra',
        background: 'none',
        moderation: 'strict',
        inputFidelity: 'maximum',
      },
      'gpt-image-1',
    )

    expect(result).toEqual({
      model: 'gpt-image-1',
      size: '1536x1024',
      quality: 'medium',
      background: 'opaque',
      moderation: 'auto',
      inputFidelity: 'high',
    })
  })
})

describe('parseReferenceImage', () => {
  it('returns a decoded buffer for supported data URLs', () => {
    const parsed = parseReferenceImage({
      dataUrl: 'data:image/png;base64,QUJD',
    })

    expect(parsed.mimeType).toBe('image/png')
    expect(parsed.buffer.toString('utf8')).toBe('ABC')
  })

  it('throws on invalid data URLs', () => {
    expect(() =>
      parseReferenceImage({
        dataUrl: 'https://example.com/image.png',
      }),
    ).toThrow('Reference image must be a base64 data URL.')
  })
})

describe('createImageResult', () => {
  it('uses image generation when there is no reference image', async () => {
    const generateMock = vi.fn().mockResolvedValue({
      data: [
        {
          b64_json: 'QUJD',
          revised_prompt: 'revised',
        },
      ],
    })

    const result = await createImageResult(
      {
        images: {
          generate: generateMock,
          edit: vi.fn(),
        },
      },
      {
        prompt: 'test prompt',
        generation: {
          size: '1024x1024',
          quality: 'high',
        },
      },
    )

    expect(generateMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      imageDataUrl: 'data:image/png;base64,QUJD',
      revisedPrompt: 'revised',
    })
  })

  it('rejects prompts that exceed the admin token ceiling', async () => {
    await expect(
      createImageResult(
        {
          images: {
            generate: vi.fn(),
            edit: vi.fn(),
          },
        },
        {
          prompt: 'A'.repeat(1200),
          guardrails: {
            maxPromptTokens: 200,
          },
        },
      ),
    ).rejects.toThrow('Prompt exceeds the admin ceiling')
  })
})

describe('handler', () => {
  it('returns 401 when the bearer token is missing', async () => {
    const { client } = createSupabaseAdminClient()

    const response = await handler(createRequest('{}', ''), {
      supabaseClient: client,
      openAiApiKey: 'test-key',
    })

    expect(response.status).toBe(401)
    expect((await response.json()).error).toBe(
      'Authorization header must use a Bearer token.',
    )
  })

  it('returns 401 when the Supabase token is invalid', async () => {
    const { client } = createSupabaseAdminClient({
      authError: new Error('invalid token'),
    })

    const response = await handler(createRequest('{}'), {
      supabaseClient: client,
      openAiApiKey: 'test-key',
    })

    expect(response.status).toBe(401)
    expect((await response.json()).error).toBe('Invalid or expired Supabase token.')
  })

  it('returns 400 for invalid json payloads after auth succeeds', async () => {
    const { client } = createSupabaseAdminClient()

    const response = await handler(createRequest('{invalid'), {
      supabaseClient: client,
      openAiApiKey: 'test-key',
    })

    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe(
      'Request body must be valid JSON.',
    )
  })

  it('returns 500 when the OpenAI key is missing', async () => {
    const { client } = createSupabaseAdminClient()

    const response = await handler(
      createRequest(
        JSON.stringify({
          prompt: 'test',
          projectId: 'project-1',
        }),
      ),
      {
        supabaseClient: client,
        openAiApiKey: '',
      },
    )

    expect(response.status).toBe(500)
    expect((await response.json()).error).toBe(
      'OPENAI_API_KEY is not configured.',
    )
  })

  it('verifies the user, uploads the image, and saves the render record', async () => {
    const { client, spies } = createSupabaseAdminClient()
    const createOpenAiClient = vi.fn(() => ({
      images: {
        generate: vi.fn().mockResolvedValue({
          data: [
            {
              b64_json: 'QUJD',
              revised_prompt: 'revised',
            },
          ],
        }),
        edit: vi.fn(),
      },
    }))

    const response = await handler(
      createRequest(
        JSON.stringify({
          prompt: 'test prompt',
          projectId: 'project-1',
          systemType: 'Clean Room',
          generation: {
            model: 'gpt-image-1.5',
            size: '1024x1024',
          },
        }),
      ),
      {
        supabaseClient: client,
        openAiApiKey: 'test-key',
        createOpenAiClient,
        now: () => 123456,
      },
    )

    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.imageDataUrl).toBe('data:image/png;base64,QUJD')
    expect(payload.storagePath).toBe('user-1/123456.png')
    expect(spies.upload).toHaveBeenCalledWith(
      'user-1/123456.png',
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
      image_url: 'user-1/123456.png',
      cost_usd: 0.04,
    })
  })
})
