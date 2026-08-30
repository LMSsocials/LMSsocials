# Supabase setup

1. Create a Supabase project.
2. Run `migrations/202608270001_initial_schema.sql` in the Supabase SQL Editor.
3. Under Authentication URL Configuration, add `http://localhost:5173/**`.
4. Copy `.env.example` to `.env.local` and add the project URL and publishable key.
5. Restart `npm run dev`.

Never put a secret/service-role key in a `VITE_` variable; Vite exposes those
variables to browser code.
