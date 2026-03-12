import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_ADMIN_CONFIG } from '../data/defaults'
import {
  ensureProject,
  getRenders,
  mapAdminConfigToProjectConfigRow,
  mapProjectConfigRowToAdminConfig,
  mergeAdminConfig,
} from './storage'

function createExistingProjectClient(project) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: project,
    error: null,
  })
  const secondEq = vi.fn(() => ({
    maybeSingle,
  }))
  const firstEq = vi.fn(() => ({
    eq: secondEq,
  }))
  const select = vi.fn(() => ({
    eq: firstEq,
  }))
  const insert = vi.fn()

  return {
    client: {
      from: vi.fn(() => ({
        select,
        insert,
      })),
    },
    spies: {
      insert,
      maybeSingle,
    },
  }
}

function createRenderClient(rows, signedUrl) {
  const limit = vi.fn().mockResolvedValue({
    data: rows,
    error: null,
  })
  const order = vi.fn(() => ({
    limit,
  }))
  const eq = vi.fn(() => ({
    order,
  }))
  const select = vi.fn(() => ({
    eq,
  }))
  const createSignedUrl = vi.fn().mockResolvedValue({
    data: {
      signedUrl,
    },
    error: null,
  })

  return {
    client: {
      from: vi.fn(() => ({
        select,
      })),
      storage: {
        from: vi.fn(() => ({
          createSignedUrl,
        })),
      },
    },
    spies: {
      createSignedUrl,
    },
  }
}

describe('storage helpers', () => {
  it('maps project config rows to the in-memory admin config shape', () => {
    const row = mapAdminConfigToProjectConfigRow('project-1', DEFAULT_ADMIN_CONFIG)
    const result = mapProjectConfigRowToAdminConfig(row)

    expect(row.project_id).toBe('project-1')
    expect(row.openai_quality).toBe(DEFAULT_ADMIN_CONFIG.generation.quality)
    expect(result).toEqual(mergeAdminConfig(DEFAULT_ADMIN_CONFIG))
  })

  it('reuses an existing project instead of inserting a duplicate', async () => {
    const existingProject = {
      id: 'project-1',
      name: 'Edwards Lifescience 305',
      company: 'Valtria',
    }
    const { client, spies } = createExistingProjectClient(existingProject)

    const result = await ensureProject(
      {
        name: existingProject.name,
        company: existingProject.company,
      },
      { client },
    )

    expect(result).toEqual(existingProject)
    expect(spies.maybeSingle).toHaveBeenCalledTimes(1)
    expect(spies.insert).not.toHaveBeenCalled()
  })

  it('loads saved renders and converts private storage paths into signed URLs', async () => {
    const { client, spies } = createRenderClient(
      [
        {
          id: 'render-1',
          user_id: 'user-1',
          image_url: 'user-1/123456.png',
          system_type: 'Clean Room',
          created_at: '2026-02-28T08:00:00.000Z',
        },
      ],
      'https://example.com/render.png',
    )

    const result = await getRenders(
      {
        userId: 'user-1',
      },
      {
        client,
        signedUrlTtlSeconds: 120,
      },
    )

    expect(spies.createSignedUrl).toHaveBeenCalledWith('user-1/123456.png', 120)
    expect(result[0].imageUrl).toBe('https://example.com/render.png')
  })
})
