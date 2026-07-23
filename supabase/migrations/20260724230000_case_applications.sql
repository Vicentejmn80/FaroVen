-- Case Applications: volunteer/ONG can apply to open cases
-- Follows the mission_applications pattern

CREATE TABLE IF NOT EXISTS case_applications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    applicant_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    organization    TEXT,
    message         TEXT,
    skills          TEXT[] DEFAULT '{}',
    availability    TEXT,
    distance_km     DOUBLE PRECISION,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','under_review','approved','rejected','withdrawn','expired')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_applications_case_id ON case_applications(case_id);
CREATE INDEX IF NOT EXISTS idx_case_applications_applicant_id ON case_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_case_applications_status ON case_applications(status);

ALTER TABLE case_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "case_applications_read_authenticated"
    ON case_applications FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "case_applications_insert_own"
    ON case_applications FOR INSERT
    WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY "case_applications_update_moderator"
    ON case_applications FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('case_manager','coordinator','regional_admin','super_admin')
        )
    );
