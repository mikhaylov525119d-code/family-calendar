// Who is using this device. Remembered until they tap "Сменить".
// With Firebase the family password is the password of the family account,
// checked by Firebase Auth; without it a local check keeps the app usable.
import { ls } from './util.js';
import { cloud } from './store.js';

const LOCAL_PASSWORD = '525119';

const AUTH_ERRORS = {
  'auth/network-request-failed': 'Нет интернета',
  'auth/too-many-requests': 'Слишком много попыток, подожди минуту',
};

export const session = {
  get authed() { return cloud ? cloud.isSignedIn() : ls.get('fc.auth', false) === true; },

  // Resolves with an error message, or null on success
  async login(pw) {
    pw = String(pw).trim();
    if (!cloud) {
      if (pw !== LOCAL_PASSWORD) return 'Неверный пароль';
      ls.set('fc.auth', true);
      return null;
    }
    try {
      await cloud.signIn(pw);
      return null;
    } catch (e) {
      return AUTH_ERRORS[e.code] || 'Неверный пароль';
    }
  },

  get meId() { return ls.get('fc.me', null); },
  setMe(id) { ls.set('fc.me', id); },
  switchUser() { ls.del('fc.me'); },
  async logout() {
    ls.del('fc.me');
    ls.del('fc.auth');
    if (cloud) await cloud.signOutCloud();
  },
};
