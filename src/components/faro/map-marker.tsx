import { divIcon, type DivIcon } from 'leaflet'
import { STATUS, SITE_META } from '@/lib/status-config'
import type { Site } from '@/lib/types'

/**
 * Crea un ícono HTML para Leaflet manteniendo el mismo lenguaje visual
 * de FARO (glass + semántica por estado + realce activo).
 */
export function createSiteMarkerIcon(site: Site, active = false, dimmed = false): DivIcon {
  const s = STATUS[site.status]
  const meta = SITE_META[site.type]

  const html = `
    <div class="faro-site-marker ${active ? 'is-active' : ''} ${dimmed ? 'is-dimmed' : ''} ${site.status === 'critical' ? 'is-critical' : ''}" style="--marker-color:${s.hex}">
      <div class="faro-site-marker__bubble" title="${meta.label}: ${site.name}">
        <span class="faro-site-marker__emoji" aria-hidden="true">${meta.emoji}</span>
      </div>
      <span class="faro-site-marker__tip"></span>
    </div>
  `

  return divIcon({
    html,
    className: 'faro-site-marker-wrapper',
    iconSize: [44, 56],
    iconAnchor: [22, 46],
  })
}

/** Pin azul para elegir ubicación al registrar un sitio. */
export function createPickerMarkerIcon(): DivIcon {
  const html = `
    <div class="faro-picker-marker">
      <div class="faro-picker-marker__pin"></div>
      <span class="faro-picker-marker__shadow"></span>
    </div>
  `
  return divIcon({
    html,
    className: 'faro-picker-marker-wrapper',
    iconSize: [36, 48],
    iconAnchor: [18, 44],
  })
}
