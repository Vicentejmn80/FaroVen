/**
 * Smoke check for canonical ops notification action_url parsing.
 * Run: node scripts/smoke-notification-routing.mjs
 *
 * Mirrors src/lib/notification-routing.ts + ops-notification-contract builders.
 */

function normalizeTabId(tab) {
  if (!tab) return null
  if (tab === 'home') return 'needs'
  if (tab === 'applications') return 'map'
  return tab
}

function parseNotificationActionUrl(actionUrl) {
  if (!actionUrl) return null
  const parts = actionUrl.split(':')
  if (parts[0] !== 'tab') return null

  if (parts[1] === 'volunteer') {
    const sub = parts[2]
    if (sub === 'available') return { tab: 'needs', volunteerTab: 'available' }
    if (sub === 'my-missions' || sub === 'activas') return { tab: 'needs', volunteerTab: 'my-missions' }
    return { tab: 'needs', volunteerTab: 'available' }
  }

  const tab = normalizeTabId(parts[1]) ?? parts[1]
  const target = { tab }

  if (tab === 'ops') {
    if (parts[2] === 'needs') target.coordinatorModule = 'needs'
    else if (parts[2] === 'missions') target.coordinatorModule = 'missions'
    else if (parts[2] === 'preparations') target.coordinatorModule = 'needs'
    else target.coordinatorModule = 'dashboard'
  }
  if (tab === 'needs') {
    target.volunteerTab = parts[2] === 'my-missions' ? 'my-missions' : 'available'
  }
  if ((tab === 'case-manager' || parts[1] === 'case-manager') && parts[2] === 'application' && parts[3]) {
    target.tab = 'case-manager'
    target.focusCaseId = parts[3]
    if (parts[4]) target.focusApplicationId = parts[4]
  }
  if ((tab === 'case-manager' || parts[1] === 'case-manager') && parts[2] === 'case' && parts[3]) {
    target.tab = 'case-manager'
    target.focusCaseId = parts[3]
  }
  if (parts[2] === 'mission-assigned' && parts[3]) {
    target.missionAssignedId = parts[3]
  }
  return target
}

const OPS = {
  gcApplication: (c, a) => `tab:case-manager:application:${c}:${a}`,
  gcCase: (c) => `tab:case-manager:case:${c}`,
  coordinatorNeeds: () => 'tab:ops:needs',
  coordinatorMissions: () => 'tab:ops:missions',
  volunteerAvailable: () => 'tab:volunteer:available',
  volunteerMissions: () => 'tab:volunteer:my-missions',
  volunteerMissionAssigned: (m) => `tab:map:mission-assigned:${m}`,
}

const checks = [
  [OPS.gcApplication('c1', 'a1'), (t) => t.focusCaseId === 'c1' && t.focusApplicationId === 'a1'],
  [OPS.gcCase('c1'), (t) => t.focusCaseId === 'c1' && t.tab === 'case-manager'],
  [OPS.coordinatorNeeds(), (t) => t.coordinatorModule === 'needs'],
  [OPS.coordinatorMissions(), (t) => t.coordinatorModule === 'missions'],
  [OPS.volunteerAvailable(), (t) => t.tab === 'needs' && t.volunteerTab === 'available'],
  [OPS.volunteerMissions(), (t) => t.tab === 'needs' && t.volunteerTab === 'my-missions'],
  [OPS.volunteerMissionAssigned('m1'), (t) => t.missionAssignedId === 'm1'],
]

let failed = 0
for (const [url, assert] of checks) {
  const parsed = parseNotificationActionUrl(url)
  const ok = parsed && assert(parsed)
  console.log(ok ? 'OK  ' : 'FAIL', url, '=>', JSON.stringify(parsed))
  if (!ok) failed += 1
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`)
  process.exit(1)
}
console.log('\nAll notification routing smoke checks passed')
