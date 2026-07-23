-- ÉPICA 10 · Fase 12b — Fix update_volunteer_location auth.uid() check
-- La RPC era SECURITY DEFINER pero no validaba que p_user_id fuese auth.uid().
CREATE OR REPLACE FUNCTION public.update_volunteer_location(
  p_user_id UUID,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN;
  END IF;

  UPDATE volunteers
  SET lat = p_lat, lng = p_lng, last_location_update = now()
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_volunteer_location TO authenticated;
