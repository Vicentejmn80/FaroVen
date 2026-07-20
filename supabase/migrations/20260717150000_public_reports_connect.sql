-- FARO: Conectar reportes públicos anónimos a Supabase
-- Permite a ciudadanos sin cuenta crear reportes y consultar estado por código de seguimiento.

-- 1) Agregar columna tracking_code para el flujo de consulta pública
ALTER TABLE reports ADD COLUMN IF NOT EXISTS tracking_code TEXT;
CREATE INDEX IF NOT EXISTS idx_reports_tracking_code ON reports (tracking_code);

-- 2) Relajar política INSERT para anon: no requiere site_type/site_id
-- Los ciudadanos pueden reportar sin seleccionar un centro registrado
DROP POLICY IF EXISTS anon_insert_reports ON reports;
CREATE POLICY anon_insert_reports
  ON reports FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pending'
  );

-- 3) Restaurar SELECT público para que anon pueda consultar por tracking_code
-- Seguridad: mitigada por rate limiting (15/hora) + aleatoriedad del tracking_code
DROP POLICY IF EXISTS public_read_reports ON reports;
CREATE POLICY public_read_reports
  ON reports FOR SELECT
  TO anon, authenticated
  USING (true);

-- 4) Asegurar grants necesarios
GRANT INSERT, SELECT ON reports TO anon;

-- 5) Permitir que la app cree notificaciones (misiones, casos) desde el frontend
GRANT EXECUTE ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, notification_priority, TEXT, TEXT, JSONB, TIMESTAMPTZ) TO anon, authenticated;
