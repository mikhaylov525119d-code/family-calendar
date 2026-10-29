import { store } from './store.js';
import { session } from './session.js';
import { toMin } from './dates.js';
import { occursOn } from './recur.js';

export { REPEAT, REMIND, DEFAULT_REMIND, remindOf, remindLabel, isRepeating, occursOn } from './recur.js';

function matchesFilter(ev, filter) {
  if (!filter?.length || !ev.forIds?.length) return true; // "Вся семья" is everyone's
  return [ev.authorId, ...(ev.forIds || [])].some(id => filter.includes(id));
}

export const byTime = (a, b) =>
  (a.allDay ? 0 : 1) - (b.allDay ? 0 : 1) ||
  (a.start || '').localeCompare(b.start || '') ||
  a.title.localeCompare(b.title);

// A private reminder is visible only to its author and the people it is for
export const canSee = ev =>
  !ev.private || ev.authorId === session.meId || (ev.forIds || []).includes(session.meId);

export const eventsOn = (key, filter) =>
  store.events.filter(ev => canSee(ev) && occursOn(ev, key) && matchesFilter(ev, filter)).sort(byTime);

// Colour of the person it is for; the author's colour when it is for several people
export function eventColor(ev) {
  const ids = ev.forIds || [];
  const m = store.member(ids.length === 1 ? ids[0] : ev.authorId);
  return m?.color || '#8e8e93';
}

export const timeLabel = ev =>
  ev.allDay ? 'Весь день' : ev.end ? `${ev.start} – ${ev.end}` : ev.start;

function span(ev) {
  const s = toMin(ev.start);
  let e = ev.end ? toMin(ev.end) : s + 60;
  if (e <= s) e = 24 * 60;
  return [s, e];
}
export function coversHour(ev, h) {
  if (ev.allDay) return false;
  const [s, e] = span(ev);
  return h * 60 < e && (h + 1) * 60 > s;
}
export const startsInHour = (ev, h) => !ev.allDay && Math.floor(toMin(ev.start) / 60) === h;
