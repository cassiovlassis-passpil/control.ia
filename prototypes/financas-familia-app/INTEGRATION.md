# Frontend integration status

The UI is based on draft PR #1 `cassiovlassis-passpil/control.ia`, source HEAD `1782d1c919899fe5818302c27d036fcf77789824`. The PR itself is a static prototype. The local app now targets the isolated Supabase contract in `supabase/CONTRACT.md` and `supabase/migrations/20261121000100_financas_familia_core.sql`.

## Frontend behavior

- Supabase Auth password sign-in/out uses only the browser publishable key. No service-role key is present in frontend code.
- Reads `household_members`, `households`, `categories` and `entries`; translates database `credit/debit` to UI credit/expense and uses per-household `display_name` for member labels.
- Uses the selected household membership, filters date range by purchase/receipt (`occurred_on`) or due date (`due_on`), filters member/category, and limits list reads to 100 rows. Realtime listens for household-scoped entry events and reloads the active filters; the migration adds `entries` to Supabase Realtime when available.
- New single entries use `entries`; future one-off entries use `planned`. Recurrences and installments use `create_entry_series`, which materializes finite projected rows. Recurrence has an explicit end date; installments have 2–120 rows.
- The audio dialog uses browser MediaRecorder permission, uploads to `/functions/v1/audio-parse`, and shows the returned transcript and editable draft. The endpoint is draft-only; cancel/close aborts in-flight work and does not save. Explicit confirmation inserts the reviewed entry.
- Family onboarding uses `create_household` and asks for household/member display names. Owner invitation creation and acceptance use the invite RPCs and display-name input. New households receive essential categories from the migration; no category data is seeded by the frontend.
- Edit controls appear only for entries created by the signed-in user, matching the frontend-side least-privilege choice; the repository also verifies that an update returned a row. RLS remains the server-side enforcement boundary.

## Validation and remaining constraints

The schema and Edge Function remain a local proposal and were not applied to Supabase. No remote project, account data, credentials, migrations, deployment, commit, or PR were changed. The folder includes the backend contract, migration and function supplied by the backend teammate; review and test them before applying to any hosted project.

The local shell used for this frontend session has no `node`/`npm` executable, so I could not run the Next typecheck/build here. The app's `tsconfig.json` excludes `supabase/functions` from Next compilation; validate the Deno function separately with Deno. UI end-to-end behavior still needs testing against a disposable local Supabase stack, especially Auth email confirmation, cross-household RLS, Realtime availability, and audio parser configuration.
