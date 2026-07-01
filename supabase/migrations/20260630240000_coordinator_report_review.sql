-- FARO: coordinador puede aprobar/rechazar reportes pendientes (consola sin auth JWT).
-- Corrige: "Cannot coerce the result to a single JSON object" al hacer UPDATE ... RETURNING
-- cuando RLS bloqueaba el UPDATE (0 filas afectadas).
-- Idempotente.

DROP POLICY IF EXISTS public_review_pending_reports ON reports;
CREATE POLICY public_review_pending_reports
  ON reports FOR UPDATE
  TO anon, authenticated
  USING (
    status IN ('pending', 'under_review')
    AND site_id IS NOT NULL
    AND site_type IS NOT NULL
  )
  WITH CHECK (
    status IN ('verified', 'dismissed', 'under_review', 'pending')
    AND site_id IS NOT NULL
  );

GRANT UPDATE ON reports TO anon;
GRANT UPDATE ON reports TO authenticated;
