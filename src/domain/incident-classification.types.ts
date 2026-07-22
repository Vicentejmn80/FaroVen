export type IncidentClassification = 'humanitarian' | 'damage' | 'medical' | 'risk'

export interface IncidentClassConfig {
  type: IncidentClassification
  label: string
  description: string
  actionLabel: string
  requiresCenter: boolean
  suggestsHospital: boolean
  defaultPriority: 'critical' | 'high' | 'medium' | 'low'
  examples: string[]
}

export const INCIDENT_CLASSES: IncidentClassConfig[] = [
  {
    type: 'humanitarian',
    label: 'Necesidad humanitaria',
    description: 'Alimentos, medicinas, agua, refugio',
    actionLabel: 'Crear necesidad',
    requiresCenter: true,
    suggestsHospital: false,
    defaultPriority: 'high',
    examples: ['Falta de alimentos', 'Necesidad de medicinas', 'Personas sin refugio'],
  },
  {
    type: 'damage',
    label: 'Daño en infraestructura',
    description: 'Árbol caído, vía bloqueada, incendio, derrumbe',
    actionLabel: 'Registrar daño',
    requiresCenter: false,
    suggestsHospital: false,
    defaultPriority: 'medium',
    examples: ['Árbol caído sobre la vía', 'Puente dañado', 'Poste eléctrico caído'],
  },
  {
    type: 'medical',
    label: 'Emergencia médica',
    description: 'Personas heridas, emergencia sanitaria',
    actionLabel: 'Crear caso médico',
    requiresCenter: false,
    suggestsHospital: true,
    defaultPriority: 'critical',
    examples: ['Persona lesionada', 'Emergencia obstétrica', 'Intoxicación masiva'],
  },
  {
    type: 'risk',
    label: 'Riesgo',
    description: 'Zona inundable, cable expuesto, deslizamiento',
    actionLabel: 'Señalizar riesgo',
    requiresCenter: false,
    suggestsHospital: false,
    defaultPriority: 'medium',
    examples: ['Zona con riesgo de inundación', 'Cable eléctrico expuesto', 'Deslizamiento de tierra'],
  },
]

export const INCIDENT_CLASS_MAP = Object.fromEntries(
  INCIDENT_CLASSES.map((c) => [c.type, c]),
) as Record<IncidentClassification, IncidentClassConfig>

const DAMAGE_KEYWORDS = [
  'árbol', 'arbol', 'caído', 'caido', 'vía', 'via', 'bloqueada', 'bloqueado',
  'puente', 'incendio', 'derrumb', 'poste', 'eléctric', 'electric',
]

const MEDICAL_KEYWORDS = [
  'herid', 'lesión', 'lesion', 'emergencia', 'médic', 'medic',
  'ambulancia', 'hospital', 'sangr', 'quemad', 'fractur',
]

const RISK_KEYWORDS = [
  'inund', 'cable', 'desliz', 'riesgo', 'peligr', 'inestable',
  'agriet', 'fuga', 'gas',
]

export function classifyReport(description: string): IncidentClassification {
  const lower = description.toLowerCase()

  const damageMatch = DAMAGE_KEYWORDS.some((k) => lower.includes(k))
  const medicalMatch = MEDICAL_KEYWORDS.some((k) => lower.includes(k))
  const riskMatch = RISK_KEYWORDS.some((k) => lower.includes(k))

  if (medicalMatch) return 'medical'
  if (damageMatch) return 'damage'
  if (riskMatch) return 'risk'
  return 'humanitarian'
}
