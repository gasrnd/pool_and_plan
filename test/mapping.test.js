// Run: node test/mapping.test.js   (made-up sample data only)
const assert = require('assert');
const M = require('../todoist-mapping.js');
let n = 0; const t = (name, fn) => { fn(); n++; };
let u = 0; const uuid = () => 'u' + (++u);

t('section names', () => {
  assert.deepStrictEqual(M.parseSectionName('ADMIN Tasks'), { board: 'ADMIN', list: 'Tasks', ok: true });
  assert.deepStrictEqual(M.parseSectionName('SELF GROWING Reading list'), { board: 'SELF GROWING', list: 'Reading list', ok: true });
  assert.deepStrictEqual(M.parseSectionName('ADMIN Buy & Sell'), { board: 'ADMIN', list: 'Buy & Sell', ok: true });
  assert.strictEqual(M.parseSectionName('ADMIN PROJECTS').problem, 'no-list-title');
  assert.strictEqual(M.parseSectionName('Loose ideas').board, M.UNSORTED);
  assert.strictEqual(M.checkListTitle('Projects').ok, true);
  assert.deepStrictEqual(M.checkListTitle('PROJECTS'), { ok: false, problem: 'caps', suggestion: 'Projects' });
  assert.strictEqual(M.checkListTitle('A list').ok, true);
});

t('projects', () => {
  assert.deepStrictEqual(M.classifyProject({ name: 'ADMIN_LCDLS' }), { kind: 'linked', board: 'ADMIN', list: 'LCDLS' });
  assert.deepStrictEqual(M.classifyProject({ name: 'POOL' }), { kind: 'container', name: 'POOL' });
  assert.deepStrictEqual(M.classifyProject({ name: 'MUSIC' }), { kind: 'container', name: 'MUSIC' });
  assert.deepStrictEqual(M.classifyProject({ name: 'Inbox', inbox_project: true }), { kind: 'inbox' });
  assert.deepStrictEqual(M.classifyProject({ name: 'Holidays' }), { kind: 'board', board: 'Holidays' });
});

const projects = [
  { id: 'P0', name: 'Inbox', inbox_project: true },
  { id: 'P1', name: 'POOL', child_order: 1 },
  { id: 'P2', name: 'MUSIC', child_order: 2 },
  { id: 'P3', name: 'ADMIN_LCDLS', shared: true, child_order: 3 },
  { id: 'P4', name: 'Holidays', child_order: 4 },
  { id: 'P5', name: 'Old', is_archived: true }];
const sections = [
  { id: 'S1', project_id: 'P1', name: 'ADMIN Tasks', section_order: 1 },
  { id: 'S2', project_id: 'P1', name: 'ADMIN Buy & Sell', section_order: 2 },
  { id: 'S3', project_id: 'P1', name: 'CREATIVE Ideas', section_order: 3 },
  { id: 'S4', project_id: 'P1', name: 'NOTES Config', section_order: 4 },
  { id: 'S5', project_id: 'P1', name: 'stray section', section_order: 5 },
  { id: 'S6', project_id: 'P2', name: 'MUSIC Albums', section_order: 1 },
  { id: 'S7', project_id: 'P4', name: 'Packing', section_order: 1 },
  { id: 'S8', project_id: 'P1', name: 'ADMIN Gone', is_deleted: true }];
const S = M.buildStructure(projects, sections);

t('structure', () => {
  assert.deepStrictEqual(S.boards.map(b => b.name), ['ADMIN', 'CREATIVE', 'MUSIC', 'Holidays', M.UNSORTED]);
  const admin = S.boards.find(b => b.name === 'ADMIN');
  assert.deepStrictEqual(admin.lists.map(l => l.title), ['Tasks', 'Buy & Sell', 'LCDLS']);
  assert.strictEqual(admin.lists[2].restricted, true);
  assert.strictEqual(S.configSectionId, 'S4');
  assert.strictEqual(S.poolProjectId, 'P1');
  assert.ok(!S.boards.some(b => b.name === 'NOTES'));
  const hol = S.boards.find(b => b.name === 'Holidays');
  assert.deepStrictEqual(hol.lists.map(l => l.title), ['No list', 'Packing']);
  const ordered = M.buildStructure(projects, sections, { boardOrder: ['CREATIVE', 'ADMIN'] });
  assert.deepStrictEqual(ordered.boards.slice(0, 2).map(b => b.name), ['CREATIVE', 'ADMIN']);
});

t('placing tasks', () => {
  assert.deepStrictEqual(M.placeTask({ project_id: 'P1', section_id: 'S1' }, S), { listKey: 's:S1' });
  assert.deepStrictEqual(M.placeTask({ project_id: 'P1', section_id: null }, S), { view: 'inbox' });
  assert.deepStrictEqual(M.placeTask({ project_id: 'P0' }, S), { view: 'inbox' });
  assert.deepStrictEqual(M.placeTask({ project_id: 'P1', section_id: 'S4' }, S), { view: 'config' });
  assert.deepStrictEqual(M.placeTask({ project_id: 'P3', section_id: 'X' }, S), { listKey: 'p:P3' });
  assert.deepStrictEqual(M.placeTask({ project_id: 'P4' }, S), { listKey: 'p:P4' });
  assert.deepStrictEqual(M.placeTask({ project_id: 'P2', section_id: 'S6' }, S), { listKey: 's:S6' });
});

t('repeats', () => {
  assert.deepStrictEqual(M.parseRepeat('every day'), { freq: 'daily', interval: 1 });
  assert.deepStrictEqual(M.parseRepeat('every 3 days at 7pm'), { freq: 'daily', interval: 3, time: 1140 });
  assert.deepStrictEqual(M.parseRepeat('every! weekday'), { freq: 'weekdays', interval: 1 });
  assert.deepStrictEqual(M.parseRepeat('every mon, wed, fri at 07:00'), { freq: 'weekly', interval: 1, days: [0, 2, 4], time: 420 });
  assert.deepStrictEqual(M.parseRepeat('every Monday'), { freq: 'weekly', interval: 1, days: [0] });
  assert.deepStrictEqual(M.parseRepeat('every 2 weeks'), { freq: 'weekly', interval: 2 });
  assert.deepStrictEqual(M.parseRepeat('every 15th'), { freq: 'monthly', interval: 1, monthDay: 15 });
  assert.strictEqual(M.parseRepeat('every 3rd friday'), null);
  assert.strictEqual(M.parseRepeat('cada lunes', 'es'), null);
  assert.strictEqual(M.repeatString({ freq: 'weekly', interval: 1, days: [0, 2] }, 420), 'every mon, wed at 07:00');
  assert.strictEqual(M.repeatString({ freq: 'monthly', interval: 1, monthDay: 1 }), 'every 1st');
  assert.strictEqual(M.repeatString({ freq: 'daily', interval: 2 }), 'every 2 days');
  for (const s of ['every day', 'every weekday', 'every mon, wed, fri at 07:00', 'every 2 weeks', 'every 15th', 'every 3 months at 09:30'])
    assert.strictEqual(M.repeatString(M.parseRepeat(s), M.parseRepeat(s).time), s, 'round trip ' + s);
});

const item = o => Object.assign({ id: 'T1', project_id: 'P1', section_id: 'S1', content: 'Call bank', description: '', priority: 1, labels: [], parent_id: null, child_order: 3, checked: false, due: null, duration: null, deadline: null }, o);

t('reading tasks', () => {
  let x = M.fromTodoist(item({ priority: 4, labels: ['errand'] }), S);
  assert.strictEqual(x.priority, 1); assert.deepStrictEqual(x.labels, ['errand']); assert.strictEqual(x.listKey, 's:S1'); assert.strictEqual(x.board, 'ADMIN');
  x = M.fromTodoist(item({ due: { date: '2026-11-21', is_recurring: false, string: 'Nov 21' } }), S);
  assert.strictEqual(x.day, '2026-11-21'); assert.strictEqual(x.time, null); assert.strictEqual(x.days, 1);
  x = M.fromTodoist(item({ due: { date: '2026-11-21T15:30:00', is_recurring: false }, duration: { amount: 90, unit: 'minute' } }), S);
  assert.strictEqual(x.time, 930); assert.strictEqual(x.dur, 90); assert.strictEqual(x.durDefault, false);
  x = M.fromTodoist(item({ due: { date: '2026-11-21T15:30:00' } }), S);
  assert.strictEqual(x.dur, 60); assert.strictEqual(x.durDefault, true);
  x = M.fromTodoist(item({ due: { date: '2026-11-23', is_recurring: true, string: 'every mon, wed', lang: 'en' } }), S);
  assert.deepStrictEqual(x.repeat, { freq: 'weekly', interval: 1, days: [0, 2] });
  x = M.fromTodoist(item({ due: { date: '2026-11-27', is_recurring: true, string: 'every last friday', lang: 'en' } }), S);
  assert.strictEqual(x.repeat, null); assert.strictEqual(x.repeatRaw, 'every last friday'); assert.strictEqual(x.repeatEditable, false);
  x = M.fromTodoist(item({ due: { date: '2026-12-01' }, duration: { amount: 3, unit: 'day' } }), S);
  assert.strictEqual(x.days, 3); assert.strictEqual(x.dur, null);
  x = M.fromTodoist(item({ project_id: 'P3', section_id: null, deadline: { date: '2026-12-15' } }), S);
  assert.strictEqual(x.restricted, true); assert.strictEqual(x.deadline, '2026-12-15');
});

const base = () => M.fromTodoist(item({}), S);
const types = r => r.commands.map(c => c.type);

t('writing tasks', () => {
  let b = base(), a = Object.assign({}, b, { title: 'Call the bank', priority: 2, labels: ['phone'] });
  let r = M.diffTask(b, a, S, uuid);
  assert.deepStrictEqual(types(r), ['item_update']);
  assert.deepStrictEqual(r.commands[0].args, { id: 'T1', content: 'Call the bank', priority: 3, labels: ['phone'] });
  // timed block with duration
  a = Object.assign({}, b, { day: '2026-11-21', time: 600, dur: 45 });
  r = M.diffTask(b, a, S, uuid);
  assert.deepStrictEqual(r.commands[0].args, { id: 'T1', due: { date: '2026-11-21T10:00:00' }, duration: { amount: 45, unit: 'minute' } });
  // clearing the time keeps the day and removes the duration
  const timed = Object.assign({}, b, { day: '2026-11-21', time: 600, dur: 45 });
  r = M.diffTask(timed, Object.assign({}, timed, { time: null, dur: null }), S, uuid);
  assert.deepStrictEqual(r.commands[0].args, { id: 'T1', due: { date: '2026-11-21' }, duration: null });
  // repeat by day
  r = M.diffTask(b, Object.assign({}, b, { day: '2026-11-23', repeat: { freq: 'weekly', interval: 1, days: [0] } }), S, uuid);
  assert.deepStrictEqual(r.commands[0].args.due, { string: 'every mon starting 2026-11-23' });
  // repeat with a time
  r = M.diffTask(b, Object.assign({}, b, { day: '2026-11-23', time: 420, dur: 60, repeat: { freq: 'weekly', interval: 1, days: [0, 2, 4] } }), S, uuid);
  assert.deepStrictEqual(r.commands[0].args.due, { string: 'every mon, wed, fri at 07:00 starting 2026-11-23' });
  // remove the date entirely
  const dated = Object.assign({}, b, { day: '2026-11-21' });
  r = M.diffTask(dated, Object.assign({}, dated, { day: '' }), S, uuid);
  assert.deepStrictEqual(r.commands[0].args.due, null);
  // multi-day without a time
  r = M.diffTask(dated, Object.assign({}, dated, { days: 3 }), S, uuid);
  assert.deepStrictEqual(r.commands[0].args, { id: 'T1', duration: { amount: 3, unit: 'day' } });
  const multi = Object.assign({}, dated, { days: 3 });
  r = M.diffTask(multi, Object.assign({}, multi, { days: 1 }), S, uuid);
  assert.deepStrictEqual(r.commands[0].args, { id: 'T1', duration: null });
  r = M.diffTask(multi, Object.assign({}, multi, { time: 540, days: 1, dur: 60, durDefault: true }), S, uuid);
  assert.deepStrictEqual(r.commands[0].args, { id: 'T1', due: { date: '2026-11-21T09:00:00' }, duration: null });
  // completion after edits
  r = M.diffTask(b, Object.assign({}, b, { title: 'x', done: true }), S, uuid);
  assert.deepStrictEqual(types(r), ['item_update', 'item_close']);
  // moving between lists and to the inbox
  r = M.diffTask(b, Object.assign({}, b, { listKey: 's:S3' }), S, uuid);
  assert.deepStrictEqual(r.commands[0], { type: 'item_move', uuid: r.commands[0].uuid, args: { id: 'T1', section_id: 'S3' } });
  r = M.diffTask(b, Object.assign({}, b, { listKey: null, view: 'inbox' }), S, uuid);
  assert.deepStrictEqual(r.commands[0].args, { id: 'T1', project_id: 'P0' });
  // restricted list: no moving in or out, but editing works
  r = M.diffTask(b, Object.assign({}, b, { listKey: 'p:P3' }), S, uuid);
  assert.deepStrictEqual(r.commands, []); assert.deepStrictEqual(r.refused, ['restricted-move']);
  const lc = M.fromTodoist(item({ project_id: 'P3', section_id: null }), S);
  r = M.diffTask(lc, Object.assign({}, lc, { title: 'Renamed', done: true }), S, uuid);
  assert.deepStrictEqual(types(r), ['item_update', 'item_close']);
  // repeat Todoist wrote that the planner can't edit: date changes refused, ticking allowed
  const raw = M.fromTodoist(item({ due: { date: '2026-11-27', is_recurring: true, string: 'every last friday', lang: 'en' } }), S);
  r = M.diffTask(raw, Object.assign({}, raw, { day: '2026-11-28' }), S, uuid);
  assert.deepStrictEqual(r.refused, ['repeat-not-editable']); assert.deepStrictEqual(r.commands, []);
  r = M.diffTask(raw, Object.assign({}, raw, { done: true }), S, uuid);
  assert.deepStrictEqual(types(r), ['item_close']);
  // new task and new subtask
  r = M.diffTask(null, { id: 'tmp1', title: 'New', notes: '', priority: 1, labels: [], listKey: 's:S2', day: '2026-11-22', time: null, days: 2 }, S, uuid);
  assert.deepStrictEqual(r.commands[0].args, { content: 'New', description: '', priority: 4, labels: [], project_id: 'P1', section_id: 'S2', due: { date: '2026-11-22' }, duration: { amount: 2, unit: 'day' } });
  assert.strictEqual(r.commands[0].temp_id, 'tmp1');
  r = M.diffTask(null, { id: 'tmp2', title: 'Sub', priority: 4, labels: [], listKey: 's:S1', parentId: 'T1', day: '' }, S, uuid);
  assert.strictEqual(r.commands[0].args.parent_id, 'T1'); assert.ok(!('section_id' in r.commands[0].args)); assert.strictEqual(r.commands[0].args.due, null);
  // delete
  assert.deepStrictEqual(types(M.diffTask(b, null, S, uuid)), ['item_delete']);
});

t('lists and boards', () => {
  let r = M.listCommands('add', S, uuid, { board: 'ADMIN', title: 'Waiting', tempId: 'l1' });
  assert.deepStrictEqual(r.commands[0].args, { name: 'ADMIN Waiting', project_id: 'P1' });
  r = M.listCommands('add', S, uuid, { board: 'ADMIN', title: 'WAITING' });
  assert.deepStrictEqual(r.refused, ['title-caps']); assert.strictEqual(r.suggestion, 'Waiting');
  r = M.listCommands('add', S, uuid, { board: 'Holidays', title: 'Flights', projectId: 'P4' });
  assert.deepStrictEqual(r.commands[0].args, { name: 'Flights', project_id: 'P4' });
  r = M.listCommands('rename', S, uuid, { key: 's:S2', title: 'Sell' });
  assert.deepStrictEqual(r.commands[0].args, { id: 'S2', name: 'ADMIN Sell' });
  assert.deepStrictEqual(M.listCommands('rename', S, uuid, { key: 'p:P3', title: 'X' }).refused, ['not-a-section']);
  r = M.renameBoardCommands(S, uuid, 'ADMIN', 'OFFICE');
  assert.deepStrictEqual(r.commands.map(c => c.args.name), ['OFFICE Tasks', 'OFFICE Buy & Sell']);
  assert.deepStrictEqual(r.refused, ['some-lists-live-elsewhere']);
  assert.deepStrictEqual(M.renameBoardCommands(S, uuid, 'ADMIN', 'Office').refused, ['board-not-caps']);
});

t('settings', () => {
  const items = [
    { id: 'C1', section_id: 'S4', content: 'Zones', description: '[{"name":"Deep work","color":1}]' },
    { id: 'C2', section_id: 'S4', content: 'Sorting', description: 'not json' },
    { id: 'C3', section_id: 'S1', content: 'Zones', description: '[]' }];
  const r = M.readSettings(items, S);
  assert.deepStrictEqual(r.values, { Zones: [{ name: 'Deep work', color: 1 }], Sorting: null });
  assert.deepStrictEqual(r.ids, { Zones: 'C1', Sorting: 'C2' });
  assert.deepStrictEqual(M.writeSetting('Zones', [], S, r.ids, uuid).args, { id: 'C1', description: '[]' });
  assert.deepStrictEqual(M.writeSetting('Rules', [], S, r.ids, uuid, 'tmpR').args, { content: 'Rules', description: '[]', project_id: 'P1', section_id: 'S4' });
});

console.log(n + ' groups passed');
