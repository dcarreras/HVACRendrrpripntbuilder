import { DEFAULT_ADMIN_CONFIG } from '../data/defaults'
import { supabase } from './supabaseClient'

export const ATTEMPT_COUNT_STORAGE_KEY = 'hvac-render-attempt-count'
export const SIGNED_RENDER_URL_TTL_SECONDS = 60 * 60

function getDefaultSessionStorage() {
  if (typeof window === 'undefined') {
    return undefined
  }

  return window.sessionStorage
}

function toPositiveInteger(value, fallback, minimum = 1) {
  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed < minimum) {
    return fallback
  }

  return parsed
}

function toPositiveNumber(value, fallback, minimum = 0) {
  const parsed = Number.parseFloat(value)

  if (!Number.isFinite(parsed) || parsed < minimum) {
    return fallback
  }

  return parsed
}

function toTrimmedText(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
}

function getClient(client = supabase) {
  if (!client) {
    throw new Error('Supabase client is not configured.')
  }

  return client
}

function assertNoError(error, fallbackMessage) {
  if (!error) {
    return
  }

  throw new Error(error.message || fallbackMessage)
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
      budgetLimitUsd: toPositiveNumber(
        source.limits?.budgetLimitUsd,
        DEFAULT_ADMIN_CONFIG.limits.budgetLimitUsd,
        0,
      ),
    },
    promptDefaults: {
      ...DEFAULT_ADMIN_CONFIG.promptDefaults,
      ...(source.promptDefaults || {}),
    },
  }
}

export function loadAttemptCount(storage = getDefaultSessionStorage()) {
  const rawValue = storage?.getItem?.(ATTEMPT_COUNT_STORAGE_KEY)
  return toPositiveInteger(rawValue, 0, 0)
}

export function saveAttemptCount(storage = getDefaultSessionStorage(), count) {
  storage?.setItem?.(
    ATTEMPT_COUNT_STORAGE_KEY,
    String(toPositiveInteger(count, 0, 0)),
  )
}

export function mapAdminConfigToProjectConfigRow(projectId, config) {
  const normalized = mergeAdminConfig(config)

  return {
    project_id: projectId,
    palette: normalized.palette,
    presets: {
      generation: {
        model: normalized.generation.model,
        background: normalized.generation.background,
        moderation: normalized.generation.moderation,
        inputFidelity: normalized.generation.inputFidelity,
      },
      limits: {
        maxPromptTokens: normalized.limits.maxPromptTokens,
        maxAttemptsPerSession: normalized.limits.maxAttemptsPerSession,
      },
      promptDefaults: {
        referenceFidelity: normalized.promptDefaults.referenceFidelity,
        negative: normalized.promptDefaults.negative,
      },
    },
    openai_quality: normalized.generation.quality,
    budget_limit_usd: normalized.limits.budgetLimitUsd,
    updated_at: new Date().toISOString(),
  }
}

export function mapProjectConfigRowToAdminConfig(row) {
  if (!row) {
    return mergeAdminConfig(DEFAULT_ADMIN_CONFIG)
  }

  const presets =
    row.presets && typeof row.presets === 'object' ? row.presets : {}

  return mergeAdminConfig({
    palette: row.palette,
    generation: {
      model: presets.generation?.model,
      quality: row.openai_quality,
      background: presets.generation?.background,
      moderation: presets.generation?.moderation,
      inputFidelity: presets.generation?.inputFidelity,
    },
    limits: {
      maxPromptTokens: presets.limits?.maxPromptTokens,
      maxAttemptsPerSession: presets.limits?.maxAttemptsPerSession,
      budgetLimitUsd: row.budget_limit_usd,
    },
    promptDefaults: {
      referenceFidelity: presets.promptDefaults?.referenceFidelity,
      negative: presets.promptDefaults?.negative,
    },
  })
}

export async function ensureProject({ name, company }, options = {}) {
  const client = getClient(options.client)
  const normalizedName = toTrimmedText(name)
  const normalizedCompany = toTrimmedText(company)

  if (!normalizedName || !normalizedCompany) {
    throw new Error('Project name and company are required.')
  }

  const { data: existingProject, error: existingError } = await client
    .from('projects')
    .select('*')
    .eq('name', normalizedName)
    .eq('company', normalizedCompany)
    .maybeSingle()

  assertNoError(existingError, 'Unable to load the project.')

  if (existingProject) {
    return existingProject
  }

  const { data: insertedProject, error: insertError } = await client
    .from('projects')
    .insert({
      name: normalizedName,
      company: normalizedCompany,
    })
    .select('*')
    .single()

  if (!insertError) {
    return insertedProject
  }

  if (insertError.code === '23505') {
    const { data: retriedProject, error: retryError } = await client
      .from('projects')
      .select('*')
      .eq('name', normalizedName)
      .eq('company', normalizedCompany)
      .single()

    assertNoError(retryError, 'Unable to load the project.')
    return retriedProject
  }

  throw new Error(insertError.message || 'Unable to create the project.')
}

export async function listProjects(options = {}) {
  const client = getClient(options.client)
  const { data, error } = await client
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  assertNoError(error, 'Unable to load projects.')

  return data || []
}

export async function getProjectConfig(projectId, options = {}) {
  if (!projectId) {
    return mergeAdminConfig(DEFAULT_ADMIN_CONFIG)
  }

  const client = getClient(options.client)
  const { data, error } = await client
    .from('project_config')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle()

  assertNoError(error, 'Unable to load the project configuration.')

  return mapProjectConfigRowToAdminConfig(data)
}

export async function saveProjectConfig({ projectId, config }, options = {}) {
  if (!projectId) {
    throw new Error('A project must be selected before saving configuration.')
  }

  const client = getClient(options.client)
  const payload = mapAdminConfigToProjectConfigRow(projectId, config)
  const { data, error } = await client
    .from('project_config')
    .upsert(payload, {
      onConflict: 'project_id',
    })
    .select('*')
    .single()

  assertNoError(error, 'Unable to save the project configuration.')

  return mapProjectConfigRowToAdminConfig(data)
}

async function createSignedRenderUrl(client, storagePath, signedUrlTtlSeconds) {
  const { data, error } = await client
    .storage
    .from('renders')
    .createSignedUrl(storagePath, signedUrlTtlSeconds)

  assertNoError(error, 'Unable to create a render download link.')

  return data?.signedUrl || ''
}

export async function getRenders(
  { userId, limit = 10 },
  options = {},
) {
  if (!userId) {
    return []
  }

  const client = getClient(options.client)
  const { data, error } = await client
    .from('renders')
    .select('id, user_id, project_id, system_type, prompt_used, image_url, cost_usd, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  assertNoError(error, 'Unable to load render history.')

  const rows = data || []
  const signedUrlTtlSeconds =
    options.signedUrlTtlSeconds || SIGNED_RENDER_URL_TTL_SECONDS
  const signedUrls = await Promise.all(
    rows.map((row) =>
      row.image_url
        ? createSignedRenderUrl(client, row.image_url, signedUrlTtlSeconds)
        : Promise.resolve(''),
    ),
  )

  return rows.map((row, index) => ({
    ...row,
    imageUrl: signedUrls[index],
  }))
}

export async function getProjectRenderHistory(
  { projectId, limit = 50 },
  options = {},
) {
  if (!projectId) {
    return []
  }

  const client = getClient(options.client)
  const { data, error } = await client
    .from('renders')
    .select('id, user_id, project_id, system_type, cost_usd, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit)

  assertNoError(error, 'Unable to load the project render history.')

  return data || []
}

export async function saveRender(renderData, persistRender) {
  if (typeof persistRender !== 'function') {
    throw new Error(
      'saveRender must delegate to a server-side persistence function.',
    )
  }

  return persistRender(renderData)
}
