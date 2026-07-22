import { divIcon, type DivIcon } from 'leaflet'
import { STATUS, SITE_META } from '@/lib/status-config'
import type { Site } from '@/lib/types'

type MissionPriority = 'low' | 'medium' | 'high' | 'critical'

const MISSION_COLORS: Record<MissionPriority, string> = {
  critical: '#FF453A',
  high: '#FFD60A',
  medium: '#0A84FF',
  low: '#30D158',
}

/**
 * Crea un ícono HTML para Leaflet manteniendo el mismo lenguaje visual
 * de FARO (glass + semántica por estado + realce activo).
 */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function createSiteMarkerIcon(site: Site, active = false, dimmed = false): DivIcon {
  const s = STATUS[site.status]
  const meta = SITE_META[site.type]
  const title = escapeAttr(`${meta.label}: ${site.name}`)

  const html = `
    <div class="faro-site-marker ${active ? 'is-active' : ''} ${dimmed ? 'is-dimmed' : ''} ${site.status === 'critical' ? 'is-critical' : ''}" style="--marker-color:${s.hex}">
      <div class="faro-site-marker__bubble" title="${title}">
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

export function createMissionMarkerIcon(
  mission: { title: string; priority: MissionPriority },
  active = false,
  dimmed = false,
): DivIcon {
  const color = MISSION_COLORS[mission.priority] ?? MISSION_COLORS.medium
  const title = escapeAttr(mission.title)
  const html = `
    <div class="faro-mission-marker ${active ? 'is-active' : ''} ${dimmed ? 'is-dimmed' : ''}" style="--marker-color:${color}">
      <div class="faro-mission-marker__bubble" title="${title}">
        <span class="faro-mission-marker__dot" aria-hidden="true"></span>
      </div>
      <span class="faro-mission-marker__tip"></span>
    </div>
  `

  return divIcon({
    html,
    className: 'faro-mission-marker-wrapper',
    iconSize: [40, 52],
    iconAnchor: [20, 42],
  })
}
