// Hour sheet, reminder card and reminder editor
import { store, applyFields } from '../store.js';
import { session } from '../session.js';
import { state } from '../state.js';
import { esc, uid, clone } from '../util.js';
import * as D from '../dates.js';
import {
  REPEAT, REMIND, DEFAULT_REMIND, remindOf, remindLabel, isRepeating, eventsOn, coversHour, eventColor, timeLabel,
} from '../events.js';
import { avatar, eventRow } from '../render.js';
import { Checklist, newList } from '../checklist.js';
import { openSheet, actionSheet, confirmDanger, toast } from '../ui.js';

export function openHourSheet(dateKey, hour) {
  const sheet = openSheet({ title: `${D.hh(hour)} – ${D.hh(hour + 1)}` });

  function render() {
    const evs = eventsOn(dateKey, state.filter).filter(ev => coversHour(ev, hour));
    sheet.body.innerHTML = `
      <p class="sheet-sub">${D.fmtLong(D.fromKey(dateKey))}</p>
      ${evs.length
        ? `<div class="ev-list">${evs.map(ev => eventRow(ev, dateKey)).join('')}</div>`
        : '<p class="muted center pad">В этот час ничего не запланировано</p>'}
      <button class="btn primary block" data-act="add">+ Добавить на ${D.hh(hour)}</button>`;
  }

  sheet.body.addEventListener('click', e => {
    const row = e.target.closest('[data-action="open-event"]');
    if (row) openEventSheet(row.dataset.id, row.dataset.date);
    if (e.target.closest('[data-act="add"]')) openEditor({ dateKey, hour });
  });
  sheet.onClose(store.subscribe(render));
  render();
}

export function openEventSheet(id, dateKey) {
  const sheet = openSheet({ title: 'Напоминание', right: '<button class="btn-text" data-act="edit">Изменить</button>' });
  sheet.body.innerHTML = `
    <div class="ev-info"></div>
    <div class="list-slot"></div>
    <button class="btn block danger-text" data-act="delete">Удалить напоминание</button>`;
  const info = sheet.body.querySelector('.ev-info');
  const slot = sheet.body.querySelector('.list-slot');
  let checklist = null;

  function render() {
    const ev = store.event(id);
    if (!ev) return sheet.close(true);
    const who = (ev.forIds || []).map(store.member).filter(Boolean);
    const author = store.member(ev.authorId);
    info.innerHTML = `
      <div class="ev-hero" style="--c:${eventColor(ev)}">
        <h3>${esc(ev.title)}</h3>
        <p>${D.fmtLong(D.fromKey(dateKey))}</p>
        <p class="ev-hero-time">${timeLabel(ev)}</p>
        ${isRepeating(ev) ? `<p class="muted">↻ ${REPEAT[ev.repeat]}</p>` : ''}
      </div>
      <div class="card rows">
        <div class="row"><span class="row-label">Для кого</span>
          <span class="row-val people">${who.length ? who.map(m => `${avatar(m, 'sm')}<span>${esc(m.name)}</span>`).join('') : 'Для всех'}</span></div>
        <div class="row"><span class="row-label">Добавил(а)</span>
          <span class="row-val people">${avatar(author, 'sm')}<span>${esc(author?.name || '—')}</span></span></div>
        <div class="row"><span class="row-label">Кто видит</span>
          <span class="row-val">${ev.private ? '🔒 Только участники' : 'Вся семья'}</span></div>
        <div class="row"><span class="row-label">Напомнить</span>
          <span class="row-val">${remindLabel(ev)}</span></div>
      </div>
      ${ev.note ? `<div class="card note">${esc(ev.note)}</div>` : ''}`;

    if (ev.list && !checklist) {
      slot.innerHTML = '';
      checklist = new Checklist(slot, {
        get: () => store.event(id)?.list,
        apply: fields => store.updateChecklist({ kind: 'event', id }, fields),
        remove: () => store.patchEvent(id, { list: null }),
      });
    } else if (ev.list) {
      checklist.refresh();
    } else {
      checklist?.destroy();
      checklist = null;
      slot.innerHTML = '<button class="btn block add-list" data-act="add-list">☑ Добавить список</button>';
    }
  }

  sheet.el.addEventListener('click', async e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    const ev = store.event(id);
    if (!ev || !act) return;
    if (act === 'edit') openEditor({ id });
    if (act === 'add-list') store.patchEvent(id, { list: newList('Покупки') });
    if (act === 'delete') {
      if (isRepeating(ev)) {
        const choice = await actionSheet({
          title: 'Это повторяющееся напоминание',
          actions: [
            { label: 'Удалить только это', value: 'one', danger: true },
            { label: 'Удалить все повторы', value: 'all', danger: true },
          ],
        });
        if (choice === 'one') await store.patchEvent(id, { exceptions: [...(ev.exceptions || []), dateKey] });
        if (choice === 'all') await store.deleteEvent(id);
        if (choice) { sheet.close(true); toast('Удалено'); }
      } else if (await confirmDanger(`Удалить «${ev.title}»?`, 'Удалить')) {
        await store.deleteEvent(id);
        sheet.close(true);
        toast('Удалено');
      }
    }
  });
  sheet.onClose(store.subscribe(render));
  render();
}

// New reminder: { dateKey, hour }. Editing: { id }.
// The list of an existing reminder is edited on its card, not here.
export function openEditor({ id, dateKey, hour }) {
  const existing = id ? store.event(id) : null;
  const startH = hour ?? defaultHour(dateKey);
  const draft = existing ? clone(existing) : {
    title: '', note: '', date: dateKey, allDay: false,
    start: D.hh(startH), end: D.hh(Math.min(startH + 1, 23)) === D.hh(startH) ? '23:59' : D.hh(startH + 1),
    forIds: [], repeat: 'none', list: null, private: false, remind: DEFAULT_REMIND,
  };
  draft.private = !!draft.private;
  draft.remind = remindOf(draft);
  const initial = JSON.stringify(draft);
  let checklist = null;

  const sheet = openSheet({
    title: existing ? 'Изменить' : 'Новое напоминание',
    left: 'Отмена',
    right: '<button class="btn-text bold" data-act="save">Сохранить</button>',
    tall: true,
    beforeClose: async () => {
      readForm();
      if (JSON.stringify(draft) === initial) return true;
      return confirmDanger('Не сохранять изменения?', 'Не сохранять');
    },
  });

  sheet.body.innerHTML = `
    <div class="card">
      <input class="input-title" name="title" placeholder="Что нужно сделать?" maxlength="120" value="${esc(draft.title)}" aria-label="Название">
    </div>
    <div class="card rows form-rows">
      <label class="row"><span class="row-label">Весь день</span><input type="checkbox" class="switch" name="allDay" ${draft.allDay ? 'checked' : ''}></label>
      <label class="row"><span class="row-label">Дата</span><input type="date" name="date" value="${draft.date}" required></label>
      <label class="row timed"><span class="row-label">Начало</span><input type="time" name="start" value="${draft.start || '09:00'}"></label>
      <label class="row timed"><span class="row-label">Конец</span><input type="time" name="end" value="${draft.end || ''}"></label>
      <label class="row"><span class="row-label">Повтор</span>
        <select name="repeat">${Object.entries(REPEAT).map(([v, l]) => `<option value="${v}"${draft.repeat === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="row"><span class="row-label">Напомнить<small class="row-hint remind-hint"></small></span>
        <select name="remind">${['none', ...Object.keys(REMIND).filter(v => v !== 'none')].map(v => `<option value="${v}"${String(draft.remind ?? 'none') === v ? ' selected' : ''}>${REMIND[v]}</option>`).join('')}</select></label>
    </div>
    <div class="section-label">Для кого</div>
    <div class="chips who-chips"></div>
    <div class="card rows private-row">
      <label class="row">
        <span class="row-label">Видят только они<small class="row-hint"></small></span>
        <input type="checkbox" class="switch" name="private" ${draft.private ? 'checked' : ''}>
      </label>
    </div>
    <div class="card">
      <textarea name="note" rows="3" placeholder="Заметка" maxlength="1000" aria-label="Заметка">${esc(draft.note || '')}</textarea>
    </div>
    <div class="list-slot"></div>`;

  const $ = s => sheet.body.querySelector(s);
  const f = name => sheet.body.querySelector(`[name="${name}"]`);

  function readForm() {
    draft.title = f('title').value.trim();
    draft.allDay = f('allDay').checked;
    draft.date = f('date').value || draft.date;
    draft.start = draft.allDay ? null : f('start').value || '09:00';
    draft.end = draft.allDay ? null : f('end').value;
    draft.repeat = f('repeat').value;
    draft.remind = f('remind').value === 'none' ? null : Number(f('remind').value);
    draft.note = f('note').value.trim();
    draft.private = draft.forIds.length > 0 && f('private').checked;
  }

  function renderWho() {
    const all = !draft.forIds.length;
    $('.who-chips').innerHTML = `
      <button type="button" class="chip${all ? ' on' : ''}" data-who="all">Вся семья</button>
      ${store.members.map(m => `
        <button type="button" class="chip${draft.forIds.includes(m.id) ? ' on' : ''}" data-who="${m.id}" style="--c:${m.color}">
          ${avatar(m, 'xs')}${esc(m.name)}</button>`).join('')}`;

    // "Only they see it" makes sense only for specific people
    $('.private-row').hidden = all;
    const viewers = [...new Set([draft.authorId || session.meId, ...draft.forIds])].map(store.member).filter(Boolean);
    $('.private-row .row-hint').textContent = viewers.map(m => m.name).join(', ');
  }

  function renderList() {
    const slot = $('.list-slot');
    if (existing) return;
    if (draft.list && !checklist) {
      slot.innerHTML = '';
      checklist = new Checklist(slot, {
        get: () => draft.list,
        apply: fields => applyFields(draft.list, fields),
        remove: () => { draft.list = null; renderList(); },
      });
    } else if (!draft.list) {
      checklist?.destroy();
      checklist = null;
      slot.innerHTML = '<button type="button" class="btn block add-list" data-act="add-list">☑ Добавить список (например, покупки)</button>';
    }
  }

  function syncTimed() {
    sheet.body.querySelectorAll('.timed').forEach(r => { r.hidden = f('allDay').checked; });
    // All-day reminders have no start time to count from
    const v = f('remind').value;
    $('.remind-hint').textContent = f('allDay').checked && v !== 'none' ? remindLabel({ allDay: true, remind: Number(v) }) : '';
  }

  // Moving the start keeps the duration, like the iOS calendar
  let prevStart = draft.start;
  f('start').addEventListener('change', () => {
    const s = f('start').value, e = f('end').value;
    if (s && e && prevStart) {
      const end = Math.min(D.toMin(e) + D.toMin(s) - D.toMin(prevStart), 23 * 60 + 59);
      f('end').value = D.fromMin(Math.max(end, D.toMin(s)));
    }
    prevStart = s;
  });
  f('allDay').addEventListener('change', syncTimed);
  f('remind').addEventListener('change', syncTimed);

  sheet.el.addEventListener('click', async e => {
    const who = e.target.closest('[data-who]');
    if (who) {
      const wid = who.dataset.who;
      if (wid === 'all') draft.forIds = [];
      else draft.forIds = draft.forIds.includes(wid) ? draft.forIds.filter(x => x !== wid) : [...draft.forIds, wid];
      return renderWho();
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'add-list') {
      draft.list = newList('Покупки');
      renderList();
      $('.cl-new input')?.focus();
    }
    if (act === 'save') save();
  });

  async function save() {
    readForm();
    if (!draft.title) {
      f('title').focus();
      return toast('Напиши название');
    }
    if (!draft.allDay && draft.end && D.toMin(draft.end) <= D.toMin(draft.start)) {
      return toast('Конец должен быть позже начала');
    }
    if (existing) {
      // Only the form's fields: the list may be changing on someone else's phone
      const { title, note, date, allDay, start, end, forIds, repeat, remind, private: isPrivate } = draft;
      store.patchEvent(id, { title, note, date, allDay, start, end, forIds, repeat, remind, private: isPrivate });
    } else {
      store.saveEvent({ ...draft, id: uid(), authorId: session.meId, createdAt: Date.now() });
    }
    sheet.close(true);
    toast(existing ? 'Сохранено' : 'Напоминание добавлено');
  }

  if (draft.allDay) { f('start').value = '09:00'; f('end').value = '10:00'; }
  syncTimed();
  renderWho();
  renderList();
  // The sheet is still sliding in from below, so iOS would scroll it down to the field
  if (!existing) f('title').focus({ preventScroll: true });
  sheet.body.scrollTop = 0;
  setTimeout(() => { sheet.body.scrollTop = 0; }, 350);
}

function defaultHour(dateKey) {
  const now = new Date();
  return dateKey === D.todayKey() ? Math.min(now.getHours() + 1, 23) : 9;
}
