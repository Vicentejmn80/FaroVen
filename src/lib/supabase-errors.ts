import type { PostgrestError } from '@supabase/supabase-js'

export function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const pg = error as PostgrestError
  const message = pg.message ?? ''
  const code = pg.code ?? ''
  const details = pg.details ?? ''

  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    message.includes('schema cache') ||
    message.includes('does not exist') ||
    details.includes('404')
  )
}

const MIGRATION_HINT =
  'Las tablas FARO no existen en tu proyecto Supabase. Abre SQL Editor y ejecuta las migraciones en supabase/migrations/ (primero 20260628151600_core_schema_reconcile.sql, luego el resto en orden).'

export function humanizeSupabaseError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Error desconocido al conectar con Supabase.'

  const pg = error as PostgrestError
  const message = pg.message ?? ''
  const code = pg.code ?? ''

  if (isMissingTableError(error)) {
    return MIGRATION_HINT
  }

  if (code === '42501' || message.toLowerCase().includes('permission') || message.toLowerCase().includes('policy')) {
    return 'No tienes permisos para esta acción.'
  }

  if (message.includes('not_authorized')) {
    return 'No tienes permisos para registrar centros.'
  }

  if (message.includes('invalid_latitude') || message.includes('invalid_longitude')) {
    return 'La ubicación del centro no es válida. Revisa el punto en el mapa.'
  }

  if (message.includes('center_name') || message.includes('center_address')) {
    return 'Revisa el nombre y la dirección del centro.'
  }

  if (message.includes('rate_limit') || message.includes('too many')) {
    return 'Has registrado demasiados centros en poco tiempo. Espera un momento e inténtalo de nuevo.'
  }

  if (
    code === 'PGRST116' ||
    message.includes('Cannot coerce the result to a single JSON object') ||
    message.includes('JSON object requested, multiple (or no) rows returned')
  ) {
    return 'No se pudo completar la operación solicitada.'
  }

  return 'No se pudo completar la operación. Inténtalo nuevamente.'
}

export { MIGRATION_HINT }
