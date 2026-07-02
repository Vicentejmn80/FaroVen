import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function assertSupabaseEnv(): { url: string; anonKey: string } {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

  const missing: string[] = []
  if (!url) missing.push('VITE_SUPABASE_URL')
  if (!anonKey) missing.push('VITE_SUPABASE_ANON_KEY')

  if (missing.length > 0) {
    const message =
      `[FARO] Supabase no configurado: faltan ${missing.join(' y ')}. ` +
      'Define estas variables en Vercel (Environment Variables) y vuelve a desplegar. ' +
      'Las variables VITE_* deben estar presentes durante el build (npm run build).'

    console.error(message)
    throw new Error(message)
  }

  return { url: url as string, anonKey: anonKey as string }
}

const { url: supabaseUrl, anonKey: supabaseAnonKey } = assertSupabaseEnv()

/** Solo true si el módulo cargó — la validación falla antes de crear el cliente. */
export const isSupabaseEnabled = true

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey)
