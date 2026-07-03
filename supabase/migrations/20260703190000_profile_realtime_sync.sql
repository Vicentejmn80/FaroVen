-- Realtime para sincronización de rol (profiles + coordinator_profiles)
-- Idempotente.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'coordinator_profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.coordinator_profiles;
  END IF;
END
$$;
