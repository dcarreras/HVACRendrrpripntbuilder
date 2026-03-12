import { useEffect, useMemo, useState } from 'react'
import { normalizeHex } from '../lib/promptBuilder'

const CUSTOM_VALUE = '__custom__'

const EXCLUDED_COLORS = [
  { hex: '#9C27B0', label: 'Bright violet' },
  { hex: '#2196F3', label: 'Neon blue' },
  { hex: '#FF9800', label: 'Bright orange' },
  { hex: '#FFFFFF', label: 'Pure white' },
]

const NEUTRAL_OPTIONS = [
  { label: 'Fog silver', hex: '#C4CDD6' },
  { label: 'Soft steel', hex: '#B0B8C4' },
  { label: 'Slate grey', hex: '#9DAAB8' },
  { label: 'Machine grey', hex: '#7A8490' },
  { label: 'Industrial graphite', hex: '#6A7480' },
  { label: 'Deep shadow', hex: '#3C4550' },
  { label: 'Light wash', hex: '#E8ECF0' },
  { label: 'Paper white', hex: '#F5F7F9' },
]

const BRAND_OPTIONS = [
  { label: 'Valtria blue', hex: '#1B6BB5' },
  { label: 'Deep brand blue', hex: '#144E86' },
  { label: 'Soft brand blue', hex: '#4B7EA9' },
]

const HOT_OPTIONS = [
  { label: 'Warm copper', hex: '#A8453A' },
  { label: 'Process red', hex: '#B55344' },
  { label: 'Muted terracotta', hex: '#9C4C3C' },
]

const COLD_OPTIONS = [
  { label: 'Cool water', hex: '#3A78A0' },
  { label: 'Pipe blue', hex: '#356D96' },
  { label: 'Steel blue', hex: '#2F648E' },
]

const PALETTE_LIBRARY = {
  duct_body: NEUTRAL_OPTIONS,
  duct_hi: NEUTRAL_OPTIONS,
  duct_sh: NEUTRAL_OPTIONS,
  struct: NEUTRAL_OPTIONS,
  floor: NEUTRAL_OPTIONS,
  sec_pipes: NEUTRAL_OPTIONS,
  bg_dark: NEUTRAL_OPTIONS,
  bg_light: NEUTRAL_OPTIONS,
  brand: BRAND_OPTIONS,
  hot: HOT_OPTIONS,
  cold: COLD_OPTIONS,
}

function toDraftMap(palette) {
  return Object.fromEntries(
    Object.entries(palette).map(([key, entry]) => [key, entry.hex]),
  )
}

function toModeMap(palette) {
  return Object.fromEntries(
    Object.entries(palette).map(([key, entry]) => {
      const curated = (PALETTE_LIBRARY[key] || []).some(
        (option) => option.hex === entry.hex,
      )
      return [key, !curated]
    }),
  )
}

function getSelectValue(key, entry, customModes) {
  if (customModes[key]) {
    return CUSTOM_VALUE
  }

  return entry.hex
}

export function PaletteEditor({ palette, onCommitHex }) {
  const [drafts, setDrafts] = useState(() => toDraftMap(palette))
  const [customModes, setCustomModes] = useState(() => toModeMap(palette))

  useEffect(() => {
    setDrafts(toDraftMap(palette))
    setCustomModes(toModeMap(palette))
  }, [palette])

  const swatches = useMemo(() => Object.values(palette), [palette])

  const handlePresetChange = (key, value) => {
    if (value === CUSTOM_VALUE) {
      setCustomModes((previous) => ({ ...previous, [key]: true }))
      return
    }

    setCustomModes((previous) => ({ ...previous, [key]: false }))
    setDrafts((previous) => ({ ...previous, [key]: value }))
    onCommitHex(key, value)
  }

  const handleDraft = (key, value) => {
    setDrafts((previous) => ({ ...previous, [key]: value }))
  }

  const handleCommit = (key) => {
    const normalized = normalizeHex(drafts[key])
    if (normalized) {
      onCommitHex(key, normalized)
      setDrafts((previous) => ({ ...previous, [key]: normalized }))
      return
    }

    setDrafts((previous) => ({ ...previous, [key]: palette[key].hex }))
  }

  return (
    <div className="palette-editor">
      <p className="t-small palette-editor__intro">
        Admin presets keep technical colors controlled. Use Custom HEX only when
        a curated option is not enough.
      </p>

      <div className="palette-strip" aria-hidden="true">
        {swatches.map((entry) => (
          <span
            key={entry.label}
            className="palette-strip__swatch"
            style={{ backgroundColor: entry.hex }}
          />
        ))}
      </div>

      <div className="palette-grid">
        {Object.entries(palette).map(([key, entry]) => (
          <div key={key} className="palette-row palette-row--stacked">
            <span
              className="palette-row__preview"
              style={{ backgroundColor: entry.hex }}
              aria-hidden="true"
            />
            <div className="palette-row__content">
              <label className="label" htmlFor={`palette-${key}`}>
                {entry.label}
              </label>
              <select
                id={`palette-${key}`}
                aria-label={`${entry.label} palette preset`}
                className="input input--mono"
                value={getSelectValue(key, entry, customModes)}
                onChange={(event) => handlePresetChange(key, event.target.value)}
              >
                {(PALETTE_LIBRARY[key] || []).map((option) => (
                  <option key={`${key}-${option.hex}`} value={option.hex}>
                    {option.label} ({option.hex})
                  </option>
                ))}
                <option value={CUSTOM_VALUE}>Custom HEX</option>
              </select>
              {customModes[key] ? (
                <input
                  aria-label={`${entry.label} HEX`}
                  className="input input--mono palette-row__custom"
                  value={drafts[key] ?? entry.hex}
                  onChange={(event) => handleDraft(key, event.target.value)}
                  onBlur={() => handleCommit(key)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      handleCommit(key)
                    }
                    if (event.key === 'Escape') {
                      setDrafts((previous) => ({
                        ...previous,
                        [key]: palette[key].hex,
                      }))
                    }
                  }}
                />
              ) : null}
            </div>
            {key === 'brand' ? (
              <span className="badge badge--accent">Max 5%</span>
            ) : null}
          </div>
        ))}
      </div>

      <div className="card card--warning palette-warning">
        <header className="card__header">Colors to avoid from BIM exports</header>
        <div className="card__body">
          <ul className="excluded-colors" aria-label="Excluded colors">
            {EXCLUDED_COLORS.map((item) => (
              <li key={item.hex}>
                <span
                  className="excluded-colors__swatch"
                  style={{ backgroundColor: item.hex }}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
