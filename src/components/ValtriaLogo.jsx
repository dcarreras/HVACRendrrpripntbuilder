import { useState } from 'react'

export function ValtriaLogo({ variant = 'dark' }) {
  const [hasAsset, setHasAsset] = useState(true)
  const logoSrc =
    variant === 'light' ? '/valtria-logo-light.svg' : '/valtria-logo.svg'

  if (hasAsset) {
    return (
      <img
        className="valtria-logo__image"
        src={logoSrc}
        alt="Valtria"
        onError={() => setHasAsset(false)}
      />
    )
  }

  return <span className="valtria-logo__wordmark">VALTRIA</span>
}
