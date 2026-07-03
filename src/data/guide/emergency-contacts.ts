import type { EmergencyContact } from '@/domain/guide-models'

/** Números de emergencia — Venezuela. Actualizar aquí sin tocar componentes. */
export const EMERGENCY_CONTACTS: EmergencyContact[] = [
  {
    id: '911',
    name: 'Emergencias 911',
    description: 'Línea única de emergencias nacionales',
    phone: '911',
    icon: '☎️',
    priority: 1,
  },
  {
    id: 'ambulance',
    name: 'Ambulancias',
    description: 'Traslado médico urgente',
    phone: '171',
    icon: '🚑',
    priority: 2,
  },
  {
    id: 'fire',
    name: 'Bomberos',
    description: 'Incendios, rescates y materiales peligrosos',
    phone: '171',
    icon: '🚒',
    priority: 3,
  },
  {
    id: 'police',
    name: 'Policía',
    description: 'Seguridad ciudadana y orden público',
    phone: '171',
    icon: '👮',
    priority: 4,
  },
  {
    id: 'civil-protection',
    name: 'Protección Civil',
    description: 'Coordinación de emergencias y refugios',
    phone: '0800-PCIVIL',
    icon: '🛟',
    priority: 5,
  },
  {
    id: 'corpoelec',
    name: 'Corpoelec',
    description: 'Fallos eléctricos y riesgos en la red',
    phone: '176',
    icon: '⚡',
    priority: 6,
  },
  {
    id: 'hidrocapital',
    name: 'Hidrocapital',
    description: 'Agua potable, fugas y servicio',
    phone: '0800-HIDRO',
    icon: '💧',
    priority: 7,
  },
]
