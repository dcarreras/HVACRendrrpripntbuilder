const ADMIN_USERS_ENDPOINT = '/.netlify/functions/admin-users'

function getAuthHeaders(accessToken) {
  if (!accessToken) {
    throw new Error('An authenticated admin session is required.')
  }

  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

async function parseAdminResponse(response) {
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(payload?.error || 'Admin request failed.')
  }

  return payload
}

async function postAdminAction(accessToken, action, body = {}, fetchImpl = fetch) {
  const response = await fetchImpl(ADMIN_USERS_ENDPOINT, {
    method: 'POST',
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify({
      action,
      ...body,
    }),
  })

  return parseAdminResponse(response)
}

export async function listManagedUsers(accessToken, fetchImpl = fetch) {
  const response = await fetchImpl(ADMIN_USERS_ENDPOINT, {
    method: 'GET',
    headers: {
      Authorization: getAuthHeaders(accessToken).Authorization,
    },
  })

  const payload = await parseAdminResponse(response)
  return payload.users || []
}

export async function createManagedUser(
  { email, password, role = 'user' },
  accessToken,
  fetchImpl = fetch,
) {
  return postAdminAction(
    accessToken,
    'create',
    {
      email,
      password,
      role,
    },
    fetchImpl,
  )
}

export async function updateManagedUser(
  { userId, password = '', role },
  accessToken,
  fetchImpl = fetch,
) {
  return postAdminAction(
    accessToken,
    'update',
    {
      userId,
      password,
      role,
    },
    fetchImpl,
  )
}

export async function clearManagedUserGallery(
  { userId },
  accessToken,
  fetchImpl = fetch,
) {
  return postAdminAction(
    accessToken,
    'clear-gallery',
    {
      userId,
    },
    fetchImpl,
  )
}

export async function deleteManagedUser(
  { userId },
  accessToken,
  fetchImpl = fetch,
) {
  return postAdminAction(
    accessToken,
    'delete',
    {
      userId,
    },
    fetchImpl,
  )
}
