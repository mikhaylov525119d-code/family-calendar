// Data layer. With a Firebase config it syncs the family through Firestore
// (and keeps working offline); without one it keeps data in localStorage.
// Reads are synchronous from an in-memory copy; writes are fire-and-forget.
import { ls, uid, clone } from './util.js';
import { FIREBASE_CONFIG } from './config.js';
import { toast } from './ui.js';

export const cloud = FIREBASE_CONFIG.apiKey ? await import('./firebase.js') : null;

// Field-path value that removes the field, e.g. { 'items.abc': DELETE }
export const DELETE = Symbol('delete');

const NAMES = ['members', 'events', 'lists'];
const DEFAULT_MEMBERS = [
  { id: 'papa', name: 'Папа', color: '#3b82f6' },
  { id: 'mama', name: 'Мама', color: '#ec4899' },
  { id: 'doch', name: 'Дочь', color: '#f59e0b' },
];

// Applies { 'a.b.c': value } updates to a plain object
export function applyFields(obj, fields) {
  for (const [path, value] of Object.entries(fields)) {
    const keys = path.split('.');
    const last = keys.pop();
    let o = obj;
    for (const k of keys) {
      if (o[k] == null || typeof o[k] !== 'object') o[k] = {};
      o = o[k];
    }
    if (value === DELETE) delete o[last];
    else if (value !== undefined) o[last] = clone(value);
  }
  return obj;
}

// Lists made before checklist items were keyed by id
function normalizeList(l) {
  if (Array.isArray(l?.items)) {
    l.items = Object.fromEntries(l.items.map((it, i) => [it.id, { text: it.text, done: !!it.done, doneBy: it.doneBy || null, order: i }]));
  }
}

const local = {
  KEY: 'fc.data.v1',
  data: null,
  listening: false,
  load() {
    const d = ls.get(this.KEY, null) || { members: clone(DEFAULT_MEMBERS), events: [], lists: [] };
    d.events.forEach(e => normalizeList(e.list));
    d.lists.forEach(normalizeList);
    return d;
  },
  start(names, onData) {
    this.onData = onData;
    this.push();
    if (!this.listening) {
      this.listening = true;
      window.addEventListener('storage', e => { if (e.key === this.KEY && this.onData) this.push(); });
    }
    return () => { this.onData = null; };
  },
  push() {
    this.data = this.load();
    NAMES.forEach(n => this.onData(n, this.data[n], { fromCache: false }));
  },
  commit() {
    ls.set(this.KEY, this.data);
    NAMES.forEach(n => this.onData?.(n, this.data[n], { fromCache: false }));
  },
  put(name, item) {
    const arr = this.data[name];
    const i = arr.findIndex(x => x.id === item.id);
    if (i >= 0) arr[i] = clone(item); else arr.push(clone(item));
    this.commit();
  },
  patch(name, id, fields) {
    const d = this.data[name].find(x => x.id === id);
    if (d) applyFields(d, fields);
    this.commit();
  },
  remove(name, id) {
    this.data[name] = this.data[name].filter(x => x.id !== id);
    this.commit();
  },
};

const backend = cloud || local;
const empty = () => ({ members: [], events: [], lists: [] });
let data = empty();
let stop = null;
let ready = null;
const subs = new Set();
const emit = () => subs.forEach(fn => fn());

function write(fn) {
  try {
    Promise.resolve(fn()).catch(onWriteError);
  } catch (e) { onWriteError(e); }
}
function onWriteError(e) {
  console.error(e);
  toast(e?.code === 'permission-denied' ? 'Нет доступа — войди заново' : 'Не удалось сохранить');
}

const strip = o => JSON.parse(JSON.stringify(o)); // Firestore rejects undefined values
const prefixed = (prefix, fields) => Object.fromEntries(Object.entries(fields).map(([k, v]) => [prefix + k, v]));

export const store = {
  get members() { return data.members; },
  get events() { return data.events; },
  get lists() { return data.lists; },

  member: id => data.members.find(m => m.id === id) || null,
  event: id => data.events.find(e => e.id === id) || null,
  list: id => data.lists.find(l => l.id === id) || null,

  subscribe(fn) {
    subs.add(fn);
    return () => subs.delete(fn);
  },

  // Starts syncing; resolves once every collection has real data (or after a timeout offline)
  connect() {
    if (ready) return ready;
    ready = new Promise(resolve => {
      const got = new Set();
      const done = () => resolve();
      setTimeout(done, 5000);
      stop = backend.start(NAMES, (name, docs, { fromCache }) => {
        if (name === 'lists') docs.forEach(normalizeList);
        if (name === 'events') docs.forEach(e => normalizeList(e.list));
        data[name] = docs;
        // First launch of the whole family: create Папа / Мама / Дочь
        if (cloud && name === 'members' && !docs.length && !fromCache) {
          DEFAULT_MEMBERS.forEach(m => write(() => backend.put('members', m)));
        }
        if (!fromCache || docs.length) got.add(name);
        if (got.size === NAMES.length) done();
        emit();
      }, (name, err) => {
        console.error(name, err);
        toast(err.code === 'permission-denied' ? 'Нет доступа к данным' : 'Ошибка синхронизации');
        done();
      });
    });
    return ready;
  },
  disconnect() {
    stop?.();
    stop = null;
    ready = null;
    data = empty();
  },

  addMember({ name, color }) {
    const member = { id: uid(), name, color };
    write(() => backend.put('members', member));
    return member;
  },
  updateMember(id, fields) { write(() => backend.patch('members', id, strip(fields), DELETE)); },
  removeMember(id) { write(() => backend.remove('members', id)); },

  saveEvent(ev) { write(() => backend.put('events', strip({ ...ev, updatedAt: Date.now() }))); },
  patchEvent(id, fields) { write(() => backend.patch('events', id, { ...strip(fields), updatedAt: Date.now() }, DELETE)); },
  deleteEvent(id) { write(() => backend.remove('events', id)); },

  saveList(list) { write(() => backend.put('lists', strip({ ...list, updatedAt: Date.now() }))); },
  deleteList(id) { write(() => backend.remove('lists', id)); },

  // Checklist changes as field paths, so two people ticking items at once never overwrite each other.
  // owner: { kind: 'event' | 'list', id }
  updateChecklist(owner, fields) {
    if (owner.kind === 'event') write(() => backend.patch('events', owner.id, prefixed('list.', fields), DELETE));
    else write(() => backend.patch('lists', owner.id, fields, DELETE));
  },
};
