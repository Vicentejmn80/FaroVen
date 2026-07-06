export type SaturationLevel = 'low' | 'medium' | 'high' | 'critical'

export const SATURATION_LEVEL_LABELS: Record<SaturationLevel, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
}

export const SATURATION_LEVEL_TONE: Record<SaturationLevel, string> = {
  low: 'text-operational',
  medium: 'text-warning',
  high: 'text-warning',
  critical: 'text-critical',
}

export const SATURATION_NEED_PRESETS = [
  { key: 'agua', label: 'Agua potable' },
  { key: 'alimentos', label: 'Alimentos no perecederos' },
  { key: 'medicamentos', label: 'Medicamentos' },
  { key: 'atencion-medica', label: 'Atención médica' },
  { key: 'refugio', label: 'Refugio / Albergue' },
  { key: 'ropa', label: 'Ropa / Cobijas' },
  { key: 'higiene', label: 'Productos de higiene' },
  { key: 'panales', label: 'Pañales / Leche infantil' },
  { key: 'apoyo-psicologico', label: 'Apoyo psicológico' },
  { key: 'transporte', label: 'Transporte / Evacuación' },
  { key: 'energia', label: 'Energía / Electricidad' },
  { key: 'comunicacion', label: 'Comunicación / Internet' },
  { key: 'herramientas', label: 'Herramientas / Equipos' },
  { key: 'voluntarios', label: 'Voluntarios' },
  { key: 'otros', label: 'Otros (especificar)' },
] as const
