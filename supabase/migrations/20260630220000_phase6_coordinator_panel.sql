-- FARO Fase 6 — Panel del coordinador
-- Eventos al revisar reportes + títulos más descriptivos en inventario.

CREATE OR REPLACE FUNCTION log_event_from_report()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO events (kind, title, detail, status, center_type, center_id, report_id)
    VALUES (
      'report',
      'Reporte recibido',
      coalesce(NEW.description, 'Nuevo reporte ciudadano'),
      CASE
        WHEN NEW.status = 'verified' THEN 'operational'
        WHEN NEW.status = 'dismissed' THEN 'info'
        ELSE 'warning'
      END,
      NEW.site_type,
      NEW.site_id,
      NEW.id
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO events (kind, title, detail, status, center_type, center_id, report_id)
    VALUES (
      'report',
      CASE
        WHEN NEW.status = 'verified' THEN 'Reporte aprobado'
        WHEN NEW.status = 'dismissed' THEN 'Reporte rechazado'
        WHEN NEW.status = 'under_review' THEN 'Reporte en revisión'
        ELSE 'Reporte actualizado'
      END,
      coalesce(NEW.review_notes, left(coalesce(NEW.description, ''), 180)),
      CASE
        WHEN NEW.status = 'verified' THEN 'operational'
        WHEN NEW.status = 'dismissed' THEN 'info'
        ELSE 'warning'
      END,
      NEW.site_type,
      NEW.site_id,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_reports_log_event ON reports;
CREATE TRIGGER trg_reports_log_event
AFTER INSERT OR UPDATE OF status, review_notes ON reports
FOR EACH ROW
EXECUTE FUNCTION log_event_from_report();

-- Inventario: distinguir cobertura completa.
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
    WHEN coverage >= 100 THEN 'operational'
    ELSE 'info'
  END;
  title_text := CASE
    WHEN TG_OP = 'INSERT' THEN 'Nueva necesidad registrada'
    WHEN coverage >= 100 AND (TG_OP = 'INSERT' OR OLD.qty_received < OLD.qty_required) THEN 'Necesidad cubierta'
    WHEN NEW.qty_received > OLD.qty_received THEN 'Llegada de donación registrada'
    WHEN NEW.qty_received < OLD.qty_received THEN 'Salida de inventario registrada'
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

-- Permitir lectura/escritura de eventos vía triggers (SECURITY DEFINER) sin cambiar políticas client.
