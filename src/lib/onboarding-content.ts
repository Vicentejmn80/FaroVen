import type { OnboardingModuleId } from '@/lib/onboarding-storage'

export const INITIAL_ONBOARDING_STEPS = [
  {
    id: 'what',
    title: 'Qué es FARO',
    body: 'FARO es un centro de operaciones humanitario. Reúne en un solo lugar la situación de hospitales, refugios y centros de acopio, con información verificada por coordinadores en el terreno.',
  },
  {
    id: 'actions',
    title: 'Qué puedes hacer',
    body: 'Consultar el mapa, ver qué falta en cada centro, reportar lo que observes y acceder a recursos de emergencia. No necesitas cuenta para explorar; solo para coordinar un centro.',
    bullets: [
      'Mapa — ubicar centros y sus necesidades.',
      'Recursos — contactos, protocolos y guías.',
      'Reportar — enviar información desde el terreno.',
    ],
  },
  {
    id: 'priorities',
    title: 'Prioridades y cobertura',
    body: 'Cada necesidad tiene una prioridad y un porcentaje de cobertura. Usa esto para decidir dónde enviar ayuda primero.',
    showPriorityGuide: true,
  },
  {
    id: 'cycle',
    title: 'Ciclo Operativo FARO',
    body: 'Cada necesidad permanece activa durante un ciclo operativo. Al finalizar, FARO solicitará el resultado para mantener la información actualizada.',
  },
  {
    id: 'start',
    title: 'Comienza a usar FARO',
    body: 'Explora el mapa y toca un centro para ver qué necesita. Las ayudas contextuales aparecerán la primera vez que visites cada sección.',
    footnote: 'FARO complementa la información oficial. Sigue las indicaciones de las autoridades competentes.',
  },
] as const

export const CONTEXTUAL_HELP: Record<
  OnboardingModuleId,
  { title: string; body: string; tip?: string }
> = {
  map: {
    title: 'Mapa operativo',
    body: 'Los puntos muestran centros activos. Toca uno para ver necesidades, navegar o compartir. Usa el listado para filtrar por prioridad.',
    tip: 'El resumen superior destaca las 3 prioridades más urgentes del momento.',
  },
  activity: {
    title: 'Centro de Recursos',
    body: 'Aquí encuentras contactos de emergencia, protocolos, listas de preparación e información verificada. Todo disponible sin conexión una vez cargado.',
  },
  reports: {
    title: 'Reportar información',
    body: 'Si ves algo relevante en el terreno — insumos faltantes, riesgos o vialidad — envía un reporte. Los coordinadores lo revisan y actualizan el mapa.',
    tip: 'Sé específico: indica el centro, la zona y qué observaste.',
  },
  profile: {
    title: 'Tu perfil',
    body: 'Consulta tu rol, centro asignado (si eres coordinador) y preferencias de notificaciones. Desde aquí puedes reiniciar las ayudas si lo necesitas.',
  },
  ops: {
    title: 'Panel del coordinador',
    body: 'Gestiona las necesidades de tu centro, revisa reportes ciudadanos y actualiza la saturación. Los cambios se reflejan de inmediato en el mapa público.',
    tip: 'Marca una necesidad como cubierta cuando recibas los insumos.',
  },
  admin: {
    title: 'Administración regional',
    body: 'Aprueba solicitudes de coordinadores, asigna centros y supervisa la operación de tu región desde este panel.',
  },
  system: {
    title: 'Administración del sistema',
    body: 'Gestión global de usuarios, solicitudes y salud de la plataforma. Reservado para administradores del sistema.',
  },
}

export const HELP_CENTER_TOPICS = [
  {
    id: 'coordinadores',
    question: '¿Qué es un coordinador?',
    answer:
      'Es la persona autorizada que mantiene actualizada la información de un centro específico: necesidades, inventario y reportes. Su rol lo aprueba un administrador regional.',
  },
  {
    id: 'necesidades',
    question: '¿Qué son las necesidades?',
    answer:
      'Son recursos que un centro requiere — insumos, personal o apoyo especializado. Cada una indica cantidad requerida, recibida y prioridad.',
  },
  {
    id: 'reportes',
    question: '¿Para qué sirven los reportes?',
    answer:
      'Permiten que cualquier persona en el terreno comparta información útil. Los coordinadores y administradores los revisan para actualizar la situación operativa.',
  },
  {
    id: 'prioridades',
    question: '¿Cómo funcionan las prioridades?',
    answer:
      'Crítica y Alta requieren atención inmediata. Media y Baja son importantes pero menos urgentes. Las cubiertas ya tienen suficiente stock.',
  },
  {
    id: 'cobertura',
    question: '¿Qué significa el porcentaje de cobertura?',
    answer:
      'Indica cuánto de lo requerido ya está disponible. Por ejemplo, 40% significa que aún falta más de la mitad. Debajo de 75% suele considerarse presión operativa.',
  },
] as const

export const PRIORITY_LEVELS = [
  { id: 'critical', label: 'Crítica', color: '#FF453A', description: 'Atención inmediata. Aparece en el Top 3 del dashboard.' },
  { id: 'high', label: 'Alta', color: '#FFD60A', description: 'Urgente, planificar en las próximas horas.' },
  { id: 'medium', label: 'Media', color: '#FFD60A', description: 'Importante, pero con margen de tiempo.' },
  { id: 'low', label: 'Baja', color: '#30D158', description: 'Seguimiento sin presión inmediata.' },
  { id: 'covered', label: 'Cubierta', color: '#30D158', description: 'Stock suficiente. No requiere acción.' },
] as const
