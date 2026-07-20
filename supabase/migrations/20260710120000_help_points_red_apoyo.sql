-- FARO Red de Apoyo — Fase 1: Puntos de Ayuda
-- Tabla y flujo de aprobación independiente de hospitales/refugios/acopios.

-- ============================================================
-- 1. Tipos
-- ============================================================
DO $$ BEGIN
  CREATE TYPE help_point_org_type AS ENUM (
    'church', 'ngo', 'community', 'refuge', 'medical_center', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE help_point_status AS ENUM (
    'pending_approval',
    'changes_requested',
    'approved',
    'rejected',
    'active',
    'inactive'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. Tabla help_points
-- ============================================================
CREATE TABLE IF NOT EXISTS help_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  state_region TEXT NOT NULL,
  municipality TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  image_url TEXT,
  organization_type help_point_org_type NOT NULL,
  people_served_estimate INT NOT NULL DEFAULT 0 CHECK (people_served_estimate >= 0 AND people_served_estimate <= 1000000),
  population_types TEXT[] NOT NULL DEFAULT '{}',
  status help_point_status NOT NULL DEFAULT 'pending_approval',
  review_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  changes_requested_message TEXT,
  changes_requested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_help_points_status ON help_points(status);
CREATE INDEX IF NOT EXISTS idx_help_points_created_by ON help_points(created_by);
CREATE INDEX IF NOT EXISTS idx_help_points_active ON help_points(status) WHERE status = 'active';

ALTER TABLE help_points ENABLE ROW LEVEL SECURITY;

-- Lectura pública solo de puntos activos (futuro mapa/directorio).
DROP POLICY IF EXISTS public_read_active_help_points ON help_points;
CREATE POLICY public_read_active_help_points
  ON help_points FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

-- Creador ve sus propias solicitudes.
DROP POLICY IF EXISTS help_points_select_own ON help_points;
CREATE POLICY help_points_select_own
  ON help_points FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- Admin ve todas.
DROP POLICY IF EXISTS help_points_admin_select ON help_points;
CREATE POLICY help_points_admin_select
  ON help_points FOR SELECT
  TO authenticated
  USING (is_elevated_admin());

-- Sin INSERT/UPDATE directo: solo RPCs SECURITY DEFINER.
GRANT SELECT ON help_points TO anon, authenticated;

DROP TRIGGER IF EXISTS trg_help_points_updated_at ON help_points;
CREATE TRIGGER trg_help_points_updated_at
  BEFORE UPDATE ON help_points
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 3. Validación de población atendida
-- ============================================================
CREATE OR REPLACE FUNCTION validate_help_point_populations(p_types TEXT[])
RETURNS VOID
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_allowed TEXT[] := ARRAY['children', 'elderly', 'disabled', 'bedridden', 'families'];
  v_type TEXT;
BEGIN
  IF p_types IS NULL OR array_length(p_types, 1) IS NULL THEN
    RAISE EXCEPTION 'population_types_required';
  END IF;

  FOREACH v_type IN ARRAY p_types LOOP
    IF NOT (v_type = ANY (v_allowed)) THEN
      RAISE EXCEPTION 'invalid_population_type';
    END IF;
  END LOOP;
END;
$$;

-- ============================================================
-- 4. Extender referencias de sitio (sin tocar tablas legacy)
-- ============================================================
CREATE OR REPLACE FUNCTION assert_valid_site_reference(p_site_type TEXT, p_site_id UUID)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_exists BOOLEAN := false;
BEGIN
  IF p_site_type NOT IN ('hospital', 'shelter', 'supply_center', 'help_point') THEN
    RAISE EXCEPTION 'invalid_site_type';
  END IF;

  IF p_site_id IS NULL THEN
    RAISE EXCEPTION 'site_id_required';
  END IF;

  IF p_site_type = 'hospital' THEN
    SELECT EXISTS(SELECT 1 FROM hospitals h WHERE h.id = p_site_id) INTO v_exists;
  ELSIF p_site_type = 'shelter' THEN
    SELECT EXISTS(SELECT 1 FROM shelters s WHERE s.id = p_site_id) INTO v_exists;
  ELSIF p_site_type = 'supply_center' THEN
    SELECT EXISTS(SELECT 1 FROM supply_centers c WHERE c.id = p_site_id) INTO v_exists;
  ELSE
    SELECT EXISTS(
      SELECT 1 FROM help_points hp
      WHERE hp.id = p_site_id AND hp.status IN ('active', 'approved')
    ) INTO v_exists;
  END IF;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'site_not_found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION coordinator_request_center_name(p_site_type TEXT, p_site_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
BEGIN
  IF p_site_type = 'hospital' THEN
    SELECT name INTO v_name FROM hospitals WHERE id = p_site_id;
  ELSIF p_site_type = 'shelter' THEN
    SELECT name INTO v_name FROM shelters WHERE id = p_site_id;
  ELSIF p_site_type = 'supply_center' THEN
    SELECT name INTO v_name FROM supply_centers WHERE id = p_site_id;
  ELSIF p_site_type = 'help_point' THEN
    SELECT name INTO v_name FROM help_points WHERE id = p_site_id;
  END IF;
  RETURN coalesce(v_name, 'Centro sin nombre');
END;
$$;

ALTER TABLE coordinator_profiles DROP CONSTRAINT IF EXISTS coordinator_profiles_site_type_check;
ALTER TABLE coordinator_profiles ADD CONSTRAINT coordinator_profiles_site_type_check
  CHECK (site_type IN ('hospital', 'supply_center', 'shelter', 'help_point'));

-- ============================================================
-- 5. Storage para imágenes
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'help-point-images',
  'help-point-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS public_read_help_point_images ON storage.objects;
CREATE POLICY public_read_help_point_images ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'help-point-images');

DROP POLICY IF EXISTS authenticated_insert_help_point_images ON storage.objects;
CREATE POLICY authenticated_insert_help_point_images ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'help-point-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- 6. RPC: crear Punto de Ayuda
-- ============================================================
CREATE OR REPLACE FUNCTION submit_help_point(
  p_name TEXT,
  p_description TEXT,
  p_state_region TEXT,
  p_municipality TEXT,
  p_address TEXT,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_image_url TEXT,
  p_organization_type help_point_org_type,
  p_people_served_estimate INT,
  p_population_types TEXT[]
)
RETURNS help_points
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row help_points%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  PERFORM enforce_rate_limit('help_point_submit', 3, 3600);

  PERFORM assert_text_bounds(p_name, 'name', 2, 255, true);
  PERFORM assert_text_bounds(p_description, 'description', 0, 2000, false);
  PERFORM assert_text_bounds(p_state_region, 'state_region', 2, 120, true);
  PERFORM assert_text_bounds(p_municipality, 'municipality', 2, 120, true);
  PERFORM assert_text_bounds(p_address, 'address', 5, 500, true);

  IF p_people_served_estimate < 0 OR p_people_served_estimate > 1000000 THEN
    RAISE EXCEPTION 'invalid_people_served_estimate';
  END IF;

  PERFORM validate_help_point_populations(p_population_types);

  IF EXISTS (
    SELECT 1 FROM help_points
    WHERE created_by = auth.uid()
      AND status IN ('pending_approval', 'changes_requested')
  ) THEN
    RAISE EXCEPTION 'help_point_pending_exists';
  END IF;

  INSERT INTO help_points (
    created_by,
    name,
    description,
    state_region,
    municipality,
    address,
    latitude,
    longitude,
    image_url,
    organization_type,
    people_served_estimate,
    population_types,
    status
  ) VALUES (
    auth.uid(),
    trim(p_name),
    nullif(trim(p_description), ''),
    trim(p_state_region),
    trim(p_municipality),
    trim(p_address),
    p_latitude,
    p_longitude,
    nullif(trim(p_image_url), ''),
    p_organization_type,
    coalesce(p_people_served_estimate, 0),
    p_population_types,
    'pending_approval'
  )
  RETURNING * INTO v_row;

  PERFORM notify_elevated_admins(
    'help_point_submitted',
    'Nuevo Punto de Ayuda',
    v_row.name || ' solicita unirse a la Red de Apoyo.',
    'high',
    'user-plus',
    'tab:admin:help-point:' || v_row.id::text,
    jsonb_build_object(
      'help_point_id', v_row.id,
      'name', v_row.name,
      'organization_type', v_row.organization_type::text
    ),
    false
  );

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_help_point(
  TEXT, TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT,
  help_point_org_type, INT, TEXT[]
) TO authenticated;

-- ============================================================
-- 7. RPC: actualizar tras solicitud de cambios
-- ============================================================
CREATE OR REPLACE FUNCTION update_help_point_application(
  p_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_state_region TEXT,
  p_municipality TEXT,
  p_address TEXT,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_image_url TEXT,
  p_organization_type help_point_org_type,
  p_people_served_estimate INT,
  p_population_types TEXT[]
)
RETURNS help_points
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row help_points%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  PERFORM enforce_rate_limit('help_point_update', 10, 3600);

  SELECT * INTO v_row FROM help_points WHERE id = p_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'help_point_not_found';
  END IF;

  IF v_row.created_by <> auth.uid() AND NOT is_elevated_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF v_row.status NOT IN ('changes_requested', 'pending_approval') THEN
    RAISE EXCEPTION 'help_point_not_editable';
  END IF;

  PERFORM assert_text_bounds(p_name, 'name', 2, 255, true);
  PERFORM validate_help_point_populations(p_population_types);

  UPDATE help_points
  SET
    name = trim(p_name),
    description = nullif(trim(p_description), ''),
    state_region = trim(p_state_region),
    municipality = trim(p_municipality),
    address = trim(p_address),
    latitude = p_latitude,
    longitude = p_longitude,
    image_url = nullif(trim(p_image_url), ''),
    organization_type = p_organization_type,
    people_served_estimate = coalesce(p_people_served_estimate, 0),
    population_types = p_population_types,
    status = 'pending_approval',
    changes_requested_message = NULL,
    changes_requested_at = NULL,
    updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION update_help_point_application(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT,
  help_point_org_type, INT, TEXT[]
) TO authenticated;

-- ============================================================
-- 8. RPC: aprobar → coordinador del punto
-- ============================================================
CREATE OR REPLACE FUNCTION approve_help_point(
  p_id UUID,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS help_points
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row help_points%ROWTYPE;
  v_user_id UUID;
  v_email TEXT;
  v_full_name TEXT;
BEGIN
  IF NOT is_elevated_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO v_row FROM help_points WHERE id = p_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'help_point_not_found';
  END IF;

  IF v_row.status NOT IN ('pending_approval', 'changes_requested') THEN
    RAISE EXCEPTION 'help_point_not_pending';
  END IF;

  v_user_id := v_row.created_by;

  SELECT email, full_name INTO v_email, v_full_name
  FROM profiles WHERE id = v_user_id;

  UPDATE help_points
  SET
    status = 'active',
    review_notes = nullif(trim(p_review_notes), ''),
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_row;

  INSERT INTO profiles (id, email, full_name, role, status)
  VALUES (v_user_id, coalesce(v_email, ''), coalesce(v_full_name, ''), 'coordinator', 'active')
  ON CONFLICT (id) DO UPDATE
    SET role = CASE
          WHEN profiles.role IN ('regional_admin', 'super_admin') THEN profiles.role
          ELSE 'coordinator'
        END,
        status = 'active',
        updated_at = now();

  INSERT INTO coordinator_profiles (
    auth_user_id,
    site_type,
    site_id,
    full_name,
    onboarding_complete,
    updated_at
  )
  VALUES (
    v_user_id,
    'help_point',
    v_row.id,
    coalesce(v_full_name, v_row.name),
    true,
    now()
  )
  ON CONFLICT (auth_user_id) DO UPDATE
    SET site_type = 'help_point',
        site_id = v_row.id,
        full_name = EXCLUDED.full_name,
        onboarding_complete = true,
        updated_at = now();

  PERFORM log_auth_event(
    'help_point_approved',
    v_user_id,
    jsonb_build_object('help_point_id', p_id, 'name', v_row.name)
  );

  PERFORM create_notification(
    v_user_id,
    'Punto de Ayuda aprobado',
    'Tu punto "' || v_row.name || '" fue aprobado. Ya eres coordinador.',
    'help_point_approved',
    'high',
    NULL,
    'tab:ops',
    jsonb_build_object('help_point_id', v_row.id),
    NULL
  );

  INSERT INTO events (kind, title, detail, status, center_type, center_id)
  VALUES (
    'help_point_approved',
    'Punto de Ayuda aprobado',
    v_row.name,
    'operational',
    'help_point',
    v_row.id
  );

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION approve_help_point(UUID, TEXT) TO authenticated;

-- ============================================================
-- 9. RPC: rechazar
-- ============================================================
CREATE OR REPLACE FUNCTION reject_help_point(
  p_id UUID,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS help_points
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row help_points%ROWTYPE;
BEGIN
  IF NOT is_elevated_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE help_points
  SET
    status = 'rejected',
    review_notes = nullif(trim(p_review_notes), ''),
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  WHERE id = p_id
    AND status IN ('pending_approval', 'changes_requested')
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'help_point_not_found';
  END IF;

  PERFORM create_notification(
    v_row.created_by,
    'Punto de Ayuda rechazado',
    coalesce(nullif(trim(p_review_notes), ''), 'Tu solicitud no fue aprobada.'),
    'help_point_rejected',
    'high',
    NULL,
    'tab:profile',
    jsonb_build_object('help_point_id', v_row.id),
    NULL
  );

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION reject_help_point(UUID, TEXT) TO authenticated;

-- ============================================================
-- 10. RPC: solicitar cambios
-- ============================================================
CREATE OR REPLACE FUNCTION request_help_point_changes(
  p_id UUID,
  p_message TEXT
)
RETURNS help_points
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row help_points%ROWTYPE;
BEGIN
  IF NOT is_elevated_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF coalesce(trim(p_message), '') = '' THEN
    RAISE EXCEPTION 'message_required';
  END IF;

  UPDATE help_points
  SET
    status = 'changes_requested',
    changes_requested_message = trim(p_message),
    changes_requested_at = now(),
    updated_at = now()
  WHERE id = p_id
    AND status = 'pending_approval'
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'help_point_not_found';
  END IF;

  PERFORM create_notification(
    v_row.created_by,
    'Cambios solicitados',
    trim(p_message),
    'help_point_changes_requested',
    'high',
    NULL,
    'flow:help-point:' || v_row.id::text,
    jsonb_build_object('help_point_id', v_row.id),
    NULL
  );

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION request_help_point_changes(UUID, TEXT) TO authenticated;

-- ============================================================
-- 11. Listados
-- ============================================================
CREATE OR REPLACE FUNCTION list_pending_help_points()
RETURNS SETOF help_points
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_elevated_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  SELECT *
  FROM help_points
  WHERE status IN ('pending_approval', 'changes_requested')
  ORDER BY created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION list_pending_help_points() TO authenticated;

CREATE OR REPLACE FUNCTION list_my_help_points()
RETURNS SETOF help_points
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  SELECT *
  FROM help_points
  WHERE created_by = auth.uid()
  ORDER BY created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION list_my_help_points() TO authenticated;
