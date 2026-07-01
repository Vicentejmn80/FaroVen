import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseEnabled = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseEnabled) {
  console.warn('[FARO] Supabase env vars are missing. La app no mostrará datos operativos hasta configurar .env')
}

export const supabase = createClient(supabaseUrl ?? 'https://placeholder.invalid', supabaseAnonKey ?? 'placeholder-key')
