'use client';

import { useEffect, useRef, useState } from 'react';
import { parseAudio, type ParsedAudioDraft } from '@/lib/audio';
import type { DashboardData, EntryDraft } from '@/lib/types';

export function AudioDialog({ data, onClose, onConfirm }: { data: DashboardData; onClose: () => void; onConfirm: (draft: EntryDraft) => Promise<void> }) {
  const [recording, setRecording] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [parsed, setParsed] = useState<ParsedAudioDraft | null>(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<EntryDraft['kind']>('expense');
  const [member, setMember] = useState('');
  const [category, setCategory] = useState('');
  const [dueOn, setDueOn] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const abort = useRef<AbortController | null>(null);
  const cancelled = useRef(false);

  function cleanup() {
    cancelled.current = true;
    abort.current?.abort();
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
  }
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', onKey); return () => { window.removeEventListener('keydown', onKey); cleanup(); }; }, []);

  async function start() {
    cancelled.current = false;
    setError(''); setParsed(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Este navegador não oferece gravação de áudio.');
      const input = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = input;
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
      const media = new MediaRecorder(input, mimeType ? { mimeType } : undefined);
      recorder.current = media;
      const chunks: BlobPart[] = [];
      media.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      media.onerror = () => setError('A gravação foi interrompida. Tente novamente.');
      media.onstop = async () => {
        input.getTracks().forEach(track => track.stop()); stream.current = null; setRecording(false);
        if (cancelled.current) return;
        if (!chunks.length) { setError('Nenhum áudio foi capturado. Grave novamente.'); return; }
        setParsing(true); abort.current = new AbortController();
        try {
          const type = media.mimeType.includes('mp4') ? 'audio/mp4' : media.mimeType.includes('ogg') ? 'audio/ogg' : 'audio/webm';
          const result = await parseAudio(new Blob(chunks, { type }), data.householdId, abort.current.signal);
          setParsed(result); setDescription(result.draft.description); setAmount(String(result.draft.amount)); setKind(result.draft.kind);
          setMember(result.draft.member_id || data.members[0]?.id || ''); setCategory(result.draft.category_id || data.categories.find(c => c.kind === result.draft.kind)?.id || ''); setDueOn(result.draft.due_on ?? '');
        } catch (cause) { if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(cause instanceof Error ? cause.message : 'Falha ao interpretar o áudio.'); }
        finally { if (!cancelled.current) setParsing(false); }
      };
      media.start(); setRecording(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível iniciar a gravação.'); inputCleanup(); }
  }
  function inputCleanup() { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; }

  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!parsed || saving) return;
    setSaving(true); setError('');
    try { await onConfirm({ member_id: member, category_id: category || null, kind, description: description.trim(), amount: Number(amount), occurred_on: parsed.draft.occurred_on || new Date().toISOString().slice(0, 10), due_on: dueOn || null, status: 'posted' }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o lançamento.'); }
    finally { setSaving(false); }
  }

  return <div className="backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="audio-title"><div className="dialog-title"><h2 id="audio-title">Novo lançamento por áudio</h2><button className="icon-button" onClick={onClose} aria-label="Fechar">×</button></div>
    <p className="muted">A gravação pede permissão do microfone. Ao parar, o áudio é enviado ao serviço de interpretação; nada será salvo no histórico até você confirmar.</p>
    {!parsed && <div className="audio-controls"><button className="button primary" onClick={recording ? () => recorder.current?.stop() : () => void start()} disabled={parsing}>{recording ? 'Parar e interpretar' : 'Permitir microfone e gravar'}</button>{recording && <span role="status">Gravando…</span>}{parsing && <span role="status" aria-live="polite">Enviando e interpretando…</span>}</div>}
    {error && <p className="error" role="alert">{error}</p>}
    {parsed && <form onSubmit={confirm} className="form-grid"><label className="full">Transcrição<textarea value={parsed.transcription} readOnly rows={3}/></label><label>Descrição<input value={description} onChange={e => setDescription(e.target.value)} required maxLength={160}/></label><label>Valor (R$)<input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required/></label><label>Tipo<select value={kind} onChange={e => { const nextKind = e.target.value as EntryDraft['kind']; setKind(nextKind); if (category && !data.categories.some(item => item.id === category && item.kind === nextKind)) setCategory(''); }}><option value="expense">Despesa</option><option value="income">Crédito</option></select></label><label>Membro<select value={member} onChange={e => setMember(e.target.value)} required>{data.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>Categoria<select value={category} onChange={e => setCategory(e.target.value)}><option value="">Sem categoria</option>{data.categories.filter(c => c.kind === kind).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Compra/recebimento<input type="date" value={parsed.draft.occurred_on} readOnly/></label><label>Vencimento<input type="date" value={dueOn} onChange={e => setDueOn(e.target.value)}/></label><div className="dialog-actions"><button type="button" className="button secondary" onClick={onClose} disabled={saving}>Cancelar e descartar</button><button className="button primary" disabled={saving || !member}>{saving ? 'Salvando…' : 'Confirmar lançamento'}</button></div></form>}
  </section></div>;
}
