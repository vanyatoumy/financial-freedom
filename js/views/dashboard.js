import { state } from '../store.js';
import { summary, reminders, freedom, fmt, monthStats, today, nowLocal, countStreak } from '../logic.js';
import { esc, addTx, icon, tile } from '../ui.js';

// New users get a short guided checklist; it disappears once every step is done.
function firstSteps() {
  const own = state.tx.filter(t => t.type !== 'opening' && !t.history);
  const steps = [
    { done: own.some(t => t.type === 'income'), t: 'Ajoute ton premier revenu', s: 'Il sera réparti sur tes 6 comptes', href: '#/add?type=income', ic: 'plus' },
    { done: own.some(t => t.type === 'expense'), t: 'Note une dépense', s: 'Taxi, marché, crédit… en 3 touches', href: '#/add?type=expense', ic: 'minus' },
    { done: state.counts.length > 0, t: 'Fais ton comptage du matin', s: 'Vérifie OM, MOMO, PAYSIKA et CASH', href: '#/count', ic: 'sun' },
    { done: state.favorites.length > 0, t: 'Crée un favori', s: 'Coche « Ajouter aux favoris » sur une dépense', href: '#/add?type=expense', ic: 'star' },
    { done: state.loans.length > 0 || state.subs.length > 0, t: 'Note un prêt, une dette ou un abonnement', s: 'Pour ne plus rien oublier', href: '#/more', ic: 'repeat' },
  ];
  const n = steps.filter(x => x.done).length;
  if (n === steps.length) return '';
  return `<h3>Premiers pas · ${n}/${steps.length}</h3>
  <div class="card tight steps">${steps.map(x => `<a class="row ${x.done ? 'done' : ''}" href="${x.href}">
    <span class="row-ico" style="--c:${x.done ? 'var(--ok)' : 'var(--primary)'}">${icon(x.done ? 'check' : x.ic)}</span>
    <div class="l"><div class="t">${x.t}</div><div class="s">${x.s}</div></div>${x.done ? '' : '<span class="chev">›</span>'}</a>`).join('')}</div>`;
}

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
      <div><div class="label">${icon('shield')} Protégé</div><b class="num">${fmt(s.protectedAmt)}</b>
        <div class="sub">${vaultW.map(w => `${esc(w.name)} ${fmt(s.b.w[w.id])}`).join(' · ')}${notHome > 0 ? ` · à ranger ${fmt(notHome)}` : ''}</div></div>
      <div><div class="label">${icon('chart')} Valeur nette</div><b class="num">${fmt(s.netWorth)}</b>
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

  ${firstSteps()}

  ${rem.length ? `<h3>À faire · ${rem.length}</h3>
  <div class="card tight todo">${rem.map(r => `<a class="row" href="${r.action || '#/'}"><span class="row-ico lvl-${r.level}">${icon(r.icon || 'info')}</span>
    <div class="l"><div class="txt">${esc(r.text)}</div></div><span class="chev">›</span></a>`).join('')}</div>` : ''}

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
    ${fr.pct === null ? `<p class="muted small">Note tes dépenses de Nécessité : on calculera quelle part de tes besoins tes revenus passifs couvrent.</p>` : `
    <div class="big num">${fr.pct.toFixed(1)} %</div>
    <p class="small muted">de tes besoins couverts par tes revenus passifs</p>
    <div class="meter mt"><i style="width:${Math.min(100, fr.pct)}%"></i></div>`}
    <p class="small muted mt">Passifs ${fmt(fr.passive)}/mois · Besoins ${fmt(fr.needs)}/mois · 3 derniers mois</p>
  </div>

  <h3>Ce mois-ci</h3>
  <div class="card grid3 center">
    <div class="stat"><span class="label">Revenus</span><b class="num pos">${fmt(m.income)}</b></div>
    <div class="stat"><span class="label">Dépenses</span><b class="num">${fmt(m.spent)}</b></div>
    <a class="stat" href="#/fees?p=month" style="color:inherit"><span class="label">Frais & taxes ›</span><b class="num">${fmt(m.fees)}</b></a>
  </div>`;
}

export function mount(root) {
  root.querySelectorAll('[data-fav]').forEach(b => b.onclick = () => {
    const f = state.favorites.find(x => x.id === b.dataset.fav);
    if (!f) return;
    addTx({ type: 'expense', date: nowLocal(), amount: f.amount, wallet: f.wallet, jar: f.jar, cat: f.cat, note: f.note || '' }, `${f.label} : ${fmt(f.amount)}`);
  });
}
