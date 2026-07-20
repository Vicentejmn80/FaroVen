/**
 * Falla el build si faltan variables VITE_* obligatorias.
 * En Vercel deben existir antes de `npm run build`.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']

function loadDotEnv(filename) {
  const path = resolve(root, filename)
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

const fileEnv = { ...loadDotEnv('.env'), ...loadDotEnv('.env.local') }
const missing = required.filter((key) => {
  const value = (process.env[key] ?? fileEnv[key] ?? '').trim()
  return !value
})

if (missing.length > 0) {
  console.error(
    `[FARO build] Faltan variables obligatorias: ${missing.join(', ')}.\n` +
      'Configúralas en Vercel → Settings → Environment Variables (Production + Preview)\n' +
      'y vuelve a desplegar. VITE_* deben existir durante el build.',
  )
  process.exit(1)
}

console.log('[FARO build] Supabase env OK')
