import { createClient } from '@supabase/supabase-js'
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
export const DEFAULT_MAX_PROMPT_TOKENS = 700
export const DEFAULT_RENDER_COST_USD = 0.04

function createResponse(statusCode, payload) {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: JSON_HEADERS,
  })
}

function createHttpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

function readAllowedValue(value, allowedValues, fallback) {
  return allowedValues.includes(value) ? value : fallback
}

function normalizePromptTokenLimit(value) {
  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed < 200) {
    return DEFAULT_MAX_PROMPT_TOKENS
  }

  return parsed
}

function estimatePromptTokens(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return 0
  }

  return Math.max(1, Math.ceil(value.trim().length / 4))
}

function getImageBase64(result) {
  const base64 = result?.data?.[0]?.b64_json
  if (!base64) {
    throw new Error('OpenAI did not return image data.')
  }

  return base64
}

function toImageDataUrl(base64) {
  return `data:image/png;base64,${base64}`
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

export function readBearerToken(headers) {
  const headerValue =
    headers.get('authorization') || headers.get('Authorization') || ''
  const match = headerValue.match(/^Bearer\s+(.+)$/i)

  if (!match) {
    throw createHttpError(401, 'Authorization header must use a Bearer token.')
  }

  return match[1]
}

export function createSupabaseAdminClient(
  supabaseUrl = process.env.VITE_SUPABASE_URL,
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY,
) {
  if (!supabaseUrl || !serviceRoleKey) {
    throw createHttpError(500, 'Supabase server credentials are not configured.')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function authenticateRequest(request, adminClient) {
  const token = readBearerToken(request.headers)
  const { data, error } = await adminClient.auth.getUser(token)

  if (error || !data?.user) {
    throw createHttpError(401, 'Invalid or expired Supabase token.')
  }

  return data.user
}

export function extractPngBase64(dataUrl) {
  const match = String(dataUrl || '').match(/^data:image\/png;base64,(.+)$/i)

  if (!match) {
    throw new Error('Generated image data is invalid.')
  }

  return match[1]
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

  const promptTokenLimit = normalizePromptTokenLimit(
    payload?.guardrails?.maxPromptTokens,
  )
  const promptTokenEstimate = estimatePromptTokens(prompt)
  if (promptTokenEstimate > promptTokenLimit) {
    throw new Error(
      `Prompt exceeds the admin ceiling (${promptTokenEstimate}/${promptTokenLimit} approx. tokens).`,
    )
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
    const imageBase64 = getImageBase64(result)

    return {
      imageDataUrl: toImageDataUrl(imageBase64),
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
  const imageBase64 = getImageBase64(result)

  return {
    imageDataUrl: toImageDataUrl(imageBase64),
    revisedPrompt: result?.data?.[0]?.revised_prompt || '',
  }
}

export async function uploadGeneratedImage(
  adminClient,
  { userId, imageDataUrl, timestamp = Date.now() },
) {
  if (!userId) {
    throw new Error('A user is required to save the generated render.')
  }

  const imageBase64 = extractPngBase64(imageDataUrl)
  const storagePath = `${userId}/${timestamp}.png`
  const buffer = Buffer.from(imageBase64, 'base64')

  const { error } = await adminClient
    .storage
    .from('renders')
    .upload(storagePath, buffer, {
      contentType: 'image/png',
      upsert: false,
    })

  if (error) {
    throw new Error(error.message || 'Unable to upload the render image.')
  }

  return storagePath
}

export async function persistRenderRecord(adminClient, record) {
  const { data, error } = await adminClient
    .from('renders')
    .insert(record)
    .select('id, image_url')
    .single()

  if (error) {
    throw new Error(error.message || 'Unable to save the render record.')
  }

  return data
}

export async function handler(request, dependencies = {}) {
  if (request.method !== 'POST') {
    return createResponse(405, { error: 'Method not allowed.' })
  }

  const {
    openAiApiKey = process.env.OPENAI_API_KEY,
    defaultModel = process.env.OPENAI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL,
    supabaseClient = null,
    createOpenAiClient = (apiKey) =>
      new OpenAI({
        apiKey,
      }),
    now = () => Date.now(),
  } = dependencies

  let adminClient
  let user
  try {
    adminClient = supabaseClient || createSupabaseAdminClient()
    user = await authenticateRequest(request, adminClient)
  } catch (error) {
    return createResponse(error.status || 401, {
      error: error.message || 'Invalid or expired Supabase token.',
    })
  }

  if (!openAiApiKey) {
    return createResponse(500, { error: 'OPENAI_API_KEY is not configured.' })
  }

  let payload
  try {
    payload = JSON.parse((await request.text()) || '{}')
  } catch {
    return createResponse(400, { error: 'Request body must be valid JSON.' })
  }

  const projectId = String(payload?.projectId || '').trim()
  if (!projectId) {
    return createResponse(400, { error: 'projectId is required.' })
  }

  try {
    const openAiClient = createOpenAiClient(openAiApiKey)
    const result = await createImageResult(openAiClient, payload, defaultModel)
    const storagePath = await uploadGeneratedImage(adminClient, {
      userId: user.id,
      imageDataUrl: result.imageDataUrl,
      timestamp: now(),
    })
    const renderRecord = await persistRenderRecord(adminClient, {
      user_id: user.id,
      project_id: projectId,
      system_type: String(payload?.systemType || '').trim() || 'Unknown system',
      prompt_used: String(payload?.prompt || '').trim(),
      image_url: storagePath,
      cost_usd: DEFAULT_RENDER_COST_USD,
    })

    return createResponse(200, {
      ...result,
      renderId: renderRecord?.id || null,
      storagePath,
    })
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
