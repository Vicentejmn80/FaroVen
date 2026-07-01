import L from 'leaflet'
import type { EntityKind } from '../lib/useMapData'
import { KIND_COLOR } from '../lib/theme'

export function buildMarkerIcon(
  kind: EntityKind,
  alert: boolean,
  selected: boolean
): L.DivIcon {
  const color = KIND_COLOR[kind]
  const classes = [
    'pv2-pin',
    alert ? 'pv2-pin--alert' : '',
    selected ? 'pv2-pin--selected' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return L.divIcon({
    className: 'pv2-pin-wrap',
    html: `<div class="${classes}" style="--pin:${color}"><span class="pv2-pin__dot"></span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -12],
  })
}
