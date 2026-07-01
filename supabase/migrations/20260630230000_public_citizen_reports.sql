-- FARO: reportes ciudadanos (anon) sobre centros registrados.
-- Corrige: "new row violates row-level security policy for table reports"
-- Idempotente: seguro de re-ejecutar.

-- INSERT: ciudadanos envían reportes pendientes ligados a un sitio registrado.
DROP POLICY IF EXISTS anon_insert_reports ON reports;
CREATE POLICY anon_insert_reports
  ON reports FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pending'
    AND site_type IS NOT NULL
    AND site_id IS NOT NULL
    AND site_type IN ('hospital', 'shelter', 'supply_center')
  );

-- SELECT: necesario para listar reportes en la app y para INSERT ... RETURNING (PostgREST).
DROP POLICY IF EXISTS public_read_reports ON reports;
CREATE POLICY public_read_reports
  ON reports FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT INSERT, SELECT ON reports TO anon;
GRANT INSERT, SELECT, UPDATE ON reports TO authenticated;

-- Revisión de reportes pendientes (panel coordinador sin login).
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
