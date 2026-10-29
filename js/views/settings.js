// Profile and family members
import { store } from '../store.js';
import { session } from '../session.js';
import * as push from '../push.js';
import { esc } from '../util.js';
import { avatar, swatches, freeColor } from '../render.js';
import { openSheet, confirmDanger, toast, closeAllSheets } from '../ui.js';

export function openSettings({ onSwitchUser }) {
  const sheet = openSheet({ title: 'Настройки' });

  function render() {
    const me = store.member(session.meId);
    sheet.body.innerHTML = `
      <div class="section-label">Это ты</div>
      <div class="card rows">
        <div class="row">${avatar(me, 'sm')}<span class="grow">${esc(me?.name || '')}</span>
          <button class="btn-text" data-act="switch">Сменить</button></div>
      </div>
      <div class="section-label">Семья</div>
      <div class="card rows">
        ${store.members.map(m => `
          <button class="row" data-member="${m.id}">${avatar(m, 'sm')}<span class="grow">${esc(m.name)}</span><span class="chev">›</span></button>`).join('')}
        <button class="row accent" data-act="add">+ Добавить члена семьи</button>
      </div>
      ${push.support() === 'off' ? '' : `
        <div class="section-label">Уведомления</div>
        <div class="card rows push-card"></div>
        <p class="section-foot">Приходят с задержкой до 10–15 минут.</p>`}
      <button class="btn block danger-text" data-act="logout">Выйти из календаря</button>
      <p class="muted center small">Семейный календарь · версия 0.2</p>`;
    renderPush();
  }

  async function renderPush() {
    const card = sheet.body.querySelector('.push-card');
    if (!card) return;
    const support = push.support();
    const status = support === 'ok' ? await push.status() : null;
    const text = s => `<div class="row"><span class="row-label">${s}</span></div>`;
    if (support === 'install') {
      card.innerHTML = text('Добавь календарь на экран «Домой»: в Safari «Поделиться» → «На экран „Домой“», и открой его оттуда. Тогда здесь можно будет включить уведомления.');
    } else if (support === 'unsupported') {
      card.innerHTML = text('Этот браузер не умеет показывать уведомления.');
    } else if (status === 'denied') {
      card.innerHTML = text('Уведомления запрещены. Разреши их: Настройки iPhone → Уведомления → Календарь.');
    } else {
      card.innerHTML = `
        <label class="row">
          <span class="row-label">На этом телефоне<small class="row-hint">О делах, о новых делах для тебя и сводка в 8:00</small></span>
          <input type="checkbox" class="switch" data-push ${status === 'on' ? 'checked' : ''}>
        </label>`;
    }
  }

  sheet.body.addEventListener('change', async e => {
    const sw = e.target.closest('[data-push]');
    if (!sw) return;
    sw.disabled = true;
    try {
      if (sw.checked) {
        const res = await push.enable();
        if (res === 'on') toast('Уведомления включены');
        else if (res === 'off') toast('Без разрешения уведомления не придут');
      } else {
        await push.disable();
        toast('Уведомления выключены');
      }
    } catch (err) {
      console.error(err);
      toast('Не получилось включить уведомления');
    }
    renderPush();
  });

  sheet.body.addEventListener('click', async e => {
    const m = e.target.closest('[data-member]');
    if (m) return openMemberEditor(m.dataset.member);
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'add') openMemberEditor(null);
    if (act === 'switch') {
      session.switchUser();
      closeAllSheets();
      onSwitchUser();
    }
    if (act === 'logout' && await confirmDanger('Выйти?', 'Выйти', 'Нужно будет снова ввести пароль.')) {
      // While still signed in, so the subscription can be removed
      if (push.support() === 'ok') await push.disable().catch(() => {});
      await session.logout();
      store.disconnect();
      closeAllSheets();
      onSwitchUser();
    }
  });
  sheet.onClose(store.subscribe(render));
  render();
}

function openMemberEditor(id) {
  const m = id ? store.member(id) : null;
  let color = m?.color || freeColor();
  const sheet = openSheet({
    title: m ? 'Член семьи' : 'Новый член семьи',
    left: 'Отмена',
    right: '<button class="btn-text bold" data-act="save">Готово</button>',
  });
  sheet.body.innerHTML = `
    <div class="card"><input class="input-title" name="name" maxlength="20" placeholder="Имя" value="${esc(m?.name || '')}" aria-label="Имя"></div>
    <div class="section-label">Цвет</div>
    <div class="card">${swatches(color)}</div>
    ${m && m.id !== session.meId ? '<button class="btn block danger-text" data-act="delete">Удалить из семьи</button>' : ''}`;
  const input = sheet.body.querySelector('[name="name"]');
  if (!m) input.focus();

  sheet.el.addEventListener('click', async e => {
    const sw = e.target.closest('[data-color]');
    if (sw) {
      color = sw.dataset.color;
      sheet.body.querySelectorAll('.swatch').forEach(s => s.classList.toggle('on', s === sw));
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'save') {
      const name = input.value.trim();
      if (!name) return toast('Напиши имя');
      if (m) store.updateMember(m.id, { name, color });
      else store.addMember({ name, color });
      sheet.close(true);
    }
    if (act === 'delete' && await confirmDanger(`Удалить «${m.name}»?`, 'Удалить', 'Добавленные дела останутся в календаре.')) {
      store.removeMember(m.id);
      sheet.close(true);
    }
  });
}
