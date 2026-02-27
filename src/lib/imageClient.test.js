import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_ADMIN_CONFIG } from '../data/defaults'
import {
  buildGenerationRequest,
  generateImageRequest,
  getImageSize,
} from './imageClient'

describe('getImageSize', () => {
  it('maps supported aspect ratios to the constrained OpenAI sizes', () => {
    expect(getImageSize('1:1')).toBe('1024x1024')
    expect(getImageSize('4:3')).toBe('1536x1024')
    expect(getImageSize('16:9')).toBe('1536x1024')
    expect(getImageSize('21:9')).toBe('1536x1024')
    expect(getImageSize('unknown')).toBe('1536x1024')
  })
})

describe('buildGenerationRequest', () => {
  it('creates the API payload from the admin configuration', () => {
    const payload = buildGenerationRequest({
      prompt: 'test prompt',
      aspect: '1:1',
      adminConfig: DEFAULT_ADMIN_CONFIG,
      referenceImage: {
        dataUrl: 'data:image/png;base64,AAA',
        mimeType: 'image/png',
        name: 'test.png',
      },
    })

    expect(payload).toEqual({
      prompt: 'test prompt',
      referenceImage: {
        dataUrl: 'data:image/png;base64,AAA',
        mimeType: 'image/png',
      },
      generation: {
        model: DEFAULT_ADMIN_CONFIG.generation.model,
        size: '1024x1024',
        quality: DEFAULT_ADMIN_CONFIG.generation.quality,
        background: DEFAULT_ADMIN_CONFIG.generation.background,
        moderation: DEFAULT_ADMIN_CONFIG.generation.moderation,
        inputFidelity: DEFAULT_ADMIN_CONFIG.generation.inputFidelity,
      },
      guardrails: {
        maxPromptTokens: DEFAULT_ADMIN_CONFIG.limits.maxPromptTokens,
      },
    })
  })
})

describe('generateImageRequest', () => {
  it('calls the Netlify function and returns the parsed payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        imageDataUrl: 'data:image/png;base64,AAA',
      }),
    })

    const result = await generateImageRequest(
      { prompt: 'test', referenceImage: null, generation: {} },
      fetchMock,
    )

    expect(fetchMock).toHaveBeenCalledWith('/.netlify/functions/generate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'test',
        referenceImage: null,
        generation: {},
      }),
    })
    expect(result.imageDataUrl).toBe('data:image/png;base64,AAA')
  })

  it('throws a readable error when the request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({
        error: 'OpenAI request failed.',
      }),
    })

    await expect(
      generateImageRequest(
        { prompt: 'test', referenceImage: null, generation: {} },
        fetchMock,
      ),
    ).rejects.toThrow('OpenAI request failed.')
  })
})
