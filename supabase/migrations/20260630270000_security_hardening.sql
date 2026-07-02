-- FARO Preproduccion - Security Hardening
-- Objetivo: cerrar escrituras inseguras, validar datos en DB y limitar abuso.
-- Idempotente.

-- ============================================================
-- 1) Tablas y helpers de seguridad
-- ============================================================

CREATE TABLE IF NOT EXISTS security_rate_limits (
  action TEXT NOT NULL,
  actor_key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (action, actor_key, window_start)
);

ALTER TABLE security_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS security_rate_limits_no_access ON security_rate_limits;
CREATE POLICY security_rate_limits_no_access ON security_rate_limits
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION security_client_ip()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_headers JSONB;
  v_ip TEXT;
BEGIN
  BEGIN
    v_headers := current_setting('request.headers', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_headers := '{}'::jsonb;
  END;

  v_ip := nullif(trim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), '');
  IF v_ip IS NULL THEN
    v_ip := nullif(trim(coalesce(v_headers ->> 'x-real-ip', '')), '');
  END IF;
  IF v_ip IS NULL THEN
    v_ip := 'unknown';
  END IF;

  RETURN v_ip;
END;
$$;

CREATE OR REPLACE FUNCTION security_actor_key()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(auth.uid()::text, security_client_ip());
$$;

CREATE OR REPLACE FUNCTION enforce_rate_limit(
  p_action TEXT,
  p_max_hits INTEGER,
  p_window_seconds INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_key TEXT;
  v_bucket TIMESTAMPTZ;
  v_hits INTEGER;
BEGIN
  IF p_action IS NULL OR p_action = '' OR p_max_hits <= 0 OR p_window_seconds <= 0 THEN
    RAISE EXCEPTION 'invalid_rate_limit_config';
  END IF;

  v_actor_key := security_actor_key();
  v_bucket := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);

  INSERT INTO security_rate_limits (action, actor_key, window_start, hits)
  VALUES (p_action, v_actor_key, v_bucket, 1)
  ON CONFLICT (action, actor_key, window_start)
  DO UPDATE SET hits = security_rate_limits.hits + 1
  RETURNING hits INTO v_hits;

  IF v_hits > p_max_hits THEN
    RAISE EXCEPTION 'rate_limit_exceeded';
  END IF;

  -- Limpieza oportunista para no crecer sin control.
  IF random() < 0.02 THEN
    DELETE FROM security_rate_limits
    WHERE window_start < now() - interval '3 days';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION security_client_ip() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION security_actor_key() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION enforce_rate_limit(TEXT, INTEGER, INTEGER) TO anon, authenticated;

-- ============================================================
-- 2) Validaciones backend (no confiar en frontend)
-- ============================================================

CREATE OR REPLACE FUNCTION validate_email_strict(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(p_email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$', false);
$$;

CREATE OR REPLACE FUNCTION validate_uuid_text(p_value TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  PERFORM p_value::uuid;
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION assert_text_bounds(
  p_value TEXT,
  p_field TEXT,
  p_min INTEGER,
  p_max INTEGER,
  p_required BOOLEAN DEFAULT true
)
RETURNS VOID
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_len INTEGER;
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN
    IF p_required THEN
      RAISE EXCEPTION '%_required', p_field;
    END IF;
    RETURN;
  END IF;

  v_len := char_length(btrim(p_value));
  IF v_len < p_min OR v_len > p_max THEN
    RAISE EXCEPTION '%_invalid_length', p_field;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION assert_valid_site_reference(p_site_type TEXT, p_site_id UUID)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_exists BOOLEAN := false;
BEGIN
  IF p_site_type NOT IN ('hospital', 'shelter', 'supply_center') THEN
    RAISE EXCEPTION 'invalid_site_type';
  END IF;

  IF p_site_id IS NULL THEN
    RAISE EXCEPTION 'site_id_required';
  END IF;

  IF p_site_type = 'hospital' THEN
    SELECT EXISTS(SELECT 1 FROM hospitals h WHERE h.id = p_site_id) INTO v_exists;
  ELSIF p_site_type = 'shelter' THEN
    SELECT EXISTS(SELECT 1 FROM shelters s WHERE s.id = p_site_id) INTO v_exists;
  ELSE
    SELECT EXISTS(SELECT 1 FROM supply_centers c WHERE c.id = p_site_id) INTO v_exists;
  END IF;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'site_not_found';
  END IF;
END;
$$;

-- ============================================================
-- 3) Endurecer RLS y grants públicos inseguros
-- ============================================================

-- Quitar políticas de escritura pública antiguas.
DROP POLICY IF EXISTS public_insert_hospitals ON hospitals;
DROP POLICY IF EXISTS public_insert_shelters ON shelters;
DROP POLICY IF EXISTS public_insert_supply_centers ON supply_centers;
DROP POLICY IF EXISTS public_insert_needs ON needs;
DROP POLICY IF EXISTS public_update_needs ON needs;
DROP POLICY IF EXISTS public_update_hospitals ON hospitals;
DROP POLICY IF EXISTS public_update_shelters ON shelters;
DROP POLICY IF EXISTS public_update_supply_centers ON supply_centers;
DROP POLICY IF EXISTS volunteer_insert_needs ON needs;
DROP POLICY IF EXISTS volunteer_update_needs ON needs;
DROP POLICY IF EXISTS coordinator_insert_shelters ON shelters;
DROP POLICY IF EXISTS public_review_pending_reports ON reports;

REVOKE INSERT, UPDATE ON hospitals FROM anon;
REVOKE INSERT, UPDATE ON shelters FROM anon;
REVOKE INSERT, UPDATE ON supply_centers FROM anon;
REVOKE INSERT, UPDATE ON needs FROM anon;
REVOKE UPDATE ON reports FROM anon;

-- Reportes públicos: solo lectura de verificados.
DROP POLICY IF EXISTS public_read_reports ON reports;
CREATE POLICY public_read_reports
  ON reports FOR SELECT
  TO anon, authenticated
  USING (status = 'verified');

-- ============================================================
-- 4) Validaciones + rate limit por tabla crítica
-- ============================================================

CREATE OR REPLACE FUNCTION validate_report_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM enforce_rate_limit('report_submit', 15, 3600);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM enforce_rate_limit('report_review', 300, 3600);
  END IF;

  PERFORM assert_text_bounds(NEW.description, 'report_description', 10, 3000, true);
  PERFORM assert_text_bounds(NEW.site_label, 'report_site_label', 0, 255, false);
  PERFORM assert_text_bounds(NEW.contact_info, 'report_contact_info', 0, 255, false);

  IF NEW.site_type IS NOT NULL OR NEW.site_id IS NOT NULL THEN
    PERFORM assert_valid_site_reference(NEW.site_type, NEW.site_id);
  END IF;

  IF NEW.latitude IS NOT NULL AND (NEW.latitude < -90 OR NEW.latitude > 90) THEN
    RAISE EXCEPTION 'invalid_latitude';
  END IF;
  IF NEW.longitude IS NOT NULL AND (NEW.longitude < -180 OR NEW.longitude > 180) THEN
    RAISE EXCEPTION 'invalid_longitude';
  END IF;

  IF TG_OP = 'INSERT' AND NEW.status <> 'pending' THEN
    RAISE EXCEPTION 'invalid_report_status';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_report_write ON reports;
CREATE TRIGGER trg_validate_report_write
  BEFORE INSERT OR UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION validate_report_write();

CREATE OR REPLACE FUNCTION validate_coordinator_request_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_from_jwt TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM enforce_rate_limit('coordinator_request_submit', 5, 86400);
  END IF;

  PERFORM assert_text_bounds(NEW.full_name, 'full_name', 3, 255, true);
  PERFORM assert_text_bounds(NEW.role_title, 'role_title', 2, 255, false);
  PERFORM assert_text_bounds(NEW.organization, 'organization', 2, 255, false);
  PERFORM assert_text_bounds(NEW.reason, 'reason', 10, 4000, false);
  PERFORM assert_text_bounds(NEW.phone, 'phone', 7, 30, false);

  IF NOT validate_email_strict(NEW.email) THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;

  IF NEW.requested_site_type IS NOT NULL OR NEW.requested_site_id IS NOT NULL THEN
    PERFORM assert_valid_site_reference(NEW.requested_site_type, NEW.requested_site_id);
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'pending' THEN
      RAISE EXCEPTION 'invalid_request_status';
    END IF;
    IF NEW.auth_user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'invalid_request_user';
    END IF;

    v_email_from_jwt := lower(coalesce(auth.jwt() ->> 'email', ''));
    IF v_email_from_jwt <> '' AND lower(NEW.email) <> v_email_from_jwt THEN
      RAISE EXCEPTION 'request_email_mismatch';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    PERFORM assert_text_bounds(NEW.review_notes, 'review_notes', 0, 1500, false);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_coordinator_request_write ON coordinator_requests;
CREATE TRIGGER trg_validate_coordinator_request_write
  BEFORE INSERT OR UPDATE ON coordinator_requests
  FOR EACH ROW
  EXECUTE FUNCTION validate_coordinator_request_write();

CREATE OR REPLACE FUNCTION validate_need_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM enforce_rate_limit('need_create', 120, 3600);
  ELSE
    PERFORM enforce_rate_limit('need_update', 600, 3600);
  END IF;

  PERFORM assert_text_bounds(NEW.item_name, 'item_name', 2, 255, true);
  PERFORM assert_text_bounds(NEW.unit, 'unit', 1, 50, true);
  PERFORM assert_text_bounds(NEW.notes, 'notes', 0, 1200, false);

  IF NEW.needable_type NOT IN ('hospital', 'shelter', 'supply_center') THEN
    RAISE EXCEPTION 'invalid_needable_type';
  END IF;

  IF NEW.qty_required < 0 OR NEW.qty_required > 1000000 THEN
    RAISE EXCEPTION 'invalid_qty_required';
  END IF;
  IF NEW.qty_received < 0 OR NEW.qty_received > 1000000 THEN
    RAISE EXCEPTION 'invalid_qty_received';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_need_write ON needs;
CREATE TRIGGER trg_validate_need_write
  BEFORE INSERT OR UPDATE ON needs
  FOR EACH ROW
  EXECUTE FUNCTION validate_need_write();

CREATE OR REPLACE FUNCTION validate_center_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    PERFORM enforce_rate_limit('center_update', 500, 3600);
  END IF;

  PERFORM assert_text_bounds(NEW.name, 'center_name', 2, 255, true);
  PERFORM assert_text_bounds(NEW.address, 'center_address', 0, 500, false);
  PERFORM assert_text_bounds(NEW.notes, 'center_notes', 0, 1200, false);

  IF NEW.latitude IS NOT NULL AND (NEW.latitude < -90 OR NEW.latitude > 90) THEN
    RAISE EXCEPTION 'invalid_latitude';
  END IF;
  IF NEW.longitude IS NOT NULL AND (NEW.longitude < -180 OR NEW.longitude > 180) THEN
    RAISE EXCEPTION 'invalid_longitude';
  END IF;
  IF NEW.capacity IS NOT NULL AND NEW.capacity < 0 THEN
    RAISE EXCEPTION 'invalid_capacity';
  END IF;
  IF NEW.current_occ IS NOT NULL AND NEW.current_occ < 0 THEN
    RAISE EXCEPTION 'invalid_current_occupancy';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_hospital_write ON hospitals;
CREATE TRIGGER trg_validate_hospital_write
  BEFORE INSERT OR UPDATE ON hospitals
  FOR EACH ROW
  EXECUTE FUNCTION validate_center_write();

DROP TRIGGER IF EXISTS trg_validate_shelter_write ON shelters;
CREATE TRIGGER trg_validate_shelter_write
  BEFORE INSERT OR UPDATE ON shelters
  FOR EACH ROW
  EXECUTE FUNCTION validate_center_write();

DROP TRIGGER IF EXISTS trg_validate_supply_center_write ON supply_centers;
CREATE TRIGGER trg_validate_supply_center_write
  BEFORE INSERT OR UPDATE ON supply_centers
  FOR EACH ROW
  EXECUTE FUNCTION validate_center_write();

-- ============================================================
-- 5) Storage hardening
-- ============================================================

-- reports-images: no escritura abierta, solo owner/carpeta propia.
DROP POLICY IF EXISTS authenticated_insert_reports_images ON storage.objects;
CREATE POLICY authenticated_insert_reports_images ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'reports-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND storage.extension(name) IN ('jpg', 'jpeg', 'png', 'webp')
  );

DROP POLICY IF EXISTS authenticated_update_reports_images ON storage.objects;
CREATE POLICY authenticated_update_reports_images ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'reports-images'
    AND owner_id = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'reports-images'
    AND owner_id = auth.uid()::text
  );

DROP POLICY IF EXISTS authenticated_delete_reports_images ON storage.objects;
CREATE POLICY authenticated_delete_reports_images ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'reports-images'
    AND owner_id = auth.uid()::text
  );

-- person-lists: restringir por owner para evitar lectura transversal.
DROP POLICY IF EXISTS coordinator_select_person_lists ON storage.objects;
CREATE POLICY coordinator_select_person_lists ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'person-lists'
    AND owner_id = auth.uid()::text
  );

DROP POLICY IF EXISTS coordinator_insert_person_lists ON storage.objects;
CREATE POLICY coordinator_insert_person_lists ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'person-lists'
    AND owner_id = auth.uid()::text
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND storage.extension(name) IN ('jpg', 'jpeg', 'png', 'webp', 'heic')
  );

DROP POLICY IF EXISTS coordinator_update_person_lists ON storage.objects;
CREATE POLICY coordinator_update_person_lists ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'person-lists'
    AND owner_id = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'person-lists'
    AND owner_id = auth.uid()::text
  );

DROP POLICY IF EXISTS coordinator_delete_person_lists ON storage.objects;
CREATE POLICY coordinator_delete_person_lists ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'person-lists'
    AND owner_id = auth.uid()::text
  );
