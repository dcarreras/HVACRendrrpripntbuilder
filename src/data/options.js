export const OPTIONS = {
  room_type: [
    'Clean Room',
    'AHU Room',
    'Technical Corridor',
    'Mechanical Floor',
  ],
  building_use: [
    'Clean room facility',
    'Pharmaceutical facility',
    'Life sciences production',
    'Hospital technical area',
  ],
  visual_style: [
    'Ultra-clean cleanroom render',
    'Photoreal technical',
    'Tender-grade technical visual',
  ],
  industry: [
    'Clean room / life sciences',
    'Biopharma',
    'Healthcare GMP',
    'Semiconductor / high purity',
  ],
  mood: [
    'Technical precision - client-facing',
    'Engineering review - internal',
    'Tender / bid document',
  ],
  output_use: [
    'Client presentation',
    'Tender document',
    'Internal design review',
    'Marketing brochure',
  ],
  color_temp: [
    '4500K neutral white',
    '5000K cool white',
    '6500K daylight',
  ],
  illumination: [
    'Even cleanroom lighting',
    'Mixed overhead + ambient',
    'Directional with soft fill',
  ],
  shadows: [
    'Soft ambient occlusion only',
    'Soft directional shadows',
  ],
  duct_mat: [
    'Brushed stainless steel',
    'Galvanized steel',
    'Painted white sheet metal',
  ],
  large_pipe: [
    'Satin painted light grey',
    'Painted white',
    'Insulated grey lagging',
  ],
  struct_steel: [
    'Matte galvanized finish',
    'Painted structural grey',
  ],
  equip_casing: [
    'Clean white',
    'Very light grey RAL 7035',
    'Neutral light grey RAL 7035',
  ],
  floor_mat: [
    'Cleanroom vinyl light grey',
    'Light grey epoxy industrial',
    'Raised access floor',
  ],
  camera: [
    'Straight elevation - orthographic',
    'Isometric 30deg - no perspective',
    'Perspective wide angle',
  ],
  framing: [
    'Balanced - full system visible',
    'Tight - focus on equipment',
    'Wide - with building context',
  ],
  aspect: ['16:9', '1:1', '4:3', '21:9'],
  reference_fidelity: [
    'Strict lock - preserve routing, architecture, and structure exactly',
    'Very high fidelity - allow only cosmetic cleanup',
    'Balanced fidelity - preserve layout with minimal simplification',
  ],
  admin_model: ['gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini'],
  admin_quality: ['medium', 'high', 'low'],
  admin_background: ['opaque', 'transparent', 'auto'],
  admin_moderation: ['auto', 'low'],
  admin_input_fidelity: ['high', 'low'],
}
