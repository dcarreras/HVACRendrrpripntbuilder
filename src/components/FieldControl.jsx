export function FieldControl({
  id,
  label,
  value,
  onChange,
  options,
  type = 'select',
  placeholder = '',
  hint = '',
  rows = 4,
}) {
  return (
    <div className="field-control">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {type === 'select' ? (
        <select
          id={id}
          className="input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {(options || []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          id={id}
          className="input input--textarea"
          value={value}
          rows={rows}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          type={type}
          className="input"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {hint ? <p className="field-hint t-small">{hint}</p> : null}
    </div>
  )
}
