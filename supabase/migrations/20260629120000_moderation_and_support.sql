-- Moderación de coordinador/admin + módulo de apoyo emocional.
-- Idempotente: seguro de re-ejecutar.

-- ============================================================
-- 1. Gate de administrador (allowlist por correo, pre-sembrable)
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_emails (
  email TEXT PRIMARY KEY,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_emails ENABLE ROW LEVEL SECURITY;
-- Sin políticas públicas: solo funciones SECURITY DEFINER y el service role lo leen.

-- is_admin(): true si el correo del JWT actual está en la allowlist.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_emails
    WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

GRANT EXECUTE ON FUNCTION is_admin() TO anon, authenticated;

-- Admin inicial (bootstrap). Cambia/añade correos aquí o en la tabla.
INSERT INTO admin_emails (email, note)
VALUES ('nex.gen0211@gmail.com', 'Admin inicial (bootstrap)')
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- 2. Moderación de reports (cola ciudadana existente)
-- ============================================================
-- Hoy reports solo permite INSERT anónimo y no tiene SELECT/UPDATE.
-- Damos a los admins lectura y revisión.

DROP POLICY IF EXISTS admin_read_reports ON reports;
CREATE POLICY admin_read_reports
  ON reports FOR SELECT
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS admin_update_reports ON reports;
CREATE POLICY admin_update_reports
  ON reports FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

GRANT SELECT, UPDATE ON reports TO authenticated;

-- ============================================================
-- 3. Moderación de updates (auditoría de cambios)
-- ============================================================
-- updates no tenía RLS habilitada (estaba abierta). La cerramos.

ALTER TABLE updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_read_updates ON updates;
CREATE POLICY admin_read_updates
  ON updates FOR SELECT
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS admin_update_updates ON updates;
CREATE POLICY admin_update_updates
  ON updates FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

GRANT SELECT, UPDATE ON updates TO authenticated;

-- ============================================================
-- 4. Apoyo emocional: tipos
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_resource_kind') THEN
    CREATE TYPE support_resource_kind AS ENUM ('crisis_line', 'volunteer_psych', 'support_group', 'child_activity');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_request_status') THEN
    CREATE TYPE support_request_status AS ENUM ('pending', 'assigned', 'contacted', 'closed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_contact_method') THEN
    CREATE TYPE support_contact_method AS ENUM ('whatsapp', 'phone', 'none');
  END IF;
END
$$;

-- ============================================================
-- 5. support_resources: directorio público de apoyo
-- ============================================================

CREATE TABLE IF NOT EXISTS support_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind support_resource_kind NOT NULL DEFAULT 'volunteer_psych',
  name VARCHAR(255) NOT NULL,
  description TEXT,
  modality TEXT[] NOT NULL DEFAULT '{}',      -- {phone, whatsapp, video, in_person}
  contact VARCHAR(255),                        -- teléfono / WhatsApp / URL
  specialties TEXT[] NOT NULL DEFAULT '{}',    -- duelo, ansiedad, niños, trauma...
  languages TEXT[] NOT NULL DEFAULT '{}',
  availability TEXT,                           -- "24/7", "L-V 8am-6pm"
  is_emergency BOOLEAN NOT NULL DEFAULT false, -- líneas de crisis se fijan arriba
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_resources_kind ON support_resources(kind);
CREATE INDEX IF NOT EXISTS idx_support_resources_active ON support_resources(is_active);

ALTER TABLE support_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read_support_resources ON support_resources;
CREATE POLICY public_read_support_resources
  ON support_resources FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS admin_write_support_resources ON support_resources;
CREATE POLICY admin_write_support_resources
  ON support_resources FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

GRANT SELECT ON support_resources TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON support_resources TO authenticated;

DROP TRIGGER IF EXISTS trg_support_resources_updated_at ON support_resources;
CREATE TRIGGER trg_support_resources_updated_at
  BEFORE UPDATE ON support_resources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 6. support_requests: cola confidencial de acompañamiento
-- ============================================================

CREATE TABLE IF NOT EXISTS support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  for_whom TEXT NOT NULL DEFAULT 'self' CHECK (for_whom IN ('self', 'child', 'family', 'other')),
  topic TEXT,                                  -- duelo, ansiedad, pánico, no sé...
  description TEXT,
  contact_method support_contact_method NOT NULL DEFAULT 'whatsapp',
  contact_value VARCHAR(255),                  -- null si contact_method = 'none'
  urgent BOOLEAN NOT NULL DEFAULT false,
  consent BOOLEAN NOT NULL DEFAULT false,
  status support_request_status NOT NULL DEFAULT 'pending',
  assigned_to VARCHAR(255),
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_requests_status ON support_requests(status);

ALTER TABLE support_requests ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede pedir ayuda, pero SOLO con consentimiento marcado.
DROP POLICY IF EXISTS anon_insert_support_requests ON support_requests;
CREATE POLICY anon_insert_support_requests
  ON support_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (consent = true);

-- Confidencial: nadie del público puede leerlas; solo admins.
DROP POLICY IF EXISTS admin_read_support_requests ON support_requests;
CREATE POLICY admin_read_support_requests
  ON support_requests FOR SELECT
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS admin_update_support_requests ON support_requests;
CREATE POLICY admin_update_support_requests
  ON support_requests FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

GRANT INSERT ON support_requests TO anon, authenticated;
GRANT SELECT, UPDATE ON support_requests TO authenticated;

-- ============================================================
-- 7. Semillas de directorio (líneas y recursos de ejemplo)
-- ============================================================

INSERT INTO support_resources (kind, name, description, modality, contact, specialties, availability, is_emergency)
SELECT 'crisis_line', 'Línea de Emergencias 911', 'Para riesgo inmediato a la vida (propia o de otra persona).', ARRAY['phone'], '911', ARRAY['crisis'], '24/7', true
WHERE NOT EXISTS (SELECT 1 FROM support_resources WHERE name = 'Línea de Emergencias 911');

INSERT INTO support_resources (kind, name, description, modality, contact, specialties, availability, is_emergency)
SELECT 'volunteer_psych', 'Red de Psicólogos Voluntarios', 'Acompañamiento emocional gratuito por psicólogos voluntarios.', ARRAY['whatsapp','video'], NULL, ARRAY['ansiedad','duelo','trauma'], 'L-D 8am-8pm', false
WHERE NOT EXISTS (SELECT 1 FROM support_resources WHERE name = 'Red de Psicólogos Voluntarios');

INSERT INTO support_resources (kind, name, description, modality, specialties, availability, is_emergency)
SELECT 'support_group', 'Grupo de apoyo para familias', 'Encuentros grupales para compartir y sostenerse entre afectados.', ARRAY['in_person'], ARRAY['duelo','familia'], 'Sáb 4pm', false
WHERE NOT EXISTS (SELECT 1 FROM support_resources WHERE name = 'Grupo de apoyo para familias');

INSERT INTO support_resources (kind, name, description, modality, specialties, availability, is_emergency)
SELECT 'child_activity', 'Espacio recreativo para niños', 'Juegos y actividades para niñas y niños en refugios; da respiro a las familias.', ARRAY['in_person'], ARRAY['niños','recreación'], 'Diario 10am-4pm', false
WHERE NOT EXISTS (SELECT 1 FROM support_resources WHERE name = 'Espacio recreativo para niños');
