export function formatAuthError(message: string): string {
  const normalized = message.toLowerCase()

  // Mensajes ya traducidos (evitar doble format service → UI)
  if (
    message.startsWith('Límite de correos') ||
    message.startsWith('Correo o contraseña') ||
    message.startsWith('Confirma tu correo') ||
    message.startsWith('Este correo ya está') ||
    message.startsWith('El enlace de confirmación') ||
    message.startsWith('Supabase no está configurado') ||
    message.startsWith('[FARO] Supabase no configurado')
  ) {
    return message
  }

  if (normalized.includes('no api key found')) {
    return 'Supabase no está configurado en el servidor. Contacta al administrador (faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en Vercel).'
  }

  if (
    normalized.includes('rate limit') ||
    normalized.includes('over_email_send_rate_limit') ||
    normalized.includes('email rate limit exceeded') ||
    normalized.includes('status code 429') ||
    normalized.startsWith('429')
  ) {
    return 'Límite de correos alcanzado. Espera unos minutos e inténtalo de nuevo.'
  }

  if (normalized.includes('invalid login credentials')) {
    return 'Correo o contraseña incorrectos.'
  }

  if (normalized.includes('email not confirmed')) {
    return 'Confirma tu correo antes de iniciar sesión.'
  }

  if (normalized.includes('user already registered') || normalized.includes('already been registered')) {
    return 'Este correo ya está registrado. Inicia sesión o recupera tu contraseña.'
  }

  if (normalized.includes('email address not confirmed')) {
    return 'Confirma tu correo antes de iniciar sesión. Revisa tu bandeja o solicita un nuevo código.'
  }

  if (
    normalized.includes('otp_expired') ||
    normalized.includes('invalid or has expired') ||
    normalized.includes('one-time token not found')
  ) {
    return 'El enlace de confirmación expiró o ya fue usado. Solicita uno nuevo desde el registro.'
  }

  if (
    normalized.includes('user from sub claim') ||
    normalized.includes('user_not_found') ||
    normalized.includes('refresh_token_not_found')
  ) {
    return 'Tu sesión expiró o la cuenta fue eliminada. Cierra sesión e inicia de nuevo.'
  }

  if (
    normalized.includes('clock') ||
    normalized.includes('skew') ||
    normalized.includes('issued in the future') ||
    normalized.includes('jwt expired')
  ) {
    return 'La hora de tu dispositivo no coincide con el servidor. Sincroniza la hora del sistema e inténtalo de nuevo.'
  }

  if (normalized.includes('password should be at least')) {
    return 'La contraseña debe tener al menos 6 caracteres.'
  }

  if (normalized.includes('message_required')) {
    return 'Escribe un mensaje para el solicitante.'
  }

  if (normalized.includes('response_required')) {
    return 'Escribe tu respuesta antes de enviar.'
  }

  if (normalized.includes('request_not_found_or_not_pending')) {
    return 'La solicitud ya no está pendiente de revisión.'
  }

  if (normalized.includes('request_not_found_or_not_allowed')) {
    return 'No puedes responder a esta solicitud.'
  }

  if (normalized.includes('confirm_super_admin_required')) {
    return 'Confirma la eliminación de un Super Administrador.'
  }

  if (normalized.includes('cannot_delete_self') || normalized.includes('cannot_demote_self')) {
    return 'No puedes eliminar ni degradar tu propia cuenta.'
  }

  if (normalized.includes('cannot_modify_super_admin')) {
    return 'No se puede modificar a otro Super Administrador sin confirmación explícita.'
  }

  if (normalized.includes('not_authorized')) {
    return 'No tienes permisos para esta acción.'
  }

  if (normalized.includes('coordinator_requires_site')) {
    return 'Para coordinador debes asignar un centro desde el módulo Coordinadores.'
  }

  if (normalized.includes('super_admin_required_for_coordinator')) {
    return 'Solo un Super Administrador puede aprobar solicitudes de Coordinador.'
  }

  if (normalized.includes('no_pending_request')) {
    return 'La solicitud ya no está pendiente.'
  }

  if (normalized.includes('site_already_has_coordinator')) {
    return 'Ese centro ya tiene coordinador. Recarga la página e inténtalo de nuevo, o elige otro centro.'
  }

  if (normalized.includes('site_not_found')) {
    return 'El centro seleccionado no existe en la base de datos.'
  }

  if (normalized.includes('invalid_site_type')) {
    return 'Tipo de centro no válido para asignación.'
  }

  if (normalized.includes('profile_not_found')) {
    return 'No se encontró el perfil del usuario.'
  }

  if (normalized.includes('role_change_forbidden')) {
    return 'No se pudo cambiar el rol. Verifica que iniciaste sesión como Super Admin.'
  }

  if (
    normalized.includes('jwt') ||
    normalized.includes('token') ||
    normalized.includes('service_role') ||
    normalized.includes('postgres') ||
    normalized.includes('sql')
  ) {
    return 'No pudimos completar esta acción. Inténtalo nuevamente.'
  }

  return 'No pudimos completar esta acción. Inténtalo nuevamente.'
}
