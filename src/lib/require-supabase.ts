import { isSupabaseEnabled } from '@/lib/supabase'

export function requireSupabase(): void {
  if (!isSupabaseEnabled) {
    throw new Error(
      'Supabase no está configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu archivo .env',
    )
  }
}
