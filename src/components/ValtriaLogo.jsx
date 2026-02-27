import { useState } from 'react'

export function ValtriaLogo() {
  const [hasAsset, setHasAsset] = useState(true)

  if (hasAsset) {
    return (
      <img
        className="valtria-logo__image"
        src="/valtria-logo.svg"
        alt="Valtria"
        onError={() => setHasAsset(false)}
      />
    )
  }

  return <span className="valtria-logo__wordmark">VALTRIA</span>
}
