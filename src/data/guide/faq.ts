import type { FaqItem } from '@/domain/guide-models'

export const GUIDE_FAQ: FaqItem[] = [
  {
    id: 'report-center',
    question: '¿Cómo reporto un centro?',
    answer:
      'Ve a la pestaña Reportar, describe la situación y vincula el centro en el mapa si lo conoces. Los reportes ciudadanos entran en revisión antes de publicarse como verificados.',
  },
  {
    id: 'become-coordinator',
    question: '¿Cómo me convierto en coordinador?',
    answer:
      'Desde tu Perfil, solicita acceso de coordinador. Un administrador regional revisará tu solicitud y te asignará un centro operativo.',
  },
  {
    id: 'verification',
    question: '¿Cómo verifican la información?',
    answer:
      'Los coordinadores y administradores revisan reportes y actualizaciones. Solo la información confirmada aparece como verificada en el mapa y en esta sección.',
  },
  {
    id: 'recent-report',
    question: '¿Cómo sé si un reporte es reciente?',
    answer:
      'Cada evento muestra la hora relativa (hace minutos, horas). En el detalle del centro verás la última actualización registrada.',
  },
  {
    id: 'saturation',
    question: '¿Qué significa un centro saturado?',
    answer:
      'Indica que la ocupación supera el umbral seguro (75–90 %). Prioriza otros centros o coordina insumos antes de enviar más personas o recursos.',
  },
  {
    id: 'offline',
    question: '¿Funciona FARO sin internet?',
    answer:
      'Sí, parcialmente. La última información sincronizada queda disponible offline. Las acciones que requieren servidor se enviarán al reconectar.',
  },
]
