/**
 * @typedef {Object} PromptFields
 * @property {string} project_name
 * @property {string} room_type
 * @property {string} building_use
 * @property {string} visual_style
 * @property {string} industry
 * @property {string} mood
 * @property {string} output_use
 * @property {string} color_temp
 * @property {string} illumination
 * @property {string} shadows
 * @property {string} duct_mat
 * @property {string} large_pipe
 * @property {string} struct_steel
 * @property {string} equip_casing
 * @property {string} floor_mat
 * @property {string} camera
 * @property {string} framing
 * @property {string} aspect
 */

/**
 * @typedef {Object} PaletteEntry
 * @property {string} label
 * @property {string} hex
 */

/**
 * @typedef {Object<string, PaletteEntry>} PromptPalette
 */

/**
 * @typedef {Object} AdminConfig
 * @property {PromptPalette} palette
 * @property {Object} generation
 * @property {'gpt-image-1.5' | 'gpt-image-1' | 'gpt-image-1-mini'} generation.model
 * @property {'low' | 'medium' | 'high'} generation.quality
 * @property {'opaque' | 'transparent' | 'auto'} generation.background
 * @property {'auto' | 'low'} generation.moderation
 * @property {'low' | 'high'} generation.inputFidelity
 * @property {Object} promptDefaults
 * @property {string} promptDefaults.referenceFidelity
 * @property {string} promptDefaults.negative
 */

/**
 * @typedef {Object} SessionState
 * @property {'user' | 'admin' | null} role
 * @property {boolean} isAuthenticated
 * @property {string} displayName
 * @property {string} email
 */

/**
 * @typedef {Object} ReferenceImage
 * @property {string} dataUrl
 * @property {string} mimeType
 * @property {string} name
 */

export {}
