export function formatAuthError(message: string): string {
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid login credentials')) {
    return 'Correo o contraseña incorrectos.'
  }

  if (normalized.includes('email not confirmed')) {
    return 'Confirma tu correo antes de iniciar sesión.'
  }

  if (
    normalized.includes('rate limit') ||
    normalized.includes('over_email_send_rate_limit') ||
    normalized.includes('email rate limit exceeded')
  ) {
    return 'Límite de correos alcanzado. Espera unos minutos e inténtalo de nuevo.'
  }

  if (normalized.includes('user already registered') || normalized.includes('already been registered')) {
    return 'Este correo ya está registrado. Inicia sesión o recupera tu contraseña.'
  }

  if (normalized.includes('email address not confirmed')) {
    return 'Confirma tu correo antes de iniciar sesión. Revisa tu bandeja o solicita un nuevo código.'
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
