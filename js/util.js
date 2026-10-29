const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ESC[c]);

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const clone = o => JSON.parse(JSON.stringify(o));

export const COLORS = ['#3b82f6', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#64748b'];

export const initials = name => (name || '?').trim().charAt(0).toUpperCase();

// Delegated listener: fn(event, matchedElement)
export function on(root, type, selector, fn) {
  root.addEventListener(type, e => {
    const el = e.target.closest(selector);
    if (el && root.contains(el)) fn(e, el);
  });
}

// localStorage can throw in private mode, so every access is guarded
export const ls = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  },
  del(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
};
