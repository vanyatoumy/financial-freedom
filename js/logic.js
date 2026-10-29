// Money rules: every transaction moves money in wallets (where it is) and jars (what it is for).
// Balances are never stored; they are recomputed from the transaction list.
import { state } from './store.js';

// ---------- money & dates ----------
export function parseMoney(str) {
  if (typeof str === 'number') return Math.round(str * 100);
  const s = String(str ?? '').replace(/[\s  ]/g, '').replace(',', '.');
  if (!s || !/^-?\d*\.?\d*$/.test(s)) return NaN;
  return Math.round(parseFloat(s) * 100);
}

const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function fmt(c, { sign = false } = {}) {
  c = Math.round(c || 0);
  const v = c / 100;
  const s = (c % 100 ? nf2 : nf0).format(Math.abs(v)) + ' F';
  if (v < 0) return '−' + s;
  return sign && v > 0 ? '+' + s : s;
}
export const toInput = c => (c ? String(c / 100).replace('.', ',') : '');

const pad = n => String(n).padStart(2, '0');
export const dateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => dateStr(new Date());
export const nowLocal = () => { const d = new Date(); return `${dateStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export function addDays(ds, n) { const d = new Date(ds.slice(0, 10) + 'T12:00'); d.setDate(d.getDate() + n); return dateStr(d); }
export function addMonths(ds, n) {
  const d = new Date(ds.slice(0, 10) + 'T12:00'); const day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return dateStr(d);
}
export const daysBetween = (a, b) => Math.round((new Date(b.slice(0, 10) + 'T12:00') - new Date(a.slice(0, 10) + 'T12:00')) / 864e5);
export function fmtDate(ds, withTime = false) {
  if (!ds) return '';
  const d = new Date(ds.length <= 10 ? ds + 'T12:00' : ds);
  const o = { day: '2-digit', month: 'short', year: 'numeric' };
  if (withTime && ds.length > 10) Object.assign(o, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('fr-FR', o);
}

// ---------- lookups ----------
export const jar = id => state.jars.find(j => j.id === id);
// The 6 jars the user sees (the hidden client-money reserve is left out).
export const userJars = () => state.jars.filter(j => !j.hidden);
export const service = id => state.services.find(s => s.id === id);
export const wallet = id => state.wallets.find(w => w.id === id);
export const cat = id => state.categories.find(c => c.id === id);
export const loan = id => state.loans.find(l => l.id === id);
export const investment = id => state.investments.find(i => i.id === id);

// ---------- split ----------
// Each jar gets its % rounded down to the whole franc; the leftover goes to the remainder jar.
export function split(amount) {
  const rem = state.settings.remainderJar || 'nec';
  const parts = state.jars.filter(j => j.pct > 0).map(j => ({ jar: j.id, amount: Math.floor(amount * j.pct / 100 / 100) * 100 }));
  const left = amount - parts.reduce((s, p) => s + p.amount, 0);
  const r = parts.find(p => p.jar === rem) || parts[0];
  if (r) r.amount += left;
  return parts;
}

// ---------- effects of one transaction ----------
export function effects(tx) {
  const w = {}, j = {};
  const add = (m, k, v) => { if (k && v) m[k] = (m[k] || 0) + v; };
  const a = tx.amount || 0;
  if (tx.history) return { w, j }; // past event recorded for stats only, already in the opening balances
  switch (tx.type) {
    case 'income':
      add(w, tx.wallet, a);
      (tx.alloc || []).forEach(p => add(j, p.jar, p.amount));
      break;
    case 'expense': case 'loan_out': case 'debt_pay': case 'invest':
      add(w, tx.wallet, -a); add(j, tx.jar, -a); break;
    case 'svc_in': // client money received: lands in the client reserve
      add(w, tx.wallet, a); add(j, 'cli', a); break;
    case 'svc_out': // service bought for a client: paid out of the client reserve (goes negative when I advance it)
      add(w, tx.wallet, -a); add(j, 'cli', -a); break;
    case 'svc_close': // what is left in the reserve for this service is my margin (or my loss)
      add(j, 'cli', -a);
      if (a > 0) (tx.alloc || []).forEach(p => add(j, p.jar, p.amount)); else add(j, tx.jar || 'nec', a);
      break;
    case 'loan_in': case 'debt_in': case 'div_collect':
      add(w, tx.wallet, a); add(j, tx.jar, a); break;
    // div_accrue (dividend earned, held by the association) and div_convert (dividends → capital)
    // don't touch wallets or jars: the money stays inside the investment.
    case 'transfer':
      add(w, tx.wallet, -a); add(w, tx.to, a); break;
    case 'jar_move': case 'forgive':
      // forgive: Dons (jar) pays for the gift, the jar the loan came from (toJar) is refunded
      add(j, tx.jar, -a); add(j, tx.toJar, a); break;
    case 'adjust':
      add(w, tx.wallet, a); add(j, tx.jar, a); break;
    case 'opening':
      Object.entries(tx.wl || {}).forEach(([k, v]) => add(w, k, v));
      Object.entries(tx.jl || {}).forEach(([k, v]) => add(j, k, v));
      break;
  }
  // fees and taxes of any operation: taken from the wallet that charged them, paid by the fee jar (Nécessité)
  const charges = (tx.fee || 0) + (tx.tax || 0);
  if (charges) { add(w, tx.feeWallet || tx.wallet, -charges); add(j, tx.feeJar || state.settings.feeJar || 'nec', -charges); }
  return { w, j };
}
export function balances(txs = state.tx) {
  const w = Object.fromEntries(state.wallets.map(x => [x.id, 0]));
  const j = Object.fromEntries(state.jars.map(x => [x.id, 0]));
  for (const t of txs) {
    const e = effects(t);
    for (const k in e.w) w[k] = (w[k] || 0) + e.w[k];
    for (const k in e.j) j[k] = (j[k] || 0) + e.j[k];
  }
  return { w, j };
}

// ---------- loans & debts ----------
export function loanInfo(l) {
  const txs = state.tx.filter(t => t.loan === l.id);
  let paid = 0, interest = 0, forgiven = 0;
  for (const t of txs) {
    if (t.type === 'loan_in') paid += t.amount;
    if (t.type === 'income') interest += t.amount; // interest earned on a loan I made
    if (t.type === 'debt_pay') { paid += t.amount - (t.interestPart || 0); interest += t.interestPart || 0; }
    if (t.type === 'forgive') forgiven += t.amount;
  }
  const remaining = Math.max(0, l.amount - paid - forgiven);
  const t = today();
  let status = 'active';
  if (forgiven > 0 && remaining === 0) status = 'forgiven';
  else if (remaining === 0) status = 'done';
  else if (l.due && l.due < t) status = 'late';
  else if (paid > 0) status = 'partial';
  return { paid, interest, forgiven, remaining, status, txs };
}
export const STATUS_LABEL = {
  active: ['En cours', ''], partial: ['Partiellement remboursé', 'warn'], late: ['En retard', 'danger'],
  done: ['Remboursé', 'ok'], forgiven: ['Pardonné (don)', 'ok'],
};

// ---------- investments ----------
// Dividends can be paid straight into a wallet ('income'), or held by the association first
// ('div_accrue' → 'à percevoir'), then collected into a wallet ('div_collect') or turned into capital ('div_convert').
export function investInfo(inv) {
  const txs = state.tx.filter(t => t.investment === inv.id);
  const sum = (type, f = () => true) => txs.filter(t => t.type === type && f(t)).reduce((s, t) => s + t.amount, 0);
  const direct = sum('income');
  const converted = sum('div_convert');
  const collected = sum('div_collect');
  const capital = (inv.initial || 0) + sum('invest') + converted;
  const pending = Math.max(0, (inv.accrued || 0) + sum('div_accrue', t => !t.history) - collected - converted);
  const dividends = txs.filter(t => t.type === 'div_accrue' || t.type === 'income').sort((a, b) => a.date.localeCompare(b.date));
  const earned = dividends.reduce((s, t) => s + t.amount, 0);
  const recent = dividends.slice(-6);
  const avg = recent.length ? recent.reduce((s, t) => s + t.amount, 0) / recent.length : 0;
  const yearly = capital > 0 && avg ? avg * (12 / (inv.freq || 1)) / capital * 100 : null;
  const commitment = inv.commitment || 0;
  return {
    capital, invested: capital, pending, earned, received: collected + direct, dividends, returns: dividends, avg, yearly,
    commitment, toPay: Math.max(0, commitment - capital), value: inv.value ?? capital + pending,
    roi: capital ? earned / capital * 100 : 0,
  };
}

// ---------- mobile wallets: allowed moves, fees & taxes ----------
export function canTransfer(from, to) {
  const F = wallet(from), T = wallet(to);
  if (!F || !T || from === to) return false;
  const into = T.allowFrom || T.onlyFrom;
  return (!F.allowTo || F.allowTo.includes(to)) && (!into || into.includes(from));
}
export function transferKind(from, to) {
  const F = wallet(from), T = wallet(to);
  if (T?.role === 'vault' && T.onlyFrom) return 'Envoi';
  if (F?.fees) return 'Retrait';
  if (T?.fees) return 'Dépôt';
  return 'Transfert';
}
// The wallet that charges the fees of a transfer: the mobile wallet involved.
export const feeWalletOf = (from, to) => (wallet(from)?.fees ? from : wallet(to)?.fees ? to : from);

const FEE_KIND = { transfer: null, expense: 'Paiements', income: 'Réceptions', loan_in: 'Prêts & dettes', debt_in: 'Prêts & dettes',
  loan_out: 'Prêts & dettes', debt_pay: 'Prêts & dettes', invest: 'Investissements', div_collect: 'Investissements',
  svc_in: 'Services clients', svc_out: 'Services clients' };
export function feeKind(t) {
  if (t.service) return 'Services clients';
  return t.type === 'transfer' ? (transferKind(t.wallet, t.to) === 'Envoi' ? 'Envois UBA' : transferKind(t.wallet, t.to) + 's') : FEE_KIND[t.type] || 'Autres';
}

// Every operation with fees or taxes between two dates (inclusive, YYYY-MM-DD).
export function feeReport(from, to) {
  const list = state.tx.filter(t => !t.history && ((t.fee || 0) + (t.tax || 0)) > 0 && t.date.slice(0, 10) >= from && t.date.slice(0, 10) <= to)
    .sort((a, b) => b.date.localeCompare(a.date));
  const fee = list.reduce((s, t) => s + (t.fee || 0), 0);
  const tax = list.reduce((s, t) => s + (t.tax || 0), 0);
  const group = keyOf => {
    const m = {};
    for (const t of list) { const k = keyOf(t); (m[k] ||= { fee: 0, tax: 0, n: 0 }); m[k].fee += t.fee || 0; m[k].tax += t.tax || 0; m[k].n++; }
    return Object.entries(m).sort((a, b) => (b[1].fee + b[1].tax) - (a[1].fee + a[1].tax));
  };
  return { list, fee, tax, total: fee + tax, byWallet: group(t => t.feeWallet || t.wallet), byKind: group(feeKind) };
}

// ---------- services bought for clients ----------
// Client money in (svc_in), service paid (svc_out), and every fee/tax charged to the reserve for this service.
export function svcInfo(s) {
  const txs = state.tx.filter(t => t.service === s.id);
  const sum = type => txs.filter(t => t.type === type).reduce((a, t) => a + t.amount, 0);
  const received = sum('svc_in'), cost = sum('svc_out');
  const fees = txs.reduce((a, t) => a + (t.fee || 0) + (t.tax || 0), 0);
  const close = txs.find(t => t.type === 'svc_close');
  const margin = close ? close.amount : received - cost - fees;
  const due = s.agreed ? Math.max(0, s.agreed - received) : 0;
  const advanced = Math.max(0, cost + fees - received); // money I put in myself and still wait for
  return { txs, received, cost, fees, margin, due, advanced, closed: !!close };
}

// ---------- summaries ----------
export function summary() {
  const b = balances();
  const spendJars = state.jars.filter(j => j.rule === 'normal' || j.rule === 'must_spend');
  const available = spendJars.reduce((s, j) => s + (b.j[j.id] || 0), 0);
  const protectedAmt = state.jars.filter(j => j.rule === 'no_spend' || j.rule === 'goal').reduce((s, j) => s + (b.j[j.id] || 0), 0);
  const pending = state.jars.filter(j => j.home && wallet(j.home)).map(j => ({
    jar: j, wallet: wallet(j.home), amount: (b.j[j.id] || 0) - (b.w[j.home] || 0),
  })).filter(p => p.amount > 0);
  let lent = 0, owed = 0;
  for (const l of state.loans) {
    const r = loanInfo(l).remaining;
    if (l.dir === 'lent') lent += r; else owed += r;
  }
  const invValue = state.investments.reduce((s, i) => s + investInfo(i).value, 0);
  const cash = Object.values(b.w).reduce((s, v) => s + v, 0);
  const clients = b.j.cli || 0; // > 0: client money I hold · < 0: money I advanced for clients
  return { b, available: available + Math.min(0, clients), protectedAmt, pending, lent, owed, invValue, cash, clients,
    netWorth: cash + lent + invValue - owed - clients };
}

// Passive income vs living costs over the last 90 days.
export function freedom() {
  const from = addDays(today(), -90);
  const recent = state.tx.filter(t => t.date.slice(0, 10) >= from);
  const passive = recent.filter(t => (t.type === 'income' && t.passive) || t.type === 'div_accrue').reduce((s, t) => s + t.amount, 0);
  const needs = recent.filter(t => (t.type === 'expense' || t.type === 'debt_pay') && t.jar === 'nec').reduce((s, t) => s + t.amount, 0);
  const months = 3;
  return { passive: passive / months, needs: needs / months, pct: needs ? passive / needs * 100 : null };
}

export function monthStats(ym) {
  const txs = state.tx.filter(t => t.date.startsWith(ym));
  const margins = txs.filter(t => t.type === 'svc_close');
  const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0) + margins.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const spent = txs.filter(t => t.type === 'expense' || t.type === 'debt_pay').reduce((s, t) => s + t.amount, 0) - margins.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0);
  const fees = txs.reduce((s, t) => s + (t.fee || 0) + (t.tax || 0), 0);
  const byJar = {};
  txs.filter(t => t.type === 'expense').forEach(t => { byJar[t.jar] = (byJar[t.jar] || 0) + t.amount; });
  return { income, spent: spent + fees, fees, byJar, txs };
}

export function countStreak() {
  const days = new Set(state.counts.map(c => c.date));
  let d = today(), n = 0;
  if (!days.has(d)) d = addDays(d, -1);
  while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

// Most recent interest date (MM-DD list) on or before today.
export function lastInterestDate(w) {
  const t = today(); const y = +t.slice(0, 4);
  const cands = [y - 1, y].flatMap(yy => (w.interestDates || []).map(md => `${yy}-${md}`)).filter(d => d <= t).sort();
  return cands.pop() || null;
}

export function reminders() {
  const out = [];
  const s = summary();
  const t = today();
  for (const p of s.pending) {
    out.push({ level: 'warn', icon: p.jar.icon, text: `${fmt(p.amount)} de ${p.jar.name} n'est pas encore dans ${p.wallet.name}.`,
      action: `#/add?type=transfer&to=${p.wallet.id}&amount=${p.amount}`, label: 'Ranger' });
  }
  if (!state.counts.some(c => c.date === t)) out.push({ level: 'info', icon: 'sun', text: 'Comptage du matin pas encore fait.', action: '#/count', label: 'Compter' });
  for (const l of state.loans) {
    const i = loanInfo(l);
    if (!i.remaining || !l.due) continue;
    const d = daysBetween(t, l.due);
    const who = l.dir === 'lent' ? `${l.person} doit te rendre` : `Tu dois rendre à ${l.person}`;
    if (d < 0) out.push({ level: 'danger', icon: 'clock', text: `${who} ${fmt(i.remaining)} (en retard de ${-d} j).`, action: `#/loan/${l.id}`, label: 'Voir' });
    else if (d <= 3) out.push({ level: 'warn', icon: 'clock', text: `${who} ${fmt(i.remaining)} ${d === 0 ? "aujourd'hui" : `dans ${d} j`}.`, action: `#/loan/${l.id}`, label: 'Voir' });
  }
  for (const sv of state.services) {
    const i = svcInfo(sv);
    if (i.closed) continue;
    if (i.advanced > 0) out.push({ level: 'warn', icon: 'store', text: `${sv.client} te doit ${fmt(Math.max(i.advanced, i.due))} (service ${sv.label || ''} avancé).`, action: `#/svc/${sv.id}`, label: 'Voir' });
    else if (i.due > 0) out.push({ level: 'info', icon: 'store', text: `${sv.client} doit encore ${fmt(i.due)} pour ${sv.label || 'son service'}.`, action: `#/svc/${sv.id}`, label: 'Voir' });
  }
  const pay = wallet('paysika');
  const activeSubs = state.subs.filter(x => x.keep);
  for (const sub of state.subs) {
    const d = daysBetween(t, sub.next);
    if (d <= 2) out.push({ level: sub.keep ? 'warn' : 'info', icon: 'repeat',
      text: `${sub.name} (${fmt(sub.amount)}) se renouvelle ${d < 0 ? 'depuis ' + -d + ' j' : d === 0 ? "aujourd'hui" : `dans ${d} j`}. ${sub.keep ? 'Recharge PAYSIKA ?' : 'Laisser expirer.'}`,
      action: '#/subs', label: 'Gérer' });
  }
  if (pay && s.b.w.paysika > 0 && state.subs.length) out.push({ level: 'warn', icon: 'card', text: `PAYSIKA n'est pas vide (${fmt(s.b.w.paysika)}) : un abonnement pourrait se renouveler.`, action: '#/subs', label: 'Voir' });
  for (const inv of state.investments) {
    if (inv.next && daysBetween(t, inv.next) <= 3) out.push({ level: 'info', icon: 'coins', text: `Dividende ${inv.name} attendu le ${fmtDate(inv.next)} : combien ce mois-ci ?`, action: `#/invest/${inv.id}`, label: 'Noter' });
  }
  for (const w of state.wallets.filter(x => x.interestPct)) {
    const ld = lastInterestDate(w);
    const since = state.settings.setupAt || t;
    if (!ld || ld < since || (s.b.w[w.id] || 0) <= 0) continue;
    const got = state.tx.some(x => x.type === 'income' && x.wallet === w.id && x.cat === 'interest' && x.date.slice(0, 10) >= addDays(ld, -7));
    if (!got) out.push({ level: 'info', icon: 'percent', text: `Intérêts ${w.name} du ${fmtDate(ld)} : environ ${fmt(Math.round(s.b.w[w.id] * w.interestPct / 100))} attendus.`,
      action: `#/add?type=income&wallet=${w.id}&cat=interest&jar=${state.jars.find(j => j.home === w.id)?.id || ''}&amount=${Math.round(s.b.w[w.id] * w.interestPct / 100)}`, label: 'Noter' });
  }
  const dim = new Date(+t.slice(0, 4), +t.slice(5, 7), 0).getDate();
  const fun = state.jars.find(j => j.rule === 'must_spend');
  if (fun && dim - +t.slice(8, 10) < 5 && s.b.j[fun.id] > 0) out.push({ level: 'info', icon: fun.icon, text: `Il te reste ${fmt(s.b.j[fun.id])} en ${fun.name} ce mois-ci : fais-toi plaisir !`, action: `#/jar/${fun.id}`, label: 'Voir' });
  return out;
}

// ---------- labels ----------
export const TYPE_LABEL = {
  income: 'Revenu', expense: 'Dépense', transfer: 'Transfert', jar_move: 'Entre comptes', loan_out: 'Prêt accordé',
  loan_in: 'Remboursement reçu', debt_in: 'Emprunt', debt_pay: 'Remboursement de dette', forgive: 'Prêt pardonné',
  invest: 'Contribution', adjust: 'Écart de comptage', opening: 'Solde de départ',
  div_accrue: 'Dividende à percevoir', div_collect: 'Dividendes encaissés', div_convert: 'Dividendes convertis en capital',
  svc_in: 'Reçu du client', svc_out: 'Service payé', svc_close: 'Marge service client',
};

const TYPE_ICON = { transfer: 'transfer', jar_move: 'shuffle', loan_out: 'arrow-up-right', loan_in: 'arrow-down-left', debt_in: 'arrow-down-left',
  debt_pay: 'arrow-up-right', forgive: 'heart', invest: 'trending-up', adjust: 'scale', opening: 'flag',
  div_accrue: 'coins', div_collect: 'download', div_convert: 'repeat', svc_in: 'arrow-down-left', svc_out: 'card', svc_close: 'store' };
export const txIcon = t => cat(t.cat)?.icon || TYPE_ICON[t.type] || 'tag';

export function txTitle(t) {
  const c = cat(t.cat);
  switch (t.type) {
    case 'income': case 'expense': return t.note || c?.name || TYPE_LABEL[t.type];
    case 'transfer': return `${transferKind(t.wallet, t.to)} ${wallet(t.wallet)?.name} → ${wallet(t.to)?.name}`;
    case 'jar_move': return `${jar(t.jar)?.name} → ${jar(t.toJar)?.name}`;
    case 'svc_in': case 'svc_out': case 'svc_close': {
      const s = service(t.service);
      return `${TYPE_LABEL[t.type]} · ${s ? s.client + (s.label ? ' (' + s.label + ')' : '') : ''}`;
    }
    case 'invest': case 'div_accrue': case 'div_collect': case 'div_convert':
      return `${TYPE_LABEL[t.type]} · ${investment(t.investment)?.name || ''}`;
    case 'loan_out': case 'loan_in': case 'debt_in': case 'debt_pay': case 'forgive':
      return `${TYPE_LABEL[t.type]} · ${loan(t.loan)?.person || ''}`;
    default: return TYPE_LABEL[t.type] || t.type;
  }
}

// Signed impact on the user's total money, for list display.
export function txSign(t) {
  const e = effects(t);
  return Object.values(e.w).reduce((s, v) => s + v, 0);
}
