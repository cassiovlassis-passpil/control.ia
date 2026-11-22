# Backend contract for FinanÃ§as FamÃ­lia

Source reviewed: draft PR #1, `cassiovlassis-passpil/control.ia`, `prototype/financas-familia`, HEAD `1782d1c919899fe5818302c27d036fcf77789824`. The PR is static sample data and explicitly has no persistence, real transcription, recurring schedule, or installment generation. The backend baseline lives in `migrations/20261121000100_financas_familia_core.sql`; it is isolated from the source repository and has not been applied remotely.

## Architecture

- Supabase Auth supplies the signed-in user JWT. Browser code uses only `SUPABASE_URL` and the publishable key; all exposed data tables have RLS.
- PostgreSQL/PostgREST is the CRUD API. There is no custom CRUD proxy and no service-role key in the browser.
- `private.is_household_member(uuid)` and `private.is_household_owner(uuid)` are narrowly scoped `SECURITY DEFINER` membership checks in a non-exposed schema, bind authorization to `auth.uid()`, pin `search_path`, and grant execution only to `authenticated`.
- Household creation and membership invitation/acceptance use restricted RPCs. Invitation acceptance requires a confirmed Auth email matching the invite and a live single-use UUID token.
- `entries` is the shared family ledger. Any authenticated member can edit shared financial fields; `created_by`, `household_id` and generated-series identity are immutable. One-off rows can be deleted; generated schedule rows are cancelled or edited individually. `occurred_on` is the purchase/receipt date; nullable `due_on` is the due date. `entry_kind` is `credit | debit`; `status` is `planned | posted | cancelled`.
- Members are keyed by `(household_id, user_id)`. `display_name` is presentation only and never grants access; Auth user ID remains the stable `member_id` used by entries and the UI.
- `entry_series` stores finite recurrence/installment definitions. `create_entry_series` atomically materializes planned entries: installments 2â€“120; recurrences have a finite end date and at most 120 occurrences. Current recurrence units are week, month, year. Edit/delete of a whole series is not implemented.
- `categories.entry_kind` is `credit | debit`. Household creation seeds essential expense and income categories.
- `entry_aggregates` is a `security_invoker` view grouped by household, occurrence date, due date, member, category, kind and status. Filter `entries` or this view by household plus the selected `occurred_on` or `due_on` range, member and category. RLS remains active on the underlying rows.
- If `supabase_realtime` exists, the migration adds `public.entries` to it. The frontend still must subscribe and apply its household/date/member/category filters to incoming changes.

## Frontend contract

`getDashboard` may query `household_members(household_id,user_id,display_name,joined_at)`, `categories(id,household_id,name,entry_kind)`, and `entries(id,household_id,member_id,category_id,series_id,installment_number,installment_count,entry_kind,status,amount,description,occurred_on,due_on)`. Member display labels must come from `display_name` (the existing UI's generated â€œVocÃª/Membro Nâ€ fallback may be used until it reads this column). Categories are seeded at household creation.

For one-off entries, insert into `entries` after the user confirms. Omit `created_by`; the database default reads `auth.uid()`. Do not accept a client-supplied household ID as proof of access. Select the household from the user's membership and let RLS validate it again. Existing row updates/deletes are limited to the entry creator. There is no series edit/delete workflow yet.

For recurrence/installments, call `create_entry_series` with:

```json
{
  "p_household_id": "<membership household UUID>",
  "p_kind": "recurring | installments",
  "p_entry_kind": "credit | debit",
  "p_amount": 100.00,
  "p_description": "Conta mensal",
  "p_category_id": "<same-household category UUID or null>",
  "p_member_id": "<same-household auth user UUID>",
  "p_start_date": "YYYY-MM-DD",
  "p_recurrence": "week | month | year (recurring only)",
  "p_interval_count": 1,
  "p_end_date": "YYYY-MM-DD (recurring only)",
  "p_installment_count": 12,
  "p_due_on": "YYYY-MM-DD or null"
}
```

PostgREST RPC parameter names are exactly the `p_*` names above; omit unused fields or send null. This RPC performs the full set of server-side validation and returns the series UUID. All generated items start as `planned` and carry `series_id`; installment rows also carry `installment_number` and `installment_count`.

Use `supabase.functions.invoke('audio-parse', { body: formData })` or POST directly to `/functions/v1/audio-parse`. Request is multipart with `household_id` (UUID) and `audio` (audio file). The function verifies the JWT via Auth, checks household membership using the caller JWT/RLS, rejects files >10 MiB or unsupported MIME types, and returns:

```json
{
  "draft": {
    "entry_kind": "credit | debit",
    "amount": 45.00,
    "description": "Mercado",
    "occurred_on": "YYYY-MM-DD",
    "due_on": null,
    "member_id": "<authenticated user's UUID>",
    "category_id": null
  },
  "transcript": "transcribed words",
  "requires_confirmation": true
}
```

Audio parse is draft-only: it never writes a row. The UI must show the transcript, editable fields and explicit confirmation before inserting; household member/category remain user-editable. `member_id` defaults to the authenticated user and `category_id` is null because no family labels are sent to the model.

## Secrets and deployment setup

Configure these Edge Function environment values in the dedicated project:

- `SUPABASE_URL` (project URL)
- A Supabase publishable API key, taken from the built-in `SUPABASE_PUBLISHABLE_KEYS` environment map (fallbacks: `SUPABASE_ANON_KEY` or local `SUPABASE_PUBLISHABLE_KEY`); never a service-role key
- `OPENAI_API_KEY` (secret, server-side only)
- `OPENAI_MODEL` (model supporting Responses API Structured Outputs; legacy `OPENAI_PARSE_MODEL` remains a fallback)
- `OPENAI_TRANSCRIBE_MODEL` (optional; defaults to current `gpt-transcribe`)
- `APP_ORIGIN` (exact allowed browser origin, for example `https://app.example.invalid`)
- `APP_TIME_ZONE` (optional; defaults to `America/Sao_Paulo`)

The Edge Function sends the uploaded audio to OpenAI `/v1/audio/transcriptions`, then sends only the transcription text to `/v1/responses` with a strict JSON schema and `store: false`. It does not send household IDs, member IDs or category names. Review OpenAI privacy/retention terms and data processing requirements before using real audio. This repository contains placeholders only; no credential or project URL is supplied.

## Remaining integration decisions and limits

- This migration is the isolated family baseline applied to the dedicated project. Static guardrails pass, but cross-household RLS has not been exercised with two live users.
- The dedicated project has the migration applied and `audio-parse` active. Provider secret provisioning and an authenticated audio test remain pending.
- Add display-name collection to household creation/invitation onboarding. Existing `create_household` keeps a default fallback for caller compatibility; pass `p_display_name` to set it.
- UI needs date-axis selection and filters for `occurred_on` vs `due_on`, and must include `due_on` on one-off inserts and the `p_due_on` RPC argument. Existing UI files are being refactored concurrently; this contract documents the backend side.
- Secrets and model are configured in the dedicated project. Before real users, test authenticated audio, cross-household RLS, cost/rate controls, backups/retention, realtime subscriptions and OpenAI data terms. The function does not yet implement per-user rate limits or spend caps.
- The hosted migration and `audio-parse` were applied after the original review. No production deployment or alias change was made; PR #2 remains a draft.

## Local checks

From this folder, run `py -3 -B -m unittest discover -s tests -v`. This verifies static contract/guardrails only; it is not a SQL parser, Postgres execution, Deno typecheck, or end-to-end test.

## Current implementation references

- Supabase [RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security) and [API keys guide](https://supabase.com/docs/guides/getting-started/api-keys).
- Supabase [CLI v3 changelog](https://supabase.com/changelog/supabase-cli-v3): hosted-change confirmation/local-first behavior was checked; no CLI or remote command was run.
- OpenAI [audio transcription](https://developers.openai.com/api/docs/guides/speech-to-text) and [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) guides. The transcription endpoint defaults to the current `gpt-transcribe` model; the parse model is configurable.

