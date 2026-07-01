import type { GuideCategory } from '@/domain/models'

export const GUIDE_LIBRARY: GuideCategory[] = [
  {
    id: 'first-aid',
    title: 'Primeros auxilios',
    icon: '🩺',
    protocols: [
      {
        id: 'fa-bleeding',
        title: 'Control de hemorragias',
        summary: 'Detener sangrado crítico en los primeros minutos.',
        steps: [
          'Aplica presión directa continua con tela limpia.',
          'Eleva la zona lesionada si no hay fractura evidente.',
          'Si no cede, aplica torniquete y anota la hora.',
          'Solicita traslado inmediato al centro más cercano.',
        ],
      },
      {
        id: 'fa-cpr',
        title: 'RCP básica',
        summary: 'Actuar rápido ante paro cardiorrespiratorio.',
        steps: [
          'Verifica respuesta y respiración.',
          'Inicia compresiones al centro del tórax (100–120/min).',
          'Alterna 30 compresiones y 2 ventilaciones si estás entrenado.',
          'No detener hasta relevo médico o recuperación.',
        ],
      },
    ],
  },
  {
    id: 'flood',
    title: 'Inundaciones',
    icon: '🌧️',
    protocols: [
      {
        id: 'fl-evac',
        title: 'Evacuación por inundación',
        summary: 'Salir temprano y evitar zonas de corriente.',
        steps: [
          'Desconecta electricidad si es seguro hacerlo.',
          'Evacúa a zonas altas con mochila de emergencia.',
          'No cruces calles con corriente.',
          'Reporta bloqueos y personas aisladas.',
        ],
      },
    ],
  },
  {
    id: 'numbers',
    title: 'Números importantes',
    icon: '☎️',
    protocols: [
      {
        id: 'num-hotlines',
        title: 'Líneas de atención',
        summary: 'Contactos para emergencias y apoyo.',
        steps: ['911 · Emergencias generales', '0800-SALUDYA · Atención sanitaria', 'Protección Civil regional'],
      },
    ],
  },
]
