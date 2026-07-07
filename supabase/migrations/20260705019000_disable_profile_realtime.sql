-- FARO — High Severity Remediation A-08
-- Remove profiles/coordinator_profiles from realtime publication.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'coordinator_profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.coordinator_profiles;
  END IF;
END
$$;
