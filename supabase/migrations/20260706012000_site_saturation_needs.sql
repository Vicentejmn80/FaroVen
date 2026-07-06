-- FARO Fase 12 — Saturación por necesidades (seguridad + UX)

-- ============================================================
-- 1. Perfil regional (para admins regionales)
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS region TEXT;

-- ============================================================
-- 2. Tipo y tabla de saturación por necesidad
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'saturation_level') THEN
    CREATE TYPE saturation_level AS ENUM ('low', 'medium', 'high', 'critical');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS site_saturation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_type TEXT NOT NULL CHECK (site_type IN ('hospital', 'shelter', 'supply_center')),
  site_id UUID NOT NULL,
  need_key TEXT NOT NULL,
  need_label TEXT NOT NULL,
  level saturation_level NOT NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_type, site_id, need_key)
);

CREATE INDEX IF NOT EXISTS idx_site_saturation_site ON site_saturation(site_type, site_id);

ALTER TABLE site_saturation ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. Helpers de permisos
-- ============================================================
CREATE OR REPLACE FUNCTION regional_admin_region()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(region)
  FROM profiles
  WHERE id = auth.uid()
    AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION site_region_for(p_site_type TEXT, p_site_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_region TEXT;
BEGIN
  IF p_site_type = 'hospital' THEN
    SELECT coalesce(state, municipality) INTO v_region FROM hospitals WHERE id = p_site_id;
  ELSIF p_site_type = 'shelter' THEN
    SELECT coalesce(state, municipality) INTO v_region FROM shelters WHERE id = p_site_id;
  ELSIF p_site_type = 'supply_center' THEN
    SELECT coalesce(state, municipality) INTO v_region FROM supply_centers WHERE id = p_site_id;
  END IF;
  RETURN lower(v_region);
END;
$$;

CREATE OR REPLACE FUNCTION can_manage_site_saturation(p_site_type TEXT, p_site_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    is_super_admin()
    OR (
      is_regional_admin()
      AND regional_admin_region() IS NOT NULL
      AND regional_admin_region() = site_region_for(p_site_type, p_site_id)
    )
    OR EXISTS (
      SELECT 1
      FROM coordinator_profiles cp
      WHERE cp.auth_user_id = auth.uid()
        AND cp.site_type = p_site_type
        AND cp.site_id = p_site_id
        AND cp.onboarding_complete IS NOT FALSE
    );
$$;

-- ============================================================
-- 4. Políticas RLS
-- ============================================================
DROP POLICY IF EXISTS site_saturation_read_public ON site_saturation;
CREATE POLICY site_saturation_read_public ON site_saturation
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS site_saturation_write ON site_saturation;
CREATE POLICY site_saturation_write ON site_saturation
  FOR INSERT TO authenticated
  WITH CHECK (can_manage_site_saturation(site_type, site_id));

DROP POLICY IF EXISTS site_saturation_update ON site_saturation;
CREATE POLICY site_saturation_update ON site_saturation
  FOR UPDATE TO authenticated
  USING (can_manage_site_saturation(site_type, site_id))
  WITH CHECK (can_manage_site_saturation(site_type, site_id));

DROP POLICY IF EXISTS site_saturation_delete ON site_saturation;
CREATE POLICY site_saturation_delete ON site_saturation
  FOR DELETE TO authenticated
  USING (can_manage_site_saturation(site_type, site_id));

-- ============================================================
-- 5. Metadata y eventos
-- ============================================================
CREATE OR REPLACE FUNCTION touch_site_saturation()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_site_saturation_touch ON site_saturation;
CREATE TRIGGER trg_site_saturation_touch
BEFORE INSERT OR UPDATE ON site_saturation
FOR EACH ROW
EXECUTE FUNCTION touch_site_saturation();

CREATE OR REPLACE FUNCTION log_event_from_site_saturation()
RETURNS TRIGGER AS $$
DECLARE
  v_title TEXT;
  v_detail TEXT;
BEGIN
  v_title := 'Saturación actualizada';
  v_detail := NEW.need_label || ' → ' || NEW.level::TEXT;

  INSERT INTO events (kind, title, detail, status, center_type, center_id)
  VALUES (
    'saturation',
    v_title,
    v_detail,
    CASE
      WHEN NEW.level = 'critical' THEN 'critical'
      WHEN NEW.level = 'high' THEN 'warning'
      ELSE 'info'
    END,
    NEW.site_type,
    NEW.site_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_site_saturation_log_event ON site_saturation;
CREATE TRIGGER trg_site_saturation_log_event
AFTER INSERT OR UPDATE ON site_saturation
FOR EACH ROW
EXECUTE FUNCTION log_event_from_site_saturation();

-- ============================================================
-- 6. Realtime y permisos
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'site_saturation'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.site_saturation;
  END IF;
END $$;

GRANT SELECT ON site_saturation TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON site_saturation TO authenticated;

-- ============================================================
-- 7. Endurecer UPDATE público sobre sitios
-- ============================================================
DROP POLICY IF EXISTS public_update_hospitals ON hospitals;
DROP POLICY IF EXISTS public_update_shelters ON shelters;
DROP POLICY IF EXISTS public_update_supply_centers ON supply_centers;

REVOKE UPDATE ON hospitals, shelters, supply_centers FROM anon;
