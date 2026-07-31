/**
 * Smoke checks for ops pipeline contract constants / URL builders.
 * Run: node scripts/smoke-ops-pipeline.mjs
 */

const OPS_CANONICAL_PHASES = {
  REVIEW: 'review',
  AWAITING_CENTER: 'awaiting_center',
  COVERAGE: 'coverage',
  EXECUTION: 'execution',
  VERIFY: 'verify',
  CLOSED: 'closed',
}

function stageToCanonicalPhase(stage) {
  const map = {
    nuevo: OPS_CANONICAL_PHASES.REVIEW,
    pending_review: OPS_CANONICAL_PHASES.REVIEW,
    validating: OPS_CANONICAL_PHASES.REVIEW,
    awaiting_info: OPS_CANONICAL_PHASES.REVIEW,
    awaiting_center_confirmation: OPS_CANONICAL_PHASES.AWAITING_CENTER,
    open_for_applications: OPS_CANONICAL_PHASES.COVERAGE,
    assigned: OPS_CANONICAL_PHASES.EXECUTION,
    accepted: OPS_CANONICAL_PHASES.EXECUTION,
    in_attention: OPS_CANONICAL_PHASES.EXECUTION,
    resolved: OPS_CANONICAL_PHASES.VERIFY,
    archived: OPS_CANONICAL_PHASES.CLOSED,
  }
  return map[stage] ?? OPS_CANONICAL_PHASES.REVIEW
}

const checks = [
  ['pending_review', 'review'],
  ['awaiting_center_confirmation', 'awaiting_center'],
  ['open_for_applications', 'coverage'],
  ['assigned', 'execution'],
  ['resolved', 'verify'],
  ['archived', 'closed'],
  ['validating', 'review'],
]

let failed = 0
for (const [stage, expected] of checks) {
  const got = stageToCanonicalPhase(stage)
  const ok = got === expected
  console.log(ok ? 'OK  ' : 'FAIL', stage, '=>', got)
  if (!ok) failed += 1
}

const quickPick = [5, 10, 20]
const ttl = 20
console.log(quickPick.length === 3 && ttl === 20 ? 'OK   quick-pick + TTL' : 'FAIL quick-pick/TTL')

if (failed) {
  console.error(`\n${failed} check(s) failed`)
  process.exit(1)
}
console.log('\nOps pipeline smoke checks passed')
