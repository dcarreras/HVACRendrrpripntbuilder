/**
 * @typedef {import('../types/prompt').AdminConfig} AdminConfig
 * @typedef {import('../types/prompt').ReferenceImage} ReferenceImage
 */

export const ASPECT_SIZE_MAP = {
  '1:1': '1024x1024',
  '4:3': '1536x1024',
  '16:9': '1536x1024',
  '21:9': '1536x1024',
}

/**
 * @param {string} aspect
 * @returns {string}
 */
export function getImageSize(aspect) {
  return ASPECT_SIZE_MAP[aspect] || ASPECT_SIZE_MAP['16:9']
}

/**
 * @param {{
 *   prompt: string
 *   aspect: string
 *   adminConfig: AdminConfig
 *   referenceImage?: ReferenceImage | null
 *   projectId?: string
 *   systemType?: string
 * }} options
 * @returns {{
 *   prompt: string
 *   projectId: string
 *   systemType: string
 *   referenceImage: { dataUrl: string, mimeType: string } | null
 *   generation: {
 *     model: string
 *     size: string
 *     quality: string
 *     background: string
 *     moderation: string
 *     inputFidelity: string
 *   }
 *   guardrails: {
 *     maxPromptTokens: number
 *   }
 * }}
 */
export function buildGenerationRequest({
  prompt,
  aspect,
  adminConfig,
  referenceImage = null,
  projectId = '',
  systemType = '',
}) {
  return {
    prompt,
    projectId,
    systemType,
    referenceImage: referenceImage
      ? {
          dataUrl: referenceImage.dataUrl,
          mimeType: referenceImage.mimeType,
        }
      : null,
    generation: {
      model: adminConfig.generation.model,
      size: getImageSize(aspect),
      quality: adminConfig.generation.quality,
      background: adminConfig.generation.background,
      moderation: adminConfig.generation.moderation,
      inputFidelity: adminConfig.generation.inputFidelity,
    },
    guardrails: {
      maxPromptTokens: adminConfig.limits.maxPromptTokens,
    },
  }
}

/**
 * @param {ReturnType<typeof buildGenerationRequest>} payload
 * @param {string | typeof fetch} accessTokenOrFetch
 * @param {typeof fetch} fetchImpl
 * @returns {Promise<{ imageDataUrl: string, revisedPrompt?: string }>}
 */
export async function generateImageRequest(
  payload,
  accessTokenOrFetch = '',
  fetchImpl = fetch,
) {
  const accessToken =
    typeof accessTokenOrFetch === 'string' ? accessTokenOrFetch : ''
  const requestFetch =
    typeof accessTokenOrFetch === 'function' ? accessTokenOrFetch : fetchImpl
  const headers = {
    'Content-Type': 'application/json',
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  const response = await requestFetch('/.netlify/functions/generate-image', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.error || 'Image generation failed.')
  }

  if (!data?.imageDataUrl) {
    throw new Error('Image generation returned no image data.')
  }

  return data
}
