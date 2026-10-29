// Sends the family's push notifications. Runs every few minutes on GitHub Actions
// (.github/workflows/notify.yml) and handles everything due since the previous run:
//   - reminders before a reminder starts (its "Напомнить" setting),
//   - "new reminder for you" when someone else adds one,
//   - the 8:00 summary of the day.
// Env: FIREBASE_SERVICE_ACCOUNT (JSON), VAPID_PRIVATE_KEY; DRY_RUN=1 prints instead of sending.
import admin from 'firebase-admin';
import webpush from 'web-push';
import { FAMILY_ID, VAPID_PUBLIC_KEY } from '../js/config.js';
import { toKey, fromKey, addDays, toMin, fmtShort } from '../js/dates.js';
import { occursOn, remindOf, ALL_DAY_HOUR } from '../js/recur.js';

const SITE = 'https://family-calendar-9bfad.web.app/';
const DIGEST_HOUR = 8;
const MAX_LOOKBACK = 3 * 3600e3; // after a long outage, skip what is too old to matter
const DRY_RUN = !!process.env.DRY_RUN;

// ---- Pure part: what is due in (from, now] ----

// Local time of a date key + 'HH:MM' (process.env.TZ is the family's zone)
const at = (key, hm) => fromKey(key).getTime() + toMin(hm) * 60e3;

const recipientsOf = (ev, members) => (ev.forIds?.length ? ev.forIds : members.map(m => m.id));

function dayText(key, now) {
  const diff = Math.round((fromKey(key) - fromKey(toKey(new Date(now)))) / 864e5);
  return { 0: 'сегодня', 1: 'завтра' }[diff] || fmtShort(fromKey(key)).toLowerCase();
}

function whenText(ev, key, now) {
  const day = dayText(key, now);
  if (ev.allDay) return `${day}, весь день`;
  const mins = Math.round((at(key, ev.start) - now) / 60e3);
  const soon = mins > 0 && mins <= 60 ? `через ${mins} мин, ` : '';
  return `${soon}${day} в ${ev.start}`;
}

function listText(ev) {
  const items = Object.values(ev.list?.items || {});
  return items.length ? ` · ☑ ${items.filter(i => i.done).length}/${items.length}` : '';
}

const plural = (n, one, few, many) =>
  n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many;

export function due({ members, events }, from, now) {
  const out = []; // { to: [memberId], title, body, tag, url }
  const today = toKey(new Date(now));
  const firstDay = toKey(new Date(from));

  // Reminders: a reminder can fire up to a day before, so look one day ahead
  for (const ev of events) {
    const r = remindOf(ev);
    if (r === null) continue;
    for (let d = fromKey(firstDay); toKey(d) <= toKey(addDays(new Date(now), 2)); d = addDays(d, 1)) {
      const key = toKey(d);
      if (!occursOn(ev, key)) continue;
      const fire = ev.allDay
        ? at(toKey(addDays(d, r >= 1440 ? -1 : 0)), `${ALL_DAY_HOUR}:00`)
        : at(key, ev.start) - r * 60e3;
      if (fire <= from || fire > now) continue;
      if (!ev.allDay && at(key, ev.start) < now - 30 * 60e3) continue; // long over
      out.push({
        to: recipientsOf(ev, members),
        title: ev.title,
        body: `${whenText(ev, key, now)}${listText(ev)}`.replace(/^./, c => c.toUpperCase()),
        tag: `ev-${ev.id}-${key}`,
        url: `${SITE}#e=${ev.id}&d=${key}`,
      });
    }
  }

  // Someone added a reminder for you
  for (const ev of events) {
    if (!ev.createdAt || ev.createdAt <= from || ev.createdAt > now) continue;
    if (!ev.repeat || ev.repeat === 'none') { if (ev.date < today) continue; }
    const to = recipientsOf(ev, members).filter(id => id !== ev.authorId);
    if (!to.length) continue;
    const author = members.find(m => m.id === ev.authorId)?.name || 'Кто-то';
    out.push({
      to,
      title: `${author}: новое дело`,
      body: `${ev.title} · ${whenText(ev, ev.date, now)}`,
      tag: `new-${ev.id}`,
      url: `${SITE}#e=${ev.id}&d=${ev.date}`,
    });
  }

  // Morning summary
  const digest = at(today, `0${DIGEST_HOUR}:00`.slice(-5));
  if (digest > from && digest <= now) {
    for (const m of members) {
      const mine = events
        .filter(ev => occursOn(ev, today) && (!ev.forIds?.length || ev.forIds.includes(m.id)))
        .sort((a, b) => (a.allDay ? '' : a.start).localeCompare(b.allDay ? '' : b.start));
      if (!mine.length) continue;
      out.push({
        to: [m.id],
        title: `Сегодня ${mine.length} ${plural(mine.length, 'дело', 'дела', 'дел')}`,
        body: mine.map(ev => `${ev.allDay ? 'Весь день' : ev.start} ${ev.title}`).join('\n'),
        tag: `digest-${today}`,
        url: `${SITE}#d=${today}`,
      });
    }
  }
  return out;
}

// ---- Firestore + Web Push ----

async function main() {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  const db = admin.firestore();
  const family = db.collection('families').doc(FAMILY_ID);
  const read = async name => (await family.collection(name).get()).docs.map(d => d.data());

  const [members, events, subs] = await Promise.all([read('members'), read('events'), read('subscriptions')]);
  const metaRef = family.collection('meta').doc('notifier');
  const meta = (await metaRef.get()).data() || {};

  // The family's time zone, as reported by their phones
  const zones = subs.map(s => s.tz).filter(Boolean);
  process.env.TZ = zones.sort((a, b) => zones.filter(z => z === b).length - zones.filter(z => z === a).length)[0]
    || meta.tz || 'Europe/Moscow';

  const now = Date.now();
  const from = Math.max(meta.lastRun || now - 10 * 60e3, now - MAX_LOOKBACK);
  const messages = due({ members, events }, from, now);
  console.log(`TZ ${process.env.TZ}, ${new Date(from).toLocaleString('ru')} → ${new Date(now).toLocaleString('ru')}: ` +
    `${messages.length} notification(s), ${subs.length} device(s)`);

  webpush.setVapidDetails(SITE.replace(/\/$/, ''), VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY || 'dry-run');
  const gone = new Set();
  for (const msg of messages) {
    const { to, ...payload } = msg;
    for (const sub of subs.filter(s => to.includes(s.memberId) && !gone.has(s.id))) {
      if (DRY_RUN) { console.log('→', sub.memberId, payload); continue; }
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload), { TTL: 3600, urgency: 'high' });
      } catch (e) {
        // The phone unsubscribed or the app was removed
        if (e.statusCode === 404 || e.statusCode === 410) gone.add(sub.id);
        else console.error(`push to ${sub.memberId} failed: ${e.statusCode} ${e.body || e.message}`);
      }
    }
  }
  for (const id of gone) await family.collection('subscriptions').doc(id).delete();
  if (!DRY_RUN) await metaRef.set({ lastRun: now, tz: process.env.TZ }, { merge: true });
}

// Run unless imported (the checks in notifier/due.test.js import due())
if (process.argv[1]?.endsWith('notify.js')) {
  main().catch(e => { console.error(e); process.exit(1); });
}
