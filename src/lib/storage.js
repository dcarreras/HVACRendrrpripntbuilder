import { DEFAULT_ADMIN_CONFIG } from '../data/defaults'

export const SESSION_STORAGE_KEY = 'hvac-render-session'
export const ADMIN_CONFIG_STORAGE_KEY = 'hvac-render-admin-config'
export const ATTEMPT_COUNT_STORAGE_KEY = 'hvac-render-attempt-count'

export const DEFAULT_SESSION = {
  role: null,
  isAuthenticated: false,
  displayName: '',
  email: '',
}

function safeParse(value) {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function toPositiveInteger(value, fallback, minimum = 1) {
  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed < minimum) {
    return fallback
  }

  return parsed
}

export function mergeAdminConfig(candidate = {}) {
  const source =
    candidate && typeof candidate === 'object' ? candidate : {}

  const palette = Object.fromEntries(
    Object.entries(DEFAULT_ADMIN_CONFIG.palette).map(([key, entry]) => [
      key,
      {
        ...entry,
        ...(source.palette?.[key] || {}),
      },
    ]),
  )

  return {
    palette,
    generation: {
      ...DEFAULT_ADMIN_CONFIG.generation,
      ...(source.generation || {}),
    },
    limits: {
      maxPromptTokens: toPositiveInteger(
        source.limits?.maxPromptTokens,
        DEFAULT_ADMIN_CONFIG.limits.maxPromptTokens,
        200,
      ),
      maxAttemptsPerSession: toPositiveInteger(
        source.limits?.maxAttemptsPerSession,
        DEFAULT_ADMIN_CONFIG.limits.maxAttemptsPerSession,
      ),
    },
    promptDefaults: {
      ...DEFAULT_ADMIN_CONFIG.promptDefaults,
      ...(source.promptDefaults || {}),
    },
  }
}

export function loadSession(storage) {
  const parsed = safeParse(storage?.getItem?.(SESSION_STORAGE_KEY))
  if (!parsed?.isAuthenticated || !parsed.role) {
    return DEFAULT_SESSION
  }

  return {
    ...DEFAULT_SESSION,
    ...parsed,
    isAuthenticated: true,
  }
}

export function saveSession(storage, session) {
  storage?.setItem?.(SESSION_STORAGE_KEY, JSON.stringify(session))
}

export function clearSession(storage) {
  storage?.removeItem?.(SESSION_STORAGE_KEY)
}

export function loadAdminConfig(storage) {
  const parsed = safeParse(storage?.getItem?.(ADMIN_CONFIG_STORAGE_KEY))
  return mergeAdminConfig(parsed)
}

export function saveAdminConfig(storage, config) {
  storage?.setItem?.(
    ADMIN_CONFIG_STORAGE_KEY,
    JSON.stringify(mergeAdminConfig(config)),
  )
}

export function loadAttemptCount(storage) {
  const rawValue = storage?.getItem?.(ATTEMPT_COUNT_STORAGE_KEY)
  return toPositiveInteger(rawValue, 0, 0)
}

export function saveAttemptCount(storage, count) {
  storage?.setItem?.(
    ATTEMPT_COUNT_STORAGE_KEY,
    String(toPositiveInteger(count, 0, 0)),
  )
}
