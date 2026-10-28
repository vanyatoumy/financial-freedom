// Small rendering helpers shared by the views.
import { state, save, uid } from './store.js';
import { fmt, jar, wallet } from './logic.js';
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

export const jarTag = id => { const j = jar(id); return j ? `<span style="color:${j.color}">${icon(j.icon)} ${esc(j.name)}</span>` : ''; };
export const walletName = id => esc(wallet(id)?.name || '');

let toastTimer;
export function toast(msg, undo) {
  const el = document.getElementById('toast');
  el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button type="button">Annuler</button>' : ''}`;
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

export const haptic =() => { try { navigator.vibrate?.(12); } catch {} };

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

// Add one or more transactions at once, with a 5-second undo.
export async function addTx(list, msg = 'Enregistré') {
  const items = (Array.isArray(list) ? list : [list]).map(t => ({ id: uid(), created: Date.now(), ...t }));
  state.tx.push(...items);
  await save();
  haptic();
  const ids = new Set(items.map(t => t.id));
  toast(msg, async () => { state.tx = state.tx.filter(t => !ids.has(t.id)); await save(); toast('Annulé'); });
  return items;
}

export function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function go(hash) {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
}
