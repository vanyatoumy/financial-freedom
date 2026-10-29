// Services bought for clients: client money passes through a reserve; only the margin becomes my income.
import { state, save, uid } from '../store.js';
import { parseMoney, fmt, toInput, nowLocal, today, fmtDate, split, balances, summary, svcInfo, service, wallet, jar, canTransfer } from '../logic.js';
import { esc, walletOpts, addTx, formData, go, toast, ask, icon, tile, emptyState, celebrate, feeFields, showFees, feeVals } from '../ui.js';

const people = () => [...new Set([...state.services.map(s => s.client), ...state.loans.map(l => l.person), ...state.tx.map(t => t.person)].filter(Boolean))].sort();
const usable = w => w.role !== 'vault';

function status(i) {
  if (i.closed) return [i.margin >= 0 ? `Marge ${fmt(i.margin)}` : `Perte ${fmt(-i.margin)}`, i.margin >= 0 ? 'ok' : 'danger'];
  if (i.advanced > 0) return [`Te doit ${fmt(Math.max(i.advanced, i.due))}`, 'warn'];
  if (i.due > 0) return [`Doit encore ${fmt(i.due)}`, 'warn'];
  if (!i.cost) return ['Service à payer', ''];
  return ['Prêt à clôturer', 'ok'];
}

export function render({ id, q }) {
  if (id) return detail(service(id));
  if (q.get('new')) return `<form id="new" class="card">
      <div class="field"><label>Client</label><input name="client" list="pp" required placeholder="ex. Paul"><datalist id="pp">${people().map(p => `<option value="${esc(p)}">`).join('')}</datalist></div>
      <div class="field"><label>Service</label><input name="label" placeholder="ex. Achat en ligne, abonnement, billet…"></div>
      <div class="field"><label>Montant demandé au client (optionnel)</label><input name="agreed" inputmode="decimal" placeholder="ex. 10 000"></div>
      <p class="small muted">L'argent du client va dans une réserve « Argent clients » : il n'est jamais compté comme ton revenu. À la fin, seule ta marge (reçu − coût − frais) est ajoutée à tes 6 comptes.</p>
      <button class="btn primary block mt">Créer</button>
    </form>`;

  const s = summary();
  const ym = today().slice(0, 7);
  const list = state.services.map(sv => ({ sv, i: svcInfo(sv) }));
  const open = list.filter(x => !x.i.closed).sort((a, b) => b.sv.date.localeCompare(a.sv.date));
  const closed = list.filter(x => x.i.closed).sort((a, b) => (b.sv.closedAt || '').localeCompare(a.sv.closedAt || ''));
  const monthMargin = closed.filter(x => (x.sv.closedAt || '').startsWith(ym)).reduce((a, x) => a + x.i.margin, 0);
  const row = ({ sv, i }) => { const [txt, cls] = status(i); return `<a class="row" href="#/svc/${sv.id}">${tile('store', i.closed ? 'var(--ok)' : 'var(--primary)')}
    <div class="l"><div class="t">${esc(sv.client)}${sv.label ? ' · ' + esc(sv.label) : ''}</div><div class="s">${fmtDate(sv.date)} · reçu ${fmt(i.received)} · coût ${fmt(i.cost)}</div></div>
    <span class="badge ${cls}">${txt}</span></a>`; };
  if (!list.length) return `<div class="card">${emptyState('store', 'Services clients', "Quand un client t'envoie de l'argent pour payer un service en ligne (ou que tu avances l'argent), note-le ici : seule ta marge deviendra ton revenu.", '#/svc?new=1', 'Nouveau service')}</div>`;
  return `<div class="card grid2">
      <div class="stat"><span class="label">${s.clients >= 0 ? 'Argent clients détenu' : 'Avancé pour des clients'}</span><b class="num ${s.clients < 0 ? 'warn-text' : ''}">${fmt(Math.abs(s.clients))}</b></div>
      <div class="stat"><span class="label">Marge ce mois</span><b class="num ${monthMargin >= 0 ? 'pos' : 'neg'}">${fmt(monthMargin)}</b></div>
    </div>
    ${open.length ? `<h3>En cours · ${open.length}</h3><div class="card tight">${open.map(row).join('')}</div>` : ''}
    ${closed.length ? `<h3>Clôturés</h3><div class="card tight">${closed.slice(0, 20).map(row).join('')}</div>` : ''}
    <div class="cta-bar"><a class="btn primary block" href="#/svc?new=1">${icon('plus')} Nouveau service</a></div>`;
}

function detail(sv) {
  if (!sv) return emptyState('alert', 'Introuvable', 'Ce service a peut-être été supprimé.', '#/svc', 'Retour');
  const i = svcInfo(sv);
  const b = balances();
  const [txt, cls] = status(i);
  const last = state.settings.lastWallet || 'om';
  const events = i.txs.slice().sort((a, c) => c.date.localeCompare(a.date)).map(t => {
    const label = t.type === 'svc_in' ? 'Reçu du client' : t.type === 'svc_out' ? 'Service payé' : t.type === 'transfer' ? `Recharge ${wallet(t.wallet)?.name} → ${wallet(t.to)?.name}` : t.amount >= 0 ? 'Marge encaissée' : 'Perte';
    const sign = t.type === 'svc_in' ? '+' : t.type === 'svc_out' ? '−' : '';
    const charges = (t.fee || 0) + (t.tax || 0);
    return `<div class="row">${tile(t.type === 'svc_in' ? 'arrow-down-left' : t.type === 'svc_out' ? 'card' : t.type === 'transfer' ? 'transfer' : 'store', t.type === 'svc_close' ? 'var(--ok)' : 'var(--primary)')}
      <div class="l"><div class="t">${label}</div><div class="s">${fmtDate(t.date, true)}${t.wallet ? ' · ' + esc(wallet(t.wallet)?.name) : ''}${charges ? ' · frais/taxes ' + fmt(charges) : ''}</div></div>
      <div class="r num">${t.type === 'transfer' ? fmt(t.amount) : sign + fmt(Math.abs(t.amount))}</div></div>`;
  }).join('');

  return `<div class="card">
      <p><span class="badge ${cls}">${txt}</span></p>
      <span class="label">${i.closed ? 'Ta marge' : 'Marge pour l’instant'}</span>
      <div class="big num ${i.margin < 0 ? 'neg' : ''}">${fmt(i.margin)}</div>
      <div class="hr"></div>
      <div class="grid3 center">
        <div class="stat"><span class="label">Reçu</span><b class="num">${fmt(i.received)}</b></div>
        <div class="stat"><span class="label">Coût</span><b class="num">${fmt(i.cost)}</b></div>
        <div class="stat"><span class="label">Frais/taxes</span><b class="num">${fmt(i.fees)}</b></div>
      </div>
      ${sv.agreed ? `<p class="small muted mt">Demandé au client : ${fmt(sv.agreed)}${i.due ? ` · il doit encore <b>${fmt(i.due)}</b>` : ' · tout reçu'}</p>` : ''}
      ${!i.closed && i.advanced > 0 ? `<p class="small warn-text mt">${icon('alert')} Tu as avancé ${fmt(i.advanced)} de ton argent pour ce client.</p>` : ''}
    </div>

    ${i.closed ? '' : `
    <form id="in" class="card">
      <h2>${icon('arrow-down-left')} Argent reçu du client</h2>
      <div class="field"><input class="amount" name="amount" inputmode="decimal" placeholder="${i.due ? fmt(i.due) : '0 F'}"></div>
      <div class="field"><label>Reçu sur</label><select name="wallet">${walletOpts(last, { filter: usable, balances: b.w })}</select></div>
      ${feeFields(last)}
      <button class="btn primary block">Enregistrer</button>
    </form>

    <form id="out" class="card">
      <h2>${icon('card')} Payer le service</h2>
      <div class="field"><input class="amount" name="amount" inputmode="decimal" placeholder="0 F"></div>
      <div class="field"><label>Payé avec</label><select name="wallet">${walletOpts('paysika', { filter: usable, balances: b.w })}</select></div>
      ${feeFields('paysika')}
      <div class="card" id="topup" style="background:var(--bg)">
        <label class="check"><input type="checkbox" name="topup" checked> ${icon('card')} Recharger PAYSIKA d'abord</label>
        <div class="field mt"><label>Depuis</label><select name="topFrom">${walletOpts('om', { filter: w => canTransfer(w.id, 'paysika'), balances: b.w })}</select></div>
        ${feeFields('om', 'top')}
      </div>
      <button class="btn primary block">Enregistrer</button>
    </form>

    <button class="btn primary block" id="close" ${i.received || i.cost ? '' : 'disabled'}>${icon('check')} Clôturer · ${i.margin >= 0 ? 'encaisser ma marge' : 'noter la perte'} (${fmt(i.margin)})</button>`}

    <h3>Opérations</h3>
    <div class="card tight">${events || emptyState('clock', 'Rien encore', "Note l'argent reçu du client et le paiement du service, dans l'ordre où ça arrive.")}</div>
    <button class="btn danger block mt" id="del">${icon('trash')} Supprimer ce service</button>`;
}

export function mount(root, { id, q }) {
  if (q.get('new')) {
    const f = root.querySelector('#new');
    f.onsubmit = async e => {
      e.preventDefault();
      const d = formData(f);
      const sv = { id: uid(), client: d.client.trim(), label: d.label.trim(), agreed: parseMoney(d.agreed || 0) || 0, date: today() };
      state.services.push(sv);
      await save();
      go(`#/svc/${sv.id}`);
    };
    return;
  }
  if (!id) return;
  const sv = service(id); if (!sv) return;
  const b = balances();

  const fin = root.querySelector('#in');
  if (fin) {
    fin.onchange = () => showFees(fin, fin.wallet.value);
    fin.onsubmit = async e => {
      e.preventDefault();
      const d = formData(fin);
      const i = svcInfo(sv);
      const a = fin.amount.value.trim() ? parseMoney(fin.amount.value) : i.due;
      if (!(a > 0)) return toast('Entre le montant reçu');
      state.settings.lastWallet = d.wallet;
      await addTx({ type: 'svc_in', date: nowLocal(), amount: a, wallet: d.wallet, service: sv.id, ...feeVals(d, d.wallet), feeJar: 'cli' },
        `Reçu de ${sv.client} : ${fmt(a)}`);
    };
  }

  const fout = root.querySelector('#out');
  if (fout) {
    const upd = () => {
      root.querySelector('#topup').hidden = fout.wallet.value !== 'paysika';
      showFees(fout, fout.wallet.value);
      showFees(fout, fout.topFrom.value, '#topup [data-fees]');
    };
    fout.onchange = upd; upd();
    fout.onsubmit = async e => {
      e.preventDefault();
      const d = formData(fout);
      const a = parseMoney(d.amount);
      if (!(a > 0)) return toast('Entre le prix du service');
      const date = nowLocal();
      const list = [];
      // fees of the top-up and of the payment belong to this service (client reserve), not to Nécessité
      if (d.wallet === 'paysika' && d.topup) {
        const need = Math.max(0, a - Math.max(0, b.w.paysika || 0));
        if (need) list.push({ type: 'transfer', date, amount: need, wallet: d.topFrom, to: 'paysika', service: sv.id, ...feeVals(d, d.topFrom, 'top'), feeJar: 'cli', note: 'Recharge PAYSIKA' });
      }
      list.push({ type: 'svc_out', date, amount: a, wallet: d.wallet, service: sv.id, ...feeVals(d, d.wallet), feeJar: 'cli' });
      if (!(d.wallet === 'paysika' && d.topup) && a > (b.w[d.wallet] || 0)
        && !(await ask(`${wallet(d.wallet).name} n'a que ${fmt(b.w[d.wallet])}. Continuer ?`, { ok: 'Continuer' }))) return;
      await addTx(list, `Service payé : ${fmt(a)}`);
    };
  }

  const cl = root.querySelector('#close');
  if (cl) cl.onclick = async () => {
    const i = svcInfo(sv);
    const owed = Math.max(i.due, i.advanced);
    if (owed && !(await ask(`${sv.client} te doit encore ${fmt(owed)}. Clôturer quand même ?\nCe qui manque sera compté comme une perte.`, { ok: 'Clôturer' }))) return;
    if (!i.cost && !(await ask("Le service n'a pas encore été payé. Clôturer quand même ?", { ok: 'Clôturer' }))) return;
    const m = i.margin;
    sv.closedAt = today();
    const items = await addTx({ type: 'svc_close', date: nowLocal(), amount: m, service: sv.id, ...(m > 0 ? { alloc: split(m), cat: 'svc_margin' } : { jar: 'nec' }) },
      m >= 0 ? `Marge : ${fmt(m)}` : `Perte : ${fmt(-m)}`, { quiet: m > 0 });
    if (m > 0) {
      const v = await celebrate({ title: 'Marge encaissée', amount: '+' + fmt(m), sub: `Service pour ${sv.client} terminé. Ta marge est répartie sur tes 6 comptes.`,
        rows: split(m).map(x => ({ icon: jar(x.jar).icon, color: jar(x.jar).color, name: jar(x.jar).name, value: fmt(x.amount) })),
        actions: [{ label: 'Super', value: 'done', primary: true }, { label: 'Annuler la clôture', value: 'undo' }] });
      if (v === 'undo') { delete sv.closedAt; await items.undo(); }
    }
  };

  root.querySelector('#del').onclick = async () => {
    if (!(await ask(`Supprimer le service de ${sv.client} et toutes ses opérations ?`, { danger: true, ok: 'Oui' }))) return;
    state.tx = state.tx.filter(t => t.service !== sv.id);
    state.services = state.services.filter(x => x.id !== sv.id);
    await save();
    go('#/svc');
  };
}
