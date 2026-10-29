import { store, cloud } from './store.js';
import { session } from './session.js';
import { state, persistUI } from './state.js';
import { on, esc } from './util.js';
import { toKey, fromKey } from './dates.js';
import { avatar } from './render.js';
import { renderLogin } from './views/login.js';
import { calendarTitle, renderCalendar, shiftCursor } from './views/calendar.js';
import { renderLists, openListSheet, createList } from './views/lists.js';
import { openHourSheet, openEventSheet, openEditor } from './views/sheets.js';
import { openSettings } from './views/settings.js';
import * as push from './push.js';

const root = document.getElementById('root');
let unsubscribe = null;

const ICONS = {
  calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  lists: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17"/></svg>',
};

async function boot() {
  unsubscribe?.();
  unsubscribe = null;
  if (cloud) await cloud.authReady;
  if (session.authed) await store.connect();
  if (!session.authed || !store.member(session.meId)) renderLogin(root, boot);
  else mountApp();
}

function mountApp() {
  root.innerHTML = '';
  const app = document.createElement('div');
  app.className = 'app';
  app.innerHTML = `
    <header class="topbar">
      <div class="topbar-row">
        <h1 class="title" data-el="title"></h1>
        <div class="topbar-actions">
          <button class="btn-pill cal-only" data-action="today">Сегодня</button>
          <button class="me-btn" data-action="settings" data-el="me" aria-label="Настройки"></button>
        </div>
      </div>
      <div class="topbar-row cal-only">
        <div class="seg" role="tablist">
          <button data-view="month">Месяц</button><button data-view="week">Неделя</button><button data-view="day">День</button>
        </div>
        <div class="arrows">
          <button data-action="prev" aria-label="Назад">‹</button><button data-action="next" aria-label="Вперёд">›</button>
        </div>
      </div>
      <div class="filters cal-only" data-el="filters"></div>
    </header>
    <main class="main" data-el="main"></main>
    <button class="fab cal-only" data-action="add" aria-label="Добавить напоминание">+</button>
    <nav class="tabbar">
      <button data-tab="calendar">${ICONS.calendar}<span>Календарь</span></button>
      <button data-tab="lists">${ICONS.lists}<span>Списки</span></button>
    </nav>`;
  root.appendChild(app);

  const el = name => app.querySelector(`[data-el="${name}"]`);
  const main = el('main');
  let scrollTarget = 'top';

  function update() {
    state.filter = state.filter.filter(id => store.member(id));
    const cal = state.tab === 'calendar';
    app.classList.toggle('tab-lists', !cal);

    el('title').innerHTML = cal ? calendarTitle(state.view, state.cursor) : 'Списки';
    el('me').innerHTML = avatar(store.member(session.meId));
    app.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === state.view));
    app.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === state.tab));
    el('filters').innerHTML = `
      <button class="chip${state.filter.length ? '' : ' on'}" data-filter="all">Все</button>
      ${store.members.map(m => `
        <button class="chip${state.filter.includes(m.id) ? ' on' : ''}" data-filter="${m.id}" style="--c:${m.color}">${avatar(m, 'xs')}${esc(m.name)}</button>`).join('')}`;

    main.innerHTML = cal ? renderCalendar(state.view, state.cursor, state.filter) : renderLists();

    if (scrollTarget === 'top') window.scrollTo(0, 0);
    if (scrollTarget === 'hour') {
      const now = new Date();
      const h = toKey(state.cursor) === toKey(now) ? Math.max(now.getHours() - 1, 0) : 8;
      const row = document.getElementById(`hour-${h}`);
      const top = app.querySelector('.topbar').offsetHeight;
      if (row) window.scrollTo(0, row.getBoundingClientRect().top + window.scrollY - top - 8);
    }
    scrollTarget = null;
  }

  function go({ view, cursor, tab } = {}) {
    if (tab) state.tab = tab;
    if (view) state.view = view;
    if (cursor) state.cursor = cursor;
    scrollTarget = state.tab === 'calendar' && state.view === 'day' ? 'hour' : 'top';
    persistUI();
    update();
  }

  on(app, 'click', '[data-view]', (e, b) => go({ view: b.dataset.view }));
  on(app, 'click', '[data-tab]', (e, b) => go({ tab: b.dataset.tab }));
  on(app, 'click', '[data-filter]', (e, b) => {
    const id = b.dataset.filter;
    if (id === 'all') state.filter = [];
    else state.filter = state.filter.includes(id) ? state.filter.filter(x => x !== id) : [...state.filter, id];
    persistUI();
    update();
  });

  on(app, 'click', '[data-action]', (e, b) => {
    const { action, date, id, hour } = b.dataset;
    switch (action) {
      case 'today': return go({ cursor: new Date() });
      case 'prev': return go({ cursor: shiftCursor(state.view, state.cursor, -1) });
      case 'next': return go({ cursor: shiftCursor(state.view, state.cursor, 1) });
      case 'settings': return openSettings({ onSwitchUser: boot });
      case 'select-day': {
        // Second tap on the selected day opens it
        if (date === toKey(state.cursor)) return go({ view: 'day', cursor: fromKey(date) });
        state.cursor = fromKey(date);
        return update();
      }
      case 'open-day': return go({ view: 'day', cursor: fromKey(date) });
      case 'open-hour': return openHourSheet(date, Number(hour));
      case 'open-event': return openEventSheet(id, date);
      case 'add': return openEditor({ dateKey: date || toKey(state.cursor) });
      case 'open-list': return openListSheet(id);
      case 'new-list': return createList();
    }
  });

  // Swipe left/right to move between months, weeks or days
  let touch = null;
  main.addEventListener('touchstart', e => {
    const t = e.touches[0];
    touch = { x: t.clientX, y: t.clientY, time: Date.now() };
  }, { passive: true });
  main.addEventListener('touchend', e => {
    if (!touch || state.tab !== 'calendar') return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.x, dy = t.clientY - touch.y;
    const quick = Date.now() - touch.time < 600;
    touch = null;
    if (quick && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      go({ cursor: shiftCursor(state.view, state.cursor, dx < 0 ? 1 : -1) });
    }
  }, { passive: true });

  unsubscribe = store.subscribe(() => {
    if (!store.member(session.meId)) return boot();
    update();
  });
  refresh = update;
  // A notification tap opens its day (#d=…) or reminder (#e=…&d=…)
  openLink = url => {
    const p = new URLSearchParams(new URL(url, location.href).hash.slice(1));
    const date = p.get('d');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return false;
    go({ tab: 'calendar', view: 'day', cursor: fromKey(date) });
    if (p.get('e') && store.event(p.get('e'))) openEventSheet(p.get('e'), date);
    return true;
  };
  if (!openLink(location.href)) go({});
  if (location.hash) history.replaceState(null, '', location.pathname);
  push.sync().catch(e => console.error(e));
}

let openLink = null;
navigator.serviceWorker?.addEventListener('message', e => {
  if (e.data?.type === 'open' && openLink) openLink(e.data.url);
});

// Keep "today" correct when the app is reopened on another day
let refresh = null;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && unsubscribe) refresh?.();
});

boot();

// Offline start for the installed app; skipped on the dev server
if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
