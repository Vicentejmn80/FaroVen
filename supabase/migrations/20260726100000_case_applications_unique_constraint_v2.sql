-- Ensure UNIQUE (case_id, applicant_id) exists on case_applications.
-- PostgreSQL 15+ syntax. Idempotent — no-op if already present.
ALTER TABLE case_applications
ADD CONSTRAINT IF NOT EXISTS case_applications_case_applicant_unique
UNIQUE (case_id, applicant_id);
