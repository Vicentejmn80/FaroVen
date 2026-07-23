-- ÉPICA 10 hotfix — GPS reports, gestor notifications, delete_report fix
-- 1) Notificar a case_manager en TODOS los reportes pendientes (con o sin centro)
-- 2) Reparar delete_report (search_path vacío + GRANT faltante)
-- 3) Reparar get_volunteers_near_location (columnas lat/lng reales)

-- ============================================================
-- 1. Trigger: notificar gestores + coordinadores de sitio
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_citizen_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_site_name TEXT;
  v_zone TEXT;
  v_cm RECORD;
BEGIN
  v_zone := COALESCE(NEW.site_label, 'Ubicación reportada');

  -- Siempre notificar a gestores de casos (flujo principal FARO)
  FOR v_cm IN
    SELECT id
    FROM profiles
    WHERE role IN ('case_manager', 'regional_admin', 'super_admin')
      AND status = 'active'
  LOOP
    PERFORM create_notification(
      v_cm.id,
      'Nuevo reporte ciudadano',
      left(coalesce(NEW.description, 'Sin descripción'), 160),
      'citizen_report',
      'high'::notification_priority,
      'file-text',
      'tab:case-manager',
      jsonb_build_object(
        'report_id', NEW.id,
        'site_label', NEW.site_label,
        'latitude', NEW.latitude,
        'longitude', NEW.longitude,
        'tracking_code', NEW.tracking_code
      ),
      NULL
    );
  END LOOP;

  -- Si el reporte está ligado a un centro, notificar también a coordinadores
  IF NEW.site_type IS NOT NULL AND NEW.site_id IS NOT NULL THEN
    IF NEW.site_type = 'hospital' THEN
      SELECT name INTO v_site_name FROM hospitals WHERE id = NEW.site_id;
    ELSIF NEW.site_type = 'shelter' THEN
      SELECT name INTO v_site_name FROM shelters WHERE id = NEW.site_id;
    ELSE
      SELECT name INTO v_site_name FROM supply_centers WHERE id = NEW.site_id;
    END IF;

    PERFORM notify_site_coordinators(
      NEW.site_type,
      NEW.site_id,
      'citizen_report',
      'Nuevo reporte ciudadano',
      left(coalesce(NEW.description, 'Sin descripción'), 160),
      'high',
      'tab:ops:reports:' || NEW.id::text,
      jsonb_build_object('report_id', NEW.id, 'site_name', coalesce(v_site_name, v_zone))
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_citizen_report ON reports;
CREATE TRIGGER trg_notify_citizen_report
  AFTER INSERT ON reports
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION notify_on_citizen_report();

-- ============================================================
-- 2. delete_report — search_path correcto + GRANT
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_report(p_report_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('case_manager', 'coordinator', 'regional_admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'No tienes permisos para eliminar reportes';
  END IF;

  DELETE FROM reports WHERE id = p_report_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_report(UUID) TO authenticated;

-- ============================================================
-- 3. get_volunteers_near_location — columnas reales lat/lng
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_volunteers_near_location(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_km DOUBLE PRECISION DEFAULT 25
)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  phone TEXT,
  distance_km DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.user_id,
    v.full_name,
    v.phone,
    (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(p_lat)) * cos(radians(v.lat)) *
          cos(radians(v.lng) - radians(p_lng)) +
          sin(radians(p_lat)) * sin(radians(v.lat))
        ))
      )
    )::DOUBLE PRECISION AS distance_km
  FROM volunteers v
  WHERE v.lat IS NOT NULL
    AND v.lng IS NOT NULL
    AND v.availability IN ('available', 'busy', 'on_mission')
    AND (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(p_lat)) * cos(radians(v.lat)) *
          cos(radians(v.lng) - radians(p_lng)) +
          sin(radians(p_lat)) * sin(radians(v.lat))
        ))
      )
    ) <= p_radius_km
  ORDER BY distance_km ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_volunteers_near_location(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
