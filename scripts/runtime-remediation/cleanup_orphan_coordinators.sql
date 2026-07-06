-- FARO — Runtime Remediation: T-038 orphan coordinator_profiles cleanup
-- Run in Supabase SQL Editor with postgres role.
-- STEP 1: Review only. STEP 2: Delete only after manual approval.

-- ── STEP 1: INVENTORY (read-only) ───────────────────────────
SELECT
  cp.id AS coordinator_profile_id,
  cp.auth_user_id,
  cp.site_type,
  cp.site_id,
  cp.full_name,
  cp.onboarding_complete,
  cp.created_at,
  EXISTS (SELECT 1 FROM auth.users u WHERE u.id = cp.auth_user_id) AS in_auth_users,
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = cp.auth_user_id) AS in_profiles
FROM coordinator_profiles cp
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = cp.auth_user_id)
   OR NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = cp.auth_user_id)
ORDER BY cp.created_at;

-- ── STEP 2: DELETE (manual approval required) ───────────────
-- Uncomment and run ONLY after reviewing STEP 1 output.

-- DELETE FROM coordinator_profiles cp
-- WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = cp.auth_user_id)
--    OR NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = cp.auth_user_id);

-- ── STEP 3: VERIFY (read-only) ──────────────────────────────
-- SELECT count(*) AS remaining_orphans
-- FROM coordinator_profiles cp
-- WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = cp.auth_user_id)
--    OR NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = cp.auth_user_id);
