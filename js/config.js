// Firebase settings: console.firebase.google.com → Project settings → Your apps → Web app.
// While apiKey is empty the app works offline-only on one device (localStorage).
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBXnz_fw_qDuffOm-vxjBNIxFhW81n8F2c',
  authDomain: 'family-calendar-9bfad.firebaseapp.com',
  projectId: 'family-calendar-9bfad',
  storageBucket: 'family-calendar-9bfad.firebasestorage.app',
  messagingSenderId: '50043780244',
  appId: '1:50043780244:web:0f150139fc97acdf520881',
};

// The single family account in Firebase Authentication; its password is the family password
export const FAMILY_EMAIL = 'family@example.com';

// All family data lives under families/{FAMILY_ID} in Firestore
export const FAMILY_ID = 'main';

// Public half of the Web Push key pair; the private half is the VAPID_PRIVATE_KEY secret on GitHub
export const VAPID_PUBLIC_KEY = 'BAMehvHTY7v9xUYGds3iwz2Oo_xUM4F0H3nUEn3LshH69-sqYcNOtkMY27c02FDBr7JcWCwNpSAuSc6MijrBPN0';
