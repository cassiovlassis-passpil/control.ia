# Frontend integration status

The UI is based on draft PR #1 `cassiovlassis-passpil/control.ia`, source HEAD `1782d1c919899fe5818302c27d036fcf77789824`. The PR itself is a static prototype. The Next.js app is in draft PR #2 and targets the isolated Supabase contract in `supabase/CONTRACT.md` and `supabase/migrations/20261121000100_financas_familia_core.sql`.

## Hosted integration status (2026-11-22)

- Supabase project `ACOMPANH.AI` (`dhubfibzsrzxyfohrhoc`) is active; migration `financas_familia_core` is applied.
- `audio-parse` is active with JWT verification enabled. Version 3 reads `OPENAI_MODEL` (with legacy `OPENAI_PARSE_MODEL` fallback) and accepts the built-in publishable-key environment map.
- Secrets `OPENAI_API_KEY`, `OPENAI_MODEL=gpt-6-luna` and `APP_ORIGIN=https://financas-familia-prototipo.vercel.app` are configured server-side; no secret value is in this repository.
- HTTP smoke checks: allowed-origin preflight returned 204, an unapproved origin returned 403, and a POST without a user session returned 401. The OpenAI account exposes `gpt-6-luna`.
- The Vercel project `financas-familia-prototipo` has no configured environment variables. PR #2 remains a draft; no production deployment or alias change was made.

## Frontend behavior

- Supabase Auth password sign-in/out uses only the browser publishable key. No service-role key is present in frontend code.
- Reads `household_members`, `households`, `categories` and `entries`; translates database `credit/debit` to UI credit/expense and uses per-household `display_name` for member labels.
- Uses the selected household membership, filters date range by purchase/receipt (`occurred_on`) or due date (`due_on`), filters member/category, and limits list reads to 100 rows. Realtime listens for household-scoped entry events and reloads the active filters; the migration adds `entries` to Supabase Realtime when available.
- New single entries use `entries`; future one-off entries use `planned`. Recurrences and installments use `create_entry_series`, which materializes finite projected rows. Recurrence has an explicit end date; installments have 2â€“120 rows.
- The audio dialog uses browser MediaRecorder permission, uploads to `/functions/v1/audio-parse`, and shows the returned transcript and editable draft. The endpoint is draft-only; cancel/close aborts in-flight work and does not save. Explicit confirmation inserts the reviewed entry.
- Family onboarding uses `create_household` and asks for household/member display names. Owner invitation creation and acceptance use the invite RPCs and display-name input. New households receive essential categories from the migration; no category data is seeded by the frontend.
- Edit controls appear for household entries because the supplied migration's RLS permits household members to edit shared financial fields; immutable identity fields remain protected in the database. The repository also verifies that an update returned a row. RLS remains the server-side enforcement boundary.

## Validation and remaining constraints

- `npm run typecheck`, `npm run build` and `py -3 -B -m unittest discover -s tests -v` pass locally; the Python suite is static guardrail coverage (5 tests), not live RLS testing.
- Supabase accepted and activated Edge Function version 3. The Next.js `tsconfig.json` excludes `supabase/functions`; no separate local Deno check was run.
- A successful authenticated audio request has not been tested. It needs a test login in the dedicated project; no matching login is saved in the OpenBot Vault. The parser remains draft-only until the user confirms the returned fields.
- Before real users, verify cross-household RLS, Auth email confirmation, Realtime availability, rate/cost limits, backup/retention and the data-processing terms for sending audio/transcripts to OpenAI.

