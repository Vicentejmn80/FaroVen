-- Coordinadores de hospital/refugio pueden registrar personas en su sitio.

GRANT INSERT, UPDATE ON persons TO authenticated;

-- ============================================================
-- 1. INSERT: solo en el sitio del coordinador (hospital o refugio)
-- ============================================================

DROP POLICY IF EXISTS coordinator_insert_hospital_persons ON persons;
CREATE POLICY coordinator_insert_hospital_persons ON persons
  FOR INSERT TO authenticated
  WITH CHECK (
    hospital_id IS NOT NULL
    AND shelter_id IS NULL
    AND EXISTS (
      SELECT 1 FROM coordinator_profiles cp
      WHERE cp.auth_user_id = auth.uid()
        AND cp.onboarding_complete = true
        AND cp.site_type = 'hospital'
        AND cp.site_id = persons.hospital_id
    )
  );

DROP POLICY IF EXISTS coordinator_insert_shelter_persons ON persons;
CREATE POLICY coordinator_insert_shelter_persons ON persons
  FOR INSERT TO authenticated
  WITH CHECK (
    shelter_id IS NOT NULL
    AND hospital_id IS NULL
    AND EXISTS (
      SELECT 1 FROM coordinator_profiles cp
      WHERE cp.auth_user_id = auth.uid()
        AND cp.onboarding_complete = true
        AND cp.site_type = 'shelter'
        AND cp.site_id = persons.shelter_id
    )
  );

-- ============================================================
-- 2. UPDATE: solo filas del sitio del coordinador
-- ============================================================

DROP POLICY IF EXISTS coordinator_update_hospital_persons ON persons;
CREATE POLICY coordinator_update_hospital_persons ON persons
  FOR UPDATE TO authenticated
  USING (
    hospital_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM coordinator_profiles cp
      WHERE cp.auth_user_id = auth.uid()
        AND cp.onboarding_complete = true
        AND cp.site_type = 'hospital'
        AND cp.site_id = persons.hospital_id
    )
  )
  WITH CHECK (
    hospital_id IS NOT NULL
    AND shelter_id IS NULL
    AND EXISTS (
      SELECT 1 FROM coordinator_profiles cp
      WHERE cp.auth_user_id = auth.uid()
        AND cp.onboarding_complete = true
        AND cp.site_type = 'hospital'
        AND cp.site_id = persons.hospital_id
    )
  );

DROP POLICY IF EXISTS coordinator_update_shelter_persons ON persons;
CREATE POLICY coordinator_update_shelter_persons ON persons
  FOR UPDATE TO authenticated
  USING (
    shelter_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM coordinator_profiles cp
      WHERE cp.auth_user_id = auth.uid()
        AND cp.onboarding_complete = true
        AND cp.site_type = 'shelter'
        AND cp.site_id = persons.shelter_id
    )
  )
  WITH CHECK (
    shelter_id IS NOT NULL
    AND hospital_id IS NULL
    AND EXISTS (
      SELECT 1 FROM coordinator_profiles cp
      WHERE cp.auth_user_id = auth.uid()
        AND cp.onboarding_complete = true
        AND cp.site_type = 'shelter'
        AND cp.site_id = persons.shelter_id
    )
  );

-- ============================================================
-- 3. Storage: fotos de listas (evidencia)
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'person-lists',
  'person-lists',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS coordinator_select_person_lists ON storage.objects;
CREATE POLICY coordinator_select_person_lists ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'person-lists'
    AND EXISTS (
      SELECT 1 FROM coordinator_profiles cp
      WHERE cp.auth_user_id = auth.uid()
        AND cp.onboarding_complete = true
        AND cp.site_type IN ('hospital', 'shelter')
    )
  );

DROP POLICY IF EXISTS coordinator_insert_person_lists ON storage.objects;
CREATE POLICY coordinator_insert_person_lists ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'person-lists'
    AND EXISTS (
      SELECT 1 FROM coordinator_profiles cp
      WHERE cp.auth_user_id = auth.uid()
        AND cp.onboarding_complete = true
        AND cp.site_type IN ('hospital', 'shelter')
    )
  );

DROP POLICY IF EXISTS coordinator_update_person_lists ON storage.objects;
CREATE POLICY coordinator_update_person_lists ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'person-lists'
    AND EXISTS (
      SELECT 1 FROM coordinator_profiles cp
      WHERE cp.auth_user_id = auth.uid()
        AND cp.onboarding_complete = true
        AND cp.site_type IN ('hospital', 'shelter')
    )
  )
  WITH CHECK (
    bucket_id = 'person-lists'
    AND EXISTS (
      SELECT 1 FROM coordinator_profiles cp
      WHERE cp.auth_user_id = auth.uid()
        AND cp.onboarding_complete = true
        AND cp.site_type IN ('hospital', 'shelter')
    )
  );
