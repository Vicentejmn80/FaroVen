-- Permitir eventos de retraso ETA en mission_events

ALTER TABLE public.mission_events
  DROP CONSTRAINT IF EXISTS mission_events_event_type_check;

ALTER TABLE public.mission_events
  ADD CONSTRAINT mission_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'mission_created'::text,
    'application_submitted'::text,
    'application_approved'::text,
    'application_rejected'::text,
    'matching_completed'::text,
    'volunteer_assigned'::text,
    'volunteer_accepted'::text,
    'volunteer_preparing'::text,
    'volunteer_rejected'::text,
    'volunteer_en_route'::text,
    'volunteer_on_site'::text,
    'mission_in_progress'::text,
    'mission_completed'::text,
    'mission_verified'::text,
    'mission_cancelled'::text,
    'mission_archived'::text,
    'volunteer_unavailable'::text,
    'needs_info'::text,
    'evidence_submitted'::text,
    'eta_delay'::text
  ]));
