// One jar: balance, this month, and every movement that touched it.
import { state } from '../store.js';
import { fmt, fmtDate, today, effects, txTitle, balances, jar, wallet } from '../logic.js';
import { esc, icon, tile } from '../ui.js';

const RULES = {
  normal: 'Compte de dépenses normales.',
  no_spend: "Ne jamais dépenser : cet argent sert uniquement à investir pour créer des revenus passifs.",
  goal: 'Pour les gros achats prévus (voiture, voyage, maison…).',
  must_spend: 'À dépenser chaque mois, pour toi, sans culpabilité !',
};

export function render({ id }) {
  const j = jar(id);
  if (!j) return '<div class="empty">Introuvable.</div>';
  const b = balances();
  const ym = today().slice(0, 7);
  const moves = state.tx.map(t => ({ t, v: effects(t).j[j.id] || 0 })).filter(x => x.v).sort((a, c) => c.t.date.localeCompare(a.t.date));
  const month = moves.filter(x => x.t.date.startsWith(ym));
  const inM = month.filter(x => x.v > 0).reduce((s, x) => s + x.v, 0);
  const outM = month.filter(x => x.v < 0).reduce((s, x) => s - x.v, 0);
  const home = j.home && wallet(j.home);
  return `<div class="card jar" style="--c:${j.color}">
      ${tile(j.icon, j.color, 'jar-ico')}<div class="name"><span>${esc(j.name)}</span><span>${j.pct}% de chaque revenu</span></div>
      <div class="amt" style="font-size:28px">${fmt(b.j[j.id])}</div>
      <p class="small muted">${RULES[j.rule] || ''}</p>
      ${home ? `<p class="small">${icon('home')} Rangé dans <b>${esc(home.name)}</b> : ${fmt(b.w[home.id])}${b.j[j.id] - b.w[home.id] > 0 ? ` · <span class="neg">${fmt(b.j[j.id] - b.w[home.id])} pas encore rangé</span>` : ' ' + icon('check')}</p>` : ''}
    </div>
    <div class="card grid2 center"><div><div class="small muted">Entré ce mois</div><b class="pos">${fmt(inM)}</b></div><div><div class="small muted">Sorti ce mois</div><b class="neg">${fmt(outM)}</b></div></div>
    ${j.rule === 'no_spend' ? `<a class="btn block" href="#/invest">${icon('trending-up')} Voir mes investissements</a>` : `<a class="btn block" href="#/add?type=expense&jar=${j.id}&back=%23%2Fjar%2F${j.id}">${icon('minus')} Dépenser depuis ce compte</a>`}
    <h3 class="mt">Mouvements</h3>
    <div class="card tight">${moves.slice(0, 200).map(({ t, v }) => `<div class="row"><div class="l"><div class="t">${esc(txTitle(t))}</div><div class="s">${fmtDate(t.date, true)}</div></div>
      <div class="r ${v > 0 ? 'pos' : 'neg'}">${fmt(v, { sign: true })}</div></div>`).join('') || '<div class="empty">Aucun mouvement.</div>'}</div>`;
}
