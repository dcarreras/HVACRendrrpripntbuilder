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
 *   saveKey?: string
 * }} options
 * @returns {{
 *   prompt: string
 *   projectId: string
 *   systemType: string
 *   saveKey: string
 *   autoSave: boolean
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
  saveKey = '',
}) {
  return {
    prompt,
    projectId,
    systemType,
    saveKey,
    autoSave: false,
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

  const endpoint = '/.netlify/functions/generate-image'
  const response = await requestFetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        'The local Netlify function was not found. Run the app with "npx.cmd netlify dev" to enable image generation locally.',
      )
    }

    throw new Error(data?.error || 'Image generation failed.')
  }

  if (!data?.imageDataUrl) {
    throw new Error('Image generation returned no image data.')
  }

  return data
}

/**
 * @param {{
 *   imageDataUrl: string
 *   projectId: string
 *   systemType: string
 *   prompt: string
 *   saveKey: string
 * }} payload
 * @param {string | typeof fetch} accessTokenOrFetch
 * @param {typeof fetch} fetchImpl
 * @returns {Promise<{ renderId?: string, storagePath?: string, message?: string }>}
 */
export async function saveRenderRequest(
  payload,
  accessTokenOrFetch = '',
  fetchImpl = fetch,
) {
  const accessToken =
    typeof accessTokenOrFetch === 'string' ? accessTokenOrFetch : ''
  const requestFetch =
    typeof accessTokenOrFetch === 'function' ? accessTokenOrFetch : fetchImpl
  const response = await requestFetch('/.netlify/functions/save-render', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        'The local Netlify function was not found. Run the app with "npx.cmd netlify dev" to enable gallery saves locally.',
      )
    }

    throw new Error(data?.error || 'Saving the render failed.')
  }

  return data || {}
}
