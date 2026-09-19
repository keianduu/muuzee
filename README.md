# Muuzee

Muuzee currently contains an exploratory static prototype and the first production Admin vertical slice.

## Production Admin v0

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill the Supabase values.
3. Start Supabase locally: `npx supabase start`
4. Preserve existing local data and apply new migrations: `npx supabase migration up`
5. Start Next.js: `npm run dev`
6. Open `http://localhost:3000/admin`

`npx supabase db reset` reconstructs the local database and must only be used when an intentional full rebuild is required. Do not use it to apply an ordinary forward migration to a database containing development data.

See `docs/master-data-architecture.md`, `docs/architecture.md`, `docs/data-model.md`, `docs/admin-v0.md`, and `docs/integrations/art-commons.md`.

> Admin has no authentication in v0. It is local/protected-staging only. Add Supabase Auth and Admin authorization before any production internet exposure.
