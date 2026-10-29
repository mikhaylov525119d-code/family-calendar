// node --test notifier/  (TZ is fixed so the times below are local)
process.env.TZ = 'Europe/Moscow';
const { test } = await import('node:test');
const assert = await import('node:assert/strict');
const { due } = await import('./notify.js');

const members = [{ id: 'papa', name: 'Папа' }, { id: 'mama', name: 'Мама' }, { id: 'doch', name: 'Дочь' }];
const t = s => new Date(s).getTime();
const ev = (o) => ({ id: 'e1', title: 'Врач', date: '2026-11-02', allDay: false, start: '18:00', end: '19:00', forIds: ['papa'], authorId: 'papa', repeat: 'none', ...o });
const run = (events, from, now) => due({ members, events }, t(from), t(now));

test('15 minutes before, only for the people it is for', () => {
  const out = run([ev()], '2026-11-02T17:40', '2026-11-02T17:45');
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].to, ['papa']);
  assert.match(out[0].body, /^Через 15 мин, сегодня в 18:00/);
  assert.equal(run([ev()], '2026-11-02T17:45', '2026-11-02T17:50').length, 0);
});

test('no reminder when turned off; "вся семья" goes to everyone', () => {
  assert.equal(run([ev({ remind: null })], '2026-11-02T17:40', '2026-11-02T17:50').length, 0);
  const out = run([ev({ forIds: [], remind: 0 })], '2026-11-02T17:55', '2026-11-02T18:00');
  assert.deepEqual(out[0].to, ['papa', 'mama', 'doch']);
});

test('a day before, and all-day reminders at 9:00', () => {
  assert.equal(run([ev({ remind: 1440 })], '2026-11-01T17:55', '2026-11-01T18:00').length, 1);
  const allDay = ev({ allDay: true, start: null, end: null });
  assert.equal(run([allDay], '2026-11-02T08:55', '2026-11-02T09:00').length, 1);
  assert.equal(run([{ ...allDay, remind: 1440 }], '2026-11-01T08:55', '2026-11-01T09:05').length, 1);
});

test('repeats and skipped occurrences', () => {
  const weekly = ev({ date: '2026-10-26', repeat: 'weekly', exceptions: ['2026-11-09'] });
  assert.equal(run([weekly], '2026-11-02T17:40', '2026-11-02T17:50').length, 1);
  assert.equal(run([weekly], '2026-11-09T17:40', '2026-11-09T17:50').length, 0);
});

test('new reminder from someone else, not to the author', () => {
  const e = ev({ forIds: ['papa', 'mama'], authorId: 'mama', createdAt: t('2026-10-29T12:01'), remind: null });
  const out = run([e], '2026-10-29T12:00', '2026-10-29T12:05');
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].to, ['papa']);
  assert.equal(out[0].title, 'Мама: новое дело');
});

test('morning summary per person', () => {
  const events = [
    ev({ id: 'a', remind: null, start: '18:00' }),
    ev({ id: 'b', remind: null, start: '09:30', forIds: [] }),
  ];
  const out = run(events, '2026-11-02T07:58', '2026-11-02T08:03');
  const papa = out.find(m => m.to[0] === 'papa');
  assert.equal(papa.title, 'Сегодня 2 дела');
  assert.equal(papa.body, '09:30 Врач\n18:00 Врач');
  assert.equal(out.find(m => m.to[0] === 'mama').title, 'Сегодня 1 дело');
});
