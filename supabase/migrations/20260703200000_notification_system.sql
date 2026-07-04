-- FARO Fase 11 — Sistema unificado de notificaciones
-- Idempotente. Fuente oficial: public.notifications

-- ============================================================
-- 1. Tipos y tablas
-- ============================================================

DO $$ BEGIN
  CREATE TYPE notification_priority AS ENUM ('critical', 'high', 'normal', 'low');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  priority notification_priority NOT NULL DEFAULT 'normal',
  icon TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  action_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  push_sent BOOLEAN NOT NULL DEFAULT false,
  push_opened BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, read, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  requests_enabled BOOLEAN NOT NULL DEFAULT true,
  reports_enabled BOOLEAN NOT NULL DEFAULT true,
  messages_enabled BOOLEAN NOT NULL DEFAULT true,
  emergencies_enabled BOOLEAN NOT NULL DEFAULT true,
  system_enabled BOOLEAN NOT NULL DEFAULT true,
  verified_news_enabled BOOLEAN NOT NULL DEFAULT true,
  nearby_centers_enabled BOOLEAN NOT NULL DEFAULT true,
  push_enabled BOOLEAN NOT NULL DEFAULT false,
  muted_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'onesignal',
  provider_player_id TEXT NOT NULL,
  device_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, provider_player_id)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

-- ============================================================
-- 2. RLS
-- ============================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select_own ON notifications;
CREATE POLICY notifications_select_own ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_update_own ON notifications;
CREATE POLICY notifications_update_own ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_delete_own ON notifications;
CREATE POLICY notifications_delete_own ON notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS notification_preferences_select_own ON notification_preferences;
CREATE POLICY notification_preferences_select_own ON notification_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS notification_preferences_update_own ON notification_preferences;
CREATE POLICY notification_preferences_update_own ON notification_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS notification_preferences_insert_own ON notification_preferences;
CREATE POLICY notification_preferences_insert_own ON notification_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_select_own ON push_subscriptions;
CREATE POLICY push_subscriptions_select_own ON push_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_insert_own ON push_subscriptions;
CREATE POLICY push_subscriptions_insert_own ON push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_update_own ON push_subscriptions;
CREATE POLICY push_subscriptions_update_own ON push_subscriptions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_delete_own ON push_subscriptions;
CREATE POLICY push_subscriptions_delete_own ON push_subscriptions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, UPDATE, DELETE ON notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON notification_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO authenticated;

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- ============================================================
-- 3. Helpers
-- ============================================================

CREATE OR REPLACE FUNCTION notification_category_for_type(p_type TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_type IN ('user_signup', 'system_error', 'admin_created', 'center_registered') THEN 'system'
    WHEN p_type LIKE 'coordinator_%' OR p_type = 'coordinator_request' THEN 'requests'
    WHEN p_type LIKE 'report_%' OR p_type = 'citizen_report' THEN 'reports'
    WHEN p_type = 'guide_feedback' OR p_type LIKE 'faro_%' THEN 'messages'
    WHEN p_type IN ('need_critical', 'need_covered', 'delivery_registered') THEN 'emergencies'
    WHEN p_type = 'verified_news' THEN 'verified_news'
    WHEN p_type = 'nearby_center' THEN 'nearby_centers'
    ELSE 'system'
  END;
$$;

CREATE OR REPLACE FUNCTION should_deliver_notification(p_user_id UUID, p_type TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefs notification_preferences%ROWTYPE;
  v_cat TEXT;
BEGIN
  SELECT * INTO v_prefs FROM notification_preferences WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN true;
  END IF;
  IF v_prefs.muted_until IS NOT NULL AND v_prefs.muted_until > now() THEN
    RETURN false;
  END IF;
  v_cat := notification_category_for_type(p_type);
  RETURN CASE v_cat
    WHEN 'requests' THEN v_prefs.requests_enabled
    WHEN 'reports' THEN v_prefs.reports_enabled
    WHEN 'messages' THEN v_prefs.messages_enabled
    WHEN 'emergencies' THEN v_prefs.emergencies_enabled
    WHEN 'verified_news' THEN v_prefs.verified_news_enabled
    WHEN 'nearby_centers' THEN v_prefs.nearby_centers_enabled
    ELSE v_prefs.system_enabled
  END;
END;
$$;

CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT,
  p_priority notification_priority DEFAULT 'normal',
  p_icon TEXT DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF NOT should_deliver_notification(p_user_id, p_type) THEN
    RETURN NULL;
  END IF;

  INSERT INTO notifications (
    user_id, title, message, type, priority, icon, action_url, metadata, expires_at
  ) VALUES (
    p_user_id,
    p_title,
    p_message,
    p_type,
    p_priority,
    p_icon,
    p_action_url,
    coalesce(p_metadata, '{}'::jsonb),
    p_expires_at
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION notify_elevated_admins(
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_priority notification_priority DEFAULT 'normal',
  p_icon TEXT DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_super_only BOOLEAN DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin RECORD;
BEGIN
  FOR v_admin IN
    SELECT id FROM profiles
    WHERE status = 'active'
      AND (
        (NOT p_super_only AND role IN ('regional_admin', 'super_admin'))
        OR (p_super_only AND role = 'super_admin')
      )
  LOOP
    PERFORM create_notification(
      v_admin.id, p_title, p_message, p_type, p_priority, p_icon, p_action_url, p_metadata
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION notify_site_coordinators(
  p_site_type TEXT,
  p_site_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_priority notification_priority DEFAULT 'normal',
  p_action_url TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coord RECORD;
BEGIN
  FOR v_coord IN
    SELECT auth_user_id FROM coordinator_profiles
    WHERE site_type = p_site_type AND site_id = p_site_id AND onboarding_complete = true
  LOOP
    PERFORM create_notification(
      v_coord.auth_user_id, p_title, p_message, p_type, p_priority, NULL, p_action_url, p_metadata
    );
  END LOOP;
END;
$$;

-- ============================================================
-- 4. RPCs cliente (solo lectura/estado — no crear notificaciones)
-- ============================================================

CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row notifications%ROWTYPE;
BEGIN
  UPDATE notifications
  SET read = true, read_at = now()
  WHERE id = p_notification_id AND user_id = auth.uid()
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notification_not_found';
  END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE notifications
  SET read = true, read_at = now()
  WHERE user_id = auth.uid() AND read = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION delete_notification(p_notification_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM notifications
  WHERE id = p_notification_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notification_not_found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION upsert_notification_preferences(
  p_requests BOOLEAN DEFAULT NULL,
  p_reports BOOLEAN DEFAULT NULL,
  p_messages BOOLEAN DEFAULT NULL,
  p_emergencies BOOLEAN DEFAULT NULL,
  p_system BOOLEAN DEFAULT NULL,
  p_verified_news BOOLEAN DEFAULT NULL,
  p_nearby_centers BOOLEAN DEFAULT NULL,
  p_push BOOLEAN DEFAULT NULL,
  p_muted_until TIMESTAMPTZ DEFAULT NULL
)
RETURNS notification_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row notification_preferences%ROWTYPE;
BEGIN
  INSERT INTO notification_preferences (user_id)
  VALUES (auth.uid())
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE notification_preferences
  SET
    requests_enabled = coalesce(p_requests, requests_enabled),
    reports_enabled = coalesce(p_reports, reports_enabled),
    messages_enabled = coalesce(p_messages, messages_enabled),
    emergencies_enabled = coalesce(p_emergencies, emergencies_enabled),
    system_enabled = coalesce(p_system, system_enabled),
    verified_news_enabled = coalesce(p_verified_news, verified_news_enabled),
    nearby_centers_enabled = coalesce(p_nearby_centers, nearby_centers_enabled),
    push_enabled = coalesce(p_push, push_enabled),
    muted_until = p_muted_until,
    updated_at = now()
  WHERE user_id = auth.uid()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION register_push_subscription(
  p_provider TEXT,
  p_provider_player_id TEXT,
  p_device_type TEXT DEFAULT NULL
)
RETURNS push_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row push_subscriptions%ROWTYPE;
BEGIN
  IF p_provider_player_id IS NULL OR btrim(p_provider_player_id) = '' THEN
    RAISE EXCEPTION 'invalid_player_id';
  END IF;

  INSERT INTO push_subscriptions (user_id, provider, provider_player_id, device_type, updated_at)
  VALUES (auth.uid(), coalesce(nullif(btrim(p_provider), ''), 'onesignal'), btrim(p_provider_player_id), p_device_type, now())
  ON CONFLICT (user_id, provider, provider_player_id) DO UPDATE
    SET device_type = EXCLUDED.device_type, updated_at = now()
  RETURNING * INTO v_row;

  PERFORM upsert_notification_preferences(p_push := true);

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_notification_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION delete_notification(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_notification_preferences(BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION register_push_subscription(TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 5. Migrar datos legacy
-- ============================================================

INSERT INTO notifications (user_id, title, message, type, priority, read, action_url, metadata, created_at, read_at)
SELECT
  user_id,
  title,
  body,
  type,
  'normal'::notification_priority,
  status = 'read',
  CASE
    WHEN related_request_id IS NOT NULL THEN 'tab:admin:request:' || related_request_id::text
    WHEN type = 'user_signup' THEN 'tab:system'
    ELSE NULL
  END,
  payload,
  created_at,
  CASE WHEN status = 'read' THEN created_at ELSE NULL END
FROM admin_notifications
WHERE NOT EXISTS (SELECT 1 FROM notifications n WHERE n.id = admin_notifications.id);

INSERT INTO notifications (user_id, title, message, type, priority, read, action_url, metadata, created_at)
SELECT
  user_id,
  title,
  body,
  type,
  'normal'::notification_priority,
  status = 'read',
  CASE
    WHEN type = 'coordinator_request_approved' THEN 'tab:ops'
    WHEN related_request_id IS NOT NULL THEN 'tab:profile:coordinator-request'
    ELSE NULL
  END,
  payload,
  created_at
FROM user_notifications
WHERE NOT EXISTS (
  SELECT 1 FROM notifications n
  WHERE n.user_id = user_notifications.user_id
    AND n.created_at = user_notifications.created_at
    AND n.type = user_notifications.type
);

-- ============================================================
-- 6. Reemplazar funciones legacy de notificación
-- ============================================================

CREATE OR REPLACE FUNCTION notify_super_admins(
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_related_request_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM notify_elevated_admins(
    p_type,
    p_title,
    p_body,
    CASE WHEN p_type = 'system_error' THEN 'critical'::notification_priority ELSE 'normal'::notification_priority END,
    NULL,
    CASE
      WHEN p_related_request_id IS NOT NULL THEN 'tab:admin:request:' || p_related_request_id::text
      WHEN p_type = 'user_signup' THEN 'tab:system'
      ELSE 'tab:admin'
    END,
    p_payload,
    true
  );
END;
$$;

CREATE OR REPLACE FUNCTION notify_admins_coordinator_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_center_name TEXT := 'Centro sin nombre';
BEGIN
  IF NEW.requested_site_type = 'hospital' THEN
    SELECT name INTO v_center_name FROM hospitals WHERE id = NEW.requested_site_id;
  ELSIF NEW.requested_site_type = 'shelter' THEN
    SELECT name INTO v_center_name FROM shelters WHERE id = NEW.requested_site_id;
  ELSIF NEW.requested_site_type = 'supply_center' THEN
    SELECT name INTO v_center_name FROM supply_centers WHERE id = NEW.requested_site_id;
  END IF;

  PERFORM notify_elevated_admins(
    'coordinator_request',
    'Nueva solicitud de coordinador',
    NEW.full_name || ' solicita administrar ' || coalesce(v_center_name, 'un centro') || '.',
    'high',
    'user-plus',
    'tab:admin:request:' || NEW.id::text,
    jsonb_build_object(
      'applicant_name', NEW.full_name,
      'applicant_email', NEW.email,
      'center_name', v_center_name,
      'request_id', NEW.id
    ),
    false
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_coordinator_request_user(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_payload JSONB,
  p_request_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM create_notification(
    p_user_id,
    p_title,
    p_body,
    p_type,
    CASE WHEN p_type = 'coordinator_request_rejected' THEN 'high'::notification_priority ELSE 'normal'::notification_priority END,
    NULL,
    CASE
      WHEN p_type = 'coordinator_request_approved' THEN 'tab:ops'
      WHEN p_type = 'coordinator_info_request' THEN 'tab:profile:coordinator-request'
      ELSE 'tab:profile:coordinator-request'
    END,
    coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('request_id', p_request_id)
  );
END;
$$;

-- ============================================================
-- 7. Triggers operativos adicionales
-- ============================================================

CREATE OR REPLACE FUNCTION notify_on_citizen_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_site_name TEXT;
BEGIN
  IF NEW.site_type IS NULL OR NEW.site_id IS NULL THEN
    RETURN NEW;
  END IF;

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
    jsonb_build_object('report_id', NEW.id, 'site_name', v_site_name)
  );

  PERFORM notify_elevated_admins(
    'citizen_report',
    'Nuevo reporte · ' || coalesce(v_site_name, 'Centro'),
    left(coalesce(NEW.description, 'Sin descripción'), 160),
    'normal',
    'file-text',
    'tab:admin',
    jsonb_build_object('report_id', NEW.id, 'site_name', v_site_name),
    false
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_citizen_report ON reports;
CREATE TRIGGER trg_notify_citizen_report
  AFTER INSERT ON reports
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION notify_on_citizen_report();

CREATE OR REPLACE FUNCTION notify_on_role_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role AND NEW.role = 'regional_admin' THEN
    PERFORM notify_elevated_admins(
      'admin_created',
      'Nuevo administrador regional',
      coalesce(NEW.full_name, NEW.email) || ' fue promovido a administrador regional.',
      'normal',
      'shield',
      'tab:system',
      jsonb_build_object('user_id', NEW.id, 'email', NEW.email),
      true
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_role_changed ON profiles;
CREATE TRIGGER trg_notify_role_changed
  AFTER UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_role_changed();

CREATE OR REPLACE FUNCTION notify_on_need_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type TEXT;
  v_title TEXT;
  v_msg TEXT;
  v_priority notification_priority := 'normal';
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_type := 'need_registered';
    v_title := 'Nueva necesidad registrada';
    v_msg := coalesce(NEW.item_name, 'Insumo') || ' — prioridad ' || coalesce(NEW.priority, 'medium');
    IF NEW.priority IN ('critical', 'high') THEN
      v_priority := 'high';
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.qty_received >= NEW.qty_required AND NEW.qty_required > 0
        AND (OLD.qty_received IS NULL OR OLD.qty_received < OLD.qty_required) THEN
    v_type := 'need_covered';
    v_title := 'Necesidad cubierta';
    v_msg := coalesce(NEW.item_name, 'Insumo') || ' alcanzó la meta.';
    v_priority := 'normal';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM notify_site_coordinators(
    NEW.needable_type,
    NEW.needable_id,
    v_type,
    v_title,
    v_msg,
    v_priority,
    'tab:ops:needs',
    jsonb_build_object('need_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_need_change ON needs;
CREATE TRIGGER trg_notify_need_change
  AFTER INSERT OR UPDATE ON needs
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_need_change();

-- Actualizar submit_guide_feedback para usar notify_super_admins (ya redirige a notifications)
-- handle_new_user ya usa notify_super_admins
