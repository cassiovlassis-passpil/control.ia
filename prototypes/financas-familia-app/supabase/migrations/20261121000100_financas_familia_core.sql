-- Finanças Família backend baseline. Apply only to a dedicated project after review.
begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create type public.household_role as enum ('owner', 'member');
create type public.entry_kind as enum ('credit', 'debit');
create type public.entry_status as enum ('planned', 'posted', 'cancelled');
create type public.series_kind as enum ('recurring', 'installments');
create type public.recurrence_unit as enum ('week', 'month', 'year');

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'Membro' check (char_length(btrim(display_name)) between 1 and 80),
  role public.household_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  entry_kind public.entry_kind not null,
  created_at timestamptz not null default now(),
  unique (household_id, id),
  unique (household_id, entry_kind, name)
);

create table public.entry_series (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  kind public.series_kind not null,
  entry_kind public.entry_kind not null,
  amount numeric(12,2) not null check (amount > 0 and amount <= 9999999999.99),
  description text not null check (char_length(btrim(description)) between 1 and 160),
  category_id uuid,
  member_id uuid not null,
  start_date date not null,
  due_on date,
  recurrence public.recurrence_unit,
  interval_count integer not null default 1 check (interval_count between 1 and 24),
  end_date date,
  installment_count integer,
  created_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, category_id) references public.categories(household_id, id),
  foreign key (household_id, member_id) references public.household_members(household_id, user_id),
  check (due_on is null or due_on >= start_date),
  check (
    (kind = 'recurring' and recurrence is not null and end_date is not null and installment_count is null and end_date >= start_date)
    or
    (kind = 'installments' and recurrence is null and end_date is null and installment_count between 2 and 120)
  )
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  member_id uuid not null,
  category_id uuid,
  series_id uuid,
  installment_number integer,
  installment_count integer,
  entry_kind public.entry_kind not null,
  status public.entry_status not null default 'posted',
  amount numeric(12,2) not null check (amount > 0 and amount <= 9999999999.99),
  description text not null check (char_length(btrim(description)) between 1 and 160),
  occurred_on date not null,
  due_on date,
  created_at timestamptz not null default now(),
  foreign key (household_id, category_id) references public.categories(household_id, id),
  foreign key (household_id, member_id) references public.household_members(household_id, user_id),
  foreign key (household_id, series_id) references public.entry_series(household_id, id),
  check ((series_id is null and installment_number is null and installment_count is null)
      or (series_id is not null and installment_number between 1 and installment_count and installment_count between 2 and 120)),
  check (due_on is null or due_on >= occurred_on),
  unique (series_id, installment_number)
);

create index entries_household_date_idx on public.entries (household_id, occurred_on desc);
create index entries_household_due_date_idx on public.entries (household_id, due_on desc) where due_on is not null;
create index entries_household_member_date_idx on public.entries (household_id, member_id, occurred_on desc);
create index entries_household_category_date_idx on public.entries (household_id, category_id, occurred_on desc);
create index household_members_user_idx on public.household_members (user_id, household_id);

-- This narrowly scoped SECURITY DEFINER helper reads only membership and always binds to auth.uid().
-- It lives outside exposed schemas, pins search_path, and is executable only by authenticated users.
create or replace function private.is_household_member(p_household_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.household_members hm
    where hm.household_id = p_household_id and hm.user_id = auth.uid()
  );
$$;
revoke all on function private.is_household_member(uuid) from public, anon;
grant execute on function private.is_household_member(uuid) to authenticated;

create or replace function private.is_household_owner(p_household_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.household_members hm
    where hm.household_id = p_household_id and hm.user_id = auth.uid() and hm.role = 'owner'
  );
$$;
revoke all on function private.is_household_owner(uuid) from public, anon;
grant execute on function private.is_household_owner(uuid) to authenticated;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.categories enable row level security;
alter table public.entry_series enable row level security;
alter table public.entries enable row level security;

create policy household_member_read on public.households for select to authenticated
  using ((select private.is_household_member(id)));
create policy household_owner_update on public.households for update to authenticated
  using ((select private.is_household_owner(id)))
  with check ((select private.is_household_owner(id)));

create policy membership_read on public.household_members for select to authenticated
  using ((select private.is_household_member(household_id)));
create policy membership_self_name_update on public.household_members for update to authenticated
  using (user_id = (select auth.uid()) and (select private.is_household_member(household_id)))
  with check (user_id = (select auth.uid()) and (select private.is_household_member(household_id)));
-- Membership is changed only by the owner invite/accept RPCs below, never by a client INSERT.

create policy categories_member_all on public.categories for all to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));
create policy series_member_read on public.entry_series for select to authenticated
  using ((select private.is_household_member(household_id)));
create policy entries_member_read on public.entries for select to authenticated
  using ((select private.is_household_member(household_id)));
create policy entries_insert_own on public.entries for insert to authenticated
  with check ((select private.is_household_member(household_id)) and created_by = (select auth.uid()) and series_id is null);
create policy entries_update_member on public.entries for update to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));
create policy entries_delete_one_off on public.entries for delete to authenticated
  using ((select private.is_household_member(household_id)) and series_id is null);

-- Family members can edit shared ledger content, but cannot move, re-author, or reshape a generated series row.
create or replace function private.prevent_entry_identity_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.household_id is distinct from old.household_id
     or new.created_by is distinct from old.created_by
     or new.series_id is distinct from old.series_id
     or new.installment_number is distinct from old.installment_number
     or new.installment_count is distinct from old.installment_count then
    raise exception 'entry identity fields are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.prevent_entry_identity_change() from public, anon, authenticated;
create trigger entries_identity_immutable before update on public.entries
  for each row execute function private.prevent_entry_identity_change();

grant select on public.households to authenticated;
grant update (name) on public.households to authenticated;
grant select on public.household_members, public.entry_series to authenticated;
grant update (display_name) on public.household_members to authenticated;
grant select, insert, update, delete on public.categories, public.entries to authenticated;
revoke insert, update, delete on public.household_members from authenticated;
grant update (display_name) on public.household_members to authenticated;
revoke insert on public.households from authenticated;
revoke insert, update, delete on public.entry_series from authenticated;
revoke all on public.households, public.household_members, public.categories,
  public.entry_series, public.entries from anon;

-- Atomic authenticated household bootstrap; never accepts a caller-supplied user ID.
create or replace function public.create_household(p_name text, p_display_name text default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_household_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 80 then
    raise exception 'invalid household name' using errcode = '22023';
  end if;
  insert into public.households(name, created_by) values (btrim(p_name), auth.uid()) returning id into v_household_id;
  insert into public.household_members(household_id, user_id, display_name, role)
  values (v_household_id, auth.uid(), coalesce(nullif(btrim(p_display_name), ''), 'Responsável'), 'owner');
  insert into public.categories(household_id, name, entry_kind) values
    (v_household_id, 'Alimentação', 'debit'), (v_household_id, 'Moradia', 'debit'),
    (v_household_id, 'Transporte', 'debit'), (v_household_id, 'Saúde', 'debit'),
    (v_household_id, 'Lazer', 'debit'), (v_household_id, 'Outros', 'debit'),
    (v_household_id, 'Salário', 'credit'), (v_household_id, 'Outros', 'credit');
  return v_household_id;
end;
$$;
revoke all on function public.create_household(text,text) from public, anon;
grant execute on function public.create_household(text,text) to authenticated;

-- Owner-only invitation workflow. Tokens are random UUIDs with expiry and single-use acceptance.
create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  invited_email text not null check (char_length(btrim(invited_email)) between 3 and 254),
  token uuid not null unique default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.household_invites enable row level security;
create policy invite_owner_read on public.household_invites for select to authenticated
  using ((select private.is_household_owner(household_id)));
grant select on public.household_invites to authenticated;
revoke all on public.household_invites from anon;

create or replace function public.create_household_invite(p_household_id uuid, p_email text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_token uuid;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if not private.is_household_owner(p_household_id) then raise exception 'not household owner' using errcode = '42501'; end if;
  if p_email is null or position('@' in btrim(p_email)) < 2 or char_length(btrim(p_email)) > 254 then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  insert into public.household_invites(household_id, invited_email, created_by)
  values (p_household_id, lower(btrim(p_email)), auth.uid()) returning token into v_token;
  return v_token;
end;
$$;
revoke all on function public.create_household_invite(uuid, text) from public, anon;
grant execute on function public.create_household_invite(uuid, text) to authenticated;

create or replace function public.accept_household_invite(p_token uuid, p_display_name text default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_invite public.household_invites%rowtype; v_email text;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '28000'; end if;
  select u.email into v_email from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null;
  if v_email is null then raise exception 'verified email required' using errcode = '42501'; end if;
  select * into v_invite from public.household_invites i
   where i.token = p_token and i.accepted_at is null and i.expires_at > now()
   for update;
  if not found or lower(v_invite.invited_email) <> lower(v_email) then
    raise exception 'invite unavailable' using errcode = '42501';
  end if;
  insert into public.household_members(household_id, user_id, display_name, role)
  values (v_invite.household_id, auth.uid(), coalesce(nullif(btrim(p_display_name), ''), 'Membro'), 'member')
  on conflict (household_id, user_id) do update set display_name = excluded.display_name;
  update public.household_invites set accepted_at = now(), accepted_by = auth.uid() where id = v_invite.id;
  return v_invite.household_id;
end;
$$;
revoke all on function public.accept_household_invite(uuid,text) from public, anon;
grant execute on function public.accept_household_invite(uuid,text) to authenticated;

-- Create a finite schedule atomically. Recurrence requires a finite end date; max 120 rows.
create or replace function public.create_entry_series(
  p_household_id uuid, p_kind public.series_kind, p_entry_kind public.entry_kind,
  p_amount numeric, p_description text, p_category_id uuid, p_member_id uuid,
  p_start_date date, p_recurrence public.recurrence_unit default null,
  p_interval_count integer default 1, p_end_date date default null,
  p_installment_count integer default null, p_due_on date default null
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_series_id uuid; v_date date; v_due_date date; v_n integer := 0; v_count integer;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if not private.is_household_member(p_household_id) then raise exception 'household access denied' using errcode = '42501'; end if;
  if p_start_date is null or p_member_id is null or p_entry_kind is null or p_kind is null then raise exception 'missing required series fields' using errcode = '22023'; end if;
  if p_due_on is not null and p_due_on < p_start_date then raise exception 'due date cannot precede occurrence date' using errcode = '22023'; end if;
  if p_interval_count is null or p_interval_count not between 1 and 24 then raise exception 'invalid recurrence interval' using errcode = '22023'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 9999999999.99 then raise exception 'invalid amount' using errcode = '22023'; end if;
  if p_description is null or char_length(btrim(p_description)) not between 1 and 160 then raise exception 'invalid description' using errcode = '22023'; end if;
  if not exists (select 1 from public.household_members hm where hm.household_id=p_household_id and hm.user_id=p_member_id)
    then raise exception 'invalid member' using errcode = '22023'; end if;
  if p_category_id is not null and not exists (select 1 from public.categories c where c.id=p_category_id and c.household_id=p_household_id and c.entry_kind=p_entry_kind)
    then raise exception 'invalid category' using errcode = '22023'; end if;
  if p_kind = 'recurring' then
    if p_recurrence is null or p_end_date is null or p_end_date < p_start_date or p_installment_count is not null
      then raise exception 'invalid recurrence range' using errcode = '22023'; end if;
  else
    if p_recurrence is not null or p_end_date is not null or p_installment_count not between 2 and 120
      then raise exception 'invalid installment count' using errcode = '22023'; end if;
  end if;
  insert into public.entry_series(household_id, created_by, kind, entry_kind, amount, description, category_id, member_id,
      start_date, due_on, recurrence, interval_count, end_date, installment_count)
  values (p_household_id, auth.uid(), p_kind, p_entry_kind, p_amount, btrim(p_description), p_category_id, p_member_id,
      p_start_date, p_due_on, p_recurrence, coalesce(p_interval_count,1), p_end_date, p_installment_count)
  returning id into v_series_id;
  if p_kind = 'installments' then
    v_count := p_installment_count;
    for v_n in 1..v_count loop
      insert into public.entries(household_id, created_by, member_id, category_id, series_id, installment_number, installment_count,
        entry_kind, status, amount, description, occurred_on, due_on)
      values (p_household_id, auth.uid(), p_member_id, p_category_id, v_series_id, v_n, v_count, p_entry_kind, 'planned',
        p_amount, btrim(p_description), (p_start_date + make_interval(months => v_n - 1))::date,
        case when p_due_on is null then null else (p_due_on + make_interval(months => v_n - 1))::date end);
    end loop;
  else
    v_date := p_start_date;
    v_due_date := p_due_on;
    while v_date <= p_end_date and v_n < 120 loop
      v_n := v_n + 1;
      insert into public.entries(household_id, created_by, member_id, category_id, series_id, entry_kind, status, amount, description, occurred_on, due_on)
      values (p_household_id, auth.uid(), p_member_id, p_category_id, v_series_id, p_entry_kind, 'planned', p_amount, btrim(p_description), v_date, v_due_date);
      v_date := case p_recurrence
        when 'week' then (v_date + make_interval(weeks => p_interval_count))::date
        when 'month' then (v_date + make_interval(months => p_interval_count))::date
        when 'year' then (v_date + make_interval(years => p_interval_count))::date
      end;
      if v_due_date is not null then
        v_due_date := case p_recurrence
          when 'week' then (v_due_date + make_interval(weeks => p_interval_count))::date
          when 'month' then (v_due_date + make_interval(months => p_interval_count))::date
          when 'year' then (v_due_date + make_interval(years => p_interval_count))::date
        end;
      end if;
    end loop;
    if v_date <= p_end_date then raise exception 'recurrence exceeds 120 occurrences' using errcode = '22023'; end if;
  end if;
  return v_series_id;
end;
$$;
revoke all on function public.create_entry_series(uuid,public.series_kind,public.entry_kind,numeric,text,uuid,uuid,date,public.recurrence_unit,integer,date,integer,date) from public, anon;
grant execute on function public.create_entry_series(uuid,public.series_kind,public.entry_kind,numeric,text,uuid,uuid,date,public.recurrence_unit,integer,date,integer,date) to authenticated;

-- Summary rows retain all chart dimensions so UI can filter member/category/date without arbitrary SQL.
create or replace view public.entry_aggregates with (security_invoker = true) as
select household_id, occurred_on, due_on, member_id, category_id, entry_kind, status,
       count(*)::bigint as entry_count, sum(amount)::numeric(14,2) as total_amount
from public.entries
group by household_id, occurred_on, due_on, member_id, category_id, entry_kind, status;
grant select on public.entry_aggregates to authenticated;
revoke all on public.entry_aggregates from anon;

-- Keep Realtime optional in bare Postgres but enable it in Supabase stacks that provide the publication.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'entries') then
    alter publication supabase_realtime add table public.entries;
  end if;
end $$;

commit;
