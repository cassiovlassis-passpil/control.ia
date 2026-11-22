export type EntryKind = 'income' | 'expense';
export type Entry = { id: string; household_id: string; member_id: string; member_name: string; category_id: string | null; category_name: string; kind: EntryKind; description: string; amount: number; occurred_on: string; due_on: string | null; status: 'planned' | 'posted' | 'cancelled'; series_id?: string | null; can_edit: boolean; installment?: { current: number; total: number } | null };
export type Member = { id: string; name: string };
export type Category = { id: string; name: string; kind: EntryKind };
export type EntryDraft = { member_id: string; category_id: string | null; kind: EntryKind; description: string; amount: number; occurred_on: string; due_on: string | null; status: 'planned' | 'posted'; series?: { kind: 'recurring'; recurrence: 'week' | 'month' | 'year'; endDate: string } | { kind: 'installments'; count: number } | null };
export type Household = { id: string; name: string };
export type DashboardQuery = { memberId: string; categoryId: string; from: string; to: string; dateMode: 'occurred' | 'due'; householdId?: string };
export type DashboardData = { entries: Entry[]; members: Member[]; categories: Category[]; households: Household[]; truncated: boolean; householdId: string; canInvite: boolean };
