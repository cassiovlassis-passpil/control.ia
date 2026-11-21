'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { acceptHouseholdInvite, createHousehold, createHouseholdInvite, getDashboard, NoHouseholdError, saveEntry } from '@/lib/repository';
import { getSupabase } from '@/lib/supabase';
import { AudioDialog } from './audio-dialog';
import { EntryDialog } from './entry-dialog';
import type { DashboardData, Entry, EntryDraft, EntryKind } from '@/lib/types';

const dateString = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
const today = dateString(new Date());
const startOfMonth = `${today.slice(0, 7)}-01`;
const endOfMonth = dateString(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));
const blank: DashboardData = { entries: [], members: [], categories: [], households: [], truncated: false, householdId: '', canInvite: false };
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Home() {
  const [data, setData] = useState(blank);
  const [member, setMember] = useState('all');
  const [category, setCategory] = useState('all');
  const [from, setFrom] = useState(startOfMonth);
  const [to, setTo] = useState(endOfMonth);
  const [dateMode, setDateMode] = useState<'occurred' | 'due'>('occurred');
  const [householdId, setHouseholdId] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [noHousehold, setNoHousehold] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [realtimeError, setRealtimeError] = useState('');
  const [saved, setSaved] = useState('');
  const [editing, setEditing] = useState<Entry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [inviteStatus, setInviteStatus] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [inviteeName, setInviteeName] = useState('');
  const reloadRef = useRef<() => void>(() => undefined);

  async function load() {
    setLoading(true); setError('');
    try {
      const result = await getDashboard({ memberId: member, categoryId: category, from, to, dateMode, householdId: householdId || undefined });
      setData(result); setAuthenticated(true); setNoHousehold(false);
      if (!householdId) setHouseholdId(result.householdId);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Não foi possível carregar os dados.';
      if (/Faça login|sessão expirou/i.test(message)) setAuthenticated(false);
      else if (cause instanceof NoHouseholdError) { setAuthenticated(true); setNoHousehold(true); setData(blank); }
      else setError(message);
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [member, category, from, to, dateMode, householdId]);
  useEffect(() => { reloadRef.current = () => { void load(); }; }, [member, category, from, to, dateMode, householdId]);
  useEffect(() => {
    if (!data.householdId) return;
    const client = getSupabase();
    const channel = client.channel(`entries-household-${data.householdId}`).on('postgres_changes', {
      event: '*', schema: 'public', table: 'entries', filter: `household_id=eq.${data.householdId}`,
    }, () => reloadRef.current()).subscribe(status => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeError('Atualização ao vivo indisponível; os dados ainda podem ser atualizados manualmente.');
      else if (status === 'SUBSCRIBED') setRealtimeError('');
    });
    return () => { void client.removeChannel(channel); };
  }, [data.householdId]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setInviteToken(params.get('invite') || '');
  }, []);

  const totals = useMemo(() => data.entries.reduce((sum, entry) => {
    const amount = Number(entry.amount);
    if (entry.status === 'posted') sum[entry.kind] += amount;
    if (entry.status === 'planned' && entry.kind === 'income') sum.futureIncome += amount;
    if (entry.status === 'planned' && entry.kind === 'expense') sum.futureExpense += amount;
    return sum;
  }, { income: 0, expense: 0, futureIncome: 0, futureExpense: 0 }), [data.entries]);
  const chartData = useMemo(() => {
    const rows = new Map<string, { date: string; income: number; expense: number }>();
    for (const entry of data.entries) {
      const date = dateMode === 'due' ? entry.due_on : entry.occurred_on;
      if (!date) continue;
      const row = rows.get(date) ?? { date, income: 0, expense: 0 };
      row[entry.kind] += Number(entry.amount);
      rows.set(date, row);
    }
    return [...rows.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [data.entries, dateMode]);
  const byCategory = useMemo(() => data.entries.filter(entry => entry.kind === 'expense').reduce<Record<string, number>>((result, entry) => {
    result[entry.category_name] = (result[entry.category_name] ?? 0) + Number(entry.amount); return result;
  }, {}), [data.entries]);

  async function signIn(form: HTMLFormElement) {
    const fields = new FormData(form);
    try {
      const { error: authError } = await getSupabase().auth.signInWithPassword({ email: String(fields.get('email')), password: String(fields.get('password')) });
      if (authError) throw authError;
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível entrar.'); }
  }
  async function signUp(form: HTMLFormElement) {
    const fields = new FormData(form);
    try {
      const { data: result, error: authError } = await getSupabase().auth.signUp({
        email: String(fields.get('email')), password: String(fields.get('password')),
        options: { emailRedirectTo: window.location.href },
      });
      if (authError) throw authError;
      if (result.session) await load();
      else setInviteStatus('Conta criada. Confirme seu e-mail pelo link enviado; o link do convite será preservado no retorno.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível criar a conta.'); }
  }
  async function signOut() { await getSupabase().auth.signOut(); setAuthenticated(false); setNoHousehold(false); setHouseholdId(''); setData(blank); }
  async function makeHousehold(form: HTMLFormElement) {
    const fields = new FormData(form);
    try { await createHousehold(String(fields.get('familyName')), String(fields.get('displayName'))); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível criar a família.'); }
  }
  async function sendInvite(form: HTMLFormElement) {
    const fields = new FormData(form);
    try {
      const token = await createHouseholdInvite(data.householdId, String(fields.get('inviteEmail')));
      const url = new URL(window.location.href); url.searchParams.set('invite', token);
      setInviteLink(url.toString()); setInviteStatus('Convite criado. Copie e compartilhe o link com a pessoa convidada.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível criar o convite.'); }
  }
  async function copyInviteLink() {
    try { if (!navigator.clipboard) throw new Error('clipboard unavailable'); await navigator.clipboard.writeText(inviteLink); setInviteStatus('Link copiado.'); }
    catch { setInviteStatus('Não foi possível copiar automaticamente. Selecione e copie o link exibido.'); }
  }
  async function acceptInvite(form?: HTMLFormElement) {
    if (!inviteToken) return;
    const name = form ? String(new FormData(form).get('inviteeName') || '') : inviteeName;
    if (!name.trim()) { setError('Informe seu nome de exibição para aceitar o convite.'); return; }
    try {
      const acceptedHousehold = await acceptHouseholdInvite(inviteToken, name);
      setHouseholdId(acceptedHousehold); setInviteToken(''); setInviteStatus('Convite aceito. Família adicionada à sua conta.');
      const url = new URL(window.location.href); url.searchParams.delete('invite'); window.history.replaceState({}, '', url.toString());
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Convite inválido, vencido ou não autorizado.'); }
  }
  async function submitEntry(form: HTMLFormElement) {
    const fields = new FormData(form);
    const count = Number(fields.get('installmentCount') || 0);
    const recurrence = String(fields.get('recurrence') || '');
    const recurrenceEnd = String(fields.get('recurrenceEndDate') || '');
    if (recurrence && !recurrenceEnd) { setError('Informe a data final da recorrência.'); return; }
    if (count > 1 && recurrence) { setError('Escolha recorrência ou parcelamento.'); return; }
    const series: EntryDraft['series'] = count > 1 ? { kind: 'installments', count } : recurrence ? { kind: 'recurring', recurrence: recurrence as 'week' | 'month' | 'year', endDate: recurrenceEnd } : null;
    const draft: EntryDraft = {
      member_id: String(fields.get('memberId')), category_id: String(fields.get('categoryId')) || null,
      kind: String(fields.get('kind')) as EntryKind, description: String(fields.get('description')).trim(),
      amount: Math.round(Number(fields.get('amount')) * 100) / 100, occurred_on: String(fields.get('date')),
      due_on: String(fields.get('dueOn') || '') || null,
      status: series || fields.get('future') === 'on' ? 'planned' : 'posted', series,
    };
    try { await saveEntry(draft, editing?.id, data.householdId); setShowForm(false); setEditing(null); setSaved(series ? 'Programação futura criada.' : 'Lançamento salvo.'); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o lançamento.'); }
  }

  return <main className="shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">F</span><div><strong>Finanças Família</strong><small>Visão compartilhada do orçamento</small></div></div>
      {authenticated && !noHousehold && <div className="toolbar">{data.households.length > 1 && <label>Família<select value={householdId} onChange={event => { setHouseholdId(event.target.value); setMember('all'); setCategory('all'); }} aria-label="Selecionar família">{data.households.map(home => <option key={home.id} value={home.id}>{home.name}</option>)}</select></label>}<label>Membro<select value={member} onChange={event => setMember(event.target.value)}><option value="all">Todos</option>{data.members.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button className="button primary" onClick={() => { setEditing(null); setShowForm(true); }}>＋ Novo lançamento</button><button className="button secondary" onClick={() => void signOut()}>Sair</button></div>}
    </header>

    {!authenticated && !loading && <section className="auth-card"><h1>{authMode === 'login' ? 'Acesse sua família' : 'Criar conta'}</h1><p>{authMode === 'login' ? 'Entre com sua conta para carregar seus lançamentos.' : 'Crie sua conta; a confirmação de e-mail pode ser exigida antes de aceitar um convite.'}</p><form onSubmit={event => { event.preventDefault(); void (authMode === 'login' ? signIn(event.currentTarget) : signUp(event.currentTarget)); }} className="auth-form">{authMode === 'signup' && <label>Nome para exibição<input name="displayName" value={displayName} onChange={event => setDisplayName(event.target.value)} required maxLength={80}/></label>}<label>E-mail<input type="email" name="email" autoComplete="username" required/></label><label>Senha<input type="password" name="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} required/></label><button className="button primary">{authMode === 'login' ? 'Entrar' : 'Criar conta'}</button></form><button className="icon-button" onClick={() => { setError(''); setAuthMode(authMode === 'login' ? 'signup' : 'login'); }}>{authMode === 'login' ? 'Criar uma conta' : 'Já tenho uma conta'}</button></section>}
    {!authenticated && inviteStatus && <p role="status" className="notice auth-notice">{inviteStatus}</p>}
    {(!authenticated || noHousehold) && error && <div role="alert" className="error"><span>{error}</span><button className="button secondary" onClick={() => { setError(''); if (authenticated) void load(); }}>Tentar novamente</button></div>}
    {authenticated && noHousehold && <section className="auth-card"><h1>Configure sua família</h1><p>Não há uma família associada à conta. Crie uma ou entre por um convite.</p>{inviteToken && <form className="auth-form" onSubmit={event => { event.preventDefault(); void acceptInvite(event.currentTarget); }}><label>Seu nome na família<input name="inviteeName" value={inviteeName} onChange={event => setInviteeName(event.target.value)} required maxLength={80}/></label><button className="button primary">Validar e aceitar convite</button></form>}<form className="auth-form" onSubmit={event => { event.preventDefault(); void makeHousehold(event.currentTarget); }}><label>Seu nome de exibição<input name="displayName" value={displayName} onChange={event => setDisplayName(event.target.value)} required maxLength={80}/></label><label>Nome da família<input name="familyName" value={familyName} onChange={event => setFamilyName(event.target.value)} required maxLength={80}/></label><button className="button primary">Criar família</button></form></section>}

    {authenticated && !noHousehold && <>
      {inviteToken && <section className="invite-banner"><span>Este link contém um convite para outra família. Aceite para adicioná-la à sua conta.</span><form className="invite-form" onSubmit={event => { event.preventDefault(); void acceptInvite(event.currentTarget); }}><label>Seu nome na família<input name="inviteeName" value={inviteeName} onChange={event => setInviteeName(event.target.value)} required maxLength={80}/></label><button className="button secondary">Validar e aceitar</button></form></section>}
      <section className="filters" aria-label="Filtros do painel"><label>Categoria<select value={category} onChange={event => setCategory(event.target.value)}><option value="all">Todas as categorias</option><option value="uncategorized">Sem categoria</option>{data.categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Data considerada<select value={dateMode} onChange={event => setDateMode(event.target.value as 'occurred' | 'due')}><option value="occurred">Compra/recebimento</option><option value="due">Vencimento</option></select></label><label>De<input aria-label="Data inicial" type="date" value={from} onChange={event => setFrom(event.target.value)}/></label><label>Até<input aria-label="Data final" type="date" value={to} onChange={event => setTo(event.target.value)}/></label><button className="button secondary" onClick={() => setAudioOpen(true)}>Lançar por áudio</button></section>
      {data.categories.length === 0 && !loading && <p className="notice">Esta família ainda não tem categorias. Você pode registrar lançamentos sem categoria.</p>}
      {inviteStatus && <div className="notice invite-result" role="status"><span>{inviteStatus}</span>{inviteLink && <><input aria-label="Link do convite" className="invite-link" readOnly value={inviteLink} onFocus={event => event.currentTarget.select()}/><button className="button secondary" onClick={() => void copyInviteLink()}>Copiar link</button></>}</div>}
      {error && <div className="error" role="alert"><span>{error}</span><button className="button secondary" onClick={() => void load()}>Tentar novamente</button></div>}
      {realtimeError && <p className="notice" role="status">{realtimeError}</p>}
      {loading ? <div className="loading" role="status" aria-live="polite">Carregando painel…</div> : <>
        <section className="cards" aria-label="Resumo do período"><Metric title="Saldo realizado" value={money.format(totals.income - totals.expense)}/><Metric title="Créditos realizados" value={money.format(totals.income)} tone="green"/><Metric title="Despesas realizadas" value={money.format(totals.expense)} tone="red"/><Metric title="Créditos futuros" value={money.format(totals.futureIncome)} tone="green"/><Metric title="Despesas futuras" value={money.format(totals.futureExpense)} tone="blue"/></section>
        <section className="charts"><article className="panel"><h2>Créditos e despesas</h2><p className="muted">Por {dateMode === 'due' ? 'vencimento' : 'data de compra/recebimento'}</p>{chartData.length ? <div className="chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#e7ebf1"/><XAxis dataKey="date" tickFormatter={value => value.slice(5)} stroke="#748096"/><YAxis tickFormatter={value => `R$${value}`} stroke="#748096"/><Tooltip formatter={value => money.format(Number(value))}/><Legend/><Line name="Créditos" dataKey="income" stroke="#138a66" strokeWidth={3}/><Line name="Despesas" dataKey="expense" stroke="#de5c50" strokeWidth={3}/></LineChart></ResponsiveContainer></div> : <Empty>Não há movimentações nessa data considerada.</Empty>}</article>
          <article className="panel"><h2>Despesas por categoria</h2><p className="muted">No período selecionado</p>{Object.keys(byCategory).length ? <div className="chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={Object.entries(byCategory).map(([name, value]) => ({ name, value }))} dataKey="value" nameKey="name" outerRadius="72%" fill="#138a66" label/><Tooltip formatter={value => money.format(Number(value))}/><Legend/></PieChart></ResponsiveContainer></div> : <Empty>Sem despesas para exibir.</Empty>}</article></section>
      <section className="panel list-panel"><div className="list-heading"><div><h2>Lançamentos</h2><p className="muted">{data.entries.length} registros no intervalo atual</p></div></div>{data.entries.length ? <div className="table-wrap"><table><thead><tr><th>Descrição</th><th>Membro</th><th>Categoria</th><th>Compra/recebimento</th><th>Vencimento</th><th>Tipo</th><th>Status</th><th>Valor</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{data.entries.map(entry => <tr key={entry.id}><td><strong>{entry.description}</strong>{entry.installment && <small>Parcela {entry.installment.current}/{entry.installment.total}</small>}</td><td>{entry.member_name}</td><td>{entry.category_name}</td><td>{entry.occurred_on}</td><td>{entry.due_on || '—'}</td><td>{entry.kind === 'income' ? 'Crédito' : 'Despesa'}</td><td>{entry.status === 'planned' ? 'Futuro' : 'Realizado'}</td><td className={entry.kind === 'income' ? 'green' : 'red'}>{money.format(entry.amount)}</td><td>{entry.can_edit && <button className="icon-button" aria-label={`Editar ${entry.description}`} onClick={() => { setEditing(entry); setShowForm(true); }}>Editar</button>}</td></tr>)}</tbody></table></div> : <Empty>Nenhum lançamento nesse intervalo. Adicione um registro para começar.</Empty>}{data.truncated && <p className="notice">Exibindo os 100 registros mais recentes que correspondem ao filtro. Reduza o intervalo para consultar com mais precisão.</p>}</section>
        {data.canInvite && <section className="panel invite-panel"><div><h2>Convidar membro</h2><p className="muted">A pessoa precisa entrar com o e-mail convidado e aceitar pelo link.</p></div><form className="invite-form" onSubmit={event => { event.preventDefault(); void sendInvite(event.currentTarget); }}><label>E-mail<input type="email" name="inviteEmail" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} required/></label><button className="button secondary">Criar convite</button></form></section>}
      </>}
    </>}
    {showForm && <EntryDialog data={data} entry={editing} onClose={() => { setShowForm(false); setEditing(null); }} onSubmit={submitEntry}/>}
    {audioOpen && <AudioDialog data={data} onClose={() => setAudioOpen(false)} onConfirm={async draft => { await saveEntry(draft, undefined, data.householdId); setAudioOpen(false); setSaved('Rascunho confirmado e lançamento salvo.'); await load(); }}/>}
  </main>;
}

function Metric({ title, value, tone = '' }: { title: string; value: string; tone?: string }) { return <article className="metric"><span>{title}</span><strong className={tone}>{value}</strong></article>; }
function Empty({ children }: { children: React.ReactNode }) { return <div className="empty" role="status">{children}</div>; }
