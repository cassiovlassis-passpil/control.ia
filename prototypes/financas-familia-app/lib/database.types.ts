export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type Relation = { foreignKeyName: string; columns: string[]; isOneToOne: boolean; referencedRelation: string; referencedColumns: string[] };
type Table<Row, Insert, Update, Relationships extends Relation[] = []> = { Row: Row; Insert: Insert; Update: Update; Relationships: Relationships };

export type Database = {
  public: {
    Tables: {
      households: Table<{ id: string; name: string; created_by: string; created_at: string }, { id?: string; name: string; created_by?: string; created_at?: string }, { name?: string }>;
      household_members: Table<{ household_id: string; user_id: string; display_name: string; role: 'owner' | 'member'; joined_at: string }, { household_id: string; user_id: string; display_name?: string; role?: 'owner' | 'member'; joined_at?: string }, { display_name?: string }, [{ foreignKeyName: 'household_members_household_id_fkey'; columns: ['household_id']; isOneToOne: false; referencedRelation: 'households'; referencedColumns: ['id'] }] >;
      categories: Table<{ id: string; household_id: string; name: string; entry_kind: 'credit' | 'debit'; created_at: string }, { id?: string; household_id: string; name: string; entry_kind: 'credit' | 'debit'; created_at?: string }, { name?: string; entry_kind?: 'credit' | 'debit' }>;
      entry_series: Table<{ id: string; household_id: string; created_by: string; kind: 'recurring' | 'installments'; entry_kind: 'credit' | 'debit'; amount: number; description: string; category_id: string | null; member_id: string; start_date: string; due_on: string | null; recurrence: 'week' | 'month' | 'year' | null; interval_count: number; end_date: string | null; installment_count: number | null; created_at: string }, never, never>;
      entries: Table<{ id: string; household_id: string; created_by: string; member_id: string; category_id: string | null; series_id: string | null; installment_number: number | null; installment_count: number | null; entry_kind: 'credit' | 'debit'; status: 'planned' | 'posted' | 'cancelled'; amount: number; description: string; occurred_on: string; due_on: string | null; created_at: string }, { id?: string; household_id: string; created_by?: string; member_id: string; category_id?: string | null; series_id?: string | null; installment_number?: number | null; installment_count?: number | null; entry_kind: 'credit' | 'debit'; status?: 'planned' | 'posted' | 'cancelled'; amount: number; description: string; occurred_on: string; due_on?: string | null; created_at?: string }, { member_id?: string; category_id?: string | null; entry_kind?: 'credit' | 'debit'; status?: 'planned' | 'posted' | 'cancelled'; amount?: number; description?: string; occurred_on?: string; due_on?: string | null }>;
    };
    Views: {
      entry_aggregates: { Row: { household_id: string; occurred_on: string; due_on: string | null; member_id: string; category_id: string | null; entry_kind: 'credit' | 'debit'; status: 'planned' | 'posted' | 'cancelled'; entry_count: number; total_amount: number }; Relationships: [] };
    };
    Functions: {
      create_household: { Args: { p_name: string; p_display_name?: string | null }; Returns: string };
      create_household_invite: { Args: { p_household_id: string; p_email: string }; Returns: string };
      accept_household_invite: { Args: { p_token: string; p_display_name?: string | null }; Returns: string };
      create_entry_series: { Args: { p_household_id: string; p_kind: 'recurring' | 'installments'; p_entry_kind: 'credit' | 'debit'; p_amount: number; p_description: string; p_category_id: string | null; p_member_id: string; p_start_date: string; p_recurrence?: 'week' | 'month' | 'year' | null; p_interval_count?: number; p_end_date?: string | null; p_installment_count?: number | null; p_due_on?: string | null }; Returns: string };
    };
    Enums: { household_role: 'owner' | 'member'; entry_kind: 'credit' | 'debit'; entry_status: 'planned' | 'posted' | 'cancelled'; series_kind: 'recurring' | 'installments'; recurrence_unit: 'week' | 'month' | 'year' };
    CompositeTypes: { [_ in never]: never };
  };
};
