# FARO — Operational Flow Audit

> Audit date: 2026-07-17
> Epic: ÉPICA 06 — Pilot Readiness & Emergency Operations MVP

---

## 1. Citizen Flow

| Feature | Status | Critical | Problem | Solution |
|---------|--------|----------|---------|----------|
| Public report creation (no auth) | ❌ Broken | 🔴 | Saves to `localStorage` only — never reaches Supabase. Citizen gets a tracking code that only works in the same browser session. | Connect `CitizenReport` to `reportRepository.create()` so public reports persist in the DB. Add anon RLS policy for INSERT. |
| Photo upload | ❌ Missing | 🟡 | Step 5 in `CitizenReport` is a placeholder button — no file picker, no upload, no storage. | Implement file upload to Supabase Storage, attach URL to the report record. |
| Authenticated report creation | ✅ Working | — | `ReportsScreen` submits to Supabase via `submitReport()` → `reportRepository.create()` with Turnstile bot protection. | — |
| Report categories | ✅ Working | — | Both flows have category selection (6 for public, 4 for authenticated). | — |
| Location capture | ⚠️ Partial | 🟡 | Public flow uses free-text (no geocoding). Authenticated flow requires a pre-registered center. Public reports lack coordinates. | Add OSM geocoding to public flow or use browser Geolocation API. |
| Bot protection | ⚠️ Partial | 🟡 | Turnstile only in authenticated `ReportsScreen`. Public `CitizenReport` has no bot protection. | Add Turnstile or rate-limiting to the public report endpoint. |
| Notification on report resolution | ❌ Missing | 🔴 | When a coordinator approves/rejects a report, no notification reaches the citizen (no push, no email, no in-app). | Implement notification channel that connects `reviewReport` mutation → citizen contact method. |
| Duplicate detection | ❌ Missing | 🟡 | No duplicate report detection. Same citizen/location/issue can submit unlimited identical reports. | Add a domain service `detectDuplicateReport()` with time+location+description fuzzy matching. |
| Rate limiting / abuse prevention | ❌ Missing | 🟡 | No rate limiting on public reports. A single client can flood the system. | Add Supabase RLS row-count check per IP per time window, or API-level rate limiting. |
| Contact info storage | ⚠️ Partial | 🟡 | Public flow captures name/phone/email but stores in `localStorage`. Authenticated flow stores hardcoded `'Reporte ciudadano'`. | Normalize: store real contact info from both flows in the `reports` table `contact_info` column. |

### Critical Path

```
Citizen opens app → sees public portal → taps "Reportar" → fills form → submits
  → ❌ Data never reaches Supabase
  → ❌ No coordinator can see the report
  → ❌ No case is created
  → ❌ No notification to citizen
```

**Fix required before pilot:** Connect public report flow to Supabase.

---

## 2. Case Flow

| Feature | Status | Critical | Problem | Solution |
|---------|--------|----------|---------|----------|
| Case creation | ✅ Working | — | Via `caseService.create()` → `caseRepository.create()`. Properly stores to Supabase `cases` table. | — |
| State machine (9 stages, 16 transitions) | ✅ Working | — | All transitions enforced via `case-lifecycle.service.ts`. 57 tests pass. | — |
| Case assignment | ✅ Working | — | `assignmentService.assign()` creates assignment + transitions case to `assigned` stage. | — |
| Center suggestion engine | ✅ Working | — | `suggestCentersForCase()` using Haversine distance + saturation scoring. | — |
| SLA tracking | ✅ Working | — | `slaService` with deadline calculation, warning/breach detection, per-priority SLAs (2h/8h/24h/72h). | — |
| Event/audit trail | ✅ Working | — | `caseRepository.addEvent()` stores every transition in `case_events` table. | — |
| Auto-case creation from reports | ❌ Missing | 🟡 | No automatic pipeline: citizen report → case creation. Reports and cases are disconnected. | Add a domain service or trigger that creates a Case when a report is verified (priority high). |
| Operations Hub integration | ⚠️ Partial | 🟡 | `operations-hub-service.ts` has mapping functions (`reportToOpsCase`) but the automated alert flow from report → case → hub is not wired. | Add service that listens for new verified reports, creates a case, and alerts the Operations Hub. |

### Critical Path

```
Report verified → 
  → ❌ No automatic case creation
  → ❌ Operations Hub not alerted
  → Manual intervention required
```

**Fix:** Add `AutoCaseService` that creates a case when a high/critical report is verified.

---

## 3. Coordinator Flow

| Feature | Status | Critical | Problem | Solution |
|---------|--------|----------|---------|----------|
| Accept cases | ✅ Working | — | `useAcceptCoordinatorCase()` transitions `assigned → accepted`. | — |
| Reject cases | ✅ Working | — | `useRejectCoordinatorCase()` transitions `assigned → pending_review` with reason. | — |
| Start attention | ✅ Working | — | `useStartCoordinatorAttention()` transitions `accepted → in_attention`. | — |
| Resolve cases | ✅ Working | — | `useResolveCoordinatorCase()` transitions `in_attention → resolved`. | — |
| Report review inbox | ✅ Working | — | `CoordinatorReportsInbox` with pending/approved/rejected filters. Approve/dismiss with notes. | — |
| Capacity editor | ✅ Working | — | `CoordinatorCapacityEditor` updates center capacity. | — |
| Resources panel | ✅ Working | — | `CoordinatorResourcesPanel` for center resource management. | — |
| Mission creation | ✅ Working | — | `CoordinatorMissionPanel` with create/start matching/verify/cancel. | — |
| Support requests | ✅ Working | — | `CoordinatorSupportPanel` to request external support. | — |
| Real-time updates | ⚠️ Partial | 🟡 | `useFaroData` has real-time channels for reports but coordinator panels don't auto-refresh consistently. | Add proper Realtime subscriptions or shorter `refetchInterval` on coordinator queries. |
| Notification to coordinator on new case assignment | ❌ Missing | 🔴 | When a case is assigned to a center, the coordinator has no notification (no badge, no sound, no push). | Wire `caseService.transition()` → `notificationService.send()` → coordinator. |

### Critical Path

```
Case assigned to center → coordinator opens app
  → ✅ Can see cases in panel
  → ❌ No push/alert notification
  → Coordinator must manually refresh or reopen the app
```

**Fix:** Add real-time Realtime subscription on `cases` table for assigned centers, or add a notification dispatch in the assignment service.

---

## 4. Volunteer Flow

| Feature | Status | Critical | Problem | Solution |
|---------|--------|----------|---------|----------|
| Profile creation | ✅ Working | — | Via `volunteerService.createProfile()` with fullName, phone, zone, location, organization. | — |
| Availability management | ✅ Working | — | 5 states (available/busy/offline/on_mission/unavailable) with `AvailabilitySelector` UI. | — |
| Skills management | ✅ Working | — | Dynamic skills via `volunteer_skills` table, CRUD via hooks. | — |
| Trust score calculation | ✅ Working | — | `calculateTrustScore()` in domain service (verification + completion rate + response time). | — |
| Matching engine | ✅ Working | — | `matchingService.runMatching()` with 6-factor scoring (skills, distance, availability, experience, load, response time). | — |
| Available missions view | ⚠️ Broken | 🟡 | `AvailableMissions` component fetches with `useMissions({ status: MISSION_STAGES.ASSIGNED })` but passes **mock empty assignment** to `VolunteerMissionCard`. The accept/reject buttons call `respond.mutate()` with `assignmentId: 'pending'` which will fail in DB. | Query actual assignments for the volunteer and use real assignment IDs. |
| Accept/reject mission | ⚠️ Broken | 🟡 | `useRespondMission` mutation calls `missionService.acceptAssignment(assignmentId)` but the hook passes `assignmentId: 'pending'` (hardcoded string). The actual assignment ID is unknown at the component level. | Restructure: when a volunteer accepts, fetch their assignment for that mission. |
| Mission status updates (en_route, on_site, completed) | ⚠️ Broken | 🟡 | `useUpdateMissionAssignment` calls `missionRepository.updateAssignment()` but the `VolunteerMissionCard` component in `AvailableMissions` doesn't have the real assignment ID. `MyMissions` section shows limited mission data (no title, no description). | Pass real assignment IDs. Populate mission data from the mission repository for each assignment. |
| Volunteer history | ⚠️ Partial | 🟡 | `history` tab renders the same `<MyMissions />` component, not a separate filtered view. | Add a proper history view that shows completed/verified/archived missions with filtering. |
| Notification on mission assignment | ❌ Missing | 🔴 | `mission-notification-service.ts` exists with `LogChannel` but no real notification provider (Telegram, push, in-app). Volunteers don't know they've been assigned. | Wire the `notifyVolunteer()` function to a real channel (Telegram BOT or in-app notification). |

### Critical Path

```
Coordinator creates mission → matching runs → volunteer assigned
  → ❌ Volunteer has no notification
  → ✅ Volunteer can see in "Disponibles" tab (if they open app)
  → ❌ Accept/reject buttons pass fake assignment IDs
  → ❌ Mission flow breaks after accept
```

**Fix:** Fix the volunteer assignment flow with real assignment IDs and add notification dispatch.

---

## 5. Admin Flow

| Feature | Status | Critical | Problem | Solution |
|---------|--------|----------|---------|----------|
| Site registry CRUD | ✅ Working | — | Create, read, update centers (hospitals, shelters, supply centers). Delete via `adminService.deleteSite()`. | — |
| User management | ✅ Working | — | List profiles, update status, change roles, delete users. | — |
| Coordinator management | ✅ Working | — | List, remove, revoke coordinator roles. | — |
| Needs CRUD | ✅ Working | — | Create, update, delete needs with priority and quantities. | — |
| Report review | ✅ Working | — | Verify/dismiss/restore/delete reports. | — |
| Audit log | ✅ Working | — | `audit-repository.ts` + `useAuditTimeline` hook. | — |
| Operational settings | ✅ Working | — | Key-value settings with CRUD. | — |
| Maintenance actions | ✅ Working | — | Archive covered needs, clean dismissed reports, delete test data, reset dashboard. | — |
| Data reset | ✅ Working | — | `resetOperationalData()` with optional email preservation. | — |
| Bulk user management | ❌ Missing | 🟡 | Can't invite/register multiple users at once. Each volunteer/c coordinator needs individual admin action. | Not critical for pilot V1. Can be added later. |

---

## 6. Production Data Hardening

| Feature | Status | Critical | Problem | Solution |
|---------|--------|----------|---------|----------|
| RLS policies | ⚠️ Partial | 🔴 | RLS exists for reports (`coordinator_read_own_site_reports`, `anon_insert_reports`, etc.) but needs comprehensive audit across all 16+ tables. | Run `supabase/db_health_check.sql` verifying each table's RLS. |
| Foreign key constraints | ⚠️ Partial | 🟡 | Mission tables have FK constraints. Need to verify all tables have proper FKs to prevent orphaned data. | Audit `supabase/migrations/` for FK coverage. |
| Indexes | ⚠️ Partial | 🟡 | `idx_reports_site_status` exists. Need indexes on: `cases(pipeline_stage)`, `cases(assigned_center_id)`, `missions(center_id)`, `missions(status)`, `volunteers(zone)`. | Add covering indexes for common query patterns. |
| Realtime channels | ⚠️ Partial | 🟡 | Reports table has Realtime enabled. Need to verify `cases`, `missions`, `volunteers`, `events` tables have Realtime replication. | Enable Realtime on all operational tables. |
| Orphaned data risk | 🔴 High | 🔴 | `case_assignments` referencing centers that may be deleted. `mission_assignments` referencing volunteers that may be deleted. | Add CASCADE or SET NULL on foreign keys, or add soft-delete pattern. |
| Supabase anon key exposure in public flow | ⚠️ Warning | 🟡 | Public reports use the anon key — if RLS is misconfigured, an attacker could read/write arbitrary data. | Review all anon RLS policies and restrict to minimum necessary operations. |

---

## 7. Critical Gaps for Pilot

### Show-stoppers (must fix before pilot)

1. **Public reports never reach backend** — CitizenReport uses `localStorage` only. No coordinator can see public reports.
2. **No notification system** — `mission-notification-service.ts` only logs to console. Coordinators and volunteers never receive alerts.
3. **Volunteer assignment flow broken** — Accept/reject and status updates use fake `assignmentId: 'pending'`. Mission operations don't work.
4. **No auto-case creation from reports** — Verified reports don't automatically create cases. Manual intervention required.
5. **Case assignment notification missing** — Coordinator doesn't know when a case is assigned to their center.
6. **Volunteer notification missing** — Volunteer doesn't know when a mission is assigned.

### Important (fix for a good pilot experience)

7. **Duplicate report detection missing** — Citizens can submit unlimited identical reports.
8. **Rate limiting missing** — No abuse prevention on public report submission.
9. **Missing indexes** — Query performance may degrade with real data.
10. **Realtime subscriptions incomplete** — Coordinator/volunteer panels don't auto-update.

### Nice-to-have (post-pilot)

11. Photo upload
12. Bulk user management
13. Geocoding for public report location
14. Contact info normalization

---

## 8. Stabilization Plan

### Phase 1 — Critical fixes (before pilot launch)

1. Connect public `CitizenReport` to Supabase:
   - Add anon INSERT RLS policy for `reports` table
   - Modify `savePortalReport()` → `reportRepository.create()`
   - Preserve tracking code generation on the backend
   - Return tracking code to citizen for status lookup
2. Fix volunteer assignment flow:
   - `AvailableMissions` should query assignments for current user
   - Use real `assignmentId` for accept/reject/status mutations
   - Populate mission title/description in `MyMissions`
3. Implement Telegram notification provider (FASE 4):
   - `telegram-notification-provider.ts`
   - Send alerts on: new critical report, new mission assignment, case assignment
4. Add auto-case creation service:
   - When a report is verified with priority high/critical → auto-create case
   - Link report ID to case for traceability
5. Add notification dispatch to assignment service:
   - When `caseService.transition()` → `assigned` → notify coordinator
   - When `matchingService.runMatching()` → volunteer assigned → notify volunteer

### Phase 2 — Hardening (pilot prep)

6. Add database health check script
7. Add indexes for common query patterns
8. Enable Realtime on operational tables
9. Add duplicate report detection domain service
10. Add rate limiting on public report endpoint

### Phase 3 — Data & Demo (FASE 3)

11. Create `EmergencyScenarioSeeder` with seed data for demo
12. Create pilot feedback table

---

## 9. Matrix Summary

| Flow | Status | Critical Issues | Pilot Ready? |
|------|--------|-----------------|-------------|
| Citizen Report (public) | ❌ Broken | 1 show-stopper | NO |
| Citizen Report (auth) | ✅ Working | — | YES |
| Case Management | ✅ Working | 1 important | YES (with Realtime fix) |
| Coordinator Ops | ✅ Working | 1 important | YES (with notification) |
| Volunteer Mission | ⚠️ Broken | 2 show-stoppers | NO |
| Volunteer Matching | ✅ Domain OK | — | Domain only (not wired end-to-end) |
| Admin Console | ✅ Working | — | YES |
| Notification System | ❌ Missing | 1 show-stopper | NO |
| Operational Intelligence | ✅ Domain OK | — | Domain built, UI exists, needs data wiring |
| Simulation Engine | ✅ Domain OK | — | Standalone, working |
