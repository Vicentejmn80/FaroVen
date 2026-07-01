import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env')
  const content = readFileSync(envPath, 'utf8')
  const result = {}

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    result[key] = value
  }

  return result
}

async function run() {
  const env = loadEnv()
  const url = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in frontend/.env')
  }

  const supabase = createClient(url, key)
  const countCheck = (table) =>
    supabase.from(table).select('id', { count: 'exact', head: true })

  const checks = [
    ['hospitals', () => countCheck('hospitals')],
    ['shelters', () => countCheck('shelters')],
    ['supply_centers', () => countCheck('supply_centers')],
    ['needs', () => countCheck('needs')],
    ['persons', () => countCheck('persons')],
    ['bulletins', () => countCheck('bulletins')],
    ['reports_insert_permission', () =>
      supabase.from('reports').insert({
        type: 'other',
        description: 'healthcheck',
      }),
    ],
    ['search_person_rpc', () =>
      supabase.rpc('search_person', {
        p_first_name: null,
        p_last_name: null,
        p_limit: 1,
      }),
    ],
  ]

  let hasErrors = false

  for (const [name, fn] of checks) {
    const result = await fn()
    const { error } = result

    if (error) {
      hasErrors = true
      console.error(`FAIL ${name}: ${error.message}`)
      continue
    }

    if ('count' in result && result.count !== null && result.count !== undefined) {
      console.log(`OK   ${name} (${result.count} rows)`)
      if (result.count === 0) {
        console.warn(`WARN ${name}: table is empty — run seed migration 4`)
      }
    } else {
      console.log(`OK   ${name}`)
    }
  }

  if (hasErrors) process.exit(1)
}

run().catch((err) => {
  console.error('Schema check failed:', err.message)
  process.exit(1)
})
