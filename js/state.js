// UI state shared by the views
import { ls } from './util.js';

export const state = {
  tab: 'calendar',
  view: ls.get('fc.view', 'month'), // month | week | day
  cursor: new Date(),               // selected day
  filter: ls.get('fc.filter', []),  // member ids; empty = everyone
};

export function persistUI() {
  ls.set('fc.view', state.view);
  ls.set('fc.filter', state.filter);
}
