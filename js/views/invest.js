// Investment portfolio: capital paid in vs commitment, dividends earned / held / collected, next expected dividend.
import { state, save, uid } from '../store.js';
import { parseMoney, fmt, toInput, investInfo, investment, today, nowLocal, fmtDate, addMonths, daysBetween, balances, wallet, freedom } from '../logic.js';
import { esc, walletOpts, jarOpts, addTx, formData, go, toast, ask, icon, tile, emptyState, celebrate, feeFields, showFees, feeVals } from '../ui.js';

const TYPES = { association: 'Association', business: 'Business', land: 'Terrain / Immobilier', stocks: 'Actions', tontine: 'Tontine', other: 'Autre' };

// First day of the month after today: dividends are posted at the start of each month.
const nextFirst = () => addMonths(today().slice(0, 8) + '01', 1);

export function render({ id, q }) {
  if (id) return detail(investment(id));
  if (q.get('new')) return `<form id="new" class="card">
      <div class="field"><label>Nom</label><input name="name" required></div>
      <div class="field"><label>Type</label><select name="type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="grid2">
        <div class="field"><label>Capital déjà versé</label><input name="initial" inputmode="decimal" placeholder="0"></div>
        <div class="field"><label>Engagement total (optionnel)</label><input name="commitment" inputmode="decimal" placeholder="ex. 365 000"></div>
      </div>
      <div class="field"><label>Dividendes à percevoir aujourd'hui</label><input name="accrued" inputmode="decimal" placeholder="0"></div>
      <div class="grid2">
        <div class="field"><label>Dividende tous les (mois)</label><input name="freq" inputmode="numeric" value="1"></div>
        <div class="field"><label>Prochain dividende</label><input type="date" name="next" value="${nextFirst()}"></div>
      </div>
      <button class="btn primary block mt">Créer</button>
    </form>`;

  const list = state.investments.map(i => ({ i, x: investInfo(i) }));
  if (!list.length) return `<div class="card">${emptyState('trending-up', 'Fais travailler ton argent',
    "Ajoute tes placements (association, business, terrain, tontine…) pour suivre ce qu'ils te rapportent et quand le prochain dividende arrive.",
    '#/invest?new=1', 'Ajouter un investissement')}</div>`;
  const tot = list.reduce((s, { x }) => ({ cap: s.cap + x.capital, pend: s.pend + x.pending, earn: s.earn + x.earned }), { cap: 0, pend: 0, earn: 0 });
  const fr = freedom();
  return `<div class="card grid3 center">
      <div class="stat"><span class="label">Capital</span><b class="num">${fmt(tot.cap)}</b></div>
      <div class="stat"><span class="label">À percevoir</span><b class="num">${fmt(tot.pend)}</b></div>
      <div class="stat"><span class="label">Dividendes</span><b class="num pos">${fmt(tot.earn)}</b></div>
    </div>
    <div class="card"><span class="label">Liberté financière</span>
      ${fr.pct === null ? '<p class="small muted">Note tes dépenses de Nécessité pour la calculer.</p>' : `<div class="big num">${fr.pct.toFixed(1)} %</div>`}
      <div class="meter mt"><i style="width:${Math.min(100, fr.pct || 0)}%"></i></div>
      <p class="small muted mt">Revenus passifs ${fmt(fr.passive)}/mois</p></div>
    <div class="card tight">${list.map(({ i, x }) => `<a class="row" href="#/invest/${i.id}">${tile('coins', 'var(--primary)')}
      <div class="l"><div class="t">${esc(i.name)}</div><div class="s">${x.commitment ? `${Math.round(x.capital / x.commitment * 100)} % versé` : TYPES[i.type] || ''}${i.next ? ' · dividende ' + fmtDate(i.next) : ''}</div></div>
      <div class="r num">${fmt(x.capital)}<div class="small pos">${x.pending ? '+' + fmt(x.pending) + ' à percevoir' : ''}</div></div></a>`).join('')}</div>
    <div class="cta-bar"><a class="btn primary block" href="#/invest?new=1">${icon('plus')} Nouvel investissement</a></div>`;
}

const EVENT = {
  div_accrue: { t: 'Dividende', ic: 'coins', c: 'var(--ok)', sign: '+' },
  income: { t: 'Dividende reçu', ic: 'coins', c: 'var(--ok)', sign: '+' },
  div_collect: { t: 'Encaissé', ic: 'download', c: 'var(--primary)', sign: '' },
  div_convert: { t: 'Converti en capital', ic: 'repeat', c: '#7c3aed', sign: '' },
  invest: { t: 'Contribution versée', ic: 'plus', c: 'var(--primary)', sign: '' },
};

function detail(inv) {
  if (!inv) return emptyState('alert', 'Introuvable', 'Cet investissement a peut-être été supprimé.', '#/invest', 'Retour');
  const x = investInfo(inv);
  const b = balances();
  const pct = x.commitment ? Math.min(100, Math.round(x.capital / x.commitment * 100)) : null;
  const events = [
    ...state.tx.filter(t => t.investment === inv.id && EVENT[t.type]).map(t => {
      const e = EVENT[t.type];
      const where = t.history ? 'avant l’application' : t.wallet ? esc(wallet(t.wallet)?.name) : t.type === 'div_accrue' ? 'à percevoir' : '';
      return { date: t.date, html: `<div class="row">${tile(e.ic, e.c)}<div class="l"><div class="t">${e.t}</div><div class="s">${fmtDate(t.date)}${where ? ' · ' + where : ''}</div></div><div class="r num ${e.sign ? 'pos' : ''}">${e.sign}${fmt(t.amount)}</div></div>` };
    }),
    ...(inv.missed || []).map(d => ({ date: d, html: `<div class="row">${tile('pause')}<div class="l"><div class="t">Pas de dividende</div><div class="s">${fmtDate(d)}</div></div><div class="r muted">0 F</div></div>` })),
  ].sort((a, c) => c.date.localeCompare(a.date));
  const due = inv.next ? daysBetween(today(), inv.next) : null;

  return `<div class="card">
      ${pct !== null ? `<div class="loan-head">
        <div class="ring" style="--p:${pct}"><div>${pct} %</div></div>
        <div><span class="label">Capital versé</span><div class="big num">${fmt(x.capital)}</div>
          <p class="small muted">sur ${fmt(x.commitment)} · reste ${fmt(x.toPay)}</p></div>
      </div>` : `<span class="label">Capital versé</span><div class="big num">${fmt(x.capital)}</div>`}
      <div class="hr"></div>
      <div class="grid3 center">
        <div class="stat"><span class="label">À percevoir</span><b class="num">${fmt(x.pending)}</b></div>
        <div class="stat"><span class="label">Encaissés</span><b class="num">${fmt(x.received)}</b></div>
        <div class="stat"><span class="label">Rendement</span><b class="num">${x.yearly !== null ? '≈ ' + x.yearly.toFixed(1) + ' %' : '—'}</b></div>
      </div>
      <p class="small muted mt">${x.avg ? `Moyenne ${fmt(Math.round(x.avg))} par dividende · ` : ''}${x.yearly !== null ? 'rendement estimé par an' : 'le rendement apparaîtra après le premier dividende'}</p>
    </div>

    <form id="div" class="card">
      <h2>${icon('coins')} Dividende du mois</h2>
      <p class="small ${due !== null && due < 0 ? 'warn-text' : 'muted'}">${inv.next ? `Attendu le ${fmtDate(inv.next)}${due < 0 ? ` (il y a ${-due} j)` : ''}` : 'Pas de date prévue'} · il reste chez ${esc(inv.name)} (à percevoir)</p>
      <div class="field mt"><input class="amount" name="amount" inputmode="decimal" placeholder="${x.avg ? fmt(Math.round(x.avg)) : '0 F'}"></div>
      <div class="field"><label>Date</label><input type="date" name="date" value="${inv.next && inv.next <= today() ? inv.next : today()}"></div>
      <div class="grid2"><button type="button" class="btn" id="missed">${icon('pause')} Pas ce mois</button><button class="btn primary">Enregistrer</button></div>
    </form>

    ${x.pending > 0 ? `<div class="card">
      <h2>À percevoir : ${fmt(x.pending)}</h2>
      <div class="grid2">
        <button class="btn" id="collect-open">${icon('download')} Encaisser</button>
        <button class="btn" id="convert">${icon('repeat')} En capital</button>
      </div>
      <form id="collect" class="mt" hidden>
        <div class="field"><label>Montant</label><input name="amount" inputmode="decimal" value="${toInput(x.pending)}"></div>
        <div class="grid2">
          <div class="field"><label>Reçu sur</label><select name="wallet">${walletOpts('momo', { balances: b.w })}</select></div>
          <div class="field"><label>Compte</label><select name="jar">${jarOpts('inv')}</select></div>
        </div>
        ${feeFields('momo')}
        <button class="btn primary block">Encaisser</button>
      </form>
    </div>` : ''}

    <details class="card"><summary>Verser une contribution</summary>
      <form id="addm" class="mt">
        <p class="small muted">L'argent sort de ton compte Investissement vers ${esc(inv.name)}.</p>
        <div class="grid2">
          <div class="field"><label>Montant</label><input name="amount" inputmode="decimal"></div>
          <div class="field"><label>Depuis</label><select name="wallet">${walletOpts('caisse', { balances: b.w })}</select></div>
        </div>
        ${feeFields('caisse')}
        <button class="btn primary block">Verser</button>
      </form>
    </details>

    <details class="card"><summary>Modifier</summary>
      <form id="edit" class="mt">
        <div class="grid2">
          <div class="field"><label>Engagement total</label><input name="commitment" inputmode="decimal" value="${toInput(inv.commitment)}"></div>
          <div class="field"><label>Dividende tous les (mois)</label><input name="freq" inputmode="numeric" value="${inv.freq || 1}"></div>
        </div>
        <div class="field"><label>Prochain dividende</label><input type="date" name="next" value="${inv.next || ''}"></div>
        <div class="field"><label>Valeur actuelle (si différente du capital + à percevoir)</label><input name="value" inputmode="decimal" value="${toInput(inv.value)}" placeholder="${toInput(x.capital + x.pending)}"></div>
        <div class="grid2"><button type="button" class="btn danger" id="del">${icon('trash')} Supprimer</button><button class="btn">Sauver</button></div>
      </form>
    </details>

    <h3>Historique</h3>
    <div class="card tight">${events.map(e => e.html).join('') || emptyState('clock', 'En attente du premier dividende', 'Note le dividende chaque mois, ou « Pas ce mois » si rien ne vient.')}</div>`;
}

export function mount(root, { id, q }) {
  if (q.get('new')) {
    const f = root.querySelector('#new');
    f.onsubmit = async e => {
      e.preventDefault();
      const d = formData(f);
      const inv = { id: uid(), name: d.name.trim(), type: d.type, initial: parseMoney(d.initial || 0) || 0, commitment: parseMoney(d.commitment || 0) || 0,
        accrued: parseMoney(d.accrued || 0) || 0, start: today(), freq: +d.freq || 1, next: d.next || '', missed: [] };
      state.investments.push(inv);
      await save();
      go(`#/invest/${inv.id}`);
    };
    return;
  }
  if (!id) return;
  const inv = investment(id); if (!inv) return;
  // A dividend close to the expected date keeps the schedule (1 Oct → 1 Nov), otherwise restart from it.
  const advance = date => {
    const base = inv.next && Math.abs(daysBetween(date, inv.next)) <= 15 ? inv.next : date;
    inv.next = addMonths(base, inv.freq || 1);
  };

  const div = root.querySelector('#div');
  div.onsubmit = async e => {
    e.preventDefault();
    const d = formData(div);
    const a = parseMoney(d.amount);
    if (!(a > 0)) return toast('Entre le montant du dividende');
    const date = d.date || today();
    const prevNext = inv.next;
    advance(date);
    const items = await addTx({ type: 'div_accrue', date: date + 'T12:00', amount: a, investment: inv.id, note: inv.name },
      `Dividende ${inv.name} : ${fmt(a)}`, { quiet: true });
    // peak moment: passive income is the heart of financial freedom
    const x = investInfo(inv), fr = freedom();
    const v = await celebrate({ title: 'Ton argent a travaillé pour toi', amount: '+' + fmt(a),
      sub: `À percevoir chez ${inv.name} : ${fmt(x.pending)}${fr.pct !== null ? ` · liberté financière ${fr.pct.toFixed(1)} %` : ''}.`,
      actions: [{ label: 'Super', value: 'done', primary: true }, { label: 'Annuler ce dividende', value: 'undo' }] });
    if (v === 'undo') { inv.next = prevNext; await items.undo(); }
  };

  root.querySelector('#missed').onclick = async () => {
    inv.missed = [...(inv.missed || []), inv.next && inv.next <= today() ? inv.next : today()];
    advance(today());
    await save();
    toast('Noté : pas de dividende ce mois');
  };

  const open = root.querySelector('#collect-open');
  if (open) open.onclick = () => { root.querySelector('#collect').hidden = false; open.classList.add('primary'); };
  const col = root.querySelector('#collect');
  if (col) col.onsubmit = async e => {
    e.preventDefault();
    const d = formData(col);
    const a = parseMoney(d.amount), max = investInfo(inv).pending;
    if (!(a > 0)) return toast('Entre un montant');
    if (a > max) return toast(`Maximum ${fmt(max)}`);
    await addTx({ type: 'div_collect', date: nowLocal(), amount: a, wallet: d.wallet, jar: d.jar, investment: inv.id, note: inv.name, ...feeVals(d, d.wallet) },
      `Encaissé : ${fmt(a)} sur ${wallet(d.wallet).name}`);
  };
  const conv = root.querySelector('#convert');
  if (conv) conv.onclick = async () => {
    const x = investInfo(inv);
    if (!(await ask(`Convertir les ${fmt(x.pending)} à percevoir en capital chez ${inv.name} ?${x.commitment ? `\nCapital versé : ${fmt(x.capital)} → ${fmt(x.capital + x.pending)}` : ''}`, { ok: 'Convertir' }))) return;
    await addTx({ type: 'div_convert', date: nowLocal(), amount: x.pending, investment: inv.id, note: inv.name }, `Converti en capital : ${fmt(x.pending)}`);
  };

  const addm = root.querySelector('#addm');
  addm.onchange = () => showFees(addm, addm.wallet.value);
  if (col) col.onchange = () => showFees(col, col.wallet.value);
  addm.onsubmit = async e => {
    e.preventDefault();
    const d = formData(addm);
    const a = parseMoney(d.amount);
    if (!(a > 0)) return toast('Entre un montant');
    await addTx({ type: 'invest', date: nowLocal(), amount: a, wallet: d.wallet, jar: 'inv', investment: inv.id, note: inv.name, ...feeVals(d, d.wallet) }, `Contribution : ${fmt(a)}`);
  };

  const ed = root.querySelector('#edit');
  ed.onsubmit = async e => {
    e.preventDefault();
    const d = formData(ed);
    inv.commitment = parseMoney(d.commitment || 0) || 0;
    inv.value = d.value.trim() ? parseMoney(d.value) : undefined;
    inv.freq = +d.freq || 1;
    inv.next = d.next;
    await save();
    toast('Sauvé', null, { ok: true });
  };
  root.querySelector('#del').onclick = async () => {
    if (!(await ask(`Supprimer ${inv.name} ? Les mouvements déjà enregistrés restent dans l'historique.`, { danger: true, ok: 'Oui' }))) return;
    state.investments = state.investments.filter(x => x.id !== inv.id);
    await save();
    go('#/invest');
  };
}
