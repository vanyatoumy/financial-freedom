// Edit one saved transaction: amount, date, note, wallet, jar, category, fees and taxes, depending on its type.
import { state, save } from '../store.js';
import { parseMoney, fmt, toInput, txTitle, txIcon, TYPE_LABEL, wallet, loan, canTransfer, feeWalletOf } from '../logic.js';
import { esc, walletOpts, jarOpts, formData, go, toast, ask, tile, emptyState, feeFields, showFees, feeVals, icon } from '../ui.js';

const WITH_WALLET = ['income', 'expense', 'transfer', 'loan_out', 'loan_in', 'debt_in', 'debt_pay', 'invest', 'div_collect', 'svc_in', 'svc_out', 'adjust'];
const WITH_JAR = ['expense', 'loan_out', 'loan_in', 'debt_in', 'debt_pay', 'div_collect', 'adjust'];
// Computed or structural entries: shown, but corrected another way.
const LOCKED = {
  opening: 'Ce sont tes soldes de départ. Pour les corriger, utilise un « Écart » au comptage du matin, ou refais la configuration après une sauvegarde.',
  svc_close: 'La marge est calculée à partir des opérations du service. Supprime cette clôture, corrige les opérations du service, puis clôture à nouveau.',
};

// Keep the original split proportions when the amount of an income changes.
function rescale(alloc, amount) {
  const total = alloc.reduce((s, p) => s + p.amount, 0) || 1;
  const parts = alloc.map(p => ({ jar: p.jar, amount: Math.floor(amount * p.amount / total / 100) * 100 }));
  const left = amount - parts.reduce((s, p) => s + p.amount, 0);
  parts.reduce((m, p) => (p.amount > m.amount ? p : m), parts[0]).amount += left;
  return parts;
}

export function render({ id }) {
  const t = state.tx.find(x => x.id === id);
  if (!t) return emptyState('alert', 'Introuvable', 'Cette opération a peut-être été supprimée.', '#/history', 'Historique');
  const head = `<div class="card"><div class="wname">${tile(txIcon(t), 'var(--primary)')}<div><b>${esc(txTitle(t))}</b>
    <div class="small muted">${esc(TYPE_LABEL[t.type] || t.type)}${t.history ? ' · avant l’application' : ''}</div></div></div></div>`;
  if (LOCKED[t.type]) return `${head}<div class="alert info">${icon('info')} <span>${LOCKED[t.type]}</span></div>
    <button class="btn danger block" id="del">${icon('trash')} Supprimer</button>`;

  const kind = t.type === 'income' ? 'income' : t.type === 'expense' ? 'expense' : null;
  const fw = t.type === 'transfer' ? feeWalletOf(t.wallet, t.to) : t.wallet;
  const oneJar = t.type === 'income' && (t.alloc || []).length === 1;
  const people = [...new Set([...state.tx.map(x => x.person), ...state.loans.map(l => l.person)].filter(Boolean))].sort();

  return `${head}<form id="f" class="card">
    <div class="field"><label>${t.type === 'adjust' ? 'Écart (négatif = argent manquant)' : 'Montant'}</label>
      <input class="amount" name="amount" inputmode="decimal" value="${toInput(t.amount)}"></div>
    ${t.type === 'transfer' ? `<div class="grid2">
        <div class="field"><label>De</label><select name="wallet">${walletOpts(t.wallet, { filter: w => state.wallets.some(x => canTransfer(w.id, x.id)) })}</select></div>
        <div class="field"><label>Vers</label><select name="to"></select></div></div>`
      : WITH_WALLET.includes(t.type) ? `<div class="field"><label>Portefeuille</label><select name="wallet">${walletOpts(t.wallet)}</select></div>` : ''}
    ${WITH_WALLET.includes(t.type) ? feeFields(fw, '', t) : ''}
    ${WITH_JAR.includes(t.type) ? `<div class="field"><label>Compte</label><select name="jar">${jarOpts(t.jar)}</select></div>` : ''}
    ${t.type === 'jar_move' ? `<div class="grid2">
        <div class="field"><label>Du compte</label><select name="jar">${jarOpts(t.jar)}</select></div>
        <div class="field"><label>Vers le compte</label><select name="toJar">${jarOpts(t.toJar)}</select></div></div>` : ''}
    ${oneJar ? `<div class="field"><label>Compte</label><select name="oneJar">${jarOpts(t.alloc[0].jar)}</select></div>` : ''}
    ${kind ? `<div class="field"><label>${kind === 'income' ? 'Source' : 'Catégorie'}</label><select name="cat">${state.categories.filter(c => c.kind === kind)
      .map(c => `<option value="${c.id}" ${c.id === t.cat ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>` : ''}
    ${t.type === 'income' ? `<label class="check"><input type="checkbox" name="passive" ${t.passive ? 'checked' : ''}> Revenu passif</label>
      ${oneJar ? '' : '<p class="small muted">Si le montant change, la répartition sur les 6 comptes garde les mêmes proportions.</p>'}` : ''}
    ${t.type === 'expense' ? `<div class="field"><label>Personne</label><input name="person" list="pp" value="${esc(t.person || '')}">
      <datalist id="pp">${people.map(p => `<option value="${esc(p)}">`).join('')}</datalist></div>` : ''}
    ${t.type === 'debt_pay' ? `<div class="field"><label>Dont intérêts</label><input name="interestPart" inputmode="decimal" value="${toInput(t.interestPart)}"></div>` : ''}
    <div class="field"><label>Date et heure</label><input type="datetime-local" name="date" value="${t.date.slice(0, 16)}"></div>
    <div class="field"><label>Note</label><input name="note" value="${esc(t.note || '')}"></div>
    <p id="warn" class="small"></p>
    <button class="btn primary block">Enregistrer les modifications</button>
  </form>
  <button class="btn danger block" id="del">${icon('trash')} Supprimer</button>`;
}

export function mount(root, { id, q }) {
  const back = q.get('back') || '#/history';
  const t = state.tx.find(x => x.id === id);
  if (!t) return;

  root.querySelector('#del').onclick = async () => {
    const warn = t.type === 'opening' ? '\nAttention : ce sont tes soldes de départ !' : t.loan ? '\nLe prêt / la dette sera recalculé(e).' : '';
    if (!(await ask(`Supprimer « ${txTitle(t)} » (${fmt(t.amount || 0)}) ?${warn}`, { danger: true, ok: 'Supprimer' }))) return;
    state.tx = state.tx.filter(x => x.id !== t.id);
    await save();
    toast('Supprimé');
    go(back);
  };

  const f = root.querySelector('#f');
  if (!f) return;
  const feeWallet = () => (t.type === 'transfer' ? feeWalletOf(f.wallet.value, f.to.value) : f.wallet?.value);
  if (t.type === 'transfer') {
    const fillTo = () => {
      const cur = f.to.value || t.to;
      f.to.innerHTML = state.wallets.filter(w => canTransfer(f.wallet.value, w.id))
        .map(w => `<option value="${w.id}" ${w.id === cur ? 'selected' : ''}>${esc(w.name)}</option>`).join('');
    };
    fillTo();
    f.wallet.addEventListener('change', fillTo);
  }
  f.onchange = () => { if (f.wallet) showFees(root, feeWallet()); };

  f.onsubmit = async e => {
    e.preventDefault();
    const d = formData(f);
    const a = parseMoney(d.amount);
    if (isNaN(a) || (t.type === 'adjust' ? a === 0 : a <= 0)) return toast('Entre un montant valide');
    const next = { ...t, amount: a, date: d.date || t.date, note: d.note.trim() };
    if (f.wallet) next.wallet = d.wallet;
    if (t.type === 'transfer') {
      if (!canTransfer(d.wallet, d.to)) return toast(`${wallet(d.wallet).name} → ${wallet(d.to)?.name || '?'} n'est pas autorisé`);
      next.to = d.to;
    }
    if (d.jar) next.jar = d.jar;
    if (d.toJar) { if (d.toJar === d.jar) return toast('Choisis deux comptes différents'); next.toJar = d.toJar; }
    if (d.cat) next.cat = d.cat;
    if (t.type === 'expense') next.person = d.person.trim() || undefined;
    if (t.type === 'income') {
      next.passive = !!d.passive;
      next.alloc = d.oneJar ? [{ jar: d.oneJar, amount: a }] : rescale(t.alloc || [], a);
    }
    if (t.type === 'debt_pay') next.interestPart = Math.min(a, parseMoney(d.interestPart || 0) || 0);
    if (f.wallet) {
      // fees and taxes are re-read from the form; the jar that pays them (Nécessité, or a client service) is kept
      delete next.fee; delete next.tax; delete next.feeWallet;
      Object.assign(next, feeVals(d, feeWallet()));
    }
    // the first movement of a loan / debt is the loan amount itself
    const l = (t.type === 'loan_out' || t.type === 'debt_in') && loan(t.loan);
    const before = structuredClone(t), loanBefore = l ? { amount: l.amount, date: l.date, wallet: l.wallet, jar: l.jar } : null;
    if (l) Object.assign(l, { amount: a, date: next.date.slice(0, 10), wallet: next.wallet, jar: next.jar });

    const i = state.tx.findIndex(x => x.id === t.id);
    state.tx[i] = next;
    await save();
    toast(`Modifié : ${fmt(a)}`, async () => {
      const j = state.tx.findIndex(x => x.id === t.id);
      if (j >= 0) state.tx[j] = before;
      if (l) Object.assign(l, loanBefore);
      await save();
      toast('Modification annulée');
    }, { ok: true });
    go(back);
  };
  showFees(root, feeWallet());
}
