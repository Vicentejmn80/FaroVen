import type { PipelineStage } from '@/domain/case-lifecycle.types'
import type { MissionStage, MissionAssignmentStatus, MissionPriority } from '@/domain/mission.types'
import type { RoleRequestStatus } from '@/domain/role-request.types'

/* ------------------------------------------------------------------ */
/*  Case pipeline stages (natural language)                           */
/* ------------------------------------------------------------------ */
export const PIPELINE_LABELS: Record<PipelineStage, string> = {
  nuevo: 'Nuevo',
  pending_review: 'En revisión',
  validating: 'En validación',
  awaiting_info: 'Info pendiente (en revisión)',
  open_for_applications: 'Esperando cobertura',
  awaiting_center_confirmation: 'Esperando cobertura',
  assigned: 'En progreso',
  accepted: 'En progreso',
  in_attention: 'En progreso',
  resolved: 'Resuelto',
  archived: 'Archivado',
}

/* ------------------------------------------------------------------ */
/*  Case priorities                                                   */
/* ------------------------------------------------------------------ */
export const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Prioridad crítica',
  high: 'Prioridad alta',
  medium: 'Prioridad media',
  low: 'Prioridad baja',
}

export const PRIORITY_SHORT_LABELS: Record<string, string> = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
}

/* ------------------------------------------------------------------ */
/*  Mission stages (natural language)                                 */
/* ------------------------------------------------------------------ */
export const MISSION_STAGE_LABELS: Record<MissionStage, string> = {
  created: 'Creada',
  matching: 'Buscando voluntarios',
  assigned: 'Voluntario asignado',
  accepted: 'Voluntario confirmado',
  en_route: 'Voluntario en camino',
  on_site: 'Voluntario en sitio',
  in_progress: 'En progreso',
  completed: 'Finalizada',
  verified: 'Verificada',
  cancelled: 'Cancelada',
  archived: 'Archivada',
}

/* ------------------------------------------------------------------ */
/*  Mission assignment statuses (natural language)                    */
/* ------------------------------------------------------------------ */
export const ASSIGNMENT_STATUS_LABELS: Record<MissionAssignmentStatus, string> = {
  assigned: 'Asignado',
  accepted: 'Confirmado',
  rejected: 'Rechazado',
  preparing: 'Preparándose',
  en_route: 'En camino',
  on_site: 'En sitio',
  in_progress: 'En progreso',
  completed: 'Finalizado',
  verified: 'Verificado',
  cancelled: 'Cancelado',
  archived: 'Archivado',
}

/* ------------------------------------------------------------------ */
/*  Mission priorities                                                */
/* ------------------------------------------------------------------ */
export const MISSION_PRIORITY_LABELS: Record<MissionPriority, string> = {
  critical: 'Misión crítica',
  high: 'Misión urgente',
  medium: 'Misión programada',
  low: 'Misión de apoyo',
}

/* ------------------------------------------------------------------ */
/*  Report statuses                                                   */
/* ------------------------------------------------------------------ */
export const REPORT_STATUS_LABELS: Record<string, string> = {
  new: 'Nuevo',
  pending: 'Esperando revisión',
  verified: 'Verificado',
  discarded: 'Descartado',
  converted: 'Convertido a caso',
}

/* ------------------------------------------------------------------ */
/*  Report categories (Tipos de incidente)                            */
/* ------------------------------------------------------------------ */
export const INCIDENT_TYPE_LABELS: Record<string, string> = {
  need: 'Necesidad humanitaria',
  damage: 'Daño en infraestructura',
  center: 'Problema en centro',
  person: 'Persona necesita ayuda',
  infra: 'Infraestructura',
  health: 'Emergencia médica',
  risk: 'Riesgo',
  shelter: 'Refugio temporal',
  supply: 'Suministros',
  security: 'Seguridad',
  road: 'Vialidad',
  wrong_info: 'Información incorrecta',
  person_found: 'Persona encontrada',
  person_transferred: 'Persona trasladada',
  hospital_changed: 'Cambio en hospital',
  need_covered: 'Necesidad cubierta',
  other: 'Otro',
}

/* ------------------------------------------------------------------ */
/*  Notification types (human-readable)                               */
/* ------------------------------------------------------------------ */
export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  new_report: 'Nuevo reporte recibido',
  report_verified: 'Reporte verificado',
  case_assigned: 'Caso asignado',
  mission_created: 'Misión creada',
  mission_assigned: 'Misión asignada',
  mission_accepted: 'Misión aceptada por voluntario',
  mission_completed: 'Misión finalizada',
  mission_cancelled: 'Misión cancelada',
  coordinator_request: 'Nueva solicitud de coordinador',
  coordinator_request_approved: 'Solicitud aprobada',
  coordinator_request_rejected: 'Solicitud rechazada',
  coordinator_info_request: 'Información adicional requerida',
  role_request: 'Nueva solicitud de ascenso',
  role_request_approved: 'Rol aprobado — tu interfaz se actualizará automáticamente',
  role_request_rejected: 'Solicitud de rol rechazada',
  role_request_under_review: 'Solicitud en revisión',
  new_need: 'Nueva necesidad registrada',
  need_critical: 'Necesidad en nivel crítico',
  center_saturated: 'Centro reportado como saturado',
  cycle_expired: 'Ciclo de necesidad vencido',
  signup: 'Nuevo registro de usuario',
  volunteer_interest: 'Voluntario interesado en ayudar',
  user_signup: 'Nuevo usuario registrado',
}

/* ------------------------------------------------------------------ */
/*  Role request statuses                                             */
/* ------------------------------------------------------------------ */
export const ROLE_REQUEST_STATUS_LABELS: Record<RoleRequestStatus, string> = {
  pending: 'Esperando revisión',
  under_review: 'En revisión',
  approved: 'Aprobado',
  rejected: 'Rechazado',
}

/* ------------------------------------------------------------------ */
/*  Site types                                                        */
/* ------------------------------------------------------------------ */
export const SITE_TYPE_LABELS: Record<string, string> = {
  hospital: 'Hospital',
  shelter: 'Refugio',
  supply_center: 'Centro de suministro',
  command_post: 'Puesto de mando',
  staging_area: 'Área de concentración',
}

/* ------------------------------------------------------------------ */
/*  Saturation levels                                                 */
/* ------------------------------------------------------------------ */
export const SATURATION_LABELS: Record<string, string> = {
  normal: 'Normal',
  moderate: 'Moderada',
  saturated: 'Saturado',
  collapsed: 'Colapsado',
}

/* ------------------------------------------------------------------ */
/*  Volunteer interest / postulation                                  */
/* ------------------------------------------------------------------ */
export const INTEREST_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente de revisión',
  contacted: 'Contactado',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  assigned: 'Asignado a misión',
}

/* ------------------------------------------------------------------ */
/*  Map-lite mission statuses (voluntario)                            */
/* ------------------------------------------------------------------ */
export const MAP_MISSION_STATUS_LABELS: Record<string, string> = {
  open: 'Buscando apoyo',
  assigned: 'Ayuda asignada',
  in_progress: 'Ayuda en proceso',
  completed: 'Finalizada',
}

export const NEED_STATUS_LABELS: Record<string, string> = {
  active: 'Necesidad activa',
  pending_closure: 'Esperando cierre',
  resolved: 'Resuelta',
  reopened: 'Reabierta',
  pending: 'En verificación',
  reserved: 'Ayuda reservada',
  in_progress: 'Ayuda en proceso',
  completed: 'Cobertura completa',
  expired: 'Expirada',
  closed: 'Cerrada',
  archived: 'Archivada',
}

export const SKILL_LABELS: Record<string, string> = {
  paramedic: 'Paramédico',
  nurse: 'Enfermería',
  doctor: 'Médico',
  driver: 'Conductor',
  logistics: 'Logística',
  psychologist: 'Apoyo psicológico',
  construction: 'Construcción',
  cooking: 'Alimentación',
  general: 'Apoyo general',
}

export const CONFIDENCE_BAND_LABELS: Record<string, string> = {
  high: 'Confianza alta',
  medium: 'Confianza media',
  low: 'Confianza baja',
}

/** Convierte score 0-100 a banda natural. */
export function confidenceBand(score: number): string {
  if (score >= 80) return CONFIDENCE_BAND_LABELS.high
  if (score >= 50) return CONFIDENCE_BAND_LABELS.medium
  return CONFIDENCE_BAND_LABELS.low
}

/* ------------------------------------------------------------------ */
/*  Public Needs workflow labels (ÉPICA 08)                            */
/* ------------------------------------------------------------------ */
export const PUBLIC_NEED_STATUS_LABELS: Record<string, string> = {
  pending: 'En verificación',
  active: 'Necesidad activa',
  reserved: 'Ayuda reservada',
  in_progress: 'Ayuda en proceso',
  completed: 'Cobertura completa',
  expired: 'Necesidad expirada',
  closed: 'Cerrada',
  archived: 'Archivada',
}

export const PUBLIC_NEED_VERIFICATION_LABELS: Record<string, string> = {
  pending_entry: 'Verificación de entrada pendiente',
  approved_entry: 'Entrada verificada',
  rejected_entry: 'Entrada rechazada',
  pending_exit: 'Verificación final pendiente',
  approved_exit: 'Salida verificada',
  rejected_exit: 'Salida rechazada',
}

export const COVERAGE_RESERVATION_LABELS: Record<string, string> = {
  reserved: 'Postulación pendiente',
  confirmed: 'Postulación aprobada',
  cancelled: 'Postulación rechazada',
  expired: 'Reserva expirada',
}

/* ------------------------------------------------------------------ */
/*  General operational terms                                         */
/* ------------------------------------------------------------------ */
export const OP_LABELS = {
  dashboard: 'Panel principal',
  inbox: 'Bandeja de entrada',
  cases: 'Casos activos',
  missions: 'Misiones operativas',
  reports: 'Reportes ciudadanos',
  needs: 'Necesidades de ayuda',
  map: 'Mapa operativo',
  profile: 'Mi perfil',
  collaborators: 'Colaboraciones',
  notifications: 'Centro de notificaciones',
  settings: 'Configuración',
  search: 'Buscar en el mapa',
  requests: 'Solicitudes',
  publicNeeds: 'Necesidades activas',
  needCoverage: 'Cobertura de ayuda',
  successCases: 'Casos de éxito',
  loading: 'Cargando información…',
  noData: 'No hay información disponible',
  error: 'Ocurrió un error',
  retry: 'Intentar de nuevo',
  save: 'Guardar cambios',
  cancel: 'Cancelar',
  confirm: 'Confirmar',
  close: 'Cerrar',
  back: 'Regresar',
  next: 'Siguiente',
  done: 'Listo',
  create: 'Crear',
  edit: 'Editar',
  delete: 'Eliminar',
  discard: 'Descartar',
  assign: 'Asignar',
  accept: 'Aceptar',
  reject: 'Rechazar',
  review: 'Revisar',
  approve: 'Aprobar',
  submit: 'Enviar',
  request: 'Solicitar',
  offer: 'Ofrecer ayuda',
  join: 'Unirse',
  leave: 'Salir',
  share: 'Compartir',
  copy: 'Copiar',
  copied: 'Copiado',
  viewDetail: 'Ver detalle',
  viewAll: 'Ver todo',
  markAllRead: 'Marcar todo como leído',
  noNotifications: 'No hay notificaciones',
  online: 'En línea',
  offline: 'Sin conexión',
  syncing: 'Sincronizando…',
  lastUpdate: 'Última actualización',
  updatedJustNow: 'Actualizado ahora mismo',
}

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  pending: 'Postulado',
  under_review: 'En revisión',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  withdrawn: 'Retirado',
  expired: 'Expirado',
}

/* ------------------------------------------------------------------ */
/*  Mission Execution Engine (ÉPICA 10)                                */
/* ------------------------------------------------------------------ */

/** Etapa de ejecución tal como la ve el gestor y el voluntario. */
export const MISSION_EXECUTION_LABELS: Record<string, string> = {
  assigned: 'Asignada',
  accepted: 'Aceptada',
  preparing: 'Preparándose',
  en_route: 'En camino',
  on_site: 'Llegó al lugar',
  in_progress: 'Ayuda en proceso',
  completed: 'Esperando validación',
  verified: 'Finalizada',
  archived: 'Archivada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
}

/** Texto explicativo bajo cada etapa. */
export const MISSION_EXECUTION_HINTS: Record<string, string> = {
  assigned: 'El voluntario aún no confirma la misión',
  accepted: 'El voluntario confirmó y va a movilizarse',
  preparing: 'El voluntario está alistando materiales',
  en_route: 'El voluntario se dirige al punto de ayuda',
  on_site: 'El voluntario llegó al punto de ayuda',
  in_progress: 'La ayuda se está entregando en este momento',
  completed: 'El gestor debe revisar la evidencia',
  verified: 'Ayuda validada por el gestor',
  archived: 'Misión cerrada y archivada',
  rejected: 'El voluntario no pudo tomar la misión',
  cancelled: 'La misión fue cancelada',
}

/** Botón principal del voluntario en cada etapa. */
export const MISSION_EXECUTION_ACTION_LABELS: Record<string, string> = {
  assigned: 'Aceptar misión',
  accepted: 'Iniciar misión',
  preparing: 'Iniciar misión',
  en_route: 'He llegado',
  on_site: 'Iniciar ayuda',
  in_progress: 'Finalizar ayuda',
}

/** Eventos del timeline operativo, en lenguaje natural. */
export const MISSION_EVENT_LABELS: Record<string, string> = {
  mission_created: 'Misión creada',
  application_submitted: 'Nueva postulación recibida',
  application_approved: 'Postulación aprobada',
  application_rejected: 'Postulación rechazada',
  matching_completed: 'Búsqueda de voluntarios completada',
  volunteer_assigned: 'Voluntario asignado',
  volunteer_accepted: 'Voluntario aceptó misión',
  volunteer_preparing: 'Voluntario se está preparando',
  volunteer_rejected: 'Voluntario rechazó la misión',
  volunteer_en_route: 'En camino',
  volunteer_on_site: 'Llegó al lugar',
  mission_in_progress: 'Inició ayuda',
  evidence_submitted: 'Subió evidencia',
  mission_completed: 'Entrega completada',
  mission_verified: 'Ayuda validada',
  mission_cancelled: 'Misión cancelada',
  mission_archived: 'Misión archivada',
  volunteer_unavailable: 'Voluntario no disponible',
  needs_info: 'Se solicitó más información',
  eta_delay: 'Retraso reportado',
  delivery_partial: 'Entrega parcial',
  awaiting_validation: 'Esperando validación',
}

/** Reglas logísticas: a dónde se despacha una necesidad. */
export const OPERATIONAL_DESTINATION_LABELS: Record<string, string> = {
  public_call: 'Convocatoria pública',
  institution: 'Institución específica',
  both: 'Convocatoria e institución',
}

export const OPERATIONAL_DESTINATION_HINTS: Record<string, string> = {
  public_call: 'Cualquier voluntario cercano puede postularse',
  institution: 'Solo se deriva al organismo responsable, sin voluntarios',
  both: 'Se avisa a los voluntarios y al organismo responsable',
}

export const INSTITUTION_TYPE_LABELS: Record<string, string> = {
  civil_protection: 'Protección Civil',
  firefighters: 'Bomberos',
  hospital: 'Hospital',
  city_hall: 'Alcaldía',
  ngo: 'ONG',
  police: 'Policía',
  other: 'Otra institución',
}

/** Quién ofrece la ayuda en una reserva de cobertura. */
export const COLLABORATOR_TYPE_LABELS: Record<string, string> = {
  citizen: 'Ciudadano',
  volunteer: 'Voluntario',
  organization: 'Organización',
  coordinator: 'Coordinador',
  mixed: 'Equipo mixto',
}

/* ------------------------------------------------------------------ */
/*  Helper: resolve a label with fallback                             */
/* ------------------------------------------------------------------ */
export function label(map: Record<string, string>, key: string | null | undefined, fallback?: string): string {
  if (!key) return fallback ?? OP_LABELS.noData
  return map[key] ?? fallback ?? key
}
