import { state } from '../store.js';
import { fmt, summary, loanInfo } from '../logic.js';
import { tile } from '../ui.js';

export function render() {
  const s = summary();
  const late = state.loans.filter(l => loanInfo(l).status === 'late').length;
  const item = (href, ic, title, sub) => `<a class="row" href="${href}">${tile(ic)}<div class="l"><div class="t">${title}</div><div class="s">${sub}</div></div><span class="chev">›</span></a>`;
  return `<div class="card tight menu">
      ${item('#/loans?tab=lent', 'arrow-up-right', 'Prêts', `On me doit ${fmt(s.lent)}${late ? ` · ${late} en retard` : ''}`)}
      ${item('#/loans?tab=borrowed', 'arrow-down-left', 'Dettes', `Je dois ${fmt(s.owed)}`)}
      ${item('#/invest', 'trending-up', 'Investissements', `Valeur ${fmt(s.invValue)}`)}
      ${item('#/svc', 'store', 'Services clients', s.clients > 0 ? `Argent clients détenu ${fmt(s.clients)}` : s.clients < 0 ? `Avancé pour des clients ${fmt(-s.clients)}` : 'Achats pour des clients, ta marge')}
      ${item('#/subs', 'repeat', 'Abonnements', `${state.subs.filter(x => x.keep).length} actif(s)`)}
      ${item('#/add?type=transfer', 'transfer', 'Retrait / Dépôt', 'OM/MOMO → CASH ou PAYSIKA, CASH → OM/MOMO, MOMO → UBA')}
      ${item('#/add?type=jar_move', 'shuffle', 'Déplacer entre comptes', 'Pour les exceptions')}
      ${item('#/fees?p=month', 'receipt', 'Frais & taxes', 'Bilan par jour, mois, année ou période')}
      ${item('#/settings', 'sliders', 'Réglages', 'Pourcentages, portefeuilles, sauvegarde')}
    </div>`;
}
