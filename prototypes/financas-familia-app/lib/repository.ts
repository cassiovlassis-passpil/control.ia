import { getSupabase } from './supabase';
import type { DashboardData, DashboardQuery, EntryDraft, EntryKind } from './types';

export class NoHouseholdError extends Error { constructor() { super('Sua conta ainda não está associada a uma família.'); this.name = 'NoHouseholdError'; } }
const toDbKind = (kind: EntryKind) => kind === 'income' ? 'credit' : 'debit';
const fromDbKind = (kind: string): EntryKind => kind === 'credit' ? 'income' : 'expense';

export async function getDashboard(query: DashboardQuery): Promise<DashboardData> {
  const db = getSupabase();
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Faça login para visualizar os dados da família.');
  const { data: membershipRows, error: membershipError } = await db.from('household_members').select('household_id,user_id,display_name,role,joined_at,households(name)').eq('user_id', auth.user.id).order('joined_at', { ascending: true });
  if (membershipError) throw membershipError;
  if (!membershipRows?.length) throw new NoHouseholdError();
  const memberships = membershipRows as Array<{ household_id: string; user_id: string; display_name: string; role: 'owner' | 'member'; households: { name: string } | Array<{ name: string }> | null }>;
  const households = memberships.map(row => ({ id: row.household_id, name: (Array.isArray(row.households) ? row.households[0]?.name : row.households?.name) ?? 'Família' }));
  const chosen = memberships.find(row => row.household_id === query.householdId) ?? (query.householdId ? null : memberships[0]);
  if (!chosen) throw new Error('A conta não tem acesso à família selecionada.');
  const householdId = chosen.household_id;

  let entriesQuery = db.from('entries').select('id,household_id,created_by,member_id,category_id,series_id,installment_number,installment_count,entry_kind,description,amount,occurred_on,due_on,status').eq('household_id', householdId).neq('status', 'cancelled').order(query.dateMode === 'due' ? 'due_on' : 'occurred_on', { ascending: false }).limit(100);
  entriesQuery = query.dateMode === 'due' ? entriesQuery.not('due_on', 'is', null).gte('due_on', query.from).lte('due_on', query.to) : entriesQuery.gte('occurred_on', query.from).lte('occurred_on', query.to);
  if (query.memberId !== 'all') entriesQuery = entriesQuery.eq('member_id', query.memberId);
  if (query.categoryId === 'uncategorized') entriesQuery = entriesQuery.is('category_id', null);
  else if (query.categoryId !== 'all') entriesQuery = entriesQuery.eq('category_id', query.categoryId);
  const [entries, members, categories] = await Promise.all([
    entriesQuery,
    db.from('household_members').select('user_id,display_name,joined_at').eq('household_id', householdId).order('joined_at', { ascending: true }),
    db.from('categories').select('id,name,entry_kind').eq('household_id', householdId).order('name'),
  ]);
  if (entries.error) throw entries.error;
  if (members.error) throw members.error;
  if (categories.error) throw categories.error;
  const memberNames = new Map((members.data ?? []).map((row: any) => [row.user_id, row.display_name]));
  const categoryMap = new Map((categories.data ?? []).map((row: any) => [row.id, row]));
  return {
    entries: (entries.data ?? []).map((row: any) => ({ ...row, kind: fromDbKind(row.entry_kind), member_name: memberNames.get(row.member_id) ?? 'Membro', category_name: categoryMap.get(row.category_id)?.name ?? 'Sem categoria', can_edit: row.created_by === auth.user.id, installment: row.installment_count ? { current: row.installment_number, total: row.installment_count } : null })),
    members: (members.data ?? []).map((row: any) => ({ id: row.user_id, name: row.display_name })),
    categories: (categories.data ?? []).map((row: any) => ({ id: row.id, name: row.name, kind: fromDbKind(row.entry_kind) })),
    households,
    truncated: (entries.data?.length ?? 0) === 100,
    householdId,
    canInvite: chosen.role === 'owner',
  };
}

export async function createHousehold(name: string, displayName: string): Promise<void> {
  const { error } = await getSupabase().rpc('create_household', { p_name: name.trim(), p_display_name: displayName.trim() });
  if (error) throw error;
}

export async function createHouseholdInvite(householdId: string, email: string): Promise<string> {
  const { data, error } = await getSupabase().rpc('create_household_invite', { p_household_id: householdId, p_email: email.trim() });
  if (error) throw error;
  return String(data);
}

export async function acceptHouseholdInvite(token: string, displayName: string): Promise<string> {
  const { data, error } = await getSupabase().rpc('accept_household_invite', { p_token: token, p_display_name: displayName.trim() });
  if (error) throw error;
  return String(data);
}

export async function saveEntry(draft: EntryDraft, id?: string, householdId?: string): Promise<void> {
  const db = getSupabase();
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sua sessão expirou. Entre novamente.');
  const { data: memberships, error } = await db.from('household_members').select('household_id').eq('user_id', auth.user.id).order('joined_at', { ascending: true });
  if (error) throw error;
  const home = memberships?.find((row: any) => row.household_id === householdId) ?? (householdId ? null : memberships?.[0]);
  if (!home) throw new NoHouseholdError();
  const { series, ...entry } = draft;
  if (series) {
    const { error: seriesError } = await db.rpc('create_entry_series', {
      p_household_id: home.household_id, p_kind: series.kind, p_entry_kind: toDbKind(entry.kind), p_amount: entry.amount,
      p_description: entry.description, p_category_id: entry.category_id || null, p_member_id: entry.member_id,
      p_start_date: entry.occurred_on, p_recurrence: series.kind === 'recurring' ? series.recurrence : null,
      p_interval_count: 1, p_end_date: series.kind === 'recurring' ? series.endDate : null,
      p_installment_count: series.kind === 'installments' ? series.count : null, p_due_on: entry.due_on,
    });
    if (seriesError) throw seriesError;
    return;
  }
  const payload = { household_id: home.household_id, member_id: entry.member_id, category_id: entry.category_id || null, entry_kind: toDbKind(entry.kind), status: entry.status, amount: entry.amount, description: entry.description, occurred_on: entry.occurred_on, due_on: entry.due_on };
  if (id) {
    const result = await db.from('entries').update(payload).eq('id', id).select('id').maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) throw new Error('Você não tem permissão para editar este lançamento.');
  } else {
    const result = await db.from('entries').insert(payload);
    if (result.error) throw result.error;
  }
}
