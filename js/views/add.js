// Quick add: expense, income, wallet transfer (with fee) and move between jars.
import { state, uid } from '../store.js';
import { parseMoney, fmt, toInput, nowLocal, addMonths, split, balances, summary, cat, jar, wallet, canTransfer, transferKind, feeWalletOf } from '../logic.js';
import { esc, walletOpts, jarOpts, addTx, formData, go, toast, ask, haptic, icon, celebrate, feeFields, showFees, feeVals } from '../ui.js';

const TYPES = [['expense', 'Dépense'], ['income', 'Revenu'], ['transfer', 'Retrait/Dépôt'], ['jar_move', 'Comptes']];

function persons() {
  return [...new Set([...state.tx.map(t => t.person), ...state.loans.map(l => l.person)].filter(Boolean))].sort();
}

// Most used categories first; the rest hide behind "Autres" so the form stays short.
function catChips(kind, selected) {
  const uses = {};
  state.tx.forEach(t => { if (t.cat) uses[t.cat] = (uses[t.cat] || 0) + 1; });
  const list = state.categories.filter(c => c.kind === kind).map((c, i) => ({ c, i }))
    .sort((a, b) => (uses[b.c.id] || 0) - (uses[a.c.id] || 0) || a.i - b.i).map(x => x.c);
  const top = 7;
  return `<div class="chips wrap">${list.map((c, i) =>
    `<button type="button" class="chip ${c.id === selected ? 'on' : ''}" data-cat="${c.id}" ${i >= top && c.id !== selected ? 'data-extra hidden' : ''}>${icon(c.icon)} ${esc(c.name)}</button>`).join('')}
    ${list.length > top ? '<button type="button" class="chip" id="more-cats">⋯ Autres</button>' : ''}</div>`;
}

function walletChips(selected, b, filter = () => true) {
  return `<div class="chips">${state.wallets.filter(filter).map(w =>
    `<button type="button" class="chip wallet-chip ${w.id === selected ? 'on' : ''}" data-wallet="${w.id}" style="--c:${w.color || 'var(--primary)'}"><span class="wc-name">${icon(w.icon)} ${esc(w.name)}</span><small>${fmt(b.w[w.id])}</small></button>`).join('')}</div>
    <input type="hidden" name="wallet" value="${selected}">`;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'del'];

// Full-screen form: amount and choices scroll at the top, keypad and save button stay at the bottom.
function screen(seg, amount, fields, options, saveLabel) {
  return `<form id="f" class="add-screen" autocomplete="off">
    <div class="add-body">
      ${seg}
      <input class="amount-display" name="amount" inputmode="none" placeholder="0 F" value="${amount}" aria-label="Montant">
      <div class="amount-hint" id="warn"></div>
      ${fields}
      <details class="card"><summary>Plus d'options</summary><div class="mt">${options}</div></details>
    </div>
    <div class="add-foot">
      <div class="keypad" id="keypad">${KEYS.map(k => `<button type="button" data-key="${k}" ${k === 'del' ? 'aria-label="Effacer"' : ''}>${k === 'del' ? icon('backspace') : k}</button>`).join('')}</div>
      <button class="btn primary block">${saveLabel}</button>
    </div>
  </form>`;
}

export function render({ q }) {
  const type = q.get('type') || 'expense';
  const b = balances();
  const amount = q.get('amount') ? toInput(+q.get('amount')) : '';
  const last = state.settings.lastWallet || 'om';
  const backQs = q.get('back') ? '&back=' + encodeURIComponent(q.get('back')) : '';
  const seg = `<div class="seg">${TYPES.map(([t, l]) => `<a href="#/add?type=${t}${backQs}" class="${t === type ? 'on' : ''}">${l}</a>`).join('')}</div>`;
  const dateField = `<div class="field"><label>Date et heure</label><input type="datetime-local" name="date" value="${nowLocal()}"></div>`;
  const noteField = `<div class="field"><label>Note</label><input name="note" value="${esc(q.get('note') || '')}" placeholder="ex. marché, taxi…"></div>`;
  const usable = w => w.role !== 'vault';

  if (type === 'expense') {
    const c0 = q.get('cat') || 'food';
    return screen(seg, amount, `
      <label>Catégorie</label>${catChips('expense', c0)}<input type="hidden" name="cat" value="${c0}">
      <label>Payé avec</label>${walletChips(q.get('wallet') || last, b, usable)}
      ${feeFields(q.get('wallet') || last)}
      <div class="field"><label>Pris sur le compte</label><select name="jar">${jarOpts(q.get('jar') || cat(c0)?.jar || 'nec', b.j)}</select></div>
      <div class="field" id="person-f" ${cat(c0)?.person ? '' : 'hidden'}><label>Personne</label>
        <input name="person" list="persons" placeholder="ex. Maman"><datalist id="persons">${persons().map(p => `<option value="${esc(p)}">`).join('')}</datalist></div>
      <div class="card" id="topup" hidden>
        <label class="check"><input type="checkbox" name="topup" checked> ${icon('card')} Recharger PAYSIKA d'abord</label>
        <div class="grid2 mt">
          <div class="field"><label>Depuis</label><select name="topFrom">${walletOpts('om', { filter: w => canTransfer(w.id, 'paysika'), balances: b.w })}</select></div>
        </div>
        ${feeFields('om', 'top')}
      </div>`,
      `${noteField}${dateField}<label class="check"><input type="checkbox" name="fav"> ${icon('star')} Ajouter aux favoris</label>`,
      'Enregistrer la dépense');
  }

  if (type === 'income') {
    const c0 = q.get('cat') || 'salary';
    const j0 = q.get('jar');
    return screen(seg, amount, `
      <label>Source</label>${catChips('income', c0)}<input type="hidden" name="cat" value="${c0}">
      <label>Reçu sur</label>${walletChips(q.get('wallet') || last, b)}
      ${feeFields(q.get('wallet') || last)}
      <div class="seg" id="mode">
        <button type="button" data-mode="split" class="${j0 ? '' : 'on'}">Répartir sur les 6</button>
        <button type="button" data-mode="one" class="${j0 ? 'on' : ''}">Un seul compte</button>
      </div>
      <input type="hidden" name="mode" value="${j0 ? 'one' : 'split'}">
      <div class="field" id="one-jar" ${j0 ? '' : 'hidden'}><label>Compte</label><select name="jar">${jarOpts(j0 || 'nec')}</select></div>
      <div class="card" id="preview"></div>`,
      `<label class="check"><input type="checkbox" name="passive" ${cat(c0)?.passive ? 'checked' : ''}> Revenu passif (l'argent travaille pour moi)</label>
      <div class="mt">${noteField}${dateField}</div>`,
      'Enregistrer le revenu');
  }

  if (type === 'transfer') {
    const to = q.get('to') || 'cash';
    const from = q.get('wallet') || (wallet(to)?.onlyFrom?.[0]) || (to === 'cash' ? 'om' : 'cash');
    return screen(seg, amount, `
      <div class="grid2">
        <div class="field"><label>De</label><select name="wallet">${walletOpts(from, { filter: w => state.wallets.some(x => canTransfer(w.id, x.id)), balances: b.w })}</select></div>
        <div class="field"><label>Vers</label><select name="to"></select></div>
      </div>
      <p class="small" id="kind"></p>
      ${feeFields(feeWalletOf(from, to))}
      <p class="small muted">Seuls les retraits (OM/MOMO → CASH ou PAYSIKA, PAYSIKA → OM/MOMO), les dépôts (CASH → OM/MOMO) et l'envoi MOMO → UBA sont possibles. Frais et taxes sont pris sur Nécessité.</p>`,
      `${noteField}${dateField}`, 'Enregistrer');
  }

  return screen(seg, amount, `
    <div class="grid2">
      <div class="field"><label>Du compte</label><select name="jar">${jarOpts('fun', b.j)}</select></div>
      <div class="field"><label>Vers le compte</label><select name="toJar">${jarOpts('nec', b.j)}</select></div>
    </div>
    <p class="small muted">Pour les exceptions : c'est noté, pour voir quand tu changes ta règle.</p>`,
    `${noteField}${dateField}`, 'Déplacer');
}

export function mount(root, { q }) {
  const type = q.get('type') || 'expense';
  const f = root.querySelector('#f');
  const back = q.get('back') || '#/';
  const b = balances();
  const amt = () => parseMoney(f.amount.value);

  // keypad writes into the amount field; the system keyboard stays closed (inputmode=none)
  const keypad = root.querySelector('#keypad');
  root.querySelectorAll('[data-key]').forEach(k => k.onclick = () => {
    const v = f.amount.value, key = k.dataset.key;
    if (key === 'del') f.amount.value = v.slice(0, -1);
    else if (key === ',') { if (!v.includes(',')) f.amount.value = (v || '0') + ','; }
    else if (!(v.includes(',') && v.split(',')[1].length >= 2) && v.replace(',', '').length < 12) f.amount.value = v === '0' ? key : v + key;
    haptic();
    update();
  });
  root.addEventListener('focusin', e => { keypad.classList.toggle('collapsed', e.target !== f.amount && e.target.matches('input:not([type=hidden]):not([type=checkbox]), select')); });
  f.amount.addEventListener('click', () => keypad.classList.remove('collapsed'));
  // once the amount is typed, choosing a category / wallet folds the keypad away to show the rest of the form
  root.querySelector('.add-body').addEventListener('click', e => {
    if (e.target.closest('[data-cat], [data-wallet], [data-mode], #more-cats') && amt() > 0) keypad.classList.add('collapsed');
  });

  root.querySelectorAll('[data-wallet]').forEach(btn => btn.onclick = () => {
    root.querySelectorAll('[data-wallet]').forEach(x => x.classList.toggle('on', x === btn));
    f.wallet.value = btn.dataset.wallet;
    update();
  });

  root.querySelectorAll('[data-cat]').forEach(btn => btn.onclick = () => {
    root.querySelectorAll('[data-cat]').forEach(x => x.classList.toggle('on', x === btn));
    f.cat.value = btn.dataset.cat;
    const c = cat(btn.dataset.cat);
    if (type === 'expense') { f.jar.value = c.jar; root.querySelector('#person-f').hidden = !c.person; }
    if (type === 'income') f.passive.checked = !!c.passive;
    update();
  });

  const more = root.querySelector('#more-cats');
  if (more) more.onclick = () => { root.querySelectorAll('[data-extra]').forEach(x => { x.hidden = false; }); more.remove(); };

  root.querySelectorAll('[data-mode]').forEach(btn => btn.onclick = () => {
    root.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x === btn));
    f.mode.value = btn.dataset.mode;
    root.querySelector('#one-jar').hidden = btn.dataset.mode !== 'one';
    update();
  });

  if (type === 'transfer') {
    const wantTo = q.get('to') || 'cash';
    const fillTo = () => {
      const from = f.wallet.value, cur = f.to.value || wantTo;
      const targets = state.wallets.filter(w => canTransfer(from, w.id));
      f.to.innerHTML = targets.map(w => `<option value="${w.id}" ${w.id === cur ? 'selected' : ''}>${esc(w.name)} · ${fmt(b.w[w.id])}</option>`).join('');
    };
    fillTo();
    f.wallet.addEventListener('change', fillTo);
  }

  function update() {
    const a = amt() || 0;
    const warn = root.querySelector('#warn');
    warn.innerHTML = '';
    if (type === 'expense' || type === 'income') showFees(root, f.wallet.value);
    if (type === 'expense') {
      showFees(root, f.topFrom.value, '#topup [data-fees]');
      const isPay = f.wallet.value === 'paysika';
      root.querySelector('#topup').hidden = !isPay;
      if (isPay && !f.dataset.touched) f.topup.checked = (b.w.paysika || 0) < a;
      const j = jar(f.jar.value);
      const msgs = [];
      if (j.rule === 'no_spend') msgs.push(`<span class="neg">${icon('alert')} ${esc(j.name)} ne doit jamais être dépensé — seulement investi.</span>`);
      else if (a > (b.j[j.id] || 0)) msgs.push(`<span class="neg">${icon('alert')} ${esc(j.name)} n'a que ${fmt(b.j[j.id])}.</span>`);
      const paysikaCovered = isPay && f.topup.checked;
      if (!paysikaCovered && a > (b.w[f.wallet.value] || 0)) msgs.push(`<span class="neg">${icon('alert')} ${esc(wallet(f.wallet.value).name)} n'a que ${fmt(b.w[f.wallet.value])}.</span>`);
      warn.innerHTML = msgs.join(' ');
    }
    if (type === 'income') {
      const p = root.querySelector('#preview');
      if (f.mode.value === 'one') { p.hidden = true; return; }
      p.hidden = false;
      p.innerHTML = `<div class="split-preview">${split(a).map(x => `<span class="sp-name" style="--c:${jar(x.jar).color}">${icon(jar(x.jar).icon)} ${esc(jar(x.jar).name)}</span><b>${fmt(x.amount)}</b>`).join('')}</div>`;
    }
    if (type === 'transfer') {
      const from = f.wallet.value, to = f.to.value;
      root.querySelector('#kind').innerHTML = to ? `<b>${transferKind(from, to)}</b> ${esc(wallet(from).name)} → ${esc(wallet(to).name)}` : '';
      showFees(root, feeWalletOf(from, to));
      if (a > (b.w[from] || 0)) warn.innerHTML = `<span class="neg">${icon('alert')} ${esc(wallet(from).name)} n'a que ${fmt(b.w[from])}.</span>`;
    }
  }
  f.oninput = e => { if (e.target.name === 'topup') f.dataset.touched = 1; update(); };
  f.onchange = update;
  update();

  f.onsubmit = async e => {
    e.preventDefault();
    const d = formData(f);
    const a = amt();
    if (!(a > 0)) return toast('Entre un montant');
    const date = d.date || nowLocal();
    const note = d.note.trim();

    if (type === 'expense') {
      const j = jar(d.jar);
      if (j.rule === 'no_spend' && !(await ask(`${j.name} ne doit jamais être dépensé. Continuer quand même ?`, { ok: 'Continuer' }))) return;
      if (a > (b.j[d.jar] || 0) && j.rule !== 'no_spend' && !(await ask(`${j.name} n'a que ${fmt(b.j[d.jar])}. Continuer ?`, { ok: 'Continuer' }))) return;
      const list = [];
      if (d.wallet === 'paysika' && d.topup) {
        const need = Math.max(0, a - Math.max(0, b.w.paysika || 0));
        list.push({ type: 'transfer', date, amount: need, wallet: d.topFrom, to: 'paysika', ...feeVals(d, d.topFrom, 'top'), note: 'Recharge PAYSIKA' });
      }
      list.push({ type: 'expense', date, amount: a, wallet: d.wallet, jar: d.jar, cat: d.cat, person: d.person?.trim() || undefined, note, ...feeVals(d, d.wallet) });
      if (d.fav) state.favorites.push({ id: uid(), label: note || cat(d.cat).name, amount: a, wallet: d.wallet, jar: d.jar, cat: d.cat, note });
      if (d.wallet !== 'paysika') state.settings.lastWallet = d.wallet;
      const sub = state.subs.find(s => s.id === q.get('sub'));
      if (sub) sub.next = sub.cycle === 'yearly' ? addMonths(sub.next, 12) : addMonths(sub.next, 1);
      await addTx(list.filter(t => t.amount > 0 || t.fee > 0 || t.tax > 0), `Dépense : ${fmt(a)}`);
    }

    if (type === 'income') {
      const alloc = d.mode === 'one' ? [{ jar: d.jar, amount: a }] : split(a);
      state.settings.lastWallet = d.wallet;
      const items = await addTx({ type: 'income', date, amount: a, wallet: d.wallet, cat: d.cat, passive: !!d.passive, alloc, note, ...feeVals(d, d.wallet) }, `Revenu : ${fmt(a)}`, { quiet: true });
      // peak moment: show where every franc went, then the one follow-up action (put protected money in its home)
      const pending = summary().pending[0];
      const v = await celebrate({
        title: 'Revenu enregistré', amount: fmt(a),
        sub: alloc.length > 1 ? 'Chaque franc a maintenant un rôle.' : `Ajouté à ${jar(alloc[0].jar).name}.`,
        rows: alloc.map(x => ({ icon: jar(x.jar).icon, color: jar(x.jar).color, name: jar(x.jar).name, value: fmt(x.amount) })),
        actions: [
          ...(pending ? [{ label: `Ranger ${fmt(pending.amount)} dans ${pending.wallet.name}`, value: 'move', primary: true }] : []),
          { label: 'Terminé', value: 'done', primary: !pending },
          { label: 'Annuler ce revenu', value: 'undo' },
        ],
      });
      if (v === 'undo') await items.undo();
      if (v === 'move') return go(`#/add?type=transfer&to=${pending.wallet.id}&amount=${pending.amount}`);
    }

    if (type === 'transfer') {
      if (!canTransfer(d.wallet, d.to)) return toast(`${wallet(d.wallet).name} → ${wallet(d.to)?.name || '?'} n'est pas autorisé`);
      const kind = transferKind(d.wallet, d.to);
      await addTx({ type: 'transfer', date, amount: a, wallet: d.wallet, to: d.to, ...feeVals(d, feeWalletOf(d.wallet, d.to)), note }, `${kind} : ${fmt(a)}`);
    }

    if (type === 'jar_move') {
      if (d.jar === d.toJar) return toast('Choisis deux comptes différents');
      await addTx({ type: 'jar_move', date, amount: a, jar: d.jar, toJar: d.toJar, note }, `Déplacé : ${fmt(a)}`);
    }
    go(back);
  };
}
