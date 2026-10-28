// Investment portfolio: what went in, what came back, when the next payment is expected.
import { state, save, uid } from '../store.js';
import { parseMoney, fmt, toInput, investInfo, investment, today, nowLocal, fmtDate, addMonths, daysBetween, split, balances, wallet, freedom } from '../logic.js';
import { esc, walletOpts, addTx, formData, go, toast, ask, icon, tile, emptyState, celebrate } from '../ui.js';

const TYPES = { association: 'Association', business: 'Business', land: 'Terrain / Immobilier', stocks: 'Actions', tontine: 'Tontine', other: 'Autre' };

export function render({ id, q }) {
  if (id) return detail(investment(id));
  if (q.get('new')) return `<form id="new" class="card">
      <div class="field"><label>Nom</label><input name="name" required></div>
      <div class="field"><label>Type</label><select name="type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="field"><label>Déjà investi avant l'application (montant)</label><input name="initial" inputmode="decimal" placeholder="0"></div>
      <div class="grid2">
        <div class="field"><label>Date de début</label><input type="date" name="start" value="${today()}"></div>
        <div class="field"><label>Paiement tous les (mois)</label><input name="freq" inputmode="numeric" value="1"></div>
      </div>
      <div class="field"><label>Prochain paiement attendu</label><input type="date" name="next"></div>
      <label class="check"><input type="checkbox" name="reinvest" checked> Réinvestir les gains (100% vers Investissement)</label>
      <button class="btn primary block mt">Créer</button>
    </form>`;

  const list = state.investments.map(i => ({ i, x: investInfo(i) }));
  const tot = list.reduce((s, { x }) => ({ inv: s.inv + x.invested, rec: s.rec + x.received, val: s.val + x.value }), { inv: 0, rec: 0, val: 0 });
  const fr = freedom();
  if (!list.length) return `<div class="card">${emptyState('trending-up', 'Fais travailler ton argent',
    "Ajoute tes placements (association, business, terrain, tontine…) pour suivre ce qu'ils te rapportent et quand le prochain paiement arrive.",
    '#/invest?new=1', 'Ajouter un investissement')}</div>`;
  return `<div class="card grid3 center">
      <div class="stat"><span class="label">Investi</span><b class="num">${fmt(tot.inv)}</b></div>
      <div class="stat"><span class="label">Valeur</span><b class="num">${fmt(tot.val)}</b></div>
      <div class="stat"><span class="label">Gains</span><b class="num pos">${fmt(tot.rec)}</b></div>
    </div>
    <div class="card"><div class="small muted">Liberté financière</div>
      <div class="meter mt"><i style="width:${Math.min(100, fr.pct || 0)}%"></i></div>
      <p class="small mt">${fr.pct === null ? 'Pas encore de dépenses de Nécessité enregistrées.' : `${fr.pct.toFixed(1)} % de tes besoins couverts par tes revenus passifs (${fmt(fr.passive)}/mois).`}</p></div>
    <div class="card tight">${list.map(({ i, x }) => `<a class="row" href="#/invest/${i.id}">${tile('coins', 'var(--primary)')}
      <div class="l"><div class="t">${esc(i.name)}</div><div class="s">${TYPES[i.type] || ''} · ${x.returns.length} paiement(s)${i.next ? ' · prochain ' + fmtDate(i.next) : ''}</div></div>
      <div class="r">${fmt(x.value)}<div class="small pos">+${fmt(x.received)}</div></div></a>`).join('')}</div>
    <div class="cta-bar"><a class="btn primary block" href="#/invest?new=1">${icon('plus')} Nouvel investissement</a></div>`;
}

function detail(inv) {
  if (!inv) return emptyState('alert', 'Introuvable', 'Cet investissement a peut-être été supprimé.', '#/invest', 'Retour');
  const x = investInfo(inv);
  const b = balances();
  const events = [
    ...x.returns.map(t => ({ date: t.date, html: `<div class="row">${tile('coins', 'var(--ok)')}<div class="l"><div class="t">Paiement reçu</div><div class="s">${fmtDate(t.date)}${t.history ? ' · avant l\'application' : ' · ' + esc(wallet(t.wallet)?.name)}</div></div><div class="r pos">+${fmt(t.amount)}</div></div>` })),
    ...(inv.missed || []).map(d => ({ date: d, html: `<div class="row">${tile('pause')}<div class="l"><div class="t">Pas de paiement</div><div class="s">${fmtDate(d)}</div></div><div class="r muted">0 F</div></div>` })),
    ...state.tx.filter(t => t.type === 'invest' && t.investment === inv.id).map(t => ({ date: t.date, html: `<div class="row">${tile('plus')}<div class="l"><div class="t">Argent ajouté</div><div class="s">${fmtDate(t.date)} · ${esc(wallet(t.wallet)?.name)}</div></div><div class="r">${fmt(t.amount)}</div></div>` })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const avg = x.returns.length ? x.received / x.returns.length : 0;
  return `<div class="card">
      <p class="muted small">${TYPES[inv.type] || ''}${inv.start ? ' · depuis ' + fmtDate(inv.start) : ''} · gains ${inv.reinvest ? 'réinvestis' : 'répartis sur les 6'}</p>
      <div class="grid3 mt center">
        <div><div class="small muted">Investi</div><b>${fmt(x.invested)}</b></div>
        <div><div class="small muted">Reçu</div><b class="pos">${fmt(x.received)}</b></div>
        <div><div class="small muted">Rendement</div><b>${x.roi.toFixed(1)} %</b></div>
      </div>
      <p class="small muted mt">${x.yearly !== null ? `≈ ${x.yearly.toFixed(1)} % par an · ` : ''}${x.returns.length ? `moyenne ${fmt(avg)} par paiement` : ''}</p>
      <p class="mt">${icon('clock')} Prochain paiement attendu : <b>${inv.next ? fmtDate(inv.next) : '—'}</b></p>
    </div>
    <form id="ret" class="card">
      <h2>Noter un paiement</h2>
      <div class="field"><input class="amount" name="amount" inputmode="decimal" placeholder="${avg ? fmt(avg) : '0 F'}"></div>
      <div class="grid2">
        <div class="field"><label>Reçu sur</label><select name="wallet">${walletOpts(state.settings.lastWallet || 'om', { balances: b.w })}</select></div>
        <div class="field"><label>Date</label><input type="date" name="date" value="${today()}"></div>
      </div>
      <label class="check"><input type="checkbox" name="reinvest" ${inv.reinvest ? 'checked' : ''}> Réinvestir (100% Investissement)</label>
      <div class="grid2 mt"><button type="button" class="btn" id="missed">${icon('pause')} Pas payé</button><button class="btn primary">Enregistrer</button></div>
    </form>
    <details class="card"><summary>Ajouter de l'argent / modifier</summary>
      <form id="addm" class="mt">
        <p class="small muted">L'argent sort du compte Investissement vers ce placement.</p>
        <div class="grid2">
          <div class="field"><label>Montant</label><input name="amount" inputmode="decimal"></div>
          <div class="field"><label>Depuis</label><select name="wallet">${walletOpts('caisse', { balances: b.w })}</select></div>
        </div>
        <button class="btn block">Investir</button>
      </form>
      <div class="hr"></div>
      <form id="edit">
        <div class="grid2">
          <div class="field"><label>Valeur actuelle</label><input name="value" inputmode="decimal" value="${toInput(inv.value)}" placeholder="${toInput(x.invested)}"></div>
          <div class="field"><label>Tous les (mois)</label><input name="freq" inputmode="numeric" value="${inv.freq || 1}"></div>
        </div>
        <div class="field"><label>Prochain paiement</label><input type="date" name="next" value="${inv.next || ''}"></div>
        <div class="grid2"><button type="button" class="btn danger" id="del">Supprimer</button><button class="btn">Sauver</button></div>
      </form>
    </details>
    <h3>Historique</h3>
    <div class="card tight">${events.map(e => e.html).join('') || emptyState('clock', 'En attente du premier paiement', 'Note chaque paiement reçu, ou « Pas payé » si rien ne vient.')}</div>`;
}

export function mount(root, { id, q }) {
  if (q.get('new')) {
    const f = root.querySelector('#new');
    f.onsubmit = async e => {
      e.preventDefault();
      const d = formData(f);
      const inv = { id: uid(), name: d.name.trim(), type: d.type, initial: parseMoney(d.initial || 0) || 0, start: d.start, freq: +d.freq || 1,
        next: d.next || '', reinvest: !!d.reinvest, missed: [] };
      state.investments.push(inv);
      await save();
      go(`#/invest/${inv.id}`);
    };
    return;
  }
  if (!id) return;
  const inv = investment(id); if (!inv) return;
  // A payment close to the expected date keeps the schedule (end of Oct → end of Dec), otherwise restart from it.
  const advance = date => {
    const base = inv.next && Math.abs(daysBetween(date, inv.next)) <= 15 ? inv.next : date;
    inv.next = addMonths(base, inv.freq || 1);
  };

  const ret = root.querySelector('#ret');
  ret.onsubmit = async e => {
    e.preventDefault();
    const d = formData(ret);
    const a = parseMoney(d.amount);
    if (!(a > 0)) return toast('Entre le montant reçu');
    advance(d.date || today());
    const items = await addTx({ type: 'income', date: (d.date || today()) + 'T12:00', amount: a, wallet: d.wallet, cat: 'inv_return', passive: true,
      investment: inv.id, alloc: d.reinvest ? [{ jar: 'inv', amount: a }] : split(a), note: inv.name }, `Paiement ${inv.name} : ${fmt(a)}`, { quiet: true });
    // peak moment: passive income is the heart of financial freedom
    const x = investInfo(inv), fr = freedom();
    const v = await celebrate({ title: 'Ton argent a travaillé pour toi', amount: '+' + fmt(a),
      sub: `${inv.name} t'a rapporté ${fmt(x.received)} au total${fr.pct !== null ? ` · liberté financière ${fr.pct.toFixed(1)} %` : ''}.`,
      actions: [{ label: 'Super', value: 'done', primary: true }, { label: 'Annuler ce paiement', value: 'undo' }] });
    if (v === 'undo') await items.undo();
  };
  root.querySelector('#missed').onclick = async () => {
    inv.missed = [...(inv.missed || []), inv.next && inv.next <= today() ? inv.next : today()];
    advance(today());
    await save();
    toast('Noté : pas de paiement');
  };
  const addm = root.querySelector('#addm');
  addm.onsubmit = async e => {
    e.preventDefault();
    const d = formData(addm);
    const a = parseMoney(d.amount);
    if (!(a > 0)) return toast('Entre un montant');
    await addTx({ type: 'invest', date: nowLocal(), amount: a, wallet: d.wallet, jar: 'inv', investment: inv.id, note: inv.name }, `Investi : ${fmt(a)}`);
  };
  const ed = root.querySelector('#edit');
  ed.onsubmit = async e => {
    e.preventDefault();
    const d = formData(ed);
    inv.value = d.value.trim() ? parseMoney(d.value) : undefined;
    inv.freq = +d.freq || 1;
    inv.next = d.next;
    await save();
    toast('Sauvé');
  };
  root.querySelector('#del').onclick = async () => {
    if (!(await ask(`Supprimer ${inv.name} ? Les paiements déjà reçus restent dans l'historique.`, { danger: true, ok: 'Oui' }))) return;
    state.investments = state.investments.filter(x => x.id !== inv.id);
    await save();
    go('#/invest');
  };
}
