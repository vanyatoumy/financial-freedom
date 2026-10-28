// Settings: split percentages, wallets, categories, favourites, backup / export.
import { state, save, uid, replaceState } from '../store.js';
import { fmt, today, TYPE_LABEL, wallet, jar, cat, loan, investment } from '../logic.js';
import { esc, jarOpts, formData, toast, go, ask, icon, tile } from '../ui.js';
import { defaultState } from '../defaults.js';
import { ICON_NAMES } from '../icons.js';

export function render() {
  return `<form id="pct" class="card">
      <h2>Répartition des revenus</h2>
      ${state.jars.map(j => `<div class="count-row" style="padding:6px 0;border:0"><span class="wname">${tile(j.icon, j.color, 'mini-ico')} ${esc(j.name)}</span>
        <input name="${j.id}" inputmode="numeric" value="${j.pct}"><span>%</span></div>`).join('')}
      <p id="pctsum" class="small"></p>
      <p class="small muted">Les changements s'appliquent aux prochains revenus seulement.</p>
      <button class="btn primary block">Sauver la répartition</button>
    </form>

    <form id="wal" class="card">
      <h2>Portefeuilles</h2>
      ${state.wallets.map(w => `<div class="field"><div class="grid2">
          <input name="name_${w.id}" value="${esc(w.name)}">
          <label class="check"><input type="checkbox" name="daily_${w.id}" ${w.daily ? 'checked' : ''}> Comptage du matin</label></div>
        ${w.interestPct !== undefined ? `<div class="grid2 mt"><div><label>Intérêts (% par période)</label><input name="ip_${w.id}" inputmode="decimal" value="${w.interestPct}"></div>
          <div><label>Dates (MM-JJ)</label><input name="id_${w.id}" value="${esc((w.interestDates || []).join(', '))}"></div></div>` : ''}
        </div>`).join('')}
      <button class="btn block">Sauver les portefeuilles</button>
      <details class="mt"><summary>+ Nouveau portefeuille</summary>
        <div class="grid2 mt"><input name="new_name" placeholder="ex. Banque"><select name="new_role">
          <option value="spending">Utilisable</option><option value="online">Paiement en ligne</option><option value="vault">Bloqué / protégé</option></select></div>
      </details>
    </form>

    <form id="cat" class="card">
      <h2>+ Nouvelle catégorie</h2>
      <div class="grid2">
        <input name="name" placeholder="ex. Coiffeur" required>
        <select name="kind"><option value="expense">Dépense</option><option value="income">Revenu</option></select>
      </div>
      <div class="grid2 mt"><select name="icon">${ICON_NAMES.map(n => `<option value="${n}">${n}</option>`).join('')}</select><select name="jar">${jarOpts('nec')}</select></div>
      <label class="check mt"><input type="checkbox" name="person"> Demander la personne</label>
      <button class="btn block mt">Ajouter</button>
    </form>

    ${state.favorites.length ? `<div class="card tight"><div class="row"><b>Favoris</b></div>${state.favorites.map(f => `<div class="row"><div class="l">${esc(f.label)}</div><div class="r">${fmt(f.amount)}</div><button class="btn sm danger" data-fav="${f.id}" aria-label="Supprimer">${icon('x')}</button></div>`).join('')}</div>` : ''}

    <div class="card stack">
      <h2>Données</h2>
      <p class="small muted">Tes données restent sur ce téléphone. Fais une sauvegarde régulièrement (ex. chaque semaine).</p>
      <button class="btn block" id="csv">${icon('file')} Exporter en CSV (Excel)</button>
      <button class="btn block" id="backup">${icon('download')} Sauvegarder (fichier JSON)</button>
      <label class="btn block" style="margin:8px 0 0">${icon('upload')} Restaurer une sauvegarde<input type="file" id="restore" accept="application/json,.json" hidden></label>
      <button class="btn block danger" id="reset">${icon('trash')} Tout effacer</button>
    </div>`;
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function csv() {
  const head = ['Date', 'Type', 'Montant', 'Portefeuille', 'Vers', 'Frais', 'Compte', 'Vers compte', 'Catégorie', 'Personne', 'Prêt/Dette', 'Investissement', 'Passif', 'Note'];
  const n = c => ((c || 0) / 100).toString().replace('.', ',');
  const q = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const rows = [...state.tx].sort((a, b) => a.date.localeCompare(b.date)).map(t => [
    t.date.replace('T', ' '), TYPE_LABEL[t.type], t.type === 'opening' ? n(Object.values(t.wl || {}).reduce((s, v) => s + v, 0)) : n(t.amount),
    wallet(t.wallet)?.name, wallet(t.to)?.name, t.fee ? n(t.fee) : '',
    t.alloc ? t.alloc.map(p => `${jar(p.jar)?.name} ${n(p.amount)}`).join(' / ') : jar(t.jar)?.name, jar(t.toJar)?.name,
    cat(t.cat)?.name, t.person, loan(t.loan)?.person, investment(t.investment)?.name, t.passive ? 'oui' : '', t.note,
  ].map(q).join(';'));
  return '﻿' + [head.map(q).join(';'), ...rows].join('\r\n');
}

export function mount(root) {
  const pf = root.querySelector('#pct');
  const sumEl = root.querySelector('#pctsum');
  const sum = () => state.jars.reduce((s, j) => s + (parseFloat(pf[j.id].value) || 0), 0);
  const show = () => { const s = sum(); sumEl.innerHTML = s === 100 ? '<span class="pos">Total 100 % ' + icon('check') + '</span>' : `<span class="neg">Total ${s} % (doit faire 100 %)</span>`; };
  pf.oninput = show; show();
  pf.onsubmit = async e => {
    e.preventDefault();
    if (sum() !== 100) return toast('Le total doit faire 100 %');
    state.jars.forEach(j => { j.pct = parseFloat(pf[j.id].value) || 0; });
    await save(); toast('Répartition sauvée');
  };

  const wf = root.querySelector('#wal');
  wf.onsubmit = async e => {
    e.preventDefault();
    const d = formData(wf);
    for (const w of state.wallets) {
      w.name = d[`name_${w.id}`]?.trim() || w.name;
      w.daily = !!d[`daily_${w.id}`];
      if (w.interestPct !== undefined) {
        w.interestPct = parseFloat(String(d[`ip_${w.id}`]).replace(',', '.')) || 0;
        w.interestDates = String(d[`id_${w.id}`] || '').split(/[,\s]+/).filter(x => /^\d\d-\d\d$/.test(x));
      }
    }
    if (d.new_name?.trim()) state.wallets.push({ id: uid(), name: d.new_name.trim(), icon: d.new_role === 'vault' ? 'lock' : 'wallet', color: '#64748b',
      role: d.new_role, decimals: true, daily: d.new_role !== 'vault' });
    await save(); toast('Portefeuilles sauvés');
  };

  const cf = root.querySelector('#cat');
  cf.onsubmit = async e => {
    e.preventDefault();
    const d = formData(cf);
    state.categories.push({ id: uid(), kind: d.kind, name: d.name.trim(), icon: d.icon || 'tag', jar: d.kind === 'expense' ? d.jar : undefined, person: !!d.person });
    await save(); toast('Catégorie ajoutée');
  };

  root.querySelectorAll('[data-fav]').forEach(b => b.onclick = async () => {
    state.favorites = state.favorites.filter(f => f.id !== b.dataset.fav); await save();
  });

  root.querySelector('#csv').onclick = () => download(`6comptes-${today()}.csv`, csv(), 'text/csv;charset=utf-8');
  root.querySelector('#backup').onclick = () => download(`6comptes-sauvegarde-${today()}.json`, JSON.stringify(state, null, 1), 'application/json');
  root.querySelector('#restore').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.tx) || !Array.isArray(data.jars)) throw new Error('format');
      if (!(await ask(`Remplacer toutes les données actuelles par cette sauvegarde (${data.tx.length} mouvements) ?`, { danger: true, ok: 'Oui' }))) return;
      await replaceState(data); toast('Sauvegarde restaurée'); go('#/');
    } catch { toast('Fichier de sauvegarde invalide'); }
  };
  root.querySelector('#reset').onclick = async () => {
    if (!(await ask('Tout effacer ? Fais une sauvegarde avant !', { danger: true, ok: 'Oui' }))) return;
    if ((await ask('Tape EFFACER pour confirmer', { input: 'EFFACER', danger: true, ok: 'Effacer' })) !== 'EFFACER') return;
    await replaceState(defaultState()); go('#/setup');
  };
}
