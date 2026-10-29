// A checklist (e.g. shopping) used inside reminders and on the Lists tab.
// Items are a map keyed by id and every change is a field-path update,
// so simultaneous edits from two phones merge instead of overwriting.
// The add-item field is never re-rendered, so the iOS keyboard stays open
// while you type several items in a row.
import { store, DELETE } from './store.js';
import { session } from './session.js';
import { esc, uid } from './util.js';
import { confirmDanger } from './ui.js';

export const newList = (title = 'Список') => ({
  id: uid(), title, items: {}, hideDone: false, createdAt: Date.now(), authorId: session.meId,
});

export const listItems = l => Object.entries(l.items || {})
  .map(([id, v]) => ({ id, ...v }))
  .sort((a, b) => (a.order || 0) - (b.order || 0));

export function listProgress(l) {
  const items = Object.values(l.items || {});
  return { done: items.filter(i => i.done).length, total: items.length };
}

export class Checklist {
  // get(): current list, apply(fields): save field-path changes, remove(): delete the whole list
  constructor(slot, { get, apply, remove }) {
    Object.assign(this, { get, apply, remove, editing: null });
    this.el = document.createElement('div');
    this.el.className = 'cl card';
    this.el.innerHTML = `
      <div class="cl-head">
        <input class="cl-title" maxlength="60" placeholder="Название списка" aria-label="Название списка">
        <span class="cl-count"></span>
      </div>
      <div class="cl-progress"><span></span></div>
      <form class="cl-new" autocomplete="off">
        <input placeholder="Добавить пункт…" maxlength="200" enterkeyhint="enter" aria-label="Новый пункт">
        <button class="cl-add" aria-label="Добавить пункт">+</button>
      </form>
      <ul class="cl-items"></ul>
      <div class="cl-foot">
        <button type="button" class="btn-text" data-cl="toggle-hide"></button>
        <button type="button" class="btn-text danger-text" data-cl="delete-list">Удалить список</button>
      </div>`;
    slot.appendChild(this.el);
    this.bind();
    this.refresh();
  }

  destroy() { this.el.remove(); }

  change(fields) {
    this.apply(fields);
    this.refresh();
  }

  refresh() {
    const l = this.get();
    if (!l) return;
    const $ = s => this.el.querySelector(s);
    const title = $('.cl-title');
    if (document.activeElement !== title) title.value = l.title;

    const { done, total } = listProgress(l);
    $('.cl-count').textContent = total ? `${done} из ${total}` : '';
    $('.cl-progress span').style.width = total ? `${(done / total) * 100}%` : '0';

    const items = listItems(l);
    const ordered = [...items.filter(i => !i.done), ...items.filter(i => i.done)];
    const visible = l.hideDone ? ordered.filter(i => !i.done) : ordered;
    $('.cl-items').innerHTML = visible.map(it => this.itemHTML(it)).join('') ||
      `<li class="cl-empty">${total ? 'Всё отмечено ✓' : 'Пока пусто — добавь первый пункт'}</li>`;

    const hideBtn = $('[data-cl="toggle-hide"]');
    hideBtn.textContent = l.hideDone ? `Показать отмеченные (${done})` : 'Скрыть отмеченные';
    hideBtn.disabled = !done && !l.hideDone;

    const edit = $('.cl-edit');
    if (edit) {
      edit.focus();
      edit.setSelectionRange(edit.value.length, edit.value.length);
    }
  }

  itemHTML(it) {
    const by = it.done && it.doneBy ? store.member(it.doneBy) : null;
    const body = this.editing === it.id
      ? `<input class="cl-edit" value="${esc(it.text)}" maxlength="200" enterkeyhint="done" aria-label="Текст пункта">`
      : `<span class="cl-text" data-cl="edit">${esc(it.text)}${by ? ` <small style="color:${by.color}">· ${esc(by.name)}</small>` : ''}</span>`;
    return `
      <li class="cl-item${it.done ? ' done' : ''}" data-id="${it.id}">
        <button type="button" class="cl-check" data-cl="check" aria-label="${it.done ? 'Снять отметку' : 'Отметить'}"></button>
        ${body}
        <button type="button" class="cl-del" data-cl="del" aria-label="Удалить пункт">×</button>
      </li>`;
  }

  commitEdit(input) {
    const id = this.editing;
    this.editing = null;
    const text = input.value.trim();
    if (text && this.get()?.items?.[id]) this.change({ [`items.${id}.text`]: text });
    else this.refresh();
  }

  bind() {
    const el = this.el;

    el.addEventListener('click', async e => {
      const b = e.target.closest('[data-cl]');
      if (!b) return;
      const id = b.closest('.cl-item')?.dataset.id;
      const l = this.get();
      if (!l) return;
      switch (b.dataset.cl) {
        case 'check': {
          const done = !l.items[id]?.done;
          this.change({ [`items.${id}.done`]: done, [`items.${id}.doneBy`]: done ? session.meId : null });
          break;
        }
        case 'edit':
          this.editing = id;
          this.refresh();
          break;
        case 'del':
          this.change({ [`items.${id}`]: DELETE });
          break;
        case 'toggle-hide':
          this.change({ hideDone: !l.hideDone });
          break;
        case 'delete-list':
          if (await confirmDanger('Удалить список?', 'Удалить список', 'Все пункты будут удалены.')) this.remove();
          break;
      }
    });

    el.querySelector('.cl-new').addEventListener('submit', e => {
      e.preventDefault();
      const input = e.target.querySelector('input');
      const text = input.value.trim();
      if (!text) return;
      this.change({ [`items.${uid()}`]: { text, done: false, doneBy: null, order: Date.now() } });
      input.value = '';
      input.focus();
    });

    el.querySelector('.cl-title').addEventListener('change', e => {
      this.change({ title: e.target.value.trim() || 'Список' });
    });

    el.addEventListener('keydown', e => {
      if (e.target.matches('.cl-title') && e.key === 'Enter') e.target.blur();
      if (!e.target.matches('.cl-edit')) return;
      if (e.key === 'Enter') e.target.blur();
      if (e.key === 'Escape') { this.editing = null; this.refresh(); }
    });
    el.addEventListener('focusout', e => {
      if (e.target.matches('.cl-edit') && this.editing) this.commitEdit(e.target);
    });
  }
}
