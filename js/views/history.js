// All transactions, grouped by day, with filters.
import { state, save } from '../store.js';
import { fmt, fmtDate, today, effects, txTitle, txIcon, txSign, TYPE_LABEL, wallet, jar, cat } from '../logic.js';
import { esc, opts, toast, ask, enableSwipe, tile, emptyState } from '../ui.js';

let filter = { month: '', type: '', jar: '', wallet: '' };

function matches(t) {
  if (filter.month && filter.month !== 'all' && !t.date.startsWith(filter.month)) return false;
  if (filter.type === 'other' ? ['income', 'expense', 'transfer'].includes(t.type) : filter.type && t.type !== filter.type) return false;
  const e = effects(t);
  if (filter.jar && !(filter.jar in e.j)) return false;
  if (filter.wallet && !(filter.wallet in e.w)) return false;
  return true;
}

export function render() {
  if (!filter.month) filter.month = today().slice(0, 7);
  const months = [...new Set([today().slice(0, 7), ...state.tx.map(t => t.date.slice(0, 7))])].sort().reverse();
  const list = state.tx.filter(matches).sort((a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0));
  const inc = list.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const exp = list.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  let lastDay = '';
  const rows = list.map(t => {
    const day = t.date.slice(0, 10);
    const sep = day !== lastDay ? `<div class="daysep">${fmtDate(day)}</div>` : '';
    lastDay = day;
    const e = effects(t);
    const sign = filter.jar ? e.j[filter.jar] || 0 : filter.wallet ? e.w[filter.wallet] || 0 : txSign(t);
    const amount = t.type === 'opening' || t.type === 'jar_move' || t.type === 'forgive' || (t.type === 'transfer' && !filter.wallet) ? (sign || t.amount) : sign;
    const sub = [
      t.date.length > 10 ? t.date.slice(11, 16) : '',
      t.type === 'expense' || t.type === 'income' ? esc(cat(t.cat)?.name || '') : TYPE_LABEL[t.type],
      t.wallet && t.type !== 'transfer' ? esc(wallet(t.wallet)?.name) : '',
      t.jar && t.type === 'expense' ? `<span style="color:${jar(t.jar)?.color}">${esc(jar(t.jar)?.name)}</span>` : '',
      t.person ? esc(t.person) : '',
      t.fee ? 'frais ' + fmt(t.fee) : '',
      t.history ? 'historique' : '',
    ].filter(Boolean).join(' · ');
    const c = cat(t.cat);
    return `${sep}<div class="swipe"><button class="swipe-del" data-del="${t.id}">Supprimer</button>
      <div class="row">${tile(txIcon(t), c ? jar(t.jar)?.color || (t.type === 'income' ? 'var(--ok)' : '') : '')}<div class="l"><div class="t">${esc(txTitle(t))}</div><div class="s">${sub}</div></div>
      <div class="r ${amount > 0 ? 'pos' : amount < 0 ? 'neg' : ''}">${fmt(amount, { sign: true })}</div></div></div>`;
  }).join('');

  const types = [['', 'Tout'], ['expense', 'Dépenses'], ['income', 'Revenus'], ['transfer', 'Transferts'], ['other', 'Autres']];
  return `<div class="field"><select data-f="month"><option value="all" ${filter.month === 'all' ? 'selected' : ''}>Tous les mois</option>${months.map(m => `<option value="${m}" ${m === filter.month ? 'selected' : ''}>${new Date(m + '-15').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</option>`).join('')}</select></div>
    <div class="chips">${types.map(([v, l]) => `<button class="chip ${v === filter.type ? 'on' : ''}" data-type="${v}">${l}</button>`).join('')}</div>
    <div class="grid2">
      <div class="field"><select data-f="jar">${opts(state.jars, filter.jar, { empty: 'Tous les comptes' })}</select></div>
      <div class="field"><select data-f="wallet">${opts(state.wallets, filter.wallet, { empty: 'Tous les portefeuilles' })}</select></div>
    </div>
    <div class="card grid2 center"><div><div class="small muted">Revenus</div><b class="pos">${fmt(inc)}</b></div><div><div class="small muted">Dépenses</div><b class="neg">${fmt(exp)}</b></div></div>
    <div class="card tight">${rows || emptyState('list', filter.type || filter.jar || filter.wallet ? 'Rien avec ces filtres' : 'Aucun mouvement ce mois-ci',
    filter.type || filter.jar || filter.wallet ? 'Essaie un autre filtre ou un autre mois.' : 'Chaque revenu, dépense et transfert apparaîtra ici, jour par jour.',
    '#/add?type=expense', 'Ajouter une opération')}</div>`;
}

export function mount(root) {
  root.querySelectorAll('[data-f]').forEach(s => s.onchange = () => {
    filter[s.dataset.f] = s.value;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  root.querySelectorAll('[data-type]').forEach(c => c.onclick = () => {
    filter.type = c.dataset.type;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  enableSwipe(root);
  root.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    const t = state.tx.find(x => x.id === b.dataset.del);
    if (!t) return;
    const warn = t.type === 'opening' ? ' Attention : ce sont tes soldes de départ !' : t.loan ? ' Le prêt/dette sera recalculé.' : '';
    if (!(await ask(`Supprimer « ${txTitle(t)} » (${fmt(t.amount || 0)}) ?${warn}`, { danger: true, ok: 'Oui' }))) return;
    state.tx = state.tx.filter(x => x.id !== t.id);
    await save();
    toast('Supprimé');
  });
}
