'use client';

import { useState } from 'react';
import type { DashboardData, Entry, EntryKind } from '@/lib/types';

export function EntryDialog({ data, entry, onClose, onSubmit }: { data: DashboardData; entry: Entry | null; onClose: () => void; onSubmit: (form: HTMLFormElement) => void }) {
  const [kind, setKind] = useState<EntryKind>(entry?.kind ?? 'expense');
  const [categoryId, setCategoryId] = useState(entry?.category_id ?? '');
  const localToday = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
  return <div className="backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="entry-title"><div className="dialog-title"><h2 id="entry-title">{entry ? 'Editar lançamento' : 'Novo lançamento'}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">×</button></div>
    {entry?.series_id && <p className="notice">Este lançamento pertence a uma programação. A edição altera somente esta ocorrência; o restante da série permanece como está.</p>}
    <form onSubmit={e => { e.preventDefault(); onSubmit(e.currentTarget); }} className="form-grid">
      <label>Descrição<input name="description" defaultValue={entry?.description} required maxLength={160}/></label>
      <label>Valor (R$)<input name="amount" type="number" min="0.01" step="0.01" defaultValue={entry?.amount} required/></label>
      <label>Tipo<select name="kind" value={kind} onChange={event => { const nextKind = event.target.value as EntryKind; setKind(nextKind); if (categoryId && !data.categories.some(category => category.id === categoryId && category.kind === nextKind)) setCategoryId(''); }}><option value="expense">Despesa</option><option value="income">Crédito</option></select></label>
      <label>Membro<select name="memberId" required defaultValue={entry?.member_id ?? data.members[0]?.id}>{data.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <label>Categoria<select name="categoryId" value={categoryId} onChange={event => setCategoryId(event.target.value)}><option value="">Sem categoria</option>{data.categories.filter(c => c.kind === kind).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Compra/recebimento<input name="date" type="date" defaultValue={entry?.occurred_on ?? localToday} required/></label>
      <label>Vencimento<input name="dueOn" type="date" defaultValue={entry?.due_on ?? ''}/></label>
      {!entry?.series_id && <>
        <label>Recorrência<select name="recurrence" defaultValue=""><option value="">Sem recorrência</option><option value="week">Semanal</option><option value="month">Mensal</option><option value="year">Anual</option></select></label>
        <label>Fim da recorrência<input name="recurrenceEndDate" type="date" min={entry?.occurred_on ?? new Date().toISOString().slice(0, 10)}/></label>
        <label>Total de parcelas<input name="installmentCount" type="number" min="2" max="120"/></label>
      </>}
      <label className="check"><input name="future" type="checkbox" defaultChecked={entry?.status === 'planned'}/> Crédito/despesa futura</label>
      <div className="dialog-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary">Salvar</button></div>
    </form>
  </section></div>;
}
