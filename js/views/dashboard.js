import { state } from '../store.js';
import { summary, reminders, freedom, fmt, monthStats, today, nowLocal, countStreak } from '../logic.js';
import { esc, addTx, icon, tile } from '../ui.js';

export function render() {
  const s = summary();
  const ym = today().slice(0, 7);
  const m = monthStats(ym);
  const fr = freedom();
  const rem = reminders();
  const streak = countStreak();
  const spendW = state.wallets.filter(w => w.role !== 'vault');
  const vaultW = state.wallets.filter(w => w.role === 'vault');
  const notHome = s.pending.reduce((a, p) => a + p.amount, 0);

  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return `
  <div class="hero">
    <div class="label">${hello} · Disponible aujourd'hui</div>
    <div class="big">${fmt(s.available)}</div>
    <div class="sub">${spendW.map(w => `${esc(w.name)} ${fmt(s.b.w[w.id])}`).join(' · ')}</div>
    <div class="hr"></div>
    <div class="grid2">
      <div><div class="label">${icon('shield')} Protégé</div><b>${fmt(s.protectedAmt)}</b>
        <div class="sub">${vaultW.map(w => `${esc(w.name)} ${fmt(s.b.w[w.id])}`).join(' · ')}${notHome > 0 ? ` · à ranger ${fmt(notHome)}` : ''}</div></div>
      <div><div class="label">${icon('chart')} Valeur nette</div><b>${fmt(s.netWorth)}</b>
        <div class="sub">prêté ${fmt(s.lent)} · dettes ${fmt(s.owed)}</div></div>
    </div>
  </div>

  <div class="actions">
    <a class="qa" href="#/add?type=expense"><i>${icon('minus')}</i>Dépense</a>
    <a class="qa" href="#/add?type=income"><i>${icon('plus')}</i>Revenu</a>
    <a class="qa" href="#/add?type=transfer"><i>${icon('transfer')}</i>Transfert</a>
    <a class="qa" href="#/count"><i>${icon('sun')}</i>${streak ? `${streak} j de suite` : 'Comptage'}</a>
  </div>

  ${state.favorites.length ? `<h3>Favoris</h3><div class="chips">${state.favorites.map(f => `<button class="chip" data-fav="${f.id}">${esc(f.label)} <small>${fmt(f.amount)}</small></button>`).join('')}</div>` : ''}

  ${rem.length ? `<h3>À faire · ${rem.length}</h3>
  <div class="card tight todo">${rem.map(r => `<a class="row" href="${r.action || '#/'}"><span class="row-ico lvl-${r.level}">${icon(r.icon || 'info')}</span>
    <div class="l" style="white-space:normal"><div class="small" style="font-weight:550">${esc(r.text)}</div></div><span class="chev">›</span></a>`).join('')}</div>` : ''}

  <h3>Mes 6 comptes</h3>
  <div class="grid2">
    ${state.jars.map(j => {
      const spent = m.byJar[j.id] || 0;
      return `<a class="jar" style="--c:${j.color}" href="#/jar/${j.id}">
        ${tile(j.icon, j.color, 'jar-ico')}
        <div class="name"><span>${esc(j.name)}</span><span>${j.pct}%</span></div>
        <div class="amt ${s.b.j[j.id] < 0 ? 'neg' : ''}">${fmt(s.b.j[j.id])}</div>
        <div class="meta">${j.rule === 'no_spend' ? 'Ne jamais dépenser' : `Ce mois : −${fmt(spent)}`}</div>
      </a>`;
    }).join('')}
  </div>

  <h3>Liberté financière</h3>
  <div class="card">
    ${fr.pct === null ? `<p class="muted small">Ajoute tes dépenses de Nécessité pour calculer ta liberté financière.</p>` : `
    <div class="meter"><i style="width:${Math.min(100, fr.pct)}%"></i></div>
    <p class="mt"><b>${fr.pct.toFixed(1)} %</b> de tes besoins sont couverts par tes revenus passifs.</p>`}
    <p class="small muted">Revenus passifs : ${fmt(fr.passive)}/mois · Besoins : ${fmt(fr.needs)}/mois (moyenne 3 derniers mois)</p>
  </div>

  <h3>Ce mois-ci</h3>
  <div class="card grid3 center">
    <div><div class="small muted">Revenus</div><b class="pos">${fmt(m.income)}</b></div>
    <div><div class="small muted">Dépenses</div><b class="neg">${fmt(m.spent)}</b></div>
    <div><div class="small muted">Frais</div><b>${fmt(m.fees)}</b></div>
  </div>`;
}

export function mount(root) {
  root.querySelectorAll('[data-fav]').forEach(b => b.onclick = () => {
    const f = state.favorites.find(x => x.id === b.dataset.fav);
    if (!f) return;
    addTx({ type: 'expense', date: nowLocal(), amount: f.amount, wallet: f.wallet, jar: f.jar, cat: f.cat, note: f.note || '' }, `${f.label} : ${fmt(f.amount)}`);
  });
}
