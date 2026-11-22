import { getSupabase } from './supabase';
import type { EntryKind } from './types';

export type ParsedAudioDraft = {
  transcription: string;
  draft: { description: string; amount: number; kind: EntryKind; member_id: string; category_id: string | null; occurred_on: string; due_on: string | null };
};

export async function parseAudio(blob: Blob, householdId: string, signal: AbortSignal): Promise<ParsedAudioDraft> {
  const { data: { session }, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  if (!session) throw new Error('Entre novamente antes de enviar o áudio.');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Configure a conexão Supabase para enviar o áudio.');
  const form = new FormData();
  form.append('household_id', householdId);
  form.append('audio', blob, `recording.${blob.type.includes('mp4') ? 'm4a' : 'webm'}`);
  const response = await fetch(`${url.replace(/\/$/, '')}/functions/v1/audio-parse`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, apikey: key }, body: form, signal });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const reason = payload && typeof payload.error === 'string' ? payload.error : '';
    if (response.status === 401) throw new Error('Sua sessão expirou. Entre novamente.');
    if (response.status === 403) throw new Error('A conta não tem acesso à família selecionada.');
    throw new Error(reason === 'audio_parser_unavailable' ? 'O serviço de interpretação está indisponível.' : 'Não foi possível interpretar o áudio. Tente novamente.');
  }
  const value: unknown = await response.json();
  if (!value || typeof value !== 'object') throw new Error('A resposta do áudio veio em formato inválido.');
  const result = value as { transcript?: unknown; draft?: Record<string, unknown>; requires_confirmation?: unknown };
  if (result.requires_confirmation !== true || typeof result.transcript !== 'string' || !result.draft || typeof result.draft.description !== 'string' || !Number.isFinite(result.draft.amount) || !['credit', 'debit'].includes(String(result.draft.entry_kind)) || typeof result.draft.member_id !== 'string' || typeof result.draft.occurred_on !== 'string') throw new Error('A resposta do áudio não contém um rascunho válido.');
  return { transcription: result.transcript, draft: { description: result.draft.description, amount: Number(result.draft.amount), kind: result.draft.entry_kind === 'credit' ? 'income' : 'expense', member_id: result.draft.member_id, category_id: typeof result.draft.category_id === 'string' ? result.draft.category_id : null, occurred_on: result.draft.occurred_on, due_on: typeof result.draft.due_on === 'string' ? result.draft.due_on : null } };
}
