// First launch: family password, then "Кто ты?" (with adding new family members)
import { store } from '../store.js';
import { session } from '../session.js';
import { esc } from '../util.js';
import { avatar, swatches, freeColor } from '../render.js';
import { WD_SHORT, weekdayIdx } from '../dates.js';

export function renderLogin(root, onDone) {
  root.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'login';
  root.appendChild(el);

  let adding = false;
  let color = freeColor();
  const now = new Date();
  const logo = `<div class="logo"><span>${WD_SHORT[weekdayIdx(now)]}</span><b>${now.getDate()}</b></div>`;

  function render() {
    if (!session.authed) {
      el.innerHTML = `
        <form class="login-card" data-form="pw" autocomplete="on">
          ${logo}
          <h1>Семейный календарь</h1>
          <p class="muted">Введи семейный пароль</p>
          <input class="input-big" type="password" name="pw" inputmode="numeric" autocomplete="current-password" placeholder="Пароль" aria-label="Пароль" required>
          <p class="error" hidden>Неверный пароль</p>
          <button class="btn primary block">Войти</button>
        </form>`;
      return;
    }
    el.innerHTML = `
      <div class="login-card">
        ${logo}
        <h1>Кто ты?</h1>
        <p class="muted">Выбери себя — приложение запомнит</p>
        <div class="who-list">
          ${store.members.map(m => `
            <button class="who" data-me="${m.id}">${avatar(m, 'lg')}<span>${esc(m.name)}</span><span class="chev">›</span></button>`).join('')}
        </div>
        ${adding ? `
          <form class="card add-member" data-form="member">
            <input name="name" placeholder="Имя, например «Бабушка»" maxlength="20" required aria-label="Имя">
            ${swatches(color)}
            <div class="row-btns">
              <button type="button" class="btn" data-cancel>Отмена</button>
              <button class="btn primary">Добавить</button>
            </div>
          </form>` : `
          <button class="btn block" data-add>+ Добавить члена семьи</button>`}
      </div>`;
    el.querySelector('[name="name"]')?.focus();
  }

  el.addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    if (form.dataset.form === 'pw') {
      const input = form.elements.pw;
      const btn = form.querySelector('button');
      btn.disabled = true;
      btn.textContent = 'Входим…';
      const error = await session.login(input.value);
      if (!error) {
        await store.connect();
        return render();
      }
      btn.disabled = false;
      btn.textContent = 'Войти';
      const msg = form.querySelector('.error');
      msg.textContent = error;
      msg.hidden = false;
      input.value = '';
      form.classList.remove('shake');
      void form.offsetWidth;
      form.classList.add('shake');
    } else {
      const name = form.elements.name.value.trim();
      if (!name) return;
      store.addMember({ name, color });
      adding = false;
      color = freeColor();
      render();
    }
  });

  el.addEventListener('click', e => {
    const me = e.target.closest('[data-me]');
    if (me) {
      unsubscribe();
      session.setMe(me.dataset.me);
      return onDone();
    }
    if (e.target.closest('[data-add]')) { adding = true; render(); }
    if (e.target.closest('[data-cancel]')) { adding = false; render(); }
    const sw = e.target.closest('[data-color]');
    if (sw) {
      color = sw.dataset.color;
      el.querySelectorAll('.swatch').forEach(s => s.classList.toggle('on', s === sw));
    }
  });

  // Family members added from other phones show up live (not while typing a new name)
  const unsubscribe = store.subscribe(() => {
    if (session.authed && !adding && el.isConnected) render();
  });

  render();
}
