import type { NeedPriority } from '@/lib/types'
import type { EntityKind } from './useMapData'

export const KIND_COLOR: Record<EntityKind, string> = {
  hospital: '#2563eb',
  supply_center: '#059669',
  shelter: '#7c3aed',
}

export const KIND_LABEL: Record<EntityKind, string> = {
  hospital: 'Hospital',
  supply_center: 'Centro de acopio',
  shelter: 'Refugio',
}

export const KIND_EMOJI: Record<EntityKind, string> = {
  hospital: '🏥',
  supply_center: '📦',
  shelter: '🏠',
}

export const PRIORITY_COLOR: Record<NeedPriority, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#16a34a',
}

export const PRIORITY_LABEL: Record<NeedPriority, string> = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo',
}

export function coverageColor(pct: number): string {
  if (pct >= 90) return '#16a34a'
  if (pct >= 60) return '#ca8a04'
  if (pct >= 30) return '#ea580c'
  return '#dc2626'
}
