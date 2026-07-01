export type PublicViewId = 'home' | 'sites' | 'coverage' | 'report' | 'people' | 'support'

export const NAV: { id: PublicViewId; label: string; short: string; hint: string }[] = [
  { id: 'home', label: 'Inicio', short: 'Inicio', hint: 'Accesos rápidos según lo que necesites' },
  { id: 'sites', label: 'Sitios', short: 'Sitios', hint: 'Necesidades verificadas por coordinadores' },
  { id: 'coverage', label: 'Cobertura', short: 'Mapa', hint: 'Mapa en vivo · toca un pin' },
  { id: 'report', label: 'Reportar', short: 'Reporte', hint: 'Avisa un cambio que aún no aparece' },
  { id: 'people', label: 'Personas', short: 'Personas', hint: 'Busca en listas de hospitales y refugios' },
  { id: 'support', label: 'Apoyo', short: 'Apoyo', hint: 'Directorio de apoyo emocional y crisis' },
]

export function getNavHint(id: PublicViewId): string {
  return NAV.find((n) => n.id === id)?.hint ?? ''
}
