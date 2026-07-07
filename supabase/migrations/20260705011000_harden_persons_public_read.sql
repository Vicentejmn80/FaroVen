-- FARO — High Severity Remediation A-05
-- Remove public read access to persons (PII exposure)

-- ============================================================
-- A-05: Restrict SELECT on persons to coordinators/admins only
-- ============================================================
DROP POLICY IF EXISTS public_read_persons ON persons;

DROP POLICY IF EXISTS coordinator_read_persons ON persons;
CREATE POLICY coordinator_read_persons ON persons
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      is_elevated_admin()
      OR (
        hospital_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM coordinator_profiles cp
          WHERE cp.auth_user_id = auth.uid()
            AND cp.onboarding_complete = true
            AND cp.site_type = 'hospital'
            AND cp.site_id = persons.hospital_id
        )
      )
      OR (
        shelter_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM coordinator_profiles cp
          WHERE cp.auth_user_id = auth.uid()
            AND cp.onboarding_complete = true
            AND cp.site_type = 'shelter'
            AND cp.site_id = persons.shelter_id
        )
      )
    )
  );
