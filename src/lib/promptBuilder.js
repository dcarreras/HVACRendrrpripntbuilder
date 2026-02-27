/**
 * @typedef {import('../types/prompt').PromptFields} PromptFields
 * @typedef {import('../types/prompt').AdminConfig} AdminConfig
 */

export const CAMERA_MAP = {
  'Straight elevation - orthographic':
    'straight orthographic elevation view, no perspective distortion',
  'Isometric 30deg - no perspective': 'isometric 30deg view, no perspective',
  'Perspective wide angle': 'wide-angle perspective view',
  'Plan view - top down': 'top-down plan view',
}

export const SHADOW_MAP = {
  'Soft ambient occlusion only':
    'soft ambient occlusion only, no cast shadows',
  'No shadows - flat technical': 'no shadows, flat even lighting',
  'Soft directional shadows': 'soft directional shadows',
}

export const REFERENCE_FIDELITY_MAP = {
  'Strict lock - preserve routing, architecture, and structure exactly': [
    'Treat the user-provided Dalux BIM screenshot as the single source of truth for geometry.',
    'Keep routing centerlines, branch topology, architectural boundaries, and structural members exactly as shown.',
    'Do not add, remove, relocate, resize, reroute, or invent any geometric element.',
  ],
  'Very high fidelity - allow only cosmetic cleanup': [
    'Preserve all geometric relationships and coordinates from the Dalux BIM reference image.',
    'Only allow cosmetic cleanup such as edge smoothing and material polish.',
    'No routing, structural, or architectural modifications are allowed.',
  ],
  'Balanced fidelity - preserve layout with minimal simplification': [
    'Preserve global layout and equipment placement from the Dalux BIM reference image.',
    'Allow minimal visual simplification only if geometry and routing remain semantically unchanged.',
    'Never create new systems, branches, or structural elements.',
  ],
}

/**
 * @param {string} value
 * @returns {string | null}
 */
export function normalizeHex(value) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const prefixed = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  const uppercase = prefixed.toUpperCase()
  const isValid = /^#[0-9A-F]{6}$/.test(uppercase)

  return isValid ? uppercase : null
}

function lookup(value, map) {
  return map[value] || value
}

function toList(value) {
  if (!value) {
    return []
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

/**
 * @param {PromptFields} fields
 * @param {AdminConfig} adminConfig
 * @returns {string}
 */
export function buildPrompt(fields, adminConfig) {
  const palette = adminConfig.palette
  const referenceFidelity = adminConfig.promptDefaults.referenceFidelity
  const referenceAdapter =
    REFERENCE_FIDELITY_MAP[referenceFidelity] ||
    REFERENCE_FIDELITY_MAP[
      'Strict lock - preserve routing, architecture, and structure exactly'
    ]
  const negativeItems = toList(adminConfig.promptDefaults.negative)

  const lines = [
    'IMAGE GENERATION BRIEF',
    '',
    'OBJECTIVE',
    `- Generate one high-quality HVAC/MEP image for ${fields.output_use}.`,
    `- Project: ${fields.project_name}.`,
    `- Space type: ${fields.room_type} in a ${fields.building_use.toLowerCase()}.`,
    `- Industry context: ${fields.industry}.`,
    `- Intent and tone: ${fields.mood}.`,
    '',
    'VISUAL DIRECTION',
    `- Style: ${fields.visual_style}.`,
    `- Camera: ${lookup(fields.camera, CAMERA_MAP)}.`,
    `- Framing: ${fields.framing}.`,
    `- Preferred aspect ratio: ${fields.aspect}.`,
    '',
    'MATERIAL SPECIFICATION',
    `- Ductwork: ${fields.duct_mat}.`,
    `- Main pipes: ${fields.large_pipe}.`,
    `- Structural steel: ${fields.struct_steel}.`,
    `- Equipment casing: ${fields.equip_casing}.`,
    `- Floor: ${fields.floor_mat}.`,
    '',
    'REFERENCE IMAGE CONTROL (DALUX BIM SOURCE)',
    '- The user may paste or upload one reference image exported from Dalux BIM.',
    `- Consistency mode: ${referenceFidelity}.`,
    ...referenceAdapter.map((line) => `- ${line}`),
    '',
    'LIGHTING AND SHADING',
    `- Color temperature: ${fields.color_temp}.`,
    `- Illumination model: ${fields.illumination}.`,
    `- Shadow policy: ${lookup(fields.shadows, SHADOW_MAP)}.`,
    '',
    'COLOR GOVERNANCE (EXACT HEX)',
    `- Duct body: ${palette.duct_body.hex}`,
    `- Duct highlight: ${palette.duct_hi.hex}`,
    `- Duct shadow: ${palette.duct_sh.hex}`,
    `- Secondary pipes: ${palette.sec_pipes.hex}`,
    `- Structural steel: ${palette.struct.hex}`,
    `- Floor: ${palette.floor.hex}`,
    `- Background gradient: ${palette.bg_dark.hex} -> ${palette.bg_light.hex}`,
    `- Pipe coding: hot ${palette.hot.hex}, cold ${palette.cold.hex}`,
    `- Brand accent: ${palette.brand.hex} applied to <= 5% of visible area`,
    '',
    'HARD CONSTRAINTS (NON-NEGOTIABLE)',
    '- Preserve exact BIM geometry, routing, and equipment placement.',
    '- Keep architectural context and structural frame aligned with the reference image.',
    '- No geometry edits, no rerouting, no added or removed equipment.',
    '- Keep AHUs and main ducts visually dominant in composition.',
    '- No BIM transparency, no x-ray, no cutaway, no exploded view.',
    '- No labels, no dimensions, no watermark, no extra text overlay.',
    '- Keep physically plausible materials and lighting.',
    '',
    'NEGATIVE CONSTRAINTS',
    ...negativeItems.map((item) => `- ${item}`),
    '- no outline glow',
    '- no over-dramatic cinematic lighting',
    '- no exaggerated contrast or oversaturation',
    '',
    'OUTPUT MODE',
    '- Generate exactly one final image.',
    '- If a reference image is provided, preserve geometry and routing fidelity.',
    '- Do not ask follow-up questions unless a critical technical constraint is missing.',
  ]

  return lines.filter(Boolean).join('\n').trim()
}
