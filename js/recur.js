// Repeats and reminder offsets. No browser APIs: the notifier (notifier/notify.js) imports this too.
import { fromKey, weekdayIdx } from './dates.js';

export const REPEAT = {
  none: 'Не повторять',
  daily: 'Каждый день',
  weekdays: 'По будням',
  weekly: 'Каждую неделю',
  monthly: 'Каждый месяц',
  yearly: 'Каждый год',
};

// Minutes before the start; null = no notification. All-day reminders come at 9:00.
export const REMIND = {
  none: 'Нет',
  0: 'В начале',
  5: 'За 5 минут',
  15: 'За 15 минут',
  30: 'За 30 минут',
  60: 'За 1 час',
  1440: 'За 1 день',
};
export const DEFAULT_REMIND = 15;
export const ALL_DAY_HOUR = 9;
export const remindOf = ev => (ev.remind === undefined ? DEFAULT_REMIND : ev.remind);

export function remindLabel(ev) {
  const r = remindOf(ev);
  if (r === null) return REMIND.none;
  if (!ev.allDay) return REMIND[r] || `За ${r} мин`;
  return r >= 1440 ? `Накануне в ${ALL_DAY_HOUR}:00` : `В ${ALL_DAY_HOUR}:00 в этот день`;
}

export const isRepeating = ev => !!ev.repeat && ev.repeat !== 'none';

export function occursOn(ev, key) {
  if (key < ev.date) return false;
  if (ev.exceptions?.includes(key)) return false;
  if (!isRepeating(ev)) return key === ev.date;
  const d = fromKey(key), s = fromKey(ev.date);
  switch (ev.repeat) {
    case 'daily': return true;
    case 'weekdays': return weekdayIdx(d) < 5;
    case 'weekly': return weekdayIdx(d) === weekdayIdx(s);
    case 'monthly': return d.getDate() === s.getDate();
    case 'yearly': return d.getDate() === s.getDate() && d.getMonth() === s.getMonth();
    default: return false;
  }
}
