/* Pool & Plan <-> Todoist mapping. Pure functions, no network.
   Rules are documented in MAPPING.md. Works in the browser (window.PPMap) and in Node (module.exports). */
(function (root) {
  'use strict';

  const CONTAINERS = ['POOL', 'MUSIC'];          // projects whose sections are named "BOARD List"
  const CONFIG = { board: 'NOTES', list: 'Config' };
  const UNSORTED = 'Unsorted';
  const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const DAYMAP = { mon: 0, monday: 0, tue: 1, tues: 1, tuesday: 1, wed: 2, wednesday: 2, thu: 3, thur: 3, thurs: 3, thursday: 3, fri: 4, friday: 4, sat: 5, saturday: 5, sun: 6, sunday: 6 };

  const pad = n => String(n).padStart(2, '0');
  const hm = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  const isCapsWord = w => /[A-Z]/.test(w) && w === w.toUpperCase() && !/[a-z]/.test(w);

  /* ---------- names ---------- */

  // "SELF GROWING Reading" -> {board:'SELF GROWING', list:'Reading'}
  function parseSectionName(name) {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    let i = 0;
    while (i < words.length && isCapsWord(words[i])) i++;
    const board = words.slice(0, i).join(' ');
    const list = words.slice(i).join(' ');
    if (!board) return { board: UNSORTED, list: list, ok: false, problem: 'no-board' };
    if (!list) return { board: board, list: '', ok: false, problem: 'no-list-title' };
    return { board: board, list: list, ok: true };
  }

  function sectionName(board, list) { return board + ' ' + list; }

  // A list title is valid when it does not start with an all-capitals word.
  function checkListTitle(title) {
    const first = String(title || '').trim().split(/\s+/)[0] || '';
    if (!first) return { ok: false, problem: 'empty' };
    if (isCapsWord(first) && first.length > 1) return { ok: false, problem: 'caps', suggestion: first.charAt(0) + first.slice(1).toLowerCase() + String(title).trim().slice(first.length) };
    return { ok: true };
  }

  // "ADMIN_LCDLS" -> {board:'ADMIN', list:'LCDLS'}
  function parseLinkedProject(name) {
    const m = /^([A-Z0-9][A-Z0-9 ]*?)_(.+)$/.exec(String(name || '').trim());
    if (!m || !/[A-Z]/.test(m[1])) return null;
    return { board: m[1].trim(), list: m[2].trim() };
  }

  function classifyProject(p) {
    if (p.inbox_project) return { kind: 'inbox' };
    const up = String(p.name || '').trim().toUpperCase();
    if (CONTAINERS.includes(up)) return { kind: 'container', name: up };
    const linked = parseLinkedProject(p.name);
    if (linked) return { kind: 'linked', board: linked.board, list: linked.list };
    return { kind: 'board', board: String(p.name || '').trim() };
  }

  /* ---------- structure ---------- */

  // projects, sections: Todoist sync objects. Returns boards with their lists and where each list lives in Todoist.
  function buildStructure(projects, sections, layout) {
    const boards = new Map(), listsByKey = new Map(), sectionToList = new Map(), projectRole = new Map();
    let inboxProjectId = null, configSectionId = null;
    const boardOf = name => {
      if (!boards.has(name)) boards.set(name, { name: name, lists: [], firstSeen: boards.size });
      return boards.get(name);
    };
    const live = (projects || []).filter(p => !p.is_deleted && !p.is_archived);
    const liveSecs = (sections || []).filter(s => !s.is_deleted && !s.is_archived)
      .sort((a, b) => (a.section_order || 0) - (b.section_order || 0));
    const containerIds = [];
    const placed = (layout && layout.projectBoards) || {};   // projectId -> board: show that project as one list there
    live.forEach(p => {
      let c = classifyProject(p);
      const to = placed[p.id];
      if (to && c.kind === 'board') c = { kind: 'linked', board: String(to).trim().toUpperCase(), list: String(p.name || '').trim(), placed: true };
      projectRole.set(p.id, c);
      if (c.kind === 'inbox') inboxProjectId = p.id;
      if (c.kind === 'container') containerIds.push(p.id);
    });
    // POOL first, then MUSIC, then everything else, so board order follows POOL
    const order = live.slice().sort((a, b) => rank(a) - rank(b) || (a.child_order || 0) - (b.child_order || 0));
    function rank(p) { const c = projectRole.get(p.id); return c.kind === 'container' ? (c.name === 'POOL' ? 0 : 1) : c.kind === 'linked' ? 3 : c.kind === 'board' ? 4 : 9; }
    order.forEach(p => {
      const c = projectRole.get(p.id);
      if (c.kind === 'container') {
        liveSecs.filter(s => s.project_id === p.id).forEach(s => {
          const n = parseSectionName(s.name);
          if (n.board === CONFIG.board && n.list === CONFIG.list) { configSectionId = s.id; return; }
          const key = 's:' + s.id;
          const list = { key: key, title: n.list || s.name, board: n.board, projectId: p.id, sectionId: s.id, restricted: false, problem: n.ok ? null : n.problem };
          boardOf(n.board).lists.push(list); listsByKey.set(key, list); sectionToList.set(s.id, key);
        });
      } else if (c.kind === 'linked') {
        const key = 'p:' + p.id;
        const list = { key: key, title: c.list, board: c.board, projectId: p.id, sectionId: null, restricted: true, problem: null };
        boardOf(c.board).lists.push(list); listsByKey.set(key, list);
      } else if (c.kind === 'board') {
        const b = boardOf(c.board), rootKey = 'p:' + p.id;
        const rootList = { key: rootKey, title: 'No list', board: c.board, projectId: p.id, sectionId: null, restricted: false, problem: null, root: true };
        b.lists.push(rootList); listsByKey.set(rootKey, rootList);
        liveSecs.filter(s => s.project_id === p.id).forEach(s => {
          const key = 's:' + s.id;
          const list = { key: key, title: s.name, board: c.board, projectId: p.id, sectionId: s.id, restricted: false, problem: null };
          b.lists.push(list); listsByKey.set(key, list); sectionToList.set(s.id, key);
        });
      }
    });
    let boardList = [...boards.values()];
    const wanted = layout && Array.isArray(layout.boardOrder) ? layout.boardOrder : null;
    boardList.sort((a, b) => {
      const ia = wanted ? wanted.indexOf(a.name) : -1, ib = wanted ? wanted.indexOf(b.name) : -1;
      if (ia !== ib) return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib);
      if (a.name === UNSORTED || b.name === UNSORTED) return a.name === UNSORTED ? 1 : -1;
      return a.firstSeen - b.firstSeen;
    });
    return { boards: boardList, listsByKey: listsByKey, sectionToList: sectionToList, projectRole: projectRole,
      inboxProjectId: inboxProjectId, containerIds: containerIds, poolProjectId: containerIds.find(id => projectRole.get(id).name === 'POOL') || null, configSectionId: configSectionId };
  }

  // Where a Todoist task belongs: {view:'inbox'} | {view:'config'} | {listKey}
  function placeTask(t, s) {
    const role = s.projectRole.get(t.project_id);
    if (!role) return { view: 'hidden' };
    if (t.section_id && t.section_id === s.configSectionId) return { view: 'config' };
    if (role.kind === 'inbox') return { view: 'inbox' };
    if (role.kind === 'container') return t.section_id && s.sectionToList.has(t.section_id) ? { listKey: s.sectionToList.get(t.section_id) } : { view: 'inbox' };
    if (role.kind === 'linked') return { listKey: 'p:' + t.project_id };
    if (t.section_id && s.sectionToList.has(t.section_id)) return { listKey: s.sectionToList.get(t.section_id) };
    return { listKey: 'p:' + t.project_id };
  }

  /* ---------- repeats ---------- */

  // Todoist due.string -> {freq, interval, days?, monthDay?, time?} or null if not understood
  function parseRepeat(str, lang) {
    if (lang && lang !== 'en') return null;
    let s = String(str || '').toLowerCase().trim().replace(/^every!/, 'every').replace(/\s+/g, ' ');
    let time = null;
    const tm = /\s(?:at|@)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(s);
    if (tm) {
      let h = +tm[1]; const mi = +(tm[2] || 0);
      if (tm[3]) { h = h % 12; if (tm[3] === 'pm') h += 12; }
      if (h > 23 || mi > 59) return null;
      time = h * 60 + mi; s = s.slice(0, tm.index).trim();
    }
    let m;
    const out = r => (time != null ? Object.assign(r, { time: time }) : r);
    const NTH = { '1st': 1, first: 1, '2nd': 2, second: 2, '3rd': 3, third: 3, '4th': 4, fourth: 4, last: -1 };
    s = s.replace(/^every other /, 'every 2 ');
    if (s === 'every 2 day') s = 'every 2 days';
    if (s === 'every 2 week') s = 'every 2 weeks';
    if (s === 'every 2 month') s = 'every 2 months';
    if (s === 'every 2 year') s = 'every 2 years';
    if (s === 'every weekend') return out({ freq: 'weekly', interval: 1, days: [5, 6] });
    if (s === 'every year' || s === 'yearly' || s === 'every 1 year') return out({ freq: 'yearly', interval: 1 });
    if ((m = /^every (\d+) years?$/.exec(s))) return out({ freq: 'yearly', interval: +m[1] });
    if ((m = /^every (1st|2nd|3rd|4th|first|second|third|fourth|last) (\w+)(?: of the month)?$/.exec(s)) && DAYMAP[m[2]] != null)
      return out({ freq: 'monthly', interval: 1, nth: NTH[m[1]], weekday: DAYMAP[m[2]] });
    if (s === 'every last day' || s === 'every last day of the month') return out({ freq: 'monthly', interval: 1, monthDay: -1 });
    if (s === 'every day' || s === 'daily' || s === 'every 1 day') return out({ freq: 'daily', interval: 1 });
    if ((m = /^every (\d+) days?$/.exec(s))) return out({ freq: 'daily', interval: +m[1] });
    if (s === 'every weekday' || s === 'every workday') return out({ freq: 'weekdays', interval: 1 });
    if (s === 'every week' || s === 'weekly') return out({ freq: 'weekly', interval: 1 });
    if ((m = /^every (\d+) weeks?$/.exec(s))) return out({ freq: 'weekly', interval: +m[1] });
    if (s === 'every month' || s === 'monthly') return out({ freq: 'monthly', interval: 1 });
    if ((m = /^every (\d+) months?$/.exec(s))) return out({ freq: 'monthly', interval: +m[1] });
    if ((m = /^every (\d{1,2})(?:st|nd|rd|th)$/.exec(s)) && +m[1] >= 1 && +m[1] <= 31) return out({ freq: 'monthly', interval: 1, monthDay: +m[1] });
    if ((m = /^every (.+)$/.exec(s))) {
      const parts = m[1].split(/\s*,\s*|\s+and\s+/).filter(Boolean);
      const days = parts.map(p => DAYMAP[p]);
      if (parts.length && days.every(d => d != null)) return out({ freq: 'weekly', interval: 1, days: [...new Set(days)].sort((a, b) => a - b) });
    }
    return null;
  }

  // planner repeat -> Todoist due string
  function repeatString(r, time) {
    const iv = r.interval || 1;
    let s;
    if (r.freq === 'daily') s = iv > 1 ? 'every ' + iv + ' days' : 'every day';
    else if (r.freq === 'weekdays') s = 'every weekday';
    else if (r.freq === 'weekly') s = r.days && r.days.length === 2 && r.days[0] === 5 && r.days[1] === 6 && iv === 1 ? 'every weekend' : r.days && r.days.length && iv === 1 ? 'every ' + r.days.map(d => DAYS[d]).join(', ') : (iv > 1 ? 'every ' + iv + ' weeks' : 'every week');
    else if (r.freq === 'monthly' && r.nth) s = 'every ' + (r.nth === -1 ? 'last' : ordinal(r.nth)) + ' ' + DAYS[r.weekday];
    else if (r.freq === 'monthly') s = r.monthDay === -1 ? 'every last day' : r.monthDay && iv === 1 ? 'every ' + ordinal(r.monthDay) : (iv > 1 ? 'every ' + iv + ' months' : 'every month');
    else if (r.freq === 'yearly') s = iv > 1 ? 'every ' + iv + ' years' : 'every year';
    else return null;
    return time != null ? s + ' at ' + hm(time) : s;
  }
  function ordinal(n) { const v = n % 100; return n + ((v >= 11 && v <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')); }

  /* ---------- tasks ---------- */

  // Todoist item -> planner task
  function fromTodoist(t, s) {
    const place = placeTask(t, s);
    const list = place.listKey ? s.listsByKey.get(place.listKey) : null;
    const task = {
      id: t.id, title: t.content || '', notes: t.description || '',
      priority: 5 - (t.priority || 1), labels: (t.labels || []).slice(),
      parentId: t.parent_id || '', order: t.child_order || 0, done: !!t.checked,
      view: place.view || null, listKey: place.listKey || null, board: list ? list.board : null,
      restricted: !!(list && list.restricted),
      deadline: t.deadline && t.deadline.date ? t.deadline.date : '',
      day: '', days: 1, time: null, dur: null, durDefault: false, repeat: null, repeatString: '', repeatRaw: null, repeatEditable: true
    };
    const d = t.due;
    if (d && d.date) {
      const dm = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?/.exec(d.date);
      if (dm) {
        task.day = dm[1];
        if (dm[2] != null) {
          task.time = +dm[2] * 60 + +dm[3];
          if (d.date.endsWith('Z')) task.timeIsUtc = true;
        }
      }
      if (d.is_recurring) {
        const r = parseRepeat(d.string, d.lang);
        task.repeatString = d.string || '';
        if (r) { const rr = Object.assign({}, r); delete rr.time; task.repeat = rr; if (task.time == null && r.time != null) task.time = r.time; }
        else { task.repeat = { freq: 'custom', text: d.string || '' }; task.repeatRaw = d.string || 'repeating'; task.repeatEditable = false; }
      }
    }
    if (t.duration && t.duration.unit === 'day' && t.duration.amount > 0 && task.time == null) task.days = t.duration.amount;
    else if (t.duration && t.duration.unit === 'minute' && t.duration.amount > 0) task.dur = t.duration.amount;
    else if (task.time != null) { task.dur = 60; task.durDefault = true; }
    return task;
  }

  // Which Todoist commands turn task `before` into `after`. Returns {commands, refused}.
  // Commands follow the Sync API: item_add, item_update, item_move, item_close, item_uncomplete, item_delete.
  function diffTask(before, after, s, uuid) {
    const cmds = [], refused = [];
    const id = (after || before).id;
    const mk = (type, args) => cmds.push({ type: type, uuid: uuid(), args: args });
    if (!before) { // new task
      const where = target(after, s);
      if (!where) { refused.push('no-target'); return { commands: cmds, refused: refused }; }
      const args = Object.assign({ content: after.title, description: after.notes || '', priority: 5 - (after.priority || 4), labels: after.labels || [] }, where);
      if (after.parentId) { args.parent_id = after.parentId; delete args.project_id; delete args.section_id; }
      const due = dueOf(after); if (due !== undefined) args.due = due;
      if (after.time != null && after.dur && !after.durDefault) args.duration = { amount: after.dur, unit: 'minute' };
      else if (after.time == null && after.day && (after.days || 1) > 1) args.duration = { amount: after.days, unit: 'day' };
      cmds.push({ type: 'item_add', uuid: uuid(), temp_id: after.id, args: args });
      return { commands: cmds, refused: refused };
    }
    if (!after) { mk('item_delete', { id: id }); return { commands: cmds, refused: refused }; }
    // fields
    const upd = {};
    if (after.title !== before.title) upd.content = after.title;
    if ((after.notes || '') !== (before.notes || '')) upd.description = after.notes || '';
    if ((after.priority || 4) !== (before.priority || 4)) upd.priority = 5 - (after.priority || 4);
    if (JSON.stringify(after.labels || []) !== JSON.stringify(before.labels || [])) upd.labels = after.labels || [];
    const whenChanged = after.day !== before.day || after.time !== before.time || JSON.stringify(after.repeat) !== JSON.stringify(before.repeat);
    if (whenChanged) {
      const samePattern = !!after.repeat && JSON.stringify(after.repeat) === JSON.stringify(before.repeat) && !!before.repeatString;
      // Same pattern, new date or time: move this occurrence and keep the pattern, as Todoist's reschedule does.
      if (samePattern) upd.due = { date: after.time != null ? after.day + 'T' + hm(after.time) + ':00' : after.day, string: before.repeatString, is_recurring: true };
      else { const due = dueOf(after); if (due !== undefined) upd.due = due; }
    }
    const durChanged = after.dur !== before.dur && !(after.durDefault && before.durDefault);
    const aDays = after.time == null && after.day ? (after.days || 1) : 1, bDays = before.time == null && before.day ? (before.days || 1) : 1;
    if (after.time != null && durChanged && !after.durDefault) upd.duration = { amount: after.dur, unit: 'minute' };
    else if (after.time == null && aDays > 1 && (aDays !== bDays || before.time != null)) upd.duration = { amount: aDays, unit: 'day' };
    else if ((after.time == null && before.time != null) || (aDays === 1 && bDays > 1) || (!after.day && !after.repeat && (before.dur || bDays > 1))) upd.duration = null;
    if (Object.keys(upd).length) mk('item_update', Object.assign({ id: id }, upd));
    // place
    if (after.parentId !== before.parentId && after.parentId) mk('item_move', { id: id, parent_id: after.parentId });
    else if (after.listKey !== before.listKey || after.view !== before.view || (before.parentId && !after.parentId)) {
      const fromList = before.listKey ? s.listsByKey.get(before.listKey) : null, toList = after.listKey ? s.listsByKey.get(after.listKey) : null;
      if ((fromList && fromList.restricted) || (toList && toList.restricted)) refused.push('restricted-move');
      else { const where = target(after, s); if (where) mk('item_move', where.section_id ? { id: id, section_id: where.section_id } : { id: id, project_id: where.project_id }); }
    }
    // completion last, so edits land first
    if (after.done !== before.done) mk(after.done ? 'item_close' : 'item_uncomplete', { id: id });
    return { commands: cmds, refused: refused };
  }

  function target(task, s) {
    if (task.listKey) {
      const l = s.listsByKey.get(task.listKey);
      if (!l) return null;
      return l.sectionId ? { project_id: l.projectId, section_id: l.sectionId } : { project_id: l.projectId };
    }
    if (task.view === 'inbox' && s.inboxProjectId) return { project_id: s.inboxProjectId };
    return null;
  }

  // planner date/time/repeat -> Todoist due (null clears it, undefined leaves it)
  function dueOf(t) {
    if (!t.day && !t.repeat) return null;
    if (t.repeat && t.repeat.freq === 'custom') {
      // Typed by the user as in Todoist; Todoist interprets it.
      const txt = String(t.repeat.text || '').trim();
      if (!txt) return undefined;
      const withTime = t.time != null && !/\s(at|@)\s/i.test(txt) ? txt + ' at ' + hm(t.time) : txt;
      return t.day ? { string: withTime + ' starting ' + t.day } : { string: withTime };
    }
    if (t.repeat) {
      const str = repeatString(t.repeat, t.time);
      if (!str) return undefined;
      return t.day ? { string: str + ' starting ' + t.day } : { string: str };
    }
    if (t.time != null) return { date: t.day + 'T' + hm(t.time) + ':00' };
    return { date: t.day };
  }

  /* ---------- order ---------- */

  // Order inside one Todoist list: written to Todoist. ids = task ids of the list, top to bottom.
  function reorderCommands(ids, uuid) {
    if (!ids || !ids.length) return [];
    return [{ type: 'item_reorder', uuid: uuid(), args: { items: ids.map((id, i) => ({ id: id, child_order: i + 1 })) } }];
  }

  // Order in views that mix lists (Today, a day in Upcoming, a label): kept in the "Order" setting.
  // orders: {viewKey: [taskId, ...]}. Returns the ids sorted, unknown ones after, in their given order.
  function applyViewOrder(viewKey, ids, orders) {
    const want = (orders && orders[viewKey]) || [];
    const pos = new Map(want.map((id, i) => [id, i]));
    return ids.map((id, i) => [id, pos.has(id) ? pos.get(id) : 1e9 + i]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
  }
  function setViewOrder(viewKey, ids, orders, existing) {
    const next = Object.assign({}, orders || {});
    next[viewKey] = ids.slice();
    // forget tasks that no longer exist, so the setting stays small
    if (existing) Object.keys(next).forEach(k => { next[k] = next[k].filter(id => existing.has(id)); if (!next[k].length) delete next[k]; });
    return next;
  }

  /* ---------- lists ---------- */

  // Commands to create, rename or delete a list. Board is the planner board name; title the list title.
  function listCommands(op, s, uuid, a) {
    if (op === 'add') {
      const chk = checkListTitle(a.title);
      if (!chk.ok) return { commands: [], refused: ['title-' + chk.problem], suggestion: chk.suggestion };
      const proj = a.projectId || s.poolProjectId;
      if (!proj) return { commands: [], refused: ['no-pool-project'] };
      const role = s.projectRole.get(proj);
      const name = role && role.kind === 'board' ? a.title : sectionName(a.board, a.title);
      return { commands: [{ type: 'section_add', uuid: uuid(), temp_id: a.tempId, args: { name: name, project_id: proj } }], refused: [] };
    }
    const l = s.listsByKey.get(a.key);
    if (!l || !l.sectionId) return { commands: [], refused: ['not-a-section'] };
    if (op === 'rename') {
      const chk = checkListTitle(a.title);
      if (!chk.ok) return { commands: [], refused: ['title-' + chk.problem], suggestion: chk.suggestion };
      const role = s.projectRole.get(l.projectId);
      const name = role && role.kind === 'board' ? a.title : sectionName(a.board || l.board, a.title);
      return { commands: [{ type: 'section_update', uuid: uuid(), args: { id: l.sectionId, name: name } }], refused: [] };
    }
    if (op === 'delete') return { commands: [{ type: 'section_delete', uuid: uuid(), args: { id: l.sectionId } }], refused: [] };
    return { commands: [], refused: ['unknown-op'] };
  }

  // Renaming a board renames every POOL/MUSIC section that carries it.
  function renameBoardCommands(s, uuid, oldName, newName) {
    if (!newName.split(/\s+/).every(isCapsWord)) return { commands: [], refused: ['board-not-caps'] };
    const b = s.boards.find(x => x.name === oldName);
    if (!b) return { commands: [], refused: ['no-board'] };
    const cmds = b.lists.filter(l => l.sectionId && s.projectRole.get(l.projectId).kind === 'container')
      .map(l => ({ type: 'section_update', uuid: uuid(), args: { id: l.sectionId, name: sectionName(newName, l.title) } }));
    const skipped = b.lists.filter(l => !(l.sectionId && s.projectRole.get(l.projectId).kind === 'container')).length;
    return { commands: cmds, refused: skipped ? ['some-lists-live-elsewhere'] : [] };
  }

  /* ---------- settings ---------- */

  const SETTINGS = ['Zones', 'Zone grid', 'Rules', 'Sorting', 'Layout', 'Order'];

  function readSettings(items, s) {
    const out = {}, ids = {}, seen = {};
    (items || []).forEach(t => {
      if (t.is_deleted || t.checked || t.section_id !== s.configSectionId || !SETTINGS.includes(t.content)) return;
      // if a setting exists twice, the most recently changed one wins
      const stamp = String(t.updated_at || t.added_at || '');
      if (ids[t.content] && stamp < (seen[t.content] || '')) return;
      seen[t.content] = stamp;
      ids[t.content] = t.id;
      try { out[t.content] = JSON.parse(t.description || 'null'); } catch (e) { out[t.content] = null; }
    });
    return { values: out, ids: ids };
  }

  function writeSetting(name, value, s, ids, uuid, tempId) {
    const description = JSON.stringify(value);
    if (ids[name]) return { type: 'item_update', uuid: uuid(), args: { id: ids[name], description: description } };
    return { type: 'item_add', uuid: uuid(), temp_id: tempId, args: { content: name, description: description, project_id: s.poolProjectId, section_id: s.configSectionId } };
  }

  const api = { parseSectionName, sectionName, checkListTitle, parseLinkedProject, classifyProject, buildStructure, placeTask,
    parseRepeat, repeatString, fromTodoist, diffTask, dueOf, reorderCommands, applyViewOrder, setViewOrder, listCommands, renameBoardCommands, readSettings, writeSetting, SETTINGS, CONFIG, UNSORTED };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PPMap = api;
})(typeof window !== 'undefined' ? window : this);
