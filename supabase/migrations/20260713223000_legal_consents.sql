-- Registro de aceptaciones legales (términos y privacidad).

CREATE TABLE IF NOT EXISTS legal_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_terms_at TIMESTAMPTZ NOT NULL,
  accepted_privacy_at TIMESTAMPTZ NOT NULL,
  terms_version TEXT NOT NULL,
  privacy_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_legal_consents_user ON legal_consents(user_id);

ALTER TABLE legal_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS legal_consents_select ON legal_consents;
CREATE POLICY legal_consents_select ON legal_consents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_super_admin());

DROP POLICY IF EXISTS legal_consents_insert ON legal_consents;
CREATE POLICY legal_consents_insert ON legal_consents
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS legal_consents_update ON legal_consents;
CREATE POLICY legal_consents_update ON legal_consents
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS legal_consents_delete ON legal_consents;
CREATE POLICY legal_consents_delete ON legal_consents
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON legal_consents TO authenticated;
