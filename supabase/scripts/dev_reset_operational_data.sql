-- ============================================================
-- FARO — Reset operacional para desarrollo
-- Ejecutar en Supabase SQL Editor como postgres / service role
-- CONSERVA: vicentejmn80@gmail.com (super_admin)
-- ============================================================

-- Opción A: RPC desde la consola Super Admin (recomendado)
-- SELECT admin_reset_operational_data('vicentejmn80@gmail.com');

-- Opción B: Script manual (equivalente)
DO $$
DECLARE
  v_preserve UUID;
BEGIN
  SELECT id INTO v_preserve FROM auth.users WHERE lower(email) = 'vicentejmn80@gmail.com' LIMIT 1;
  IF v_preserve IS NULL THEN
    RAISE EXCEPTION 'Usuario preserve no encontrado';
  END IF;

  DELETE FROM needs;
  DELETE FROM site_saturation;
  DELETE FROM reports;
  DELETE FROM persons;
  DELETE FROM events;
  DELETE FROM notifications WHERE user_id <> v_preserve;
  DELETE FROM admin_notifications WHERE user_id <> v_preserve;
  DELETE FROM coordinator_requests;
  DELETE FROM coordinator_profiles WHERE auth_user_id <> v_preserve;
  DELETE FROM hospitals;
  DELETE FROM shelters;
  DELETE FROM supply_centers;
  DELETE FROM guide_feedback;
  DELETE FROM operational_audit_logs;
  DELETE FROM auth_audit_logs;
  DELETE FROM bulletins;
  DELETE FROM updates;
  DELETE FROM auth.users WHERE id <> v_preserve;
END $$;

-- Storage: limpiar objetos de prueba (ejecutar aparte si aplica)
-- DELETE FROM storage.objects WHERE bucket_id IN ('reports-images', 'person-lists');

-- Verificar estado final
SELECT email, role, status FROM profiles;
SELECT COUNT(*) AS hospitals FROM hospitals;
SELECT COUNT(*) AS needs FROM needs;
SELECT COUNT(*) AS reports FROM reports;
