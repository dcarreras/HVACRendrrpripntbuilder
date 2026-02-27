function isPresetActive(preset, fields) {
  return Object.entries(preset.overrides).every(
    ([key, value]) => fields[key] === value,
  )
}

export function PresetStrip({ presets, fields, onApplyPreset }) {
  return (
    <div className="preset-strip" role="list" aria-label="Quick presets">
      {presets.map((preset) => {
        const active = isPresetActive(preset, fields)
        return (
          <button
            key={preset.id}
            type="button"
            className={`preset-chip ${active ? 'preset-chip--active' : ''}`.trim()}
            onClick={() => onApplyPreset(preset)}
          >
            <span className="preset-chip__title">{preset.label}</span>
            <span className="preset-chip__description">{preset.description}</span>
          </button>
        )
      })}
    </div>
  )
}
