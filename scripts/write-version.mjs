/**
 * Genera public/version.json antes del build.
 * Vite copia automáticamente public/ → dist/.
 *
 * Uso: se ejecuta automáticamente via script "prebuild" en package.json.
 * Para actualización crítica: FARO_CRITICAL_UPDATE=true npm run build
 */
import { execSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

function getCommitCount() {
  try {
    return execSync('git rev-list --count HEAD', { cwd: ROOT }).toString().trim()
  } catch {
    return '001'
  }
}

function getLocalCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim()
  } catch {
    return 'unknown'
  }
}

const now = new Date()
const y = String(now.getFullYear()).slice(2)
const m = String(now.getMonth() + 1).padStart(2, '0')
const d = String(now.getDate()).padStart(2, '0')
const seq = String(Number(getCommitCount())).padStart(3, '0')
const releaseCode = `FARO-${y}${m}${d}-${seq}`
const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? getLocalCommit()

const payload = {
  version: releaseCode,
  buildDate: now.toISOString(),
  commit,
  critical: process.env.FARO_CRITICAL_UPDATE === 'true',
}

const publicDir = path.join(ROOT, 'public')
mkdirSync(publicDir, { recursive: true })

const dest = path.join(publicDir, 'version.json')
writeFileSync(dest, JSON.stringify(payload, null, 2))

console.log(`[FARO] version.json → ${dest}`)
console.log(JSON.stringify(payload, null, 2))
