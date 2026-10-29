// Bottom sheets, action sheets and toasts in the iOS style
import { esc } from './util.js';

let stack = [];

export function openSheet({ title = '', left = 'Закрыть', right = '', tall = false, beforeClose } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `
    <div class="sheet-backdrop" data-sheet-close></div>
    <section class="sheet${tall ? ' tall' : ''}" role="dialog" aria-modal="true">
      <header class="sheet-head">
        <button class="btn-text" data-sheet-close>${esc(left)}</button>
        <h2 class="sheet-title"></h2>
        <div class="sheet-right">${right}</div>
      </header>
      <div class="sheet-body"></div>
    </section>`;
  document.getElementById('sheets').appendChild(wrap);

  const closers = [];
  const api = {
    el: wrap,
    body: wrap.querySelector('.sheet-body'),
    closed: false,
    setTitle(t) { wrap.querySelector('.sheet-title').textContent = t; },
    onClose(fn) { closers.push(fn); },
    async close(force = false) {
      if (api.closed) return;
      if (!force && beforeClose && !(await beforeClose())) return;
      api.closed = true;
      wrap.classList.remove('open');
      stack = stack.filter(s => s !== api);
      closers.forEach(fn => fn());
      setTimeout(() => wrap.remove(), 320);
      if (!stack.length) document.documentElement.classList.remove('sheet-open');
    },
  };
  api.setTitle(title);
  wrap.addEventListener('click', e => {
    if (e.target.closest('[data-sheet-close]')) api.close();
  });

  stack.push(api);
  document.documentElement.classList.add('sheet-open');
  void wrap.offsetHeight; // start the slide-in transition from the closed state
  wrap.classList.add('open');
  return api;
}

export const closeAllSheets = () => [...stack].reverse().forEach(s => s.close(true));

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && stack.length) stack[stack.length - 1].close();
});

// Resolves with the chosen action's value, or null on cancel
export function actionSheet({ title = '', message = '', actions }) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'as-wrap';
    wrap.innerHTML = `
      <div class="sheet-backdrop" data-i="-1"></div>
      <div class="as">
        <div class="as-group">
          ${title || message ? `<div class="as-head">${title ? `<b>${esc(title)}</b>` : ''}${message ? `<span>${esc(message)}</span>` : ''}</div>` : ''}
          ${actions.map((a, i) => `<button class="as-btn${a.danger ? ' danger' : ''}" data-i="${i}">${esc(a.label)}</button>`).join('')}
        </div>
        <button class="as-btn as-cancel" data-i="-1">Отмена</button>
      </div>`;
    document.getElementById('sheets').appendChild(wrap);
    void wrap.offsetHeight;
    wrap.classList.add('open');
    wrap.addEventListener('click', e => {
      const b = e.target.closest('[data-i]');
      if (!b) return;
      const i = Number(b.dataset.i);
      wrap.classList.remove('open');
      setTimeout(() => wrap.remove(), 250);
      resolve(i < 0 ? null : actions[i].value);
    });
  });
}

export const confirmDanger = (title, label, message = '') =>
  actionSheet({ title, message, actions: [{ label, value: true, danger: true }] }).then(Boolean);

let toastTimer;
export function toast(text) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}
