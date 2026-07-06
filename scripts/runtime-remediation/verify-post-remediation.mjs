/**
 * FARO — Post-remediation verification
 *
 * Usage:
 *   node scripts/runtime-remediation/verify-post-remediation.mjs
 *
 * Required .env (root or frontend/.env):
 *   SUPABASE_URL          (or VITE_SUPABASE_URL)
 *   SUPABASE_ANON_KEY     (or VITE_SUPABASE_ANON_KEY)
 *   DATABASE_URL          — Postgres pooler/direct URL for SQL catalog checks
 *
 * HTTP checks use anon key only (never service_role).
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnv() {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), 'frontend/.env'),
  ]
  for (const envPath of candidates) {
    if (!existsSync(envPath)) continue
    for (const rawLine of readFileSync(envPath, 'utf8').split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const idx = line.indexOf('=')
      if (idx <= 0) continue
      const key = line.slice(0, idx).trim()
      const value = line.slice(idx + 1).trim()
      if (!process.env[key]) process.env[key] = value
    }
  }
}

loadEnv()

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const databaseUrl = process.env.DATABASE_URL

if (!supabaseUrl || !anonKey) {
  console.error('❌ Missing SUPABASE_URL and SUPABASE_ANON_KEY (or VITE_* equivalents) in .env')
  process.exit(1)
}

const anonHeaders = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  'Content-Type': 'application/json',
}

const results = []

function record(id, pass, detail = '') {
  results.push({ id, pass, detail })
  console.log(`${pass ? '✅' : '❌'} ${id}${detail ? ` — ${detail}` : ''}`)
}

async function runSql(sql) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not set')
  }
  let pg
  try {
    pg = await import('pg')
  } catch {
    throw new Error('Install pg for SQL checks: npm install pg')
  }
  const client = new pg.default.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    const res = await client.query(sql)
    return res.rows
  } finally {
    await client.end()
  }
}

async function runSqlChecks() {
  if (!databaseUrl) {
    record(
      'c) has_function_privilege anon notify_coordinator_request_user',
      false,
      'SKIPPED — set DATABASE_URL in .env',
    )
    record(
      'd) has_function_privilege anon log_auth_event',
      false,
      'SKIPPED — set DATABASE_URL in .env',
    )
    record('e) public_read_persons policy absent', false, 'SKIPPED — set DATABASE_URL')
    record('f) profiles/coordinator_profiles not in realtime', false, 'SKIPPED — set DATABASE_URL')
    record('g) coordinator_profiles_site_unique index exists', false, 'SKIPPED — set DATABASE_URL')
    record('h) validate_need_write contains invalid_need_owner', false, 'SKIPPED — set DATABASE_URL')
    record('i) admin_insert policies enforce status=active', false, 'SKIPPED — set DATABASE_URL')
    return
  }

  try {
    const [notifyPriv] = await runSql(
      `SELECT has_function_privilege(
        'anon',
        'public.notify_coordinator_request_user(uuid,text,text,text,jsonb,uuid)',
        'EXECUTE'
      ) AS allowed`,
    )
    record(
      'c) has_function_privilege anon notify_coordinator_request_user',
      notifyPriv.allowed === false,
      `allowed=${notifyPriv.allowed}`,
    )

    const [logPriv] = await runSql(
      `SELECT has_function_privilege(
        'anon',
        'public.log_auth_event(text,uuid,jsonb)',
        'EXECUTE'
      ) AS allowed`,
    )
    record(
      'd) has_function_privilege anon log_auth_event',
      logPriv.allowed === false,
      `allowed=${logPriv.allowed}`,
    )

    const [personsPolicy] = await runSql(
      `SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'persons'
          AND policyname = 'public_read_persons'
      ) AS exists`,
    )
    record(
      'e) public_read_persons policy absent',
      personsPolicy.exists === false,
      `exists=${personsPolicy.exists}`,
    )

    const [realtime] = await runSql(
      `SELECT
        EXISTS (
          SELECT 1 FROM pg_publication_tables
          WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
        ) AS profiles_in_rt,
        EXISTS (
          SELECT 1 FROM pg_publication_tables
          WHERE pubname = 'supabase_realtime' AND tablename = 'coordinator_profiles'
        ) AS coord_profiles_in_rt`,
    )
    const rtOk = realtime.profiles_in_rt === false && realtime.coord_profiles_in_rt === false
    record(
      'f) profiles/coordinator_profiles not in realtime',
      rtOk,
      `profiles=${realtime.profiles_in_rt}, coordinator_profiles=${realtime.coord_profiles_in_rt}`,
    )

    const [idx] = await runSql(
      `SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'coordinator_profiles'
          AND indexname = 'coordinator_profiles_site_unique'
      ) AS exists`,
    )
    record(
      'g) coordinator_profiles_site_unique index exists',
      idx.exists === true,
      `exists=${idx.exists}`,
    )

    const [needFn] = await runSql(
      `SELECT strpos(
        pg_get_functiondef('public.validate_need_write()'::regprocedure),
        'invalid_need_owner'
      ) > 0 AS has_guard`,
    )
    record(
      'h) validate_need_write contains invalid_need_owner',
      needFn.has_guard === true,
      `has_guard=${needFn.has_guard}`,
    )

    const [policies] = await runSql(
      `SELECT count(*) FILTER (
          WHERE with_check LIKE '%status = ''active''%'
        ) AS ok_count,
        count(*) AS total
       FROM pg_policies
       WHERE policyname IN (
         'regional_admin_insert_hospitals',
         'regional_admin_insert_shelters',
         'regional_admin_insert_supply_centers'
       )`,
    )
    const policiesOk = Number(policies.ok_count) === 3 && Number(policies.total) === 3
    record(
      'i) admin_insert policies enforce status=active',
      policiesOk,
      `ok=${policies.ok_count}/3`,
    )
  } catch (err) {
    record('SQL checks', false, err.message)
  }
}

async function runHttpChecks() {
  const edgeUrl = `${supabaseUrl}/functions/v1/send-notification-push`

  const noSecretRes = await fetch(edgeUrl, {
    method: 'POST',
    headers: anonHeaders,
    body: JSON.stringify({ notification_id: '00000000-0000-0000-0000-000000000000' }),
  })
  record(
    'a) Edge Function without secret → 401',
    noSecretRes.status === 401,
    `status=${noSecretRes.status}`,
  )

  const badSecretRes = await fetch(edgeUrl, {
    method: 'POST',
    headers: { ...anonHeaders, 'x-faro-webhook-secret': 'invalid-secret' },
    body: JSON.stringify({ notification_id: '00000000-0000-0000-0000-000000000000' }),
  })
  record(
    'b) Edge Function with invalid secret → 401',
    badSecretRes.status === 401,
    `status=${badSecretRes.status}`,
  )
}

console.log('=== FARO Post-Remediation Verification ===\n')

await runHttpChecks()
await runSqlChecks()

const passed = results.filter((r) => r.pass).length
const failed = results.filter((r) => !r.pass).length

console.log('')
if (failed === 0) {
  console.log(`PASS: ${passed} checks`)
  process.exit(0)
} else {
  console.log(`FAIL: ${failed} checks (${passed} passed, ${failed} failed)`)
  process.exit(1)
}
