// Month, week and day views
import * as D from '../dates.js';
import { esc } from '../util.js';
import { eventsOn, eventColor, coversHour, startsInHour } from '../events.js';
import { eventRow } from '../render.js';
import { listProgress } from '../checklist.js';

export function calendarTitle(view, c) {
  if (view === 'month') return `${D.MONTHS[c.getMonth()]} <span class="muted">${c.getFullYear()}</span>`;
  if (view === 'week') {
    const s = D.startOfWeek(c), e = D.addDays(s, 6);
    return s.getMonth() === e.getMonth()
      ? `${s.getDate()} – ${e.getDate()} ${D.MONTHS_SHORT[s.getMonth()]}`
      : `${s.getDate()} ${D.MONTHS_SHORT[s.getMonth()]} – ${e.getDate()} ${D.MONTHS_SHORT[e.getMonth()]}`;
  }
  return D.fmtShort(c);
}

export function shiftCursor(view, c, dir) {
  if (view === 'month') return D.addMonths(c, dir);
  return D.addDays(c, view === 'week' ? 7 * dir : dir);
}

export function renderCalendar(view, c, filter) {
  if (view === 'week') return renderWeek(c, filter);
  if (view === 'day') return renderDay(c, filter);
  return renderMonth(c, filter);
}

function renderMonth(c, filter) {
  const y = c.getFullYear(), m = c.getMonth();
  const first = new Date(y, m, 1);
  const start = D.startOfWeek(first);
  const rows = Math.ceil((D.weekdayIdx(first) + D.daysInMonth(y, m)) / 7);
  const sel = D.toKey(c), today = D.todayKey();

  let cells = '';
  for (let i = 0; i < rows * 7; i++) {
    const d = D.addDays(start, i), k = D.toKey(d);
    const evs = eventsOn(k, filter);
    const cls = [
      d.getMonth() !== m && 'other', k === today && 'today', k === sel && 'selected', D.weekdayIdx(d) > 4 && 'weekend',
    ].filter(Boolean).join(' ');
    cells += `
      <button class="mcell ${cls}" data-action="select-day" data-date="${k}" aria-label="${D.fmtLong(d)}">
        <span class="mnum">${d.getDate()}</span>
        ${evs.slice(0, 3).map(ev => `<span class="mpill" style="--c:${eventColor(ev)}">${esc(ev.title)}</span>`).join('')}
        ${evs.length > 3 ? `<span class="mmore">+${evs.length - 3}</span>` : ''}
      </button>`;
  }

  return `
    <div class="month">
      <div class="wd-row">${D.WD_SHORT.map((w, i) => `<span class="${i > 4 ? 'weekend' : ''}">${w}</span>`).join('')}</div>
      <div class="month-grid">${cells}</div>
    </div>
    ${agenda(sel, filter)}`;
}

function agenda(k, filter) {
  const evs = eventsOn(k, filter);
  const rel = D.relLabel(k);
  return `
    <section class="agenda">
      <div class="agenda-head">
        <h3>${rel ? `${rel}, ` : ''}${rel ? D.fmtShort(D.fromKey(k)).split(', ')[1] : D.fmtShort(D.fromKey(k))}</h3>
        <button class="btn-text" data-action="open-day" data-date="${k}">По часам ›</button>
      </div>
      ${evs.length
        ? `<div class="ev-list">${evs.map(ev => eventRow(ev, k)).join('')}</div>`
        : `<button class="empty" data-action="add" data-date="${k}">Дел нет. <b>Добавить?</b></button>`}
    </section>`;
}

function renderWeek(c, filter) {
  const s = D.startOfWeek(c), today = D.todayKey();
  let html = '<div class="week">';
  for (let i = 0; i < 7; i++) {
    const d = D.addDays(s, i), k = D.toKey(d);
    const evs = eventsOn(k, filter);
    html += `
      <section class="wday${k === today ? ' today' : ''}${i > 4 ? ' weekend' : ''}">
        <header class="wday-head">
          <button class="wday-title" data-action="open-day" data-date="${k}">
            <span class="wday-num">${d.getDate()}</span>
            <span class="wday-name">${D.WD_LONG[i]}<small>${D.relLabel(k) || D.MONTHS_GEN[d.getMonth()]}</small></span>
          </button>
          <button class="icon-btn" data-action="add" data-date="${k}" aria-label="Добавить на ${D.fmtLong(d)}">+</button>
        </header>
        ${evs.length
          ? `<div class="ev-list">${evs.map(ev => eventRow(ev, k)).join('')}</div>`
          : '<div class="wday-empty">Свободно</div>'}
      </section>`;
  }
  return html + '</div>';
}

function hourChip(ev, k, h) {
  const p = ev.list ? listProgress(ev.list) : null;
  if (!startsInHour(ev, h)) {
    return `<button class="chip-ev cont" data-action="open-event" data-id="${ev.id}" data-date="${k}" style="--c:${eventColor(ev)}">↳ ${esc(ev.title)}</button>`;
  }
  return `
    <button class="chip-ev" data-action="open-event" data-id="${ev.id}" data-date="${k}" style="--c:${eventColor(ev)}">
      <span class="chip-time">${ev.start}${ev.end ? `–${ev.end}` : ''}</span>
      <span class="chip-title">${esc(ev.title)}</span>
      ${p ? `<span class="chip-tag">☑ ${p.done}/${p.total}</span>` : ''}
    </button>`;
}

function renderDay(c, filter) {
  const k = D.toKey(c);
  const evs = eventsOn(k, filter);
  const allDay = evs.filter(e => e.allDay), timed = evs.filter(e => !e.allDay);
  const now = new Date();
  const isToday = k === D.todayKey();
  const rel = D.relLabel(k);

  let html = `
    <div class="day">
      <div class="day-head"><b>${rel || D.WD_LONG[D.weekdayIdx(c)]}</b> · ${D.fmtLong(c).split(', ')[1]}</div>
      ${allDay.length ? `<div class="allday"><div class="hour-label">весь<br>день</div><div class="ev-list">${allDay.map(ev => eventRow(ev, k)).join('')}</div></div>` : ''}
      <div class="hours">`;
  for (let h = 0; h < 24; h++) {
    const here = timed.filter(ev => coversHour(ev, h));
    const past = isToday && h < now.getHours();
    const nowLine = isToday && now.getHours() === h
      ? `<div class="now-line" style="top:${(now.getMinutes() / 60) * 100}%"></div>` : '';
    html += `
      <div class="hour${past ? ' past' : ''}" id="hour-${h}" data-action="open-hour" data-hour="${h}" data-date="${k}" role="button" aria-label="${D.hh(h)}">
        <div class="hour-label">${D.hh(h)}</div>
        <div class="hour-body">${here.map(ev => hourChip(ev, k, h)).join('')}</div>
        ${nowLine}
      </div>`;
  }
  return html + '</div></div>';
}
