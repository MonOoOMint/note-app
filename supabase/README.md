# Database migrations

The files in `supabase/migrations` are the source of truth for the database
schema. Apply them before deploying application code that calls the matching
RPC functions.

For a linked Supabase CLI project:

```sh
supabase db push
```

The legacy root files `bookmark_setup.sql` and `supabase_notes.sql` are kept as
historical setup scripts; they are not a complete application schema.
