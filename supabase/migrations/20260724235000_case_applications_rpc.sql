-- RPC: delete_report — permite a case_manager/coordinator eliminar reportes
CREATE OR REPLACE FUNCTION delete_report(p_report_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('case_manager','coordinator','regional_admin','super_admin')
  ) THEN
    RAISE EXCEPTION 'No tienes permisos para eliminar reportes';
  END IF;

  DELETE FROM reports WHERE id = p_report_id;
END;
$$;

-- RPC: get_volunteers_near_location — voluntarios activos cerca de una ubicación.
-- Las columnas reales de `volunteers` son lat/lng y availability (no
-- latitude/longitude/status), y acos() se acota para evitar errores de dominio
-- por redondeo en distancias muy cortas.
CREATE OR REPLACE FUNCTION get_volunteers_near_location(
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
