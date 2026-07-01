import { useState } from 'react'

const STORAGE_KEY = 'pv3-welcome-seen'

function readSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** First-visit welcome card on home; dismissible overview of app zones. */
export function WelcomeBanner() {
  const [seen, setSeen] = useState(() => readSeen())

  if (seen) return null

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
    setSeen(true)
  }

  return (
    <div className="pv3-welcome" role="region" aria-label="Bienvenida">
      <div className="pv3-welcome__head">
        <strong>Bienvenido a FARO</strong>
        <button type="button" className="pv3-guide-dismiss pv3-welcome__close" onClick={dismiss}>
          Entendido
        </button>
      </div>
      <p className="pv3-welcome__lead">
        Una app para ver qué falta, dónde ayudar y pedir apoyo — con datos verificados por coordinadores.
      </p>
      <ul className="pv3-welcome__list">
        <li><strong>Sitios</strong> — necesidades en hospitales, refugios y centros de acopio</li>
        <li><strong>Cobertura</strong> — mapa en vivo con nivel de cobertura por zona</li>
        <li><strong>Reportar</strong> — avisa un cambio que aún no aparece en la app</li>
        <li><strong>Personas</strong> — busca en listas publicadas por sitios verificados</li>
        <li><strong>Apoyo</strong> — líneas de crisis y acompañamiento emocional</li>
      </ul>
    </div>
  )
}
