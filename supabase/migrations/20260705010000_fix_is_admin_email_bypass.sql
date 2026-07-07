-- FARO — A-01: Eliminar dependencia de admin_emails en is_admin()
-- La función is_admin() confiaba en el email del JWT, que puede ser controlado
-- por el proveedor OAuth externo. Ahora delega exclusivamente a profiles.role.
-- Prerequisito: los correos en admin_emails deben tener profiles.role = 'super_admin'.
-- La migración 20260630260000 ya hizo el bootstrap: INSERT INTO profiles desde admin_emails.

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_elevated_admin() OR is_super_admin();
$$;

-- Nota: is_elevated_admin() = is_super_admin() OR is_regional_admin()
-- por lo que is_admin() = is_regional_admin() OR is_super_admin()
-- La tabla admin_emails se mantiene en schema (no se borra) por compatibilidad
-- pero ya no es consultada por ninguna función de seguridad.
