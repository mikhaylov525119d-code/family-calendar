// Small HTML fragments shared by several screens
import { store } from './store.js';
import { esc, initials, COLORS } from './util.js';
import { eventColor, isRepeating } from './events.js';
import { listProgress } from './checklist.js';

export function avatar(m, size = '') {
  if (!m) return `<span class="avatar ${size}" style="--c:#9ca3af">?</span>`;
  return `<span class="avatar ${size}" style="--c:${m.color}" title="${esc(m.name)}">${esc(initials(m.name))}</span>`;
}

export const swatches = selected => `
  <div class="swatches">
    ${COLORS.map(c => `<button type="button" class="swatch${c === selected ? ' on' : ''}" data-color="${c}" style="--c:${c}" aria-label="Цвет"></button>`).join('')}
  </div>`;

export const freeColor = () => COLORS.find(c => !store.members.some(m => m.color === c)) || COLORS[0];

export function eventRow(ev, key) {
  const p = ev.list ? listProgress(ev.list) : null;
  const who = (ev.forIds?.length ? ev.forIds : [ev.authorId]).map(store.member).filter(Boolean);
  const time = ev.allDay
    ? '<span class="ev-time-all">весь день</span>'
    : `${ev.start}${ev.end ? `<small>${ev.end}</small>` : ''}`;
  return `
    <button class="ev-row" data-action="open-event" data-id="${ev.id}" data-date="${key}" style="--c:${eventColor(ev)}">
      <span class="ev-time">${time}</span>
      <span class="ev-main">
        <span class="ev-title">${esc(ev.title)}</span>
        <span class="ev-meta">
          ${who.map(m => avatar(m, 'xs')).join('')}
          ${ev.private ? '<span class="ev-tag" title="Видят только участники">🔒</span>' : ''}
          ${isRepeating(ev) ? '<span class="ev-tag">↻</span>' : ''}
          ${p ? `<span class="ev-tag${p.total && p.done === p.total ? ' ok' : ''}">☑ ${p.done}/${p.total}</span>` : ''}
          ${ev.note ? '<span class="ev-tag">✎</span>' : ''}
        </span>
      </span>
    </button>`;
}
