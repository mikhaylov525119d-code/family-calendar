// Cloud backend: Firebase Auth + Firestore with an offline cache.
// Loaded by store.js only when config.js has an apiKey.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, deleteField,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { FIREBASE_CONFIG, FAMILY_EMAIL, FAMILY_ID } from './config.js';

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
const col = name => collection(db, 'families', FAMILY_ID, name);

export const authReady = new Promise(resolve => {
  const stop = onAuthStateChanged(auth, user => { stop(); resolve(user); });
});
export const isSignedIn = () => !!auth.currentUser;
export const signIn = password => signInWithEmailAndPassword(auth, FAMILY_EMAIL, password);
export const signOutCloud = () => signOut(auth);

// onData(name, docs, { fromCache }) for each collection; returns a stop function
export function start(names, onData, onError) {
  const stops = names.map(name => onSnapshot(
    col(name),
    { includeMetadataChanges: false },
    snap => onData(name, snap.docs.map(d => d.data()), { fromCache: snap.metadata.fromCache }),
    err => onError(name, err),
  ));
  return () => stops.forEach(s => s());
}

// Writes resolve only once the server confirms, which never happens offline,
// so callers do not wait for them: the local cache updates the UI immediately.
export const put = (name, item) => setDoc(doc(col(name), item.id), item);
export const remove = (name, id) => deleteDoc(doc(col(name), id));
export function patch(name, id, fields, DELETE) {
  const data = {};
  for (const [path, v] of Object.entries(fields)) data[path] = v === DELETE ? deleteField() : v;
  return updateDoc(doc(col(name), id), data);
}
