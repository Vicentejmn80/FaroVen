/** Codifica cantidad ofrecida en campos existentes (sin migración). */
const QTY_MARKER = /\[\[qty:(\d+)\]\]/i
const QTY_AVAIL = /^qty:(\d+)$/i

export function encodeQuantityOffered(quantity: number, baseMessage: string): {
  message: string
  availability: string
} {
  const qty = Math.max(1, Math.floor(quantity) || 1)
  const clean = baseMessage.replace(QTY_MARKER, '').trim()
  return {
    message: `[[qty:${qty}]] ${clean}`.trim(),
    availability: `qty:${qty}`,
  }
}

export function parseQuantityOffered(input?: {
  message?: string | null
  availability?: string | null
}): number | null {
  if (!input) return null
  const fromMsg = input.message?.match(QTY_MARKER)?.[1]
  if (fromMsg) {
    const n = Number(fromMsg)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const fromAvail = input.availability?.match(QTY_AVAIL)?.[1]
  if (fromAvail) {
    const n = Number(fromAvail)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  return null
}

export function stripQuantityMarker(message?: string | null): string {
  if (!message) return ''
  return message.replace(QTY_MARKER, '').trim()
}
