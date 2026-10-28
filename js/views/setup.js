// First-run wizard: wallet balances → which jar owns that money → association investment.
import { state, save, uid } from '../store.js';
import { parseMoney, fmt, toInput, today, addMonths } from '../logic.js';
import { esc, go, formData, toast, icon, tile } from '../ui.js';

const draft = { w: {}, j: {}, inv: null };

export function render({ q }) {
  const step = +(q.get('step') || 1);
  if (step === 1) return `
    <h1>Bienvenue</h1>
    <p class="muted">Étape 1/3 — Combien as-tu dans chaque compte aujourd'hui ?</p>
    <form id="f" class="card mt">
      ${state.wallets.map(w => `<div class="field"><label class="wname">${tile(w.icon, w.color, 'mini-ico')} ${esc(w.name)}${w.role === 'vault' ? ' (bloqué / protégé)' : ''}</label>
        <input name="${w.id}" inputmode="decimal" placeholder="0" value="${toInput(draft.w[w.id])}"></div>`).join('')}
      <button class="btn primary block">Suivant</button>
    </form>`;

  if (step === 2) {
    const total = Object.values(draft.w).reduce((s, v) => s + v, 0);
    return `
    <h1>À quoi sert cet argent ?</h1>
    <p class="muted">Étape 2/3 — Répartis tes <b>${fmt(total)}</b> entre les 6 comptes. Le total doit être égal.</p>
    <form id="f" class="card mt">
      ${state.jars.map(j => `<div class="field"><label class="wname">${tile(j.icon, j.color, 'mini-ico')} ${esc(j.name)}${j.home ? ` <span class="small">(dans ${esc(state.wallets.find(w => w.id === j.home)?.name)})</span>` : ''}</label>
        <input name="${j.id}" inputmode="decimal" value="${toInput(draft.j[j.id])}"></div>`).join('')}
      <p id="sum" class="small"></p>
      <div class="grid2"><a class="btn" href="#/setup?step=1">Retour</a><button class="btn primary">Suivant</button></div>
    </form>`;
  }

  const i = draft.inv || {};
  return `
    <h1>Ton investissement</h1>
    <p class="muted">Étape 3/3 — Ton association (tu peux passer et l'ajouter plus tard).</p>
    <form id="f" class="card mt">
      <div class="field"><label>Nom</label><input name="name" value="${esc(i.name || 'Association')}"></div>
      <div class="field"><label>Montant investi</label><input name="initial" inputmode="decimal" value="${toInput(i.initial)}"></div>
      <div class="field"><label>Date de l'investissement</label><input type="date" name="start" value="${i.start || ''}"></div>
      <div class="hr"></div>
      <div class="field"><label>Paiement reçu fin août (montant)</label><input name="aug" inputmode="decimal" value="${toInput(i.aug)}"></div>
      <div class="field"><label>Date de ce paiement</label><input type="date" name="augDate" value="${i.augDate || '2026-08-31'}"></div>
      <div class="field"><label>Prochain paiement attendu</label><input type="date" name="next" value="${i.next || '2026-10-31'}"></div>
      <div class="field"><label>Fréquence estimée (mois)</label><input name="freq" inputmode="numeric" value="${i.freq || 2}"></div>
      <label class="check"><input type="checkbox" name="reinvest" checked> Réinvestir les gains (100% vers Investissement)</label>
      <div class="grid2 mt"><button class="btn" name="skip" value="1">Passer</button><button class="btn primary">Terminer</button></div>
    </form>`;
}

export function mount(root, { q }) {
  const step = +(q.get('step') || 1);
  const f = root.querySelector('#f');

  if (step === 1) f.onsubmit = e => {
    e.preventDefault();
    const d = formData(f);
    for (const w of state.wallets) {
      const v = parseMoney(d[w.id] || 0);
      if (isNaN(v) || v < 0) return toast(`Montant invalide pour ${w.name}`);
      draft.w[w.id] = v;
    }
    // defaults: home wallets go to their jar, the rest is shared by % among the other jars
    const homes = state.jars.filter(j => j.home);
    const homeIds = new Set(homes.map(j => j.home));
    const rest = state.wallets.filter(w => !homeIds.has(w.id)).reduce((s, w) => s + draft.w[w.id], 0);
    const others = state.jars.filter(j => !j.home);
    const pctSum = others.reduce((s, j) => s + j.pct, 0) || 1;
    let used = 0;
    for (const j of state.jars) draft.j[j.id] = j.home ? draft.w[j.home] : Math.floor(rest * j.pct / pctSum / 100) * 100;
    for (const j of others) used += draft.j[j.id];
    if (others[0]) draft.j[others[0].id] += rest - used;
    go('#/setup?step=2');
  };

  if (step === 2) {
    const total = Object.values(draft.w).reduce((s, v) => s + v, 0);
    const sumEl = root.querySelector('#sum');
    const check = () => {
      const d = formData(f);
      const s = state.jars.reduce((a, j) => a + (parseMoney(d[j.id] || 0) || 0), 0);
      sumEl.innerHTML = s === total ? `<span class="pos">${icon('check')} Total : ${fmt(s)}</span>` : `<span class="neg">Total : ${fmt(s)} (écart ${fmt(s - total)})</span>`;
      return s === total;
    };
    f.oninput = check; check();
    f.onsubmit = e => {
      e.preventDefault();
      if (!check()) return toast('Le total des comptes doit être égal au total des portefeuilles');
      const d = formData(f);
      state.jars.forEach(j => { draft.j[j.id] = parseMoney(d[j.id] || 0) || 0; });
      go('#/setup?step=3');
    };
  }

  if (step === 3) f.onsubmit = async e => {
    e.preventDefault();
    const d = formData(f);
    const skip = e.submitter?.name === 'skip';
    const date = today() + 'T00:00';
    state.tx = state.tx.filter(t => t.type !== 'opening');
    state.tx.push({ id: uid(), type: 'opening', date, wl: { ...draft.w }, jl: { ...draft.j }, created: Date.now() });
    if (!skip && d.name) {
      const inv = { id: uid(), name: d.name, type: 'association', initial: parseMoney(d.initial || 0) || 0, start: d.start || '',
        freq: +d.freq || 2, next: d.next || addMonths(today(), +d.freq || 2), reinvest: !!d.reinvest, missed: [] };
      state.investments.push(inv);
      const aug = parseMoney(d.aug || 0) || 0;
      if (aug > 0) state.tx.push({ id: uid(), type: 'income', history: true, date: (d.augDate || today()) + 'T12:00', amount: aug,
        wallet: 'om', cat: 'inv_return', passive: true, investment: inv.id, alloc: [{ jar: 'inv', amount: aug }], note: inv.name, created: Date.now() });
    }
    state.settings.setupDone = true;
    state.settings.setupAt = today();
    await save();
    go('#/');
  };
}
