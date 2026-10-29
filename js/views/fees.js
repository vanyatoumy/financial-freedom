// Fees & taxes paid on OM / MOMO / PAYSIKA operations, for a day, a month, a year or any period.
import { fmt, fmtDate, today, addDays, feeReport, feeKind, txTitle, wallet } from '../logic.js';
import { esc, tile, emptyState } from '../ui.js';

const PERIODS = [['day', "Aujourd'hui"], ['month', 'Ce mois'], ['year', 'Cette année'], ['custom', 'Période']];

function range(q) {
  const t = today();
  switch (q.get('p') || 'month') {
    case 'day': return [t, t];
    case 'year': return [t.slice(0, 4) + '-01-01', t];
    case 'custom': return [q.get('from') || addDays(t, -30), q.get('to') || t];
    default: return [t.slice(0, 8) + '01', t];
  }
}

const KIND_ICON = { Retraits: 'download', 'Dépôts': 'upload', 'Envois UBA': 'lock', Paiements: 'cart', 'Réceptions': 'arrow-down-left',
  'Prêts & dettes': 'users', Investissements: 'trending-up', Transferts: 'transfer', Autres: 'tag' };

export function render({ q }) {
  const p = q.get('p') || 'month';
  const [from, to] = range(q);
  const r = feeReport(from, to);
  const days = Math.max(1, Math.round((new Date(to) - new Date(from)) / 864e5) + 1);
  const line = ([k, v], ic, color, name) => `<div class="row">${tile(ic, color)}<div class="l"><div class="t">${esc(name)}</div>
    <div class="s">${v.n} opération${v.n > 1 ? 's' : ''} · frais ${fmt(v.fee)} · taxes ${fmt(v.tax)}</div></div><div class="r num">${fmt(v.fee + v.tax)}</div></div>`;

  return `<div class="chips">${PERIODS.map(([k, l]) => `<a class="chip ${k === p ? 'on' : ''}" href="#/fees?p=${k}">${l}</a>`).join('')}</div>
    ${p === 'custom' ? `<form id="period" class="card grid2">
      <div class="field"><label>Du</label><input type="date" name="from" value="${from}"></div>
      <div class="field"><label>Au</label><input type="date" name="to" value="${to}"></div>
    </form>` : ''}
    <div class="card">
      <span class="label">${from === to ? fmtDate(from) : `Du ${fmtDate(from)} au ${fmtDate(to)}`}</span>
      <div class="big num">${fmt(r.total)}</div>
      <p class="small muted">de frais et taxes${days > 1 && r.total ? ` · ≈ ${fmt(Math.round(r.total / days))} par jour` : ''}</p>
      <div class="hr"></div>
      <div class="grid2">
        <div class="stat"><span class="label">Frais</span><b class="num">${fmt(r.fee)}</b></div>
        <div class="stat"><span class="label">Taxes</span><b class="num">${fmt(r.tax)}</b></div>
      </div>
    </div>
    ${r.list.length ? `
    <h3>Par portefeuille</h3>
    <div class="card tight">${r.byWallet.map(e => { const w = wallet(e[0]); return line(e, w?.icon || 'wallet', w?.color, w?.name || e[0]); }).join('')}</div>
    <h3>Par opération</h3>
    <div class="card tight">${r.byKind.map(e => line(e, KIND_ICON[e[0]] || 'tag', 'var(--primary)', e[0])).join('')}</div>
    <h3>Détail</h3>
    <div class="card tight">${r.list.map(t => `<div class="row"><div class="l"><div class="t">${esc(txTitle(t))}</div>
      <div class="s">${fmtDate(t.date, true)} · ${esc(feeKind(t))} · ${esc(wallet(t.feeWallet || t.wallet)?.name || '')}</div></div>
      <div class="r num">${fmt((t.fee || 0) + (t.tax || 0))}<div class="small muted">${t.fee ? 'frais ' + fmt(t.fee) : ''}${t.fee && t.tax ? ' · ' : ''}${t.tax ? 'taxe ' + fmt(t.tax) : ''}</div></div></div>`).join('')}</div>`
    : `<div class="card">${emptyState('receipt', 'Aucun frais sur cette période', 'Les frais et taxes notés sur tes opérations OM, MOMO et PAYSIKA apparaîtront ici.')}</div>`}`;
}

export function mount(root) {
  const f = root.querySelector('#period');
  if (f) f.onchange = () => { location.hash = `#/fees?p=custom&from=${f.from.value}&to=${f.to.value}`; };
}
