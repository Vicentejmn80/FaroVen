-- FARO — Volunteer Mission Engine V1
-- Motor operativo para coordinar voluntarios durante emergencias.
-- El actor principal es la MISIÓN, no el voluntario.
-- ============================================================

-- ============================================================
-- 1. Tabla volunteers — perfil completo del voluntario
-- ============================================================
CREATE TABLE IF NOT EXISTS volunteers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL,
  phone           TEXT NOT NULL DEFAULT '',
  zone            TEXT NOT NULL DEFAULT '',
  lat             DOUBLE PRECISION NOT NULL DEFAULT 0,
  lng             DOUBLE PRECISION NOT NULL DEFAULT 0,
  organization    TEXT,
  experience      TEXT,
  availability    TEXT NOT NULL DEFAULT 'offline'
                  CHECK (availability IN ('available','busy','offline','on_mission','unavailable')),
  verification_level TEXT NOT NULL DEFAULT 'unverified'
                  CHECK (verification_level IN ('unverified','basic','advanced','full')),
  trust_score     INT NOT NULL DEFAULT 0 CHECK (trust_score >= 0 AND trust_score <= 100),
  avg_response_minutes INT NOT NULL DEFAULT 0,
  total_missions  INT NOT NULL DEFAULT 0,
  completed_missions INT NOT NULL DEFAULT 0,
  service_hours   INT NOT NULL DEFAULT 0,
  last_location_update TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_volunteers_user ON volunteers(user_id);
CREATE INDEX IF NOT EXISTS idx_volunteers_zone ON volunteers(zone);
CREATE INDEX IF NOT EXISTS idx_volunteers_availability ON volunteers(availability);
CREATE INDEX IF NOT EXISTS idx_volunteers_location ON volunteers(lat, lng);

COMMENT ON TABLE volunteers IS 'Perfil completo del voluntario. Un usuario = un perfil.';
COMMENT ON COLUMN volunteers.availability IS 'Disponibilidad en tiempo real: available, busy, offline, on_mission, unavailable';
COMMENT ON COLUMN volunteers.trust_score IS 'Puntaje de confianza 0-100 calculado por el sistema';

-- ============================================================
-- 2. Tabla volunteer_skills — habilidades dinámicas
-- ============================================================
CREATE TABLE IF NOT EXISTS volunteer_skills (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id  UUID NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
  skill         TEXT NOT NULL,
  proficiency   INT NOT NULL DEFAULT 1 CHECK (proficiency >= 1 AND proficiency <= 5)
);

CREATE INDEX IF NOT EXISTS idx_volunteer_skills_volunteer ON volunteer_skills(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_skills_skill ON volunteer_skills(skill);
CREATE UNIQUE INDEX IF NOT EXISTS idx_volunteer_skills_unique ON volunteer_skills(volunteer_id, skill);

COMMENT ON TABLE volunteer_skills IS 'Habilidades del voluntario (dinámicas, no columnas fijas)';

-- ============================================================
-- 3. Tabla volunteer_availability_log — auditoría de disponibilidad
-- ============================================================
CREATE TABLE IF NOT EXISTS volunteer_availability_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id  UUID NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
  status        TEXT NOT NULL CHECK (status IN ('available','busy','offline','on_mission','unavailable')),
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vol_avail_log_volunteer ON volunteer_availability_log(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_vol_avail_log_changed ON volunteer_availability_log(volunteer_id, changed_at DESC);

COMMENT ON TABLE volunteer_availability_log IS 'Auditoría de cambios de disponibilidad del voluntario';

-- ============================================================
-- 4. Tabla missions — la entidad principal
-- ============================================================
CREATE TABLE IF NOT EXISTS missions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  support_request_id UUID,
  case_id           UUID,
  center_id         TEXT NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  priority          TEXT NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('critical','high','medium','low')),
  required_skills   TEXT[] NOT NULL DEFAULT '{}',
  required_people   INT NOT NULL DEFAULT 1 CHECK (required_people > 0),
  assigned_people   INT NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'created'
                    CHECK (status IN ('created','matching','assigned','accepted','en_route','on_site','in_progress','completed','verified','archived')),
  lat               DOUBLE PRECISION NOT NULL DEFAULT 0,
  lng               DOUBLE PRECISION NOT NULL DEFAULT 0,
  address           TEXT,
  zone              TEXT NOT NULL DEFAULT '',
  deadline          TIMESTAMPTZ,
  eta               TIMESTAMPTZ,
  created_by        TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  verified_at       TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  cancellation_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
CREATE INDEX IF NOT EXISTS idx_missions_center ON missions(center_id);
CREATE INDEX IF NOT EXISTS idx_missions_priority ON missions(priority) WHERE status IN ('created','matching','assigned');
CREATE INDEX IF NOT EXISTS idx_missions_zone ON missions(zone) WHERE status IN ('matching','assigned');
CREATE INDEX IF NOT EXISTS idx_missions_case ON missions(case_id);
CREATE INDEX IF NOT EXISTS idx_missions_support ON missions(support_request_id);

COMMENT ON TABLE missions IS 'Misión operativa: la unidad de trabajo del voluntario';
COMMENT ON COLUMN missions.support_request_id IS 'FK opcional a support_requests';
COMMENT ON COLUMN missions.case_id IS 'FK opcional a cases';
COMMENT ON COLUMN missions.required_skills IS 'Array dinámico de habilidades requeridas (ej: {paramedic,driver})';

-- ============================================================
-- 5. Tabla mission_assignments — voluntarios asignados a misiones
-- ============================================================
CREATE TABLE IF NOT EXISTS mission_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id    UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  volunteer_id  UUID NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'assigned'
                CHECK (status IN ('assigned','accepted','rejected','en_route','on_site','completed','cancelled')),
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at  TIMESTAMPTZ,
  arrived_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  rating        INT CHECK (rating >= 1 AND rating <= 5),
  feedback      TEXT
);

CREATE INDEX IF NOT EXISTS idx_mission_assignments_mission ON mission_assignments(mission_id);
CREATE INDEX IF NOT EXISTS idx_mission_assignments_volunteer ON mission_assignments(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_mission_assignments_status ON mission_assignments(mission_id, status);

COMMENT ON TABLE mission_assignments IS 'Asignación voluntario→misión con timeline y calificación propia';

-- ============================================================
-- 6. Tabla mission_events — timeline auditada
-- ============================================================
CREATE TABLE IF NOT EXISTS mission_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id    UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL CHECK (event_type IN (
    'mission_created', 'matching_completed', 'volunteer_assigned', 'volunteer_accepted',
    'volunteer_rejected', 'volunteer_en_route', 'volunteer_on_site', 'mission_in_progress',
    'mission_completed', 'mission_verified', 'mission_cancelled', 'mission_archived',
    'volunteer_unavailable', 'needs_info'
  )),
  actor_id      TEXT,
  actor_name    TEXT,
  description   TEXT,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mission_events_mission ON mission_events(mission_id);
CREATE INDEX IF NOT EXISTS idx_mission_events_created ON mission_events(mission_id, created_at ASC);

COMMENT ON TABLE mission_events IS 'Timeline de eventos de la misión';

-- ============================================================
-- 7. RLS
-- ============================================================
ALTER TABLE volunteers ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_availability_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_events ENABLE ROW LEVEL SECURITY;

-- Volunteers: el voluntario ve/edita su perfil; roles operativos leen
CREATE POLICY volunteers_select ON volunteers
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('volunteer', 'coordinator', 'case_manager', 'regional_admin', 'super_admin')
  ));

CREATE POLICY volunteers_insert ON volunteers
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY volunteers_update ON volunteers
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Skills: mismo modelo
CREATE POLICY volunteer_skills_select ON volunteer_skills
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('volunteer', 'coordinator', 'case_manager', 'regional_admin', 'super_admin')
  ));

CREATE POLICY volunteer_skills_insert ON volunteer_skills
  FOR INSERT TO authenticated
  WITH CHECK (volunteer_id IN (SELECT id FROM volunteers WHERE user_id = auth.uid()));

CREATE POLICY volunteer_skills_update ON volunteer_skills
  FOR UPDATE TO authenticated
  USING (volunteer_id IN (SELECT id FROM volunteers WHERE user_id = auth.uid()));

CREATE POLICY volunteer_skills_delete ON volunteer_skills
  FOR DELETE TO authenticated
  USING (volunteer_id IN (SELECT id FROM volunteers WHERE user_id = auth.uid()));

-- Availability log: el voluntario inserta; roles operativos leen
CREATE POLICY vol_avail_log_select ON volunteer_availability_log
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('volunteer', 'coordinator', 'case_manager', 'regional_admin', 'super_admin')
  ));

CREATE POLICY vol_avail_log_insert ON volunteer_availability_log
  FOR INSERT TO authenticated
  WITH CHECK (volunteer_id IN (SELECT id FROM volunteers WHERE user_id = auth.uid()));

-- Missions: coord/admin pueden todo; volunteer solo lee y responde
CREATE POLICY missions_select ON missions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('volunteer', 'coordinator', 'case_manager', 'regional_admin', 'super_admin')
  ));

CREATE POLICY missions_insert ON missions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('coordinator', 'regional_admin', 'super_admin')
  ));

CREATE POLICY missions_update ON missions
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('coordinator', 'case_manager', 'regional_admin', 'super_admin')
  ));

-- Mission assignments: voluntario ve las suyas; coord/admin ven todas
CREATE POLICY mission_assignments_select ON mission_assignments
  FOR SELECT TO authenticated
  USING (
    volunteer_id IN (SELECT id FROM volunteers WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('coordinator', 'case_manager', 'regional_admin', 'super_admin')
    )
  );

CREATE POLICY mission_assignments_insert ON mission_assignments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('coordinator', 'regional_admin', 'super_admin')
  ));

CREATE POLICY mission_assignments_update ON mission_assignments
  FOR UPDATE TO authenticated
  USING (
    volunteer_id IN (SELECT id FROM volunteers WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('coordinator', 'case_manager', 'regional_admin', 'super_admin')
    )
  );

-- Mission events: todos los roles operativos leen
CREATE POLICY mission_events_select ON mission_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('volunteer', 'coordinator', 'case_manager', 'regional_admin', 'super_admin')
  ));

CREATE POLICY mission_events_insert ON mission_events
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('coordinator', 'volunteer', 'case_manager', 'regional_admin', 'super_admin')
  ));

-- ============================================================
-- 8. Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE volunteers;
ALTER PUBLICATION supabase_realtime ADD TABLE missions;
ALTER PUBLICATION supabase_realtime ADD TABLE mission_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE mission_events;
