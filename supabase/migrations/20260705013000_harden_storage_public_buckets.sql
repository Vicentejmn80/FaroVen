-- FARO — High Severity Remediation A-07
-- Lock down public storage buckets for reports and person lists.

-- ============================================================
-- A-07: Make buckets private and restrict read access
-- ============================================================
UPDATE storage.buckets
SET public = false
WHERE id IN ('reports-images', 'person-lists');

-- Remove public read on reports-images
DROP POLICY IF EXISTS public_read_reports_images ON storage.objects;

-- Allow authenticated owners to read their own report images
DROP POLICY IF EXISTS authenticated_select_reports_images ON storage.objects;
CREATE POLICY authenticated_select_reports_images ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'reports-images'
    AND owner_id = auth.uid()::text
  );
