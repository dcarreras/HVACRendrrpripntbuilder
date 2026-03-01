import { createClient } from '@supabase/supabase-js'

const JSON_HEADERS = {
  'Content-Type': 'application/json',
}

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

function readBearerToken(headers) {
  const headerValue =
    headers.get('authorization') || headers.get('Authorization') || ''
  const match = headerValue.match(/^Bearer\s+(.+)$/i)

  if (!match) {
    throw createHttpError(401, 'Authorization header must use a Bearer token.')
  }

  return match[1]
}

function assertNoError(error, fallbackMessage, status = 500) {
  if (!error) {
    return
  }

  throw createHttpError(status, error.message || fallbackMessage)
}

function toTrimmedText(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
}

function normalizeRole(value) {
  return value === 'admin' ? 'admin' : 'user'
}

function isAdminUser(user) {
  return (
    user?.app_metadata?.role === 'admin' ||
    user?.user_metadata?.role === 'admin'
  )
}

function getUserRole(user) {
  return normalizeRole(user?.app_metadata?.role || user?.user_metadata?.role)
}

function createSupabaseAdminClient(
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

async function authenticateAdminRequest(request, adminClient) {
  const token = readBearerToken(request.headers)
  const { data, error } = await adminClient.auth.getUser(token)

  if (error || !data?.user) {
    throw createHttpError(401, 'Invalid or expired Supabase token.')
  }

  if (!isAdminUser(data.user)) {
    throw createHttpError(403, 'Admin access is required.')
  }

  return data.user
}

function buildManagedUserView(user, stats) {
  return {
    id: user.id,
    email: user.email || '',
    role: getUserRole(user),
    createdAt: user.created_at || '',
    lastSignInAt: user.last_sign_in_at || '',
    renderCount: stats.count,
    latestRenderAt: stats.latestRenderAt,
  }
}

async function listRenderStatsByUser(adminClient) {
  const { data, error } = await adminClient
    .from('renders')
    .select('user_id, created_at')

  assertNoError(error, 'Unable to load render statistics.')

  return (data || []).reduce((accumulator, row) => {
    const userId = row.user_id

    if (!userId) {
      return accumulator
    }

    const existing = accumulator.get(userId) || {
      count: 0,
      latestRenderAt: '',
    }

    const nextLatest =
      !existing.latestRenderAt || existing.latestRenderAt < row.created_at
        ? row.created_at
        : existing.latestRenderAt

    accumulator.set(userId, {
      count: existing.count + 1,
      latestRenderAt: nextLatest,
    })

    return accumulator
  }, new Map())
}

export async function listManagedUsers(adminClient) {
  const [{ data, error }, statsByUser] = await Promise.all([
    adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    }),
    listRenderStatsByUser(adminClient),
  ])

  assertNoError(error, 'Unable to load users.')

  return (data?.users || []).map((user) =>
    buildManagedUserView(
      user,
      statsByUser.get(user.id) || {
        count: 0,
        latestRenderAt: '',
      },
    ),
  )
}

async function getManagedUser(adminClient, userId) {
  const { data, error } = await adminClient.auth.admin.getUserById(userId)

  assertNoError(error, 'Unable to load the selected user.', 400)

  if (!data?.user) {
    throw createHttpError(404, 'The selected user was not found.')
  }

  return data.user
}

export async function createManagedUser(adminClient, payload) {
  const email = toTrimmedText(payload.email)
  const password = toTrimmedText(payload.password)
  const role = normalizeRole(payload.role)

  if (!email) {
    throw createHttpError(400, 'Email is required.')
  }

  if (password.length < 4) {
    throw createHttpError(400, 'Password must be at least 4 characters long.')
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role,
    },
    app_metadata: {
      role,
    },
  })

  assertNoError(error, 'Unable to create the user.', 400)

  return {
    message: `User ${data?.user?.email || email} created.`,
  }
}

export async function updateManagedUser(adminClient, payload) {
  const userId = toTrimmedText(payload.userId)
  const password = toTrimmedText(payload.password)
  const role = normalizeRole(payload.role)

  if (!userId) {
    throw createHttpError(400, 'userId is required.')
  }

  const user = await getManagedUser(adminClient, userId)
  const attributes = {
    user_metadata: {
      ...(user.user_metadata || {}),
      role,
    },
    app_metadata: {
      ...(user.app_metadata || {}),
      role,
    },
  }

  if (password) {
    if (password.length < 4) {
      throw createHttpError(400, 'Password must be at least 4 characters long.')
    }

    attributes.password = password
  }

  const { error } = await adminClient.auth.admin.updateUserById(userId, attributes)

  assertNoError(error, 'Unable to update the user.', 400)

  return {
    message: `Access updated for ${user.email || 'the selected user'}.`,
  }
}

function chunkItems(items, chunkSize) {
  const chunks = []

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize))
  }

  return chunks
}

export async function clearManagedUserGallery(adminClient, payload) {
  const userId = toTrimmedText(payload.userId)

  if (!userId) {
    throw createHttpError(400, 'userId is required.')
  }

  const { data, error } = await adminClient
    .from('renders')
    .select('id, image_url')
    .eq('user_id', userId)

  assertNoError(error, 'Unable to load the user gallery.', 400)

  const rows = data || []
  const storagePaths = rows
    .map((row) => row.image_url)
    .filter(Boolean)

  for (const chunk of chunkItems(storagePaths, 100)) {
    if (!chunk.length) {
      continue
    }

    const { error: storageError } = await adminClient
      .storage
      .from('renders')
      .remove(chunk)

    assertNoError(storageError, 'Unable to clear render files.', 500)
  }

  const { error: deleteError } = await adminClient
    .from('renders')
    .delete()
    .eq('user_id', userId)

  assertNoError(deleteError, 'Unable to clear render records.', 500)

  return {
    message: rows.length
      ? `Deleted ${rows.length} render records for the selected user.`
      : 'The selected user has no saved renders.',
  }
}

export async function deleteManagedUser(adminClient, payload, requester) {
  const userId = toTrimmedText(payload.userId)

  if (!userId) {
    throw createHttpError(400, 'userId is required.')
  }

  if (userId === requester.id) {
    throw createHttpError(400, 'You cannot delete the active admin account.')
  }

  const user = await getManagedUser(adminClient, userId)
  const galleryResult = await clearManagedUserGallery(adminClient, payload)
  const { error } = await adminClient.auth.admin.deleteUser(userId)

  assertNoError(error, 'Unable to delete the user.', 500)

  return {
    message: `${user.email || 'User'} deleted. ${galleryResult.message}`,
  }
}

export async function handler(request, dependencies = {}) {
  try {
    const adminClient = dependencies.adminClient || createSupabaseAdminClient()
    const requester = await authenticateAdminRequest(request, adminClient)

    if (request.method === 'GET') {
      return createResponse(200, {
        users: await listManagedUsers(adminClient),
      })
    }

    if (request.method !== 'POST') {
      return createResponse(405, { error: 'Method not allowed.' })
    }

    let payload

    try {
      payload = JSON.parse((await request.text()) || '{}')
    } catch {
      return createResponse(400, { error: 'Request body must be valid JSON.' })
    }

    const action = toTrimmedText(payload.action)

    if (action === 'create') {
      return createResponse(200, await createManagedUser(adminClient, payload))
    }

    if (action === 'update') {
      return createResponse(200, await updateManagedUser(adminClient, payload))
    }

    if (action === 'clear-gallery') {
      return createResponse(200, await clearManagedUserGallery(adminClient, payload))
    }

    if (action === 'delete') {
      return createResponse(
        200,
        await deleteManagedUser(adminClient, payload, requester),
      )
    }

    return createResponse(400, { error: 'Unsupported admin action.' })
  } catch (error) {
    return createResponse(error.status || 500, {
      error: error.message || 'Admin request failed.',
    })
  }
}

export default handler
