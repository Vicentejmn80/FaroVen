-- FARO: awaiting_center_confirmation + backfill reportes stuck tras Abrir Caso
-- ============================================================
-- 1) Nueva etapa: caso propuesto a centro, aún no ASIGNADO
-- 2) Backfill: reportes pending con case ligado vía metadata.report_id → converted
-- ============================================================

ALTER TYPE pipeline_stage ADD VALUE IF NOT EXISTS 'awaiting_center_confirmation';

DO $$ BEGIN
  ALTER TYPE case_event_type ADD VALUE IF NOT EXISTS 'case_awaiting_center';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE case_event_type ADD VALUE IF NOT EXISTS 'case_center_confirmed';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill: reportes que quedaron en bandeja porque markConverted falló
-- (p.ej. convert crítico con doble transición a pending_review).
UPDATE public.reports r
SET
  status = 'converted',
  reviewed_at = COALESCE(r.reviewed_at, now()),
  review_notes = COALESCE(
    r.review_notes,
    'Backfill: marcado converted — caso operativo ya existía (FARO flow stabilization)'
  )
FROM public.cases c
WHERE
  r.status IN ('pending', 'under_review', 'reviewing')
  AND c.metadata->>'report_id' = r.id::text
  AND c.pipeline_stage IS DISTINCT FROM 'archived';
