import {
  DEFAULT_RENDER_COST_USD,
  authenticateRequest,
  createSupabaseAdminClient,
  persistRenderRecord,
  uploadGeneratedImage,
} from './generate-image'

const JSON_HEADERS = {
  'Content-Type': 'application/json',
}

function createResponse(statusCode, payload) {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: JSON_HEADERS,
  })
}

function toTrimmedText(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
}

async function findExistingRender(adminClient, userId, storagePath) {
  const { data, error } = await adminClient
    .from('renders')
    .select('id, image_url')
    .eq('user_id', userId)
    .eq('image_url', storagePath)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Unable to verify the saved render.')
  }

  return data
}

export async function handler(request, dependencies = {}) {
  if (request.method !== 'POST') {
    return createResponse(405, { error: 'Method not allowed.' })
  }

  const {
    supabaseClient = null,
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

  let payload

  try {
    payload = JSON.parse((await request.text()) || '{}')
  } catch {
    return createResponse(400, { error: 'Request body must be valid JSON.' })
  }

  const projectId = toTrimmedText(payload.projectId)
  const systemType = toTrimmedText(payload.systemType)
  const prompt = toTrimmedText(payload.prompt)
  const imageDataUrl = toTrimmedText(payload.imageDataUrl)
  const saveKey = toTrimmedText(payload.saveKey)

  if (!projectId || !imageDataUrl || !saveKey) {
    return createResponse(400, {
      error: 'projectId, imageDataUrl, and saveKey are required.',
    })
  }

  const storagePath = `${user.id}/${saveKey}.png`

  try {
    const existingRender = await findExistingRender(adminClient, user.id, storagePath)

    if (existingRender) {
      return createResponse(200, {
        renderId: existingRender.id,
        storagePath,
        message: 'This render is already saved in your gallery.',
      })
    }

    await uploadGeneratedImage(adminClient, {
      userId: user.id,
      imageDataUrl,
      timestamp: saveKey,
    })

    const renderRecord = await persistRenderRecord(adminClient, {
      user_id: user.id,
      project_id: projectId,
      system_type: systemType || 'Unknown system',
      prompt_used: prompt,
      image_url: storagePath,
      cost_usd: DEFAULT_RENDER_COST_USD,
    })

    return createResponse(200, {
      renderId: renderRecord?.id || null,
      storagePath,
      message: 'Saved to your gallery.',
    })
  } catch (error) {
    return createResponse(500, {
      error: error.message || 'Saving the render failed.',
    })
  }
}

export default handler
