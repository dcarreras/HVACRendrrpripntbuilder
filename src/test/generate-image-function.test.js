import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createImageResult,
  handler,
  normalizeGenerationRequest,
  parseReferenceImage,
} from '../../netlify/functions/generate-image'

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
})

describe('handler', () => {
  const originalApiKey = process.env.OPENAI_API_KEY

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalApiKey
  })

  it('returns 400 for invalid json payloads', async () => {
    process.env.OPENAI_API_KEY = 'test-key'

    const response = await handler(
      new Request('https://example.com/.netlify/functions/generate-image', {
        method: 'POST',
        body: '{invalid',
      }),
    )

    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe(
      'Request body must be valid JSON.',
    )
  })

  it('returns 500 when the OpenAI key is missing', async () => {
    delete process.env.OPENAI_API_KEY

    const response = await handler(
      new Request('https://example.com/.netlify/functions/generate-image', {
        method: 'POST',
        body: '{}',
      }),
    )

    expect(response.status).toBe(500)
    expect((await response.json()).error).toBe(
      'OPENAI_API_KEY is not configured.',
    )
  })
})
