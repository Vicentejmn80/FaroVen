-- ============================================================
-- FARO — Limpieza manual en Supabase SQL Editor
-- Proyecto: Dashboard → SQL → New query → pegar y Run
-- ============================================================

-- ── 1. Verificar que eres admin ─────────────────────────────
SELECT is_admin();  -- debe ser true cuando ejecutas con tu sesión JWT
-- En SQL Editor usa el rol postgres (bypass RLS) o confía en las funciones SECURITY DEFINER.

SELECT * FROM admin_emails ORDER BY email;

-- Agregar tu correo si falta:
INSERT INTO admin_emails (email, note)
VALUES ('vicentejmn80@gmail.com', 'Admin principal')
ON CONFLICT (email) DO NOTHING;

-- ── 2. Ver todos los sitios y si tienen coordinador ─────────
SELECT * FROM admin_registry_overview();

-- Solo huérfanos (sitio sin coordinador):
SELECT * FROM admin_registry_overview() WHERE is_orphan = true;

-- ── 3. Borrar UN sitio completo (needs + perfil + sitio) ────
-- Copia site_type y site_id de admin_registry_overview()
-- SELECT admin_delete_site('supply_center', 'UUID-AQUI'::uuid);
-- SELECT admin_delete_site('hospital', 'UUID-AQUI'::uuid);
-- SELECT admin_delete_site('shelter', 'UUID-AQUI'::uuid);

-- ── 4. Quitar solo coordinador (deja el sitio huérfano) ─────
-- SELECT admin_remove_coordinator('UUID-DEL-PROFILE'::uuid);

-- ── 5. Borrar usuario en Authentication (Dashboard) ─────────
-- Authentication → Users → Delete user
-- ⚠️ Eso NO borra el hospital/acopio que creó. Usa admin_delete_site después.

-- ── 6. Limpieza masiva de huérfanos (¡cuidado! revisa la lista antes) ──
-- DO $$
-- DECLARE r RECORD;
-- BEGIN
--   FOR r IN SELECT site_type, site_id FROM admin_registry_overview() WHERE is_orphan = true
--   LOOP
--     PERFORM admin_delete_site(r.site_type, r.site_id);
--   END LOOP;
-- END $$;

-- ── 7. Ver reportes sin sitio ───────────────────────────────
SELECT id, type, other_place_name, site_label, description, created_at
FROM reports
WHERE status = 'pending' AND site_id IS NULL
ORDER BY created_at DESC;
