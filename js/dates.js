export const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export const WD_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const WD_LONG = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

export const pad = n => String(n).padStart(2, '0');
export const hh = h => `${pad(h % 24)}:00`;

// Dates are stored as 'YYYY-MM-DD' keys in local time
export const toKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = k => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const todayKey = () => toKey(new Date());

export const addDays = (d, n) => {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
};
export const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
export const addMonths = (d, n) => {
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  t.setDate(Math.min(d.getDate(), daysInMonth(t.getFullYear(), t.getMonth())));
  return t;
};

// Monday = 0 … Sunday = 6
export const weekdayIdx = d => (d.getDay() + 6) % 7;
export const startOfWeek = d => addDays(d, -weekdayIdx(d));

export const fmtLong = d => `${WD_LONG[weekdayIdx(d)]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
export const fmtShort = d => `${WD_SHORT[weekdayIdx(d)]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;

export function relLabel(key) {
  const diff = Math.round((fromKey(key) - fromKey(todayKey())) / 864e5);
  return { '-1': 'Вчера', 0: 'Сегодня', 1: 'Завтра' }[diff] || '';
}

export const toMin = t => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
export const fromMin = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
