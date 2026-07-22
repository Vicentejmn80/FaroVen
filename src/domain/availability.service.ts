import type { AvailabilitySlot } from './availability.types'

export function validateSlot(slot: Partial<AvailabilitySlot>): string | null {
  if (!slot.date || typeof slot.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(slot.date)) {
    return 'La fecha debe tener formato YYYY-MM-DD'
  }
  if (slot.hour === undefined || slot.hour < 0 || slot.hour > 23 || !Number.isInteger(slot.hour)) {
    return 'La hora debe ser un entero entre 0 y 23'
  }
  if (slot.available === undefined || typeof slot.available !== 'boolean') {
    return 'El estado de disponibilidad debe ser booleano'
  }
  return null
}

export function canModifySlot(slot: AvailabilitySlot): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const slotDate = new Date(slot.date + 'T00:00:00')
  return slotDate >= today
}

export function isPastSlot(slot: AvailabilitySlot): boolean {
  const now = new Date()
  const slotDateTime = new Date(slot.date + 'T' + String(slot.hour).padStart(2, '0') + ':00:00')
  return slotDateTime < now
}
