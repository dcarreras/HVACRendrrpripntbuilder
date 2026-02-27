import OpenAI, { toFile } from 'openai'

const JSON_HEADERS = {
  'Content-Type': 'application/json',
}

const ALLOWED_MODELS = ['gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini']
const ALLOWED_SIZES = ['1024x1024', '1536x1024']
const ALLOWED_QUALITY = ['low', 'medium', 'high']
const ALLOWED_BACKGROUND = ['opaque', 'transparent', 'auto']
const ALLOWED_MODERATION = ['auto', 'low']
const ALLOWED_INPUT_FIDELITY = ['low', 'high']
const ALLOWED_REFERENCE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export const DEFAULT_IMAGE_MODEL = 'gpt-image-1.5'

function createResponse(statusCode, payload) {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: JSON_HEADERS,
  })
}

function readAllowedValue(value, allowedValues, fallback) {
  return allowedValues.includes(value) ? value : fallback
}

export function normalizeGenerationRequest(
  generation = {},
  defaultModel = DEFAULT_IMAGE_MODEL,
) {
  return {
    model: readAllowedValue(
      generation.model,
      ALLOWED_MODELS,
      readAllowedValue(defaultModel, ALLOWED_MODELS, DEFAULT_IMAGE_MODEL),
    ),
    size: readAllowedValue(generation.size, ALLOWED_SIZES, '1536x1024'),
    quality: readAllowedValue(generation.quality, ALLOWED_QUALITY, 'medium'),
    background: readAllowedValue(
      generation.background,
      ALLOWED_BACKGROUND,
      'opaque',
    ),
    moderation: readAllowedValue(
      generation.moderation,
      ALLOWED_MODERATION,
      'auto',
    ),
    inputFidelity: readAllowedValue(
      generation.inputFidelity,
      ALLOWED_INPUT_FIDELITY,
      'high',
    ),
  }
}

export function parseReferenceImage(referenceImage) {
  if (!referenceImage?.dataUrl) {
    return null
  }

  const match = String(referenceImage.dataUrl).match(
    /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/i,
  )

  if (!match) {
    throw new Error('Reference image must be a base64 data URL.')
  }

  const mimeType = match[1].toLowerCase()
  if (!ALLOWED_REFERENCE_TYPES.includes(mimeType)) {
    throw new Error('Reference image type is not supported.')
  }

  return {
    mimeType,
    buffer: Buffer.from(match[2], 'base64'),
  }
}

function getFileName(mimeType) {
  if (mimeType === 'image/jpeg') {
    return 'reference.jpg'
  }

  if (mimeType === 'image/webp') {
    return 'reference.webp'
  }

  return 'reference.png'
}

function toImageDataUrl(result) {
  const base64 = result?.data?.[0]?.b64_json
  if (!base64) {
    throw new Error('OpenAI did not return image data.')
  }

  return `data:image/png;base64,${base64}`
}

export async function createImageResult(
  client,
  payload,
  defaultModel = DEFAULT_IMAGE_MODEL,
) {
  const prompt = payload?.prompt?.trim()
  if (!prompt) {
    throw new Error('Prompt is required.')
  }

  const generation = normalizeGenerationRequest(payload?.generation, defaultModel)
  const referenceImage = parseReferenceImage(payload?.referenceImage)

  if (referenceImage) {
    const imageFile = await toFile(
      referenceImage.buffer,
      getFileName(referenceImage.mimeType),
      {
        type: referenceImage.mimeType,
      },
    )

    const result = await client.images.edit({
      model: generation.model,
      prompt,
      image: imageFile,
      size: generation.size,
      quality: generation.quality,
      background: generation.background,
      moderation: generation.moderation,
      input_fidelity: generation.inputFidelity,
      n: 1,
      output_format: 'png',
    })

    return {
      imageDataUrl: toImageDataUrl(result),
      revisedPrompt: result?.data?.[0]?.revised_prompt || '',
    }
  }

  const result = await client.images.generate({
    model: generation.model,
    prompt,
    size: generation.size,
    quality: generation.quality,
    background: generation.background,
    moderation: generation.moderation,
    n: 1,
    output_format: 'png',
  })

  return {
    imageDataUrl: toImageDataUrl(result),
    revisedPrompt: result?.data?.[0]?.revised_prompt || '',
  }
}

export async function handler(request) {
  if (request.method !== 'POST') {
    return createResponse(405, { error: 'Method not allowed.' })
  }

  if (!process.env.OPENAI_API_KEY) {
    return createResponse(500, { error: 'OPENAI_API_KEY is not configured.' })
  }

  let payload
  try {
    payload = JSON.parse((await request.text()) || '{}')
  } catch {
    return createResponse(400, { error: 'Request body must be valid JSON.' })
  }

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const result = await createImageResult(
      client,
      payload,
      process.env.OPENAI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL,
    )

    return createResponse(200, result)
  } catch (error) {
    const statusCode =
      typeof error?.status === 'number' && error.status >= 400
        ? error.status
        : 502

    return createResponse(statusCode, {
      error: error?.message || 'Image generation failed.',
    })
  }
}

export default handler
