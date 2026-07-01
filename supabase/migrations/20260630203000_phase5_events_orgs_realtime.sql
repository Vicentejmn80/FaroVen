-- FARO Fase 5
-- Persistencia real incremental sobre esquema existente.
-- No rompe tablas previas; añade solo piezas faltantes para repositorios/hooks.

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'ngo',
  contact TEXT,
  logo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read_organizations ON organizations;
CREATE POLICY public_read_organizations
  ON organizations FOR SELECT
  TO anon, authenticated
  USING (true);

-- Tabla de eventos unificada para timeline/recent activity/resumen.
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'info',
  center_type TEXT,
  center_id UUID,
  report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_center ON events(center_type, center_id);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read_events ON events;
CREATE POLICY public_read_events
  ON events FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS system_insert_events ON events;
CREATE POLICY system_insert_events
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (true);

GRANT SELECT ON events TO anon, authenticated;
GRANT INSERT ON events TO authenticated;
GRANT SELECT ON organizations TO anon, authenticated;

-- Bucket para fotografías de reportes (preparado para UI futura).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reports-images',
  'reports-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS public_read_reports_images ON storage.objects;
CREATE POLICY public_read_reports_images ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id = 'reports-images');

DROP POLICY IF EXISTS authenticated_insert_reports_images ON storage.objects;
CREATE POLICY authenticated_insert_reports_images ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'reports-images');

DROP POLICY IF EXISTS authenticated_update_reports_images ON storage.objects;
CREATE POLICY authenticated_update_reports_images ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'reports-images')
WITH CHECK (bucket_id = 'reports-images');

-- Trigger: reporte recibido => evento.
CREATE OR REPLACE FUNCTION log_event_from_report()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO events (kind, title, detail, status, center_type, center_id, report_id)
  VALUES (
    'report',
    'Reporte recibido',
    coalesce(NEW.description, 'Nuevo reporte ciudadano'),
    CASE
      WHEN NEW.status = 'verified' THEN 'info'
      WHEN NEW.status = 'dismissed' THEN 'operational'
      ELSE 'warning'
    END,
    NEW.site_type,
    NEW.site_id,
    NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_reports_log_event ON reports;
CREATE TRIGGER trg_reports_log_event
AFTER INSERT ON reports
FOR EACH ROW
EXECUTE FUNCTION log_event_from_report();

-- Trigger: necesidad creada/actualizada => evento.
CREATE OR REPLACE FUNCTION log_event_from_need()
RETURNS TRIGGER AS $$
DECLARE
  coverage NUMERIC;
  level TEXT;
  title_text TEXT;
BEGIN
  coverage := CASE
    WHEN NEW.qty_required > 0 THEN ROUND((NEW.qty_received::NUMERIC / NEW.qty_required) * 100, 2)
    ELSE 0
  END;
  level := CASE
    WHEN NEW.priority = 'critical' OR coverage < 40 THEN 'critical'
    WHEN NEW.priority = 'high' OR coverage < 70 THEN 'warning'
    ELSE 'info'
  END;
  title_text := CASE
    WHEN TG_OP = 'INSERT' THEN 'Nueva necesidad registrada'
    ELSE 'Actualización de inventario'
  END;

  INSERT INTO events (kind, title, detail, status, center_type, center_id)
  VALUES (
    'inventory',
    title_text,
    NEW.item_name || ' (' || coverage || '% cubierto)',
    level,
    NEW.needable_type,
    NEW.needable_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_needs_log_event ON needs;
CREATE TRIGGER trg_needs_log_event
AFTER INSERT OR UPDATE ON needs
FOR EACH ROW
EXECUTE FUNCTION log_event_from_need();

-- Trigger: actualización de centro => evento.
CREATE OR REPLACE FUNCTION log_event_from_center()
RETURNS TRIGGER AS $$
DECLARE
  center_kind TEXT;
  center_status TEXT;
BEGIN
  center_kind := TG_ARGV[0];
  center_status := CASE
    WHEN NEW.status = 'active' THEN 'operational'
    WHEN NEW.status = 'inactive' THEN 'warning'
    ELSE 'info'
  END;

  INSERT INTO events (kind, title, detail, status, center_type, center_id)
  VALUES (
    'saturation',
    NEW.name || ' actualizado',
    'Estado del centro modificado',
    center_status,
    center_kind,
    NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_hospitals_log_event ON hospitals;
CREATE TRIGGER trg_hospitals_log_event
AFTER UPDATE ON hospitals
FOR EACH ROW
EXECUTE FUNCTION log_event_from_center('hospital');

DROP TRIGGER IF EXISTS trg_shelters_log_event ON shelters;
CREATE TRIGGER trg_shelters_log_event
AFTER UPDATE ON shelters
FOR EACH ROW
EXECUTE FUNCTION log_event_from_center('shelter');

DROP TRIGGER IF EXISTS trg_supply_centers_log_event ON supply_centers;
CREATE TRIGGER trg_supply_centers_log_event
AFTER UPDATE ON supply_centers
FOR EACH ROW
EXECUTE FUNCTION log_event_from_center('supply_center');

-- Realtime: asegurar tablas publicadas.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'hospitals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hospitals;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'shelters'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shelters;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'supply_centers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.supply_centers;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'needs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.needs;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'reports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
  END IF;
END
$$;
