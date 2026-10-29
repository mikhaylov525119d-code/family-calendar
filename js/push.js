// Web Push on this device. The subscription is saved to families/{id}/subscriptions
// with who uses the phone; the notifier (notifier/notify.js on GitHub Actions) sends from there.
import { cloud } from './store.js';
import { session } from './session.js';
import { ls } from './util.js';
import { VAPID_PUBLIC_KEY } from './config.js';

const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// 'ok' | 'install' (iPhone shows notifications only from the home screen) | 'unsupported' | 'off' (no cloud)
export function support() {
  if (!cloud) return 'off';
  if ('PushManager' in window && 'serviceWorker' in navigator && 'Notification' in window) return 'ok';
  return isIOS && !standalone ? 'install' : 'unsupported';
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration()) || navigator.serviceWorker.register('sw.js');
}

async function currentSub() {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

async function idFor(endpoint) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return [...new Uint8Array(hash)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}

function keyBytes(base64url) {
  const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

async function record(sub) {
  const { endpoint, keys } = sub.toJSON();
  const id = await idFor(endpoint);
  const doc = {
    id, endpoint, keys,
    memberId: session.meId,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    updatedAt: Date.now(),
  };
  ls.set('fc.push', `${id}|${doc.memberId}`);
  // Like other writes, this resolves only online; the cache sends it later
  cloud.put('subscriptions', doc).catch(e => console.error(e));
}

// 'on' | 'off' | 'denied'
export async function status() {
  if (support() !== 'ok') return 'off';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.permission === 'granted' && (await currentSub()) ? 'on' : 'off';
}

// Must be called from a tap: iOS asks for permission only then
export async function enable() {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off';
  await registration();
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  await record(sub);
  return 'on';
}

export async function disable() {
  const sub = await currentSub();
  ls.del('fc.push');
  if (!sub) return;
  cloud.remove('subscriptions', await idFor(sub.endpoint)).catch(e => console.error(e));
  await sub.unsubscribe();
}

// Keeps the subscription pointing at whoever uses this phone now
export async function sync() {
  if (support() !== 'ok' || Notification.permission !== 'granted') return;
  const sub = await currentSub();
  if (!sub) return;
  if (ls.get('fc.push', '') !== `${await idFor(sub.endpoint)}|${session.meId}`) await record(sub);
}
