import { describe, expect, it } from 'vitest'
import { DEFAULT_ADMIN_CONFIG, DEFAULT_FIELDS } from '../data/defaults'
import {
  CAMERA_MAP,
  REFERENCE_FIDELITY_MAP,
  SHADOW_MAP,
  buildPrompt,
  normalizeHex,
} from './promptBuilder'

describe('normalizeHex', () => {
  it('normalizes lowercase and missing hash values', () => {
    expect(normalizeHex('1b6bb5')).toBe('#1B6BB5')
    expect(normalizeHex('#a8453a')).toBe('#A8453A')
  })

  it('returns null for invalid values', () => {
    expect(normalizeHex('')).toBeNull()
    expect(normalizeHex('#ABC')).toBeNull()
    expect(normalizeHex('ZZZZZZ')).toBeNull()
  })
})

describe('buildPrompt', () => {
  it('generates a structured prompt with the admin configuration merged in', () => {
    const prompt = buildPrompt(DEFAULT_FIELDS, DEFAULT_ADMIN_CONFIG)

    expect(prompt.startsWith('IMAGE GENERATION BRIEF')).toBe(true)
    expect(prompt).toContain('OBJECTIVE')
    expect(prompt).toContain('REFERENCE IMAGE CONTROL (DALUX BIM SOURCE)')
    expect(prompt).toContain('COLOR GOVERNANCE (EXACT HEX)')
    expect(prompt).toContain(`- Project: ${DEFAULT_FIELDS.project_name}.`)
    expect(prompt).toContain(
      `- Consistency mode: ${DEFAULT_ADMIN_CONFIG.promptDefaults.referenceFidelity}.`,
    )
    expect(prompt).toContain(DEFAULT_ADMIN_CONFIG.palette.brand.hex)
  })

  it('maps camera and shadow labels to rendering instructions', () => {
    const prompt = buildPrompt(DEFAULT_FIELDS, DEFAULT_ADMIN_CONFIG)

    expect(prompt).toContain(CAMERA_MAP[DEFAULT_FIELDS.camera])
    expect(prompt).toContain(SHADOW_MAP[DEFAULT_FIELDS.shadows])
  })

  it('injects admin negative constraints and keeps hard-coded base negatives', () => {
    const prompt = buildPrompt(DEFAULT_FIELDS, {
      ...DEFAULT_ADMIN_CONFIG,
      promptDefaults: {
        ...DEFAULT_ADMIN_CONFIG.promptDefaults,
        negative: 'fog, bloom',
      },
    })

    expect(prompt).toContain('- fog')
    expect(prompt).toContain('- bloom')
    expect(prompt).toContain('- no outline glow')
  })

  it('keeps palette formatting and ordering', () => {
    const prompt = buildPrompt(DEFAULT_FIELDS, DEFAULT_ADMIN_CONFIG)

    const expectedFragment = [
      `- Duct body: ${DEFAULT_ADMIN_CONFIG.palette.duct_body.hex}`,
      `- Duct highlight: ${DEFAULT_ADMIN_CONFIG.palette.duct_hi.hex}`,
      `- Duct shadow: ${DEFAULT_ADMIN_CONFIG.palette.duct_sh.hex}`,
      `- Secondary pipes: ${DEFAULT_ADMIN_CONFIG.palette.sec_pipes.hex}`,
      `- Structural steel: ${DEFAULT_ADMIN_CONFIG.palette.struct.hex}`,
      `- Floor: ${DEFAULT_ADMIN_CONFIG.palette.floor.hex}`,
      `- Background gradient: ${DEFAULT_ADMIN_CONFIG.palette.bg_dark.hex} -> ${DEFAULT_ADMIN_CONFIG.palette.bg_light.hex}`,
    ].join('\n')

    expect(prompt).toContain(expectedFragment)
  })

  it('injects the selected reference fidelity adapter block', () => {
    const referenceFidelity =
      'Very high fidelity - allow only cosmetic cleanup'
    const prompt = buildPrompt(DEFAULT_FIELDS, {
      ...DEFAULT_ADMIN_CONFIG,
      promptDefaults: {
        ...DEFAULT_ADMIN_CONFIG.promptDefaults,
        referenceFidelity,
      },
    })

    expect(prompt).toContain(`- Consistency mode: ${referenceFidelity}.`)
    expect(prompt).toContain(REFERENCE_FIDELITY_MAP[referenceFidelity][0])
  })
})
