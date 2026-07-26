-- Add case_applications to supabase_realtime publication
-- Without this, the GC's modal never auto-refreshes when a volunteer applies

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'case_applications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE case_applications;
  END IF;
END $$;
