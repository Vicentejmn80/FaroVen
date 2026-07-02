import type { PostgrestError } from '@supabase/supabase-js'

const MIGRATION_HINT =
  'Las tablas FARO no existen en tu proyecto Supabase. Abre SQL Editor y ejecuta las migraciones en supabase/migrations/ (primero 20260628151600_core_schema_reconcile.sql, luego el resto en orden).'

export function humanizeSupabaseError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Error desconocido al conectar con Supabase.'

  const pg = error as PostgrestError
  const message = pg.message ?? ''
  const code = pg.code ?? ''
  const details = pg.details ?? ''

  if (
    code === 'PGRST205' ||
    code === '42P01' ||
    message.includes('schema cache') ||
    message.includes('does not exist') ||
    details.includes('404')
  ) {
    return MIGRATION_HINT
  }

  if (code === '42501' || message.toLowerCase().includes('permission') || message.toLowerCase().includes('policy')) {
    return 'No tienes permisos para esta acción.'
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
