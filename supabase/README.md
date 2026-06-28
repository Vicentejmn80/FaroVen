# Supabase migrations — FaroVen

This folder contains idempotent migrations to bootstrap the core schema and keep compatibility with a manually-created `hospitals` table.

## Migrations

1. `20260628151600_core_schema_reconcile.sql`
   - Creates extensions, enums, core tables and indexes.
   - Reconciles `hospitals` by adding missing columns with `ADD COLUMN IF NOT EXISTS`.
2. `20260628151700_search_person_rpc.sql`
   - Creates/updates `search_person` RPC used by frontend search.
3. `20260628151800_rls_public_access.sql`
   - Enables minimal RLS: public read + anonymous report inserts.
4. `20260628152000_seed_demo_data.sql`
   - Inserts demo hospitals, shelters, needs and persons for MVP testing.
5. `20260628153000_bulletins_and_feed.sql`
   - Creates verified flash bulletins + RLS + sample bulletins for Home feed.
6. `20260628154000_anchors_and_volunteer_updates.sql`
   - Marks anchor sites, enables volunteer need updates (INSERT/UPDATE).

## Apply now (Supabase SQL Editor)

Because the local Supabase MCP/CLI may be unavailable, apply manually in this order:

1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/gfngmbbotqzzchjzgajo/sql/new)
2. Run migration 1.
3. Run migration 2.
4. Run migration 3.
5. Run migration 4 (seed data).
6. Run migration 5 (bulletins feed).
7. Run migration 6 (anchors + volunteer updates).

## Validate from frontend

Run from `frontend/`:

```bash
npm run db:check-core
```

Expected result:

- `OK hospitals`
- `OK shelters`
- `OK supply_centers`
- `OK needs`
- `OK reports_insert_permission`
- `OK search_person_rpc`
