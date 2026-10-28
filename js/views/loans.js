// Loans (money I lent) and debts (money I borrowed), with due dates and repayments.
import { state, save, uid } from '../store.js';
import { parseMoney, fmt, loanInfo, STATUS_LABEL, today, nowLocal, fmtDate, daysBetween, loan, wallet, jar, balances } from '../logic.js';
import { esc, walletOpts, jarOpts, addTx, formData, go, toast, ask, icon, emptyState, celebrate } from '../ui.js';

const people = () => [...new Set([...state.loans.map(l => l.person), ...state.tx.map(t => t.person)].filter(Boolean))].sort();
const badge = st => `<span class="badge ${STATUS_LABEL[st][1]}">${STATUS_LABEL[st][0]}</span>`;

export function render({ name, id, q }) {
  if (name === 'loan') return detail(loan(id));
  if (q.get('new')) return newForm(q.get('new'));
  const tab = q.get('tab') || 'lent';
  const lentTab = tab === 'lent';
  const list = state.loans.filter(l => l.dir === tab).map(l => ({ l, i: loanInfo(l) }))
    .sort((a, b) => (a.i.remaining === 0) - (b.i.remaining === 0) || (a.l.due || '9').localeCompare(b.l.due || '9'));
  const open = list.filter(x => x.i.remaining > 0);
  const total = open.reduce((s, x) => s + x.i.remaining, 0);
  const late = open.filter(x => x.i.status === 'late').length;
  const t = today();
  const seg = `<div class="seg"><a href="#/loans?tab=lent" class="${lentTab ? 'on' : ''}">J'ai prêté</a><a href="#/loans?tab=borrowed" class="${!lentTab ? 'on' : ''}">Je dois</a></div>`;
  if (!list.length) return seg + `<div class="card">${lentTab
    ? emptyState('arrow-up-right', 'Aucun prêt', "Note l'argent que tu prêtes : la date de retour, les remboursements et les rappels sont suivis pour toi.", '#/loans?new=lent', 'Noter un prêt')
    : emptyState('arrow-down-left', 'Aucune dette', 'Note ce que tu dois pour voir le reste à payer, les intérêts et la date de fin.', '#/loans?new=borrowed', 'Noter une dette')}</div>`;
  return `${seg}
    <div class="card grid2">
      <div class="stat"><span class="label">${lentTab ? 'On me doit' : 'Je dois'}</span><b class="num">${fmt(total)}</b></div>
      <div class="stat"><span class="label">En retard</span><b class="${late ? 'neg' : ''}">${late}</b>
        ${!lentTab ? `<span class="label">Intérêts payés ${fmt(list.reduce((s, x) => s + x.i.interest, 0))}</span>` : ''}</div>
    </div>
    <div class="card tight">${list.map(({ l, i }) => {
      const d = l.due ? daysBetween(t, l.due) : null;
      const cls = i.remaining === 0 || d === null ? '' : d < 0 ? 'neg' : d <= 7 ? 'warn-text' : '';
      const when = i.remaining === 0 ? STATUS_LABEL[i.status][0] : d === null ? 'Sans date de retour' : d < 0 ? `En retard de ${-d} j` : d === 0 ? "Aujourd'hui" : `Dans ${d} j · ${fmtDate(l.due)}`;
      return `<a class="row" href="#/loan/${l.id}">${avatar(l.person, i.remaining === 0)}<div class="l"><div class="t">${esc(l.person)}</div>
        <div class="s ${cls}">${when}</div><div class="bar" style="height:4px;--c:${i.remaining ? 'var(--primary)' : 'var(--ok)'}"><i style="width:${progress(l, i)}%"></i></div></div>
        <div class="r num">${fmt(i.remaining)}<div class="small muted">sur ${fmt(l.amount)}</div></div></a>`;
    }).join('')}</div>
    <div class="cta-bar"><a class="btn primary block" href="#/loans?new=${tab}">${icon('plus')} ${lentTab ? 'Nouveau prêt' : 'Nouvelle dette'}</a></div>`;
}

// People get an initials avatar (more personal than a generic icon).
const AVATAR_COLORS = ['#0b7a6c', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#ca8a04'];
function avatar(name, done) {
  const initials = name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const c = done ? 'var(--ok)' : AVATAR_COLORS[[...name].reduce((s, ch) => s + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return `<span class="row-ico" style="--c:${c};border-radius:50%;font-weight:700;font-size:13px">${done ? icon('check') : esc(initials)}</span>`;
}
const progress = (l, i) => Math.min(100, Math.round((i.paid + i.forgiven) / l.amount * 100));

function newForm(dir) {
  const b = balances();
  const lent = dir === 'lent';
  return `<form id="f" class="card">
      <div class="field"><label>${lent ? 'Prêté à' : 'Emprunté à (personne ou banque)'}</label>
        <input name="person" list="pp" required><datalist id="pp">${people().map(p => `<option value="${esc(p)}">`).join('')}</datalist></div>
      <div class="field"><label>Montant</label><input class="amount" name="amount" inputmode="decimal" required></div>
      <div class="grid2">
        <div class="field"><label>Date</label><input type="date" name="date" value="${today()}"></div>
        <div class="field"><label>Retour prévu le</label><input type="date" name="due"></div>
      </div>
      <div class="grid2">
        <div class="field"><label>${lent ? "Sorti de" : 'Reçu sur'}</label><select name="wallet">${walletOpts(state.settings.lastWallet || 'om', { filter: w => w.role !== 'vault', balances: b.w })}</select></div>
        <div class="field"><label>${lent ? 'Pris sur le compte' : 'Mis dans le compte'}</label><select name="jar">${jarOpts('nec', b.j)}</select></div>
      </div>
      ${lent ? '' : `<div class="grid2">
        <div class="field"><label>Taux d'intérêt (%/an)</label><input name="rate" inputmode="decimal" placeholder="0"></div>
        <div class="field"><label>Mensualité (optionnel)</label><input name="monthly" inputmode="decimal"></div></div>
        <p class="small muted">L'argent emprunté n'est <b>pas</b> un revenu : il n'est pas réparti sur les 6 comptes.</p>`}
      <div class="field"><label>Note</label><input name="note"></div>
      <p id="warn" class="small"></p>
      <button class="btn primary block">Enregistrer</button>
    </form>`;
}

function detail(l) {
  if (!l) return emptyState('alert', 'Introuvable', 'Ce prêt a peut-être été supprimé.', '#/loans', 'Retour');
  const i = loanInfo(l);
  const b = balances();
  const lent = l.dir === 'lent';
  const pct = progress(l, i);
  const t = today();
  // timeline: start → repayments → expected return (future or late)
  const events = [
    { date: l.date, t: lent ? 'Prêt accordé' : 'Argent emprunté', s: `${fmtDate(l.date)} · ${esc(wallet(l.wallet)?.name || '')}`, r: fmt(l.amount), c: 'var(--muted)' },
    ...i.txs.filter(x => x.type !== 'loan_out' && x.type !== 'debt_in').map(x => ({
      date: x.date, t: x.type === 'forgive' ? 'Pardonné (devient un don)' : lent ? 'Remboursement reçu' : 'Remboursement',
      s: `${fmtDate(x.date, true)}${x.wallet ? ' · ' + esc(wallet(x.wallet)?.name) : ''}${x.interestPart ? ' · dont intérêts ' + fmt(x.interestPart) : ''}`,
      r: (x.type === 'forgive' ? '' : '−') + fmt(x.amount), c: x.type === 'forgive' ? '#db2777' : 'var(--ok)' })),
  ].sort((a, c) => a.date.localeCompare(c.date));
  if (i.remaining > 0 && l.due) {
    const late = l.due < t;
    events.push({ date: l.due, future: !late, t: late ? 'Retour prévu (dépassé)' : 'Retour prévu', s: fmtDate(l.due), r: fmt(i.remaining), c: late ? 'var(--danger)' : 'var(--primary)' });
  }
  return `<div class="card">
      <div class="loan-head">
        <div class="ring" style="--p:${pct};--c:${i.remaining ? 'var(--primary)' : 'var(--ok)'}"><div>${pct} %</div></div>
        <div>
          <span class="label">${i.remaining ? 'Reste à ' + (lent ? 'recevoir' : 'payer') : 'Terminé'}</span>
          <div class="big num">${fmt(i.remaining)}</div>
          <p class="small muted">sur ${fmt(l.amount)} · ${badge(i.status)}</p>
        </div>
      </div>
      ${l.rate ? `<p class="small muted mt">Taux ${l.rate} %/an · intérêts payés ${fmt(i.interest)}${l.monthly ? ` · mensualité ${fmt(l.monthly)}` : ''}</p>` : ''}
      ${l.note ? `<p class="small mt">${esc(l.note)}</p>` : ''}
    </div>
    ${i.remaining > 0 ? `<form id="pay" class="card">
      <h2>${lent ? 'Remboursement reçu' : 'Je rembourse'}</h2>
      <div class="field"><input class="amount" name="amount" inputmode="decimal" placeholder="${fmt(i.remaining)}"></div>
      <div class="grid2">
        <div class="field"><label>${lent ? 'Reçu sur' : 'Payé avec'}</label><select name="wallet">${walletOpts(l.wallet, { filter: w => w.role !== 'vault', balances: b.w })}</select></div>
        <div class="field"><label>Compte</label><select name="jar">${jarOpts(l.jar, b.j)}</select></div>
      </div>
      ${lent ? '' : `<div class="field"><label>Dont intérêts</label><input name="interest" inputmode="decimal" placeholder="0"></div>`}
      <div class="field"><label>Date</label><input type="datetime-local" name="date" value="${nowLocal()}"></div>
      <button class="btn primary block">Enregistrer</button>
    </form>` : ''}
    <h3>Suivi</h3>
    <div class="card tight"><ul class="timeline">${events.map(e => `<li class="${e.future ? 'future' : ''}" style="--c:${e.c}"><span class="tdot"></span>
      <div class="l"><div class="t">${e.t}</div><div class="s">${e.s}</div></div><span class="r num">${e.r}</span></li>`).join('')}</ul></div>
    <div class="grid2 mt">
      ${lent && i.remaining > 0 ? `<button class="btn" id="forgive">${icon('heart')} Pardonner le reste</button>` : '<span></span>'}
      <button class="btn danger" id="del">${icon('trash')} Supprimer</button>
    </div>`;
}

export function mount(root, { name, id, q }) {
  if (q.get('new')) {
    const f = root.querySelector('#f');
    const lent = q.get('new') === 'lent';
    const b = balances();
    const upd = () => {
      const j = jar(f.jar.value);
      root.querySelector('#warn').innerHTML = lent && j.rule === 'no_spend' ? `<span class="neg">${icon('alert')} Évite de prêter l'argent de ${esc(j.name)}.</span>` : '';
    };
    f.onchange = upd; upd();
    f.onsubmit = async e => {
      e.preventDefault();
      const d = formData(f);
      const a = parseMoney(d.amount);
      if (!(a > 0)) return toast('Entre un montant');
      if (lent && jar(d.jar).rule === 'no_spend' && !(await ask(`Prêter l'argent de ${jar(d.jar).name} ?`, { ok: 'Continuer' }))) return;
      if (lent && a > (b.w[d.wallet] || 0) && !(await ask(`${wallet(d.wallet).name} n'a que ${fmt(b.w[d.wallet])}. Continuer ?`, { ok: 'Continuer' }))) return;
      const l = { id: uid(), dir: q.get('new'), person: d.person.trim(), amount: a, date: d.date || today(), due: d.due || '',
        wallet: d.wallet, jar: d.jar, rate: parseFloat((d.rate || '').replace(',', '.')) || 0, monthly: parseMoney(d.monthly || 0) || 0, note: d.note };
      state.loans.push(l);
      await addTx({ type: lent ? 'loan_out' : 'debt_in', date: l.date + 'T12:00', amount: a, wallet: d.wallet, jar: d.jar, loan: l.id, note: d.note },
        lent ? `Prêt à ${l.person} : ${fmt(a)}` : `Dette envers ${l.person} : ${fmt(a)}`);
      go(`#/loan/${l.id}`);
    };
    return;
  }
  if (name !== 'loan') return;
  const l = loan(id); if (!l) return;
  const lent = l.dir === 'lent';
  const pay = root.querySelector('#pay');
  if (pay) pay.onsubmit = async e => {
    e.preventDefault();
    const d = formData(pay);
    const i = loanInfo(l);
    const a = pay.amount.value.trim() ? parseMoney(pay.amount.value) : i.remaining;
    if (!(a > 0)) return toast('Entre un montant');
    const interestPart = lent ? 0 : Math.min(a, parseMoney(d.interest || 0) || 0);
    if (a - interestPart > i.remaining && !(await ask(`C'est plus que le reste (${fmt(i.remaining)}). Continuer ?`, { ok: 'Continuer' }))) return;
    const items = await addTx({ type: lent ? 'loan_in' : 'debt_pay', date: d.date || nowLocal(), amount: a, wallet: d.wallet, jar: d.jar, loan: l.id, interestPart },
      `Remboursement : ${fmt(a)}`, { quiet: loanInfo(l).remaining === 0 });
    // peak moment: a loan fully paid back / a debt cleared
    if (loanInfo(l).remaining === 0) {
      const v = await celebrate({
        title: lent ? `${l.person} a tout remboursé` : 'Dette terminée !', amount: fmt(l.amount),
        sub: lent ? 'Ton argent est revenu à la maison.' : `Tu ne dois plus rien à ${l.person}. Un pas de plus vers la liberté financière.`,
        actions: [{ label: 'Super', value: 'done', primary: true }, { label: 'Annuler ce remboursement', value: 'undo' }] });
      if (v === 'undo') await items.undo();
    }
  };
  const fg = root.querySelector('#forgive');
  if (fg) fg.onclick = async () => {
    const r = loanInfo(l).remaining;
    if (!(await ask(`Pardonner ${fmt(r)} à ${l.person} ? Ce montant sera compté comme un don (pris sur Dons).`, { ok: 'Continuer' }))) return;
    await addTx({ type: 'forgive', date: nowLocal(), amount: r, jar: 'don', toJar: l.jar, loan: l.id, note: `Prêt pardonné à ${l.person}` }, 'Prêt pardonné');
  };
  root.querySelector('#del').onclick = async () => {
    if (!(await ask('Supprimer ce prêt/dette et tous ses mouvements ?', { danger: true, ok: 'Oui' }))) return;
    state.tx = state.tx.filter(t => t.loan !== l.id);
    state.loans = state.loans.filter(x => x.id !== l.id);
    await save();
    go(`#/loans?tab=${l.dir}`);
  };
}
