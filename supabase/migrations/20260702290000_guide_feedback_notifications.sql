-- FARO — Mensajes del Centro de Recursos + notificación a Super Admin
-- Idempotente.

CREATE TABLE IF NOT EXISTS guide_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('bug', 'suggestion', 'incorrect_info')),
  message TEXT NOT NULL,
  sender_email TEXT,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guide_feedback_created ON guide_feedback(created_at DESC);

ALTER TABLE guide_feedback ENABLE ROW LEVEL SECURITY;

-- Solo lectura para super admins; inserción vía RPC.
DROP POLICY IF EXISTS guide_feedback_super_admin_read ON guide_feedback;
CREATE POLICY guide_feedback_super_admin_read ON guide_feedback
  FOR SELECT TO authenticated
  USING (is_super_admin());

GRANT SELECT ON guide_feedback TO authenticated;

CREATE OR REPLACE FUNCTION submit_guide_feedback(
  p_category TEXT,
  p_message TEXT,
  p_email TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_admin RECORD;
  v_category_label TEXT;
BEGIN
  PERFORM enforce_rate_limit('guide_feedback_submit', 5, 3600);

  IF p_category NOT IN ('bug', 'suggestion', 'incorrect_info') THEN
    RAISE EXCEPTION 'invalid_feedback_category';
  END IF;

  PERFORM assert_text_bounds(p_message, 'message', 10, 3000, true);

  IF p_email IS NOT NULL AND btrim(p_email) <> '' THEN
    IF NOT validate_email_strict(p_email) THEN
      RAISE EXCEPTION 'invalid_email';
    END IF;
  END IF;

  v_category_label := CASE p_category
    WHEN 'bug' THEN 'Reporte de error'
    WHEN 'suggestion' THEN 'Sugerencia'
    ELSE 'Información incorrecta'
  END;

  INSERT INTO guide_feedback (category, message, sender_email, auth_user_id)
  VALUES (
    p_category,
    btrim(p_message),
    nullif(btrim(coalesce(p_email, '')), ''),
    auth.uid()
  )
  RETURNING id INTO v_id;

  -- Notificar únicamente a Super Admins (vicentejmn80@gmail.com vía perfil super_admin)
  FOR v_admin IN
    SELECT id FROM profiles
    WHERE role = 'super_admin'
      AND status = 'active'
  LOOP
    INSERT INTO admin_notifications (
      user_id,
      type,
      title,
      body,
      payload
    ) VALUES (
      v_admin.id,
      'guide_feedback',
      'Nuevo mensaje · Centro de Recursos',
      v_category_label || ': ' || left(btrim(p_message), 120),
      jsonb_build_object(
        'feedback_id', v_id,
        'category', p_category,
        'category_label', v_category_label,
        'message', btrim(p_message),
        'sender_email', nullif(btrim(coalesce(p_email, '')), ''),
        'submitted_at', now()
      )
    );
  END LOOP;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_guide_feedback(TEXT, TEXT, TEXT) TO anon, authenticated;
