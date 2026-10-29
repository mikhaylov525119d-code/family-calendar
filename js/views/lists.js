// "Списки" tab: standalone lists plus lists attached to upcoming reminders
import { store } from '../store.js';
import { esc } from '../util.js';
import * as D from '../dates.js';
import { isRepeating, canSee } from '../events.js';
import { Checklist, newList, listProgress } from '../checklist.js';
import { openSheet } from '../ui.js';

function card(l, attrs, sub) {
  const { done, total } = listProgress(l);
  return `
    <button class="list-card" ${attrs}>
      <span class="lc-title">${esc(l.title)}</span>
      <span class="lc-sub">${sub ? `${esc(sub)} · ` : ''}${total ? `${done} из ${total}` : 'пусто'}</span>
      <span class="lc-bar"><span style="width:${total ? (done / total) * 100 : 0}%"></span></span>
    </button>`;
}

export function renderLists() {
  const mine = [...store.lists].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const today = D.todayKey();
  const inEvents = store.events
    .filter(e => e.list && canSee(e) && (e.date >= today || isRepeating(e)))
    .sort((a, b) => a.date.localeCompare(b.date));

  return `
    <div class="lists-page">
      <button class="btn primary block" data-action="new-list">+ Новый список</button>
      ${mine.length
        ? `<div class="section-label">Мои списки</div><div class="list-cards">${mine.map(l => card(l, `data-action="open-list" data-id="${l.id}"`)).join('')}</div>`
        : '<p class="muted center pad">Списки без даты: продукты, подарки, дела по дому. Их видит вся семья.</p>'}
      ${inEvents.length
        ? `<div class="section-label">В напоминаниях</div><div class="list-cards">${inEvents.map(ev =>
            card(ev.list, `data-action="open-event" data-id="${ev.id}" data-date="${ev.date}"`, `${ev.title}, ${D.fmtShort(D.fromKey(ev.date))}`)).join('')}</div>`
        : ''}
    </div>`;
}

export function openListSheet(id, { focusTitle = false } = {}) {
  const sheet = openSheet({ title: 'Список' });
  const checklist = new Checklist(sheet.body, {
    get: () => store.list(id),
    apply: fields => store.updateChecklist({ kind: 'list', id }, fields),
    remove: () => {
      store.deleteList(id);
      sheet.close(true);
    },
  });
  // A just-created list may arrive from the cloud cache a moment later
  let seen = !!store.list(id);
  sheet.onClose(store.subscribe(() => {
    if (store.list(id)) seen = true;
    else if (seen) return sheet.close(true);
    checklist.refresh();
  }));
  if (focusTitle) sheet.body.querySelector('.cl-title').select();
}

export function createList() {
  const l = newList('Новый список');
  store.saveList(l);
  openListSheet(l.id, { focusTitle: true });
}
