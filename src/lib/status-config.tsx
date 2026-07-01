import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Info,
  type LucideIcon,
} from 'lucide-react'
import type { OperationalStatus, SiteType } from './types'

interface StatusStyle {
  label: string
  /** color sólido para texto/icono */
  text: string
  /** fondo suave translúcido */
  bg: string
  /** color de borde/anillo */
  ring: string
  /** color hex puro para puntos y marcadores */
  hex: string
  icon: LucideIcon
}

export const STATUS: Record<OperationalStatus, StatusStyle> = {
  critical: {
    label: 'Crítico',
    text: 'text-critical',
    bg: 'bg-critical-soft',
    ring: 'ring-critical-ring',
    hex: '#FF453A',
    icon: AlertTriangle,
  },
  warning: {
    label: 'Atención',
    text: 'text-warning',
    bg: 'bg-warning-soft',
    ring: 'ring-warning-ring',
    hex: '#FFD60A',
    icon: Activity,
  },
  operational: {
    label: 'Operativo',
    text: 'text-operational',
    bg: 'bg-operational-soft',
    ring: 'ring-operational-ring',
    hex: '#30D158',
    icon: CheckCircle2,
  },
  info: {
    label: 'Info',
    text: 'text-info',
    bg: 'bg-info-soft',
    ring: 'ring-info-ring',
    hex: '#0A84FF',
    icon: Info,
  },
}

export const SITE_META: Record<SiteType, { label: string; emoji: string }> = {
  hospital: { label: 'Hospital', emoji: '🏥' },
  supply_center: { label: 'Centro de acopio', emoji: '📦' },
  shelter: { label: 'Refugio', emoji: '🏠' },
  medical_center: { label: 'Centro médico', emoji: '🏥' },
  organization: { label: 'Organización', emoji: '🧭' },
}
