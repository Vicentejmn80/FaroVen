export const VOLUNTEER_AVAILABILITY = {
  AVAILABLE: 'available',
  BUSY: 'busy',
  OFFLINE: 'offline',
  ON_MISSION: 'on_mission',
  UNAVAILABLE: 'unavailable',
} as const

export type VolunteerAvailabilityStatus = typeof VOLUNTEER_AVAILABILITY[keyof typeof VOLUNTEER_AVAILABILITY]

export const VOLUNTEER_AVAILABILITY_LABELS: Record<VolunteerAvailabilityStatus, string> = {
  [VOLUNTEER_AVAILABILITY.AVAILABLE]: 'Disponible',
  [VOLUNTEER_AVAILABILITY.BUSY]: 'Ocupado',
  [VOLUNTEER_AVAILABILITY.OFFLINE]: 'Desconectado',
  [VOLUNTEER_AVAILABILITY.ON_MISSION]: 'En misión',
  [VOLUNTEER_AVAILABILITY.UNAVAILABLE]: 'No disponible',
}

export const VOLUNTEER_AVAILABILITY_TONES: Record<VolunteerAvailabilityStatus, string> = {
  [VOLUNTEER_AVAILABILITY.AVAILABLE]: 'bg-operational/20 text-operational',
  [VOLUNTEER_AVAILABILITY.BUSY]: 'bg-warning/20 text-warning',
  [VOLUNTEER_AVAILABILITY.OFFLINE]: 'bg-white/10 text-ink-faint',
  [VOLUNTEER_AVAILABILITY.ON_MISSION]: 'bg-info/20 text-info',
  [VOLUNTEER_AVAILABILITY.UNAVAILABLE]: 'bg-critical/20 text-critical',
}

export const VOLUNTEER_VERIFICATION_LEVELS = {
  UNVERIFIED: 'unverified',
  BASIC: 'basic',
  ADVANCED: 'advanced',
  FULL: 'full',
} as const

export type VerificationLevel = typeof VOLUNTEER_VERIFICATION_LEVELS[keyof typeof VOLUNTEER_VERIFICATION_LEVELS]

export const VERIFICATION_LEVEL_LABELS: Record<VerificationLevel, string> = {
  [VOLUNTEER_VERIFICATION_LEVELS.UNVERIFIED]: 'Sin verificar',
  [VOLUNTEER_VERIFICATION_LEVELS.BASIC]: 'Verificación básica',
  [VOLUNTEER_VERIFICATION_LEVELS.ADVANCED]: 'Verificación avanzada',
  [VOLUNTEER_VERIFICATION_LEVELS.FULL]: 'Verificación completa',
}

export const SKILL_CATEGORIES: Record<string, string[]> = {
  medical: ['paramedic', 'doctor', 'nurse', 'psychologist', 'pharmacist'],
  logistics: ['driver', 'cook', 'electrician', 'mechanic', 'radio_operator'],
  rescue: ['rescuer', 'heavy_operator', 'dog_handler', 'swimmer'],
  construction: ['builder', 'carpenter', 'welder', 'architect'],
  communication: ['translator', 'radio_operator', 'journalist'],
}

export const SKILL_LABELS: Record<string, string> = {
  paramedic: 'Paramédico',
  doctor: 'Médico',
  nurse: 'Enfermero',
  psychologist: 'Psicólogo',
  pharmacist: 'Farmacéutico',
  driver: 'Conductor',
  cook: 'Cocinero',
  electrician: 'Electricista',
  mechanic: 'Mecánico',
  radio_operator: 'Operador de radio',
  rescuer: 'Rescatista',
  heavy_operator: 'Operador de maquinaria',
  dog_handler: 'Manejador canino',
  swimmer: 'Nadador de rescate',
  builder: 'Constructor',
  carpenter: 'Carpintero',
  welder: 'Soldador',
  architect: 'Arquitecto',
  translator: 'Traductor',
  journalist: 'Periodista',
}

export const URGENCY_THRESHOLDS: Record<string, number> = {
  critical: 20,
  high: 15,
  medium: 10,
  low: 5,
}

export interface VolunteerProfile {
  id: string
  userId: string
  fullName: string
  phone: string
  zone: string
  lat: number
  lng: number
  organization?: string
  experience?: string
  availability: VolunteerAvailabilityStatus
  verificationLevel: VerificationLevel
  trustScore: number
  avgResponseMinutes: number
  avgMissionDurationMinutes: number
  totalMissions: number
  completedMissions: number
  serviceHours: number
  skills: string[]
  specialties: string[]
  centersCollaborated: string[]
  lastLocationUpdate: Date
  lastActivityAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface VolunteerSkill {
  id: string
  volunteerId: string
  skill: string
  proficiency: number
}

export interface VolunteerAvailabilityLog {
  id: string
  volunteerId: string
  status: VolunteerAvailabilityStatus
  changedAt: Date
}
