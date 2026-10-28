// Morning count: type what each wallet really holds, then explain or accept the gaps.
import { state, save, uid } from '../store.js';
import { parseMoney, fmt, toInput, balances, today, nowLocal, countStreak, fmtDate, wallet } from '../logic.js';
import { esc, addTx, go, toast, jarOpts, ask, icon, tile } from '../ui.js';

let typed = {}; // keeps what the user typed while they go add a forgotten expense

export function render() {
  const b = balances();
  const done = state.counts.find(c => c.date === today());
  const daily = state.wallets.filter(w => w.daily);
  const vaults = state.wallets.filter(w => !w.daily);
  const row = w => `<div class="count-row">
      <div class="wname">${tile(w.icon, w.color, 'mini-ico')}<div><b>${esc(w.name)}</b><div class="small muted">attendu ${fmt(b.w[w.id])}</div></div></div>
      <input data-w="${w.id}" inputmode="decimal" placeholder="${toInput(b.w[w.id]) || '0'}" value="${typed[w.id] ?? ''}">
      <div class="gap" data-gap="${w.id}"></div>
    </div>`;
  const last = state.counts.slice(-7).reverse();
  return `
    <p class="muted small">${fmtDate(today())} · Tape ce que tu as vraiment dans chaque portefeuille. ${countStreak() ? `<span class="streak">${icon('flame')} ${countStreak()} jour(s) de suite</span>` : ''}</p>
    ${done ? `<div class="alert ok">${icon('check')} Déjà fait aujourd'hui (écart ${fmt(done.gap, { sign: true })}). Tu peux recompter.</div>` : ''}
    <div class="card tight">${daily.map(row).join('')}
      <div class="count-row"><b>Total</b><b id="tot-actual" style="text-align:right"></b><div class="gap" id="tot-gap"></div></div>
    </div>
    <details class="card"><summary><span>${icon('lock')} Coffres (UBA, Caisse) — à vérifier de temps en temps</span></summary>
      <div class="mt">${vaults.map(row).join('')}</div>
    </details>
    <div id="gaps"></div>
    <button class="btn primary block" id="validate">Valider le comptage</button>
    ${last.length ? `<h3 class="mt">Derniers comptages</h3><div class="card tight">${last.map(c => `<div class="row"><div class="l"><div class="t">${fmtDate(c.date)}</div></div><div class="r ${c.gap ? 'neg' : 'pos'}">${c.gap ? fmt(c.gap, { sign: true }) : icon('check')}</div></div>`).join('')}</div>` : ''}`;
}

export function mount(root) {
  const b = balances();
  const inputs = [...root.querySelectorAll('[data-w]')];
  const val = id => { const i = root.querySelector(`[data-w="${id}"]`); return i.value.trim() === '' ? null : parseMoney(i.value); };

  function gaps() {
    return inputs.map(i => ({ w: wallet(i.dataset.w), actual: val(i.dataset.w) }))
      .filter(x => x.actual !== null && !isNaN(x.actual))
      .map(x => ({ ...x, gap: x.actual - (b.w[x.w.id] || 0) }));
  }

  function update() {
    inputs.forEach(i => { typed[i.dataset.w] = i.value; });
    const g = gaps();
    for (const i of inputs) {
      const x = g.find(y => y.w.id === i.dataset.w);
      const el = root.querySelector(`[data-gap="${i.dataset.w}"]`);
      el.className = 'gap ' + (x ? (x.gap === 0 ? 'pos' : 'neg') : '');
      el.innerHTML = x ? (x.gap === 0 ? icon('check') : fmt(x.gap, { sign: true })) : '';
    }
    const daily = state.wallets.filter(w => w.daily);
    const actual = daily.reduce((s, w) => s + (val(w.id) ?? b.w[w.id] ?? 0), 0);
    const gapTotal = actual - daily.reduce((s, w) => s + (b.w[w.id] || 0), 0);
    root.querySelector('#tot-actual').textContent = fmt(actual);
    const tg = root.querySelector('#tot-gap'); tg.innerHTML = gapTotal ? fmt(gapTotal, { sign: true }) : icon('check'); tg.className = 'gap ' + (gapTotal ? 'neg' : 'pos');

    const bad = g.filter(x => x.gap !== 0);
    root.querySelector('#gaps').innerHTML = bad.length ? `<h3>Que s'est-il passé ?</h3>${bad.map(x => `
      <div class="card">
        <b>${esc(x.w.name)} : ${fmt(x.gap, { sign: true })}</b>
        <div class="chips mt" style="flex-wrap:wrap">
          ${x.gap < 0 ? `<a class="chip" href="#/add?type=expense&wallet=${x.w.id}&amount=${-x.gap}&back=%23%2Fcount">${icon('minus')} Dépense oubliée</a>
            <a class="chip" href="#/add?type=expense&wallet=${x.w.id}&amount=${-x.gap}&cat=fees&back=%23%2Fcount">${icon('receipt')} Frais</a>`
          : `<a class="chip" href="#/add?type=income&wallet=${x.w.id}&amount=${x.gap}&back=%23%2Fcount">${icon('plus')} Revenu oublié</a>
            ${x.w.interestPct ? `<a class="chip" href="#/add?type=income&wallet=${x.w.id}&amount=${x.gap}&cat=interest&jar=${state.jars.find(j => j.home === x.w.id)?.id || ''}&back=%23%2Fcount">${icon('percent')} Intérêts</a>` : ''}`}
        </div>
        <div class="field mt"><label>Sinon, écart inconnu pris sur</label><select data-gapjar="${x.w.id}">${jarOpts(state.jars.find(j => j.home === x.w.id)?.id || state.settings.gapJar || 'nec')}</select></div>
      </div>`).join('')}` : '';
  }
  inputs.forEach(i => i.oninput = update);
  update();

  root.querySelector('#validate').onclick = async () => {
    const g = gaps();
    if (!g.length) return toast('Tape au moins un montant');
    const bad = g.filter(x => x.gap !== 0);
    if (bad.length && !(await ask(`Enregistrer ${bad.length} écart(s) inconnu(s) ? (sinon, utilise les boutons pour les expliquer)`, { ok: 'Continuer' }))) return;
    const date = nowLocal();
    const adj = bad.map(x => ({ type: 'adjust', date, amount: x.gap, wallet: x.w.id,
      jar: root.querySelector(`[data-gapjar="${x.w.id}"]`)?.value || 'nec', note: 'Écart non expliqué' }));
    state.counts = state.counts.filter(c => c.date !== today());
    state.counts.push({ id: uid(), date: today(), gap: bad.reduce((s, x) => s + x.gap, 0),
      lines: g.map(x => ({ wallet: x.w.id, expected: b.w[x.w.id] || 0, actual: x.actual })) });
    typed = {};
    if (adj.length) await addTx(adj, 'Comptage enregistré'); else { await save(); toast('Comptage parfait !'); }
    go('#/');
  };
}
