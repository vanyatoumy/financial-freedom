// Small rendering helpers shared by the views.
import { state, save, uid } from './store.js';
import { fmt, jar, wallet, parseMoney } from './logic.js';
import { icon } from './icons.js';
export { icon };

// Coloured rounded tile with an icon, used in lists and cards.
export const tile = (name, color, cls = 'row-ico') => `<span class="${cls}" style="${color ? `--c:${color}` : ''}">${icon(name)}</span>`;

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function opts(list, selected, { empty } = {}) {
  return (empty !== undefined ? `<option value="">${esc(empty)}</option>` : '') +
    list.map(x => `<option value="${esc(x.id)}" ${x.id === selected ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
}

export function walletOpts(selected, { filter, balances } = {}) {
  const list = state.wallets.filter(filter || (() => true));
  return list.map(w => `<option value="${w.id}" ${w.id === selected ? 'selected' : ''}>${esc(w.name)}${balances ? ' · ' + fmt(balances[w.id]) : ''}</option>`).join('');
}

export function jarOpts(selected, balances) {
  return state.jars.map(j => `<option value="${j.id}" ${j.id === selected ? 'selected' : ''}>${esc(j.name)}${balances ? ' · ' + fmt(balances[j.id]) : ''}</option>`).join('');
}

// Fees + taxes inputs, shown only when the chosen wallet charges them (OM, MOMO, PAYSIKA).
export function feeFields(walletId, prefix = '') {
  return `<div class="grid2" data-fees ${wallet(walletId)?.fees ? '' : 'hidden'}>
    <div class="field"><label>Frais</label><input name="${prefix}fee" inputmode="decimal" placeholder="0"></div>
    <div class="field"><label>Taxe</label><input name="${prefix}tax" inputmode="decimal" placeholder="0"></div></div>`;
}
export function showFees(root, walletId, sel = '[data-fees]') {
  const box = root.querySelector(sel);
  if (box) box.hidden = !wallet(walletId)?.fees;
}
// { fee, tax } in centimes, only when the wallet charges fees; zero values are left out of the saved operation.
export function feeVals(d, walletId, prefix = '') {
  if (!wallet(walletId)?.fees) return {};
  const fee = parseMoney(d[prefix + 'fee'] || 0) || 0, tax = parseMoney(d[prefix + 'tax'] || 0) || 0;
  return { ...(fee ? { fee } : {}), ...(tax ? { tax } : {}), ...(fee || tax ? { feeWallet: walletId } : {}) };
}

export const jarTag =id => { const j = jar(id); return j ? `<span style="color:${j.color}">${icon(j.icon)} ${esc(j.name)}</span>` : ''; };
export const walletName = id => esc(wallet(id)?.name || '');

let toastTimer;
export function toast(msg, undo, { ok = false } = {}) {
  const el = document.getElementById('toast');
  el.innerHTML = `<span class="msg">${ok ? `<span class="ok-dot">${icon('check')}</span>` : ''}<span>${esc(msg)}</span></span>${undo ? '<button type="button">Annuler</button>' : ''}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  if (undo) el.querySelector('button').onclick = async () => { el.hidden = true; await undo(); };
  toastTimer = setTimeout(() => { el.hidden = true; }, undo ? 5000 : 2500);
}

// Swipe a .swipe > .row to the left to reveal its delete button. Only one row stays open at a time.
export function enableSwipe(root) {
  const OPEN = -96;
  const close = except => root.querySelectorAll('.swipe .row.open').forEach(r => { if (r !== except) { r.classList.remove('open'); r.style.transform = ''; } });
  root.querySelectorAll('.swipe .row').forEach(row => {
    let x0 = 0, y0 = 0, dx = 0, base = 0, active = false, horizontal = null;
    row.addEventListener('pointerdown', e => {
      x0 = e.clientX; y0 = e.clientY; dx = 0; active = true; horizontal = null;
      base = row.classList.contains('open') ? OPEN : 0;
    });
    row.addEventListener('pointermove', e => {
      if (!active) return;
      const mx = e.clientX - x0, my = e.clientY - y0;
      if (horizontal === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) horizontal = Math.abs(mx) > Math.abs(my);
      if (!horizontal) return;
      dx = mx;
      row.classList.add('dragging');
      row.style.transform = `translateX(${Math.min(0, Math.max(OPEN * 1.3, base + dx))}px)`;
    });
    const end = () => {
      if (!active) return;
      active = false;
      row.classList.remove('dragging');
      if (horizontal) {
        const open = base + dx < OPEN / 2;
        row.classList.toggle('open', open);
        row.style.transform = open ? `translateX(${OPEN}px)` : '';
        if (open) { close(row); haptic(); }
      } else if (row.classList.contains('open')) { row.classList.remove('open'); row.style.transform = ''; }
    };
    row.addEventListener('pointerup', end);
    row.addEventListener('pointercancel', end);
    row.addEventListener('pointerleave', end);
  });
}

export const haptic = () => { try { navigator.vibrate?.(12); } catch {} };

// Bottom-sheet confirmation, replaces window.confirm / prompt. Resolves true/false (or the typed text with `input`).
export function ask(message, { ok = 'Confirmer', cancel = 'Annuler', danger = false, input = null } = {}) {
  return new Promise(resolve => {
    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    scrim.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div><p>${esc(message)}</p>
      ${input !== null ? `<div class="field"><input id="ask-in" placeholder="${esc(input)}" autocomplete="off"></div>` : ''}
      <div class="grid2"><button class="btn" data-a="0">${esc(cancel)}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-a="1">${esc(ok)}</button></div></div>`;
    const done = v => { scrim.remove(); resolve(v); };
    scrim.onclick = e => {
      if (e.target === scrim) return done(input !== null ? null : false);
      const a = e.target.closest('[data-a]');
      if (a) done(a.dataset.a === '1' ? (input !== null ? scrim.querySelector('#ask-in').value : true) : (input !== null ? null : false));
    };
    document.body.appendChild(scrim);
    (scrim.querySelector('#ask-in') || scrim.querySelector('[data-a="1"]')).focus();
  });
}

// Add one or more transactions at once. Shows a success snackbar with a 5-second undo,
// unless `quiet` (the caller shows its own success screen and gets the undo function back).
export async function addTx(list, msg = 'Enregistré', { quiet = false } = {}) {
  const items = (Array.isArray(list) ? list : [list]).map(t => ({ id: uid(), created: Date.now(), ...t }));
  state.tx.push(...items);
  await save();
  haptic();
  const ids = new Set(items.map(t => t.id));
  const undo = async () => { state.tx = state.tx.filter(t => !ids.has(t.id)); await save(); toast('Annulé'); };
  if (!quiet) toast(msg, undo, { ok: true });
  return Object.assign(items, { undo });
}

// Guided empty state: what this screen is for, and the one action to start.
export function emptyState(ic, title, text, href, label) {
  return `<div class="empty"><span class="empty-ico">${icon(ic)}</span><b>${esc(title)}</b><p>${esc(text)}</p>
    ${href ? `<a class="btn primary" href="${href}">${esc(label)}</a>` : ''}</div>`;
}

// Full-screen success moment (peak-end): check badge with sparks, the key number, an optional breakdown.
// actions: [{ label, value, primary }] -> resolves with the chosen value.
export function celebrate({ title, amount, sub, rows = [], actions = [{ label: 'Terminé', value: 'done', primary: true }] }) {
  return new Promise(resolve => {
    const colors = ['#3fd0b8', '#fbbf24', '#f472b6', '#60a5fa', '#a78bfa', '#34d399'];
    const sparks = Array.from({ length: 10 }, (_, i) => {
      const a = i / 10 * Math.PI * 2, d = 70 + (i % 3) * 14;
      return `<i class="spark" style="--c:${colors[i % colors.length]};--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d}px"></i>`;
    }).join('');
    const el = document.createElement('div');
    el.className = 'win';
    el.setAttribute('role', 'dialog');
    el.innerHTML = `<div class="burst">${sparks}<span class="badge-ok">${icon('check')}</span></div>
      <h1>${esc(title)}</h1>
      ${amount ? `<div class="big">${esc(amount)}</div>` : ''}
      ${sub ? `<p class="sub">${esc(sub)}</p>` : ''}
      ${rows.length ? `<div class="card">${rows.map((r, i) => `<div class="split-row" style="animation-delay:${.25 + i * .07}s">
        ${tile(r.icon, r.color, 'mini-ico')}<span class="l">${esc(r.name)}</span><b class="num">${esc(r.value)}</b></div>`).join('')}</div>` : ''}
      ${actions.map(a => `<button class="btn ${a.primary ? 'primary' : a.value === 'undo' ? 'ghost' : ''}" data-v="${esc(a.value)}">${esc(a.label)}</button>`).join('')}`;
    el.onclick = e => { const b = e.target.closest('[data-v]'); if (b) { el.remove(); resolve(b.dataset.v); } };
    document.body.appendChild(el);
    try { navigator.vibrate?.([12, 60, 24]); } catch {}
    el.querySelector('.btn.primary')?.focus();
  });
}

export function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function go(hash) {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
}
