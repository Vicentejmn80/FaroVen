export function formatAuthError(message: string): string {
  const normalized = message.toLowerCase()

  if (
    normalized.includes('rate limit') ||
    normalized.includes('over_email_send_rate_limit') ||
    normalized.includes('email rate limit exceeded')
  ) {
    return 'Límite de correos alcanzado. Supabase permite muy pocos envíos por hora en desarrollo (≈2/hora). Espera 30–60 minutos o usa el último código que ya recibiste. Para pruebas frecuentes, configura SMTP propio en Supabase → Authentication → SMTP.'
  }

  if (normalized.includes('over_request_rate_limit')) {
    return 'Demasiados intentos seguidos. Espera un minuto e inténtalo de nuevo.'
  }

  if (normalized.includes('token has expired') || normalized.includes('otp_expired')) {
    return 'El código expiró. Cuando se levante el límite de correo, pide uno nuevo.'
  }

  if (normalized.includes('invalid') && normalized.includes('otp')) {
    return 'Código incorrecto. Revisa el correo e intenta de nuevo.'
  }

  return message
}

export function isEmailRateLimitError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('rate limit') ||
    normalized.includes('over_email_send_rate_limit') ||
    normalized.includes('email rate limit exceeded')
  )
}
