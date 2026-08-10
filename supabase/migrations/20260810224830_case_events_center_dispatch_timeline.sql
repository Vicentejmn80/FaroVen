-- Eventos de misión interna del centro visibles en timeline del GC.
-- Distingue brigada/delivery de centro vs. eventos de voluntario (mission_events).

ALTER TYPE public.case_event_type ADD VALUE IF NOT EXISTS 'center_dispatched';
ALTER TYPE public.case_event_type ADD VALUE IF NOT EXISTS 'center_delivered';

COMMENT ON TYPE public.case_event_type IS
  'Eventos de dominio del caso. center_dispatched / center_delivered = avance logístico del centro (no voluntario).';
