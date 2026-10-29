import { load, onChange, state } from './store.js';
import { jar, loan, investment, service } from './logic.js';
import * as dashboard from './views/dashboard.js';
import * as add from './views/add.js';
import * as count from './views/count.js';
import * as loans from './views/loans.js';
import * as invest from './views/invest.js';
import * as subs from './views/subs.js';
import * as history from './views/history.js';
import * as settings from './views/settings.js';
import * as setup from './views/setup.js';
import * as more from './views/more.js';
import * as jarView from './views/jar.js';
import * as fees from './views/fees.js';
import * as svc from './views/svc.js';

const routes = {
  '': dashboard, add, count, loans, loan: loans, invest, subs, history, settings, setup, more, jar: jarView, fees, svc,
};
const navOf = { '': 'home', count: 'count', history: 'history' };

// App bar title and back target for each screen. Top-level tabs have no back button.
function meta({ name, id, q }) {
  switch (name) {
    case '': return { title: 'Financial Freedom' };
    case 'add': return { title: 'Nouvelle opération', back: q.get('back') || '#/', close: true };
    case 'count': return { title: 'Comptage du matin' };
    case 'history': return { title: 'Historique' };
    case 'more': return { title: 'Plus' };
    case 'loans': return q.get('new')
      ? { title: q.get('new') === 'lent' ? 'Nouveau prêt' : 'Nouvelle dette', back: `#/loans?tab=${q.get('new')}` }
      : { title: 'Prêts & dettes', back: '#/more' };
    case 'loan': { const l = loan(id); return { title: l?.person || 'Détail', back: `#/loans?tab=${l?.dir || 'lent'}` }; }
    case 'invest': return id ? { title: investment(id)?.name || 'Investissement', back: '#/invest' }
      : q.get('new') ? { title: 'Nouvel investissement', back: '#/invest' } : { title: 'Investissements', back: '#/more' };
    case 'subs': return { title: 'Abonnements', back: '#/more' };
    case 'settings': return { title: 'Réglages', back: '#/more' };
    case 'fees': return { title: 'Frais & taxes', back: '#/more' };
    case 'svc': return id ? { title: service(id)?.client || 'Service', back: '#/svc' }
      : q.get('new') ? { title: 'Nouveau service', back: '#/svc' } : { title: 'Services clients', back: '#/more' };
    case 'jar': return { title: jar(id)?.name || 'Compte', back: '#/' };
    case 'setup': return { title: 'Bienvenue' };
    default: return { title: 'Financial Freedom' };
  }
}

const root = document.getElementById('app');
const backBtn = document.getElementById('back');
const titleEl = document.getElementById('title');
const nav = document.getElementById('bottomnav');

function parse() {
  const [path, qs] = location.hash.replace(/^#\/?/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  return { name: parts[0] || '', id: parts[1], q: new URLSearchParams(qs || '') };
}

const CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const BACK_ICON = backBtn.innerHTML;

function render(animate = false) {
  const r = parse();
  if (!state.settings.setupDone && r.name !== 'setup') { location.replace('#/setup'); return; }
  const view = routes[r.name] || dashboard;
  const m = meta(r);
  titleEl.textContent = m.title;
  backBtn.hidden = !m.back;
  if (m.back) { backBtn.href = m.back; backBtn.innerHTML = m.close ? CLOSE_ICON : BACK_ICON; }
  root.innerHTML = view.render(r);
  view.mount?.(root, r);
  if (animate) { root.classList.remove('view-enter'); void root.offsetWidth; root.classList.add('view-enter'); }
  nav.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.nav === (navOf[r.name] || 'more')));
  const noNav = r.name === 'setup' || r.name === 'add';
  nav.hidden = noNav;
  document.body.classList.toggle('no-nav', noNav);
}

window.addEventListener('hashchange', () => { render(true); window.scrollTo(0, 0); });
window.addEventListener('scroll', () => document.getElementById('appbar').classList.toggle('scrolled', scrollY > 4), { passive: true });
onChange(() => render(false));

await load();
render(true);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(e => console.warn('SW', e));
}
