/** Normaliza teléfono venezolano a E.164 (+58…) para Supabase Phone Auth. */
export function normalizeVePhone(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('58') && digits.length >= 12) return `+${digits}`
  if (digits.startsWith('0') && digits.length >= 11) return `+58${digits.slice(1)}`
  if (digits.length === 10) return `+58${digits}`
  if (input.startsWith('+')) return `+${digits}`
  return `+${digits}`
}

export function formatPhoneDisplay(e164: string): string {
  if (!e164) return ''
  return e164.replace(/^\+58/, '0')
}
