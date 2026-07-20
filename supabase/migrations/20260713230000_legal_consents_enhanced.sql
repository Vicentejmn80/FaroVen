-- Ampliación de legal_consents: tres consentimientos separados + metadatos de registro.

ALTER TABLE legal_consents
  ADD COLUMN IF NOT EXISTS privacy_read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_data_processing_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_processing_version TEXT,
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Backfill para registros previos (misma marca temporal que términos/privacidad).
UPDATE legal_consents
SET
  privacy_read_at = COALESCE(privacy_read_at, accepted_privacy_at, accepted_terms_at),
  accepted_data_processing_at = COALESCE(accepted_data_processing_at, accepted_privacy_at, accepted_terms_at),
  data_processing_version = COALESCE(data_processing_version, privacy_version, terms_version)
WHERE privacy_read_at IS NULL
   OR accepted_data_processing_at IS NULL
   OR data_processing_version IS NULL;

COMMENT ON COLUMN legal_consents.privacy_read_at IS 'Confirmación de haber leído la Política de Privacidad.';
COMMENT ON COLUMN legal_consents.accepted_data_processing_at IS 'Autorización expresa del tratamiento de datos personales.';
COMMENT ON COLUMN legal_consents.ip_address IS 'IP pública aproximada al momento del consentimiento (si disponible).';
COMMENT ON COLUMN legal_consents.user_agent IS 'User-Agent del navegador al momento del consentimiento.';
