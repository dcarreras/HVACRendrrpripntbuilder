export const DEFAULT_FIELDS = {
  project_name: 'Edwards Lifescience 305',
  room_type: 'HVAC Plant Room',
  building_use: 'Pharmaceutical facility',
  visual_style: 'Ultra-clean technical engineering',
  industry: 'Clean room / ISO',
  mood: 'Technical precision - corporate marketing',
  output_use: 'Marketing brochure',
  color_temp: '4500K neutral white',
  illumination: 'Even global illumination',
  shadows: 'Soft ambient occlusion only',
  duct_mat: 'Brushed stainless steel',
  large_pipe: 'Satin painted light grey',
  struct_steel: 'Matte galvanized finish',
  equip_casing: 'Clean white',
  floor_mat: 'Light grey epoxy industrial',
  camera: 'Straight elevation - orthographic',
  framing: 'Balanced - full system visible',
  aspect: '16:9',
}

export const DEFAULT_PALETTE = {
  duct_body: { label: 'Duct body', hex: '#9DAAB8' },
  duct_hi: { label: 'Duct highlight', hex: '#C4CDD6' },
  duct_sh: { label: 'Duct shadow', hex: '#3C4550' },
  struct: { label: 'Structural steel', hex: '#6A7480' },
  floor: { label: 'Floor', hex: '#B0B8C4' },
  sec_pipes: { label: 'Secondary pipes', hex: '#7A8490' },
  brand: { label: 'Brand accent', hex: '#1B6BB5' },
  hot: { label: 'Hot water', hex: '#A8453A' },
  cold: { label: 'Cold water', hex: '#3A78A0' },
  bg_dark: { label: 'Background dark', hex: '#E8ECF0' },
  bg_light: { label: 'Background light', hex: '#F5F7F9' },
}

export const DEFAULT_ADMIN_CONFIG = {
  palette: DEFAULT_PALETTE,
  generation: {
    model: 'gpt-image-1.5',
    quality: 'medium',
    background: 'opaque',
    moderation: 'auto',
    inputFidelity: 'high',
  },
  promptDefaults: {
    referenceFidelity:
      'Strict lock - preserve routing, architecture, and structure exactly',
    negative: 'cartoon, artistic, dramatic lighting, lens flare, bokeh',
  },
}
