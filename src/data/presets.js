export const PRESETS = [
  {
    id: 'pharma',
    label: 'Pharma baseline',
    description: 'Clean casing and stainless ductwork for regulated facilities.',
    overrides: {
      industry: 'Corporate pharma / clean room',
      equip_casing: 'Clean white',
      duct_mat: 'Brushed stainless steel',
    },
  },
  {
    id: 'cleanroom-gmp',
    label: 'Clean room GMP',
    description: 'Raised floor and controlled framing for cleanroom operations.',
    overrides: {
      building_use: 'Clean room facility',
      floor_mat: 'Raised access floor',
      output_use: 'Client presentation',
    },
  },
  {
    id: 'industrial',
    label: 'Heavy industrial',
    description: 'Raw structure and concrete floor for industrial context.',
    overrides: {
      industry: 'Heavy industrial',
      floor_mat: 'Bare concrete',
      struct_steel: 'Exposed raw steel',
    },
  },
  {
    id: 'cleanroom',
    label: 'Clean room',
    description: 'White technical finishes and controlled visual hierarchy.',
    overrides: {
      room_type: 'Clean Room',
      equip_casing: 'Clean white',
      duct_mat: 'Painted white sheet metal',
    },
  },
]
