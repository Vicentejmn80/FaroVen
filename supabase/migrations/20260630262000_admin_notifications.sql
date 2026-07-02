-- Notificaciones internas para admins (solicitudes de coordinador, etc.)
-- Idempotente.

CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'coordinator_request',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  related_request_id UUID REFERENCES coordinator_requests(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_user
  ON admin_notifications(user_id, status, created_at DESC);

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_notifications_select_own ON admin_notifications;
CREATE POLICY admin_notifications_select_own ON admin_notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS admin_notifications_update_own ON admin_notifications;
CREATE POLICY admin_notifications_update_own ON admin_notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, UPDATE ON admin_notifications TO authenticated;

-- Notificar a todos los admins regionales y super admins
CREATE OR REPLACE FUNCTION notify_admins_coordinator_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin RECORD;
  v_center_name TEXT := 'Centro sin nombre';
BEGIN
  IF NEW.requested_site_type = 'hospital' THEN
    SELECT name INTO v_center_name FROM hospitals WHERE id = NEW.requested_site_id;
  ELSIF NEW.requested_site_type = 'shelter' THEN
    SELECT name INTO v_center_name FROM shelters WHERE id = NEW.requested_site_id;
  ELSIF NEW.requested_site_type = 'supply_center' THEN
    SELECT name INTO v_center_name FROM supply_centers WHERE id = NEW.requested_site_id;
  END IF;

  FOR v_admin IN
    SELECT id FROM profiles
    WHERE role IN ('regional_admin', 'super_admin')
      AND status = 'active'
  LOOP
    INSERT INTO admin_notifications (
      user_id,
      type,
      title,
      body,
      payload,
      related_request_id
    ) VALUES (
      v_admin.id,
      'coordinator_request',
      'Nueva solicitud de coordinador',
      NEW.full_name || ' solicita administrar ' || coalesce(v_center_name, 'un centro') || '.',
      jsonb_build_object(
        'applicant_name', NEW.full_name,
        'applicant_email', NEW.email,
        'center_name', v_center_name,
        'request_status', NEW.status,
        'requested_site_type', NEW.requested_site_type,
        'requested_site_id', NEW.requested_site_id
      ),
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_coordinator_request ON coordinator_requests;
CREATE TRIGGER trg_notify_coordinator_request
  AFTER INSERT ON coordinator_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_coordinator_request();
