// Subscriptions paid with PAYSIKA: renewal dates, keep or let expire.
import { state, save, uid } from '../store.js';
import { parseMoney, fmt, today, fmtDate, daysBetween, balances } from '../logic.js';
import { esc, jarOpts, formData, toast, ask, icon, emptyState } from '../ui.js';

export function render() {
  const b = balances();
  const t = today();
  const subs = [...state.subs].sort((a, c) => a.next.localeCompare(c.next));
  const monthly = subs.filter(s => s.keep).reduce((s, x) => s + (x.cycle === 'yearly' ? x.amount / 12 : x.amount), 0);
  return `<div class="card grid2">
      <div><div class="small muted">Coût (gardés)</div><b>${fmt(Math.round(monthly))}/mois</b><div class="small muted">${fmt(Math.round(monthly * 12))}/an</div></div>
      <div><div class="small muted">PAYSIKA</div><b class="${b.w.paysika > 0 ? 'warn-text' : 'pos'}">${fmt(b.w.paysika)}</b><div class="small muted">${b.w.paysika > 0 ? 'pas vide !' : 'vide'}</div></div>
    </div>
    <div class="card tight">${subs.length ? subs.map(s => {
      const d = daysBetween(t, s.next);
      return `<div class="row"><div class="l"><div class="t">${esc(s.name)} <span class="badge ${s.keep ? 'ok' : ''}">${s.keep ? 'Garder' : 'Laisser expirer'}</span></div>
        <div class="s">${fmt(s.amount)} / ${s.cycle === 'yearly' ? 'an' : 'mois'} · <span class="${d < 0 ? 'neg' : d <= 2 ? 'warn-text' : ''}">${fmtDate(s.next)}</span></div></div>
        <div class="r" style="display:flex;gap:6px">
          ${s.keep ? `<a class="btn sm primary" href="#/add?type=expense&wallet=paysika&amount=${s.amount}&cat=subs&jar=${s.jar}&note=${encodeURIComponent(s.name)}&sub=${s.id}&back=%23%2Fsubs">Payer</a>` : ''}
          <button class="btn sm" data-toggle="${s.id}" aria-label="${s.keep ? 'Laisser expirer' : 'Garder'}">${icon(s.keep ? 'pause' : 'play')}</button>
          <button class="btn sm danger" data-del="${s.id}" aria-label="Supprimer">${icon('trash')}</button>
        </div></div>`;
    }).join('') : emptyState('repeat', 'Aucun abonnement', 'Ajoute tes abonnements payés avec PAYSIKA : on te prévient 2 jours avant chaque renouvellement.')}</div>
    <form id="f" class="card">
      <h2>+ Ajouter un abonnement</h2>
      <div class="grid2">
        <div class="field"><label>Service</label><input name="name" required placeholder="Netflix"></div>
        <div class="field"><label>Montant</label><input name="amount" inputmode="decimal" required></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Cycle</label><select name="cycle"><option value="monthly">Mensuel</option><option value="yearly">Annuel</option></select></div>
        <div class="field"><label>Prochain renouvellement</label><input type="date" name="next" value="${t}" required></div>
      </div>
      <div class="field"><label>Compte</label><select name="jar">${jarOpts('fun')}</select></div>
      <button class="btn primary block">Ajouter</button>
    </form>`;
}

export function mount(root) {
  const f = root.querySelector('#f');
  f.onsubmit = async e => {
    e.preventDefault();
    const d = formData(f);
    const amount = parseMoney(d.amount);
    if (!(amount > 0)) return toast('Entre un montant');
    state.subs.push({ id: uid(), name: d.name.trim(), amount, cycle: d.cycle, next: d.next, jar: d.jar, keep: true });
    await save();
  };
  root.querySelectorAll('[data-toggle]').forEach(btn => btn.onclick = async () => {
    const s = state.subs.find(x => x.id === btn.dataset.toggle);
    s.keep = !s.keep; await save();
  });
  root.querySelectorAll('[data-del]').forEach(btn => btn.onclick = async () => {
    if (!(await ask('Supprimer cet abonnement ?', { danger: true, ok: 'Oui' }))) return;
    state.subs = state.subs.filter(x => x.id !== btn.dataset.del); await save();
  });
}
