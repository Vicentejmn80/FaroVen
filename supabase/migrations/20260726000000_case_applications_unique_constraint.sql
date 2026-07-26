-- Ensure a UNIQUE constraint exists on (case_id, applicant_id) for case_applications
-- This prevents duplicate applications and gives us ON CONFLICT DO NOTHING support

DO $$
BEGIN
  -- Check if the constraint already exists (e.g. added via dashboard)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'case_applications_case_applicant_unique'
    AND conrelid = 'case_applications'::regclass
  ) THEN
    ALTER TABLE case_applications
    ADD CONSTRAINT case_applications_case_applicant_unique
    UNIQUE (case_id, applicant_id);
  END IF;
END $$;
