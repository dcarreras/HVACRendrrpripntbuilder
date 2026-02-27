export const PRESETS = [
  {
    id: 'gmp-suite',
    label: 'GMP suite',
    description: 'Balanced cleanroom baseline for client-facing regulated spaces.',
    overrides: {
      room_type: 'Clean Room',
      building_use: 'Pharmaceutical facility',
      industry: 'Biopharma',
      output_use: 'Client presentation',
      visual_style: 'Ultra-clean cleanroom render',
      equip_casing: 'Clean white',
      floor_mat: 'Cleanroom vinyl light grey',
    },
  },
  {
    id: 'ahu-tech-room',
    label: 'AHU technical room',
    description: 'Focused technical room setup for internal design validation.',
    overrides: {
      room_type: 'AHU Room',
      building_use: 'Hospital technical area',
      industry: 'Healthcare GMP',
      output_use: 'Internal design review',
      duct_mat: 'Brushed stainless steel',
      camera: 'Straight elevation - orthographic',
    },
  },
  {
    id: 'tender-pack',
    label: 'Tender pack',
    description: 'Sharper technical framing for bids and engineering packs.',
    overrides: {
      room_type: 'Technical Corridor',
      building_use: 'Clean room facility',
      industry: 'Clean room / life sciences',
      output_use: 'Tender document',
      visual_style: 'Tender-grade technical visual',
      mood: 'Tender / bid document',
      framing: 'Wide - with room envelope',
    },
  },
]
