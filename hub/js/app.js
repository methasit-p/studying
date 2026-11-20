window.__shPart1 = true;

/* Show a readable message instead of an endless spinner if anything goes wrong while loading. */
window.addEventListener('error', function (e) {
  var m = document.getElementById('main');
  if (m && !(window.S && S.data)) m.innerHTML = '<div class="panel empty-state"><h3>Study Hub hit an error<\/h3><p>' + String(e.message).replace(/[<]/g, '&' + 'lt;') + ' (line ' + e.lineno + ')<\/p><\/div>';
});
setTimeout(function () {
  if (!(window.S && S.data) && window.shApi && shApi.configured() && !document.getElementById('connectForm')) document.getElementById('main').innerHTML = '<div class="panel empty-state"><h3>Still waiting for your data<\/h3><p>Open Executions in the Apps Script editor to see what went wrong, then reload this page.<\/p><p><button class="btn" onclick="shApi.showConnect()">Check the connection<\/button><\/p><\/div>';
}, 45000);
/* ================= State & server bridge ================= */
const S = { data: null, view: 'dashboard', subjectId: null, typeFilter: 'All', courses: null, files: {}, allFilter: { subject: '', type: '', status: 'open', q: '' } };
const TYPES = ['Homework', 'Project', 'Group Project'];
const COLORS = ['#2B50D6', '#C8102E', '#0F8A5F', '#E07A00', '#7B3FD1', '#0B8FA8', '#C2185B', '#6B7A1F', '#5A4636', '#3E4A61'];

/* On GitHub Pages there is no google.script.run: shApi (js/api.js) posts to the Apps Script web app instead. */
function call(fn, ...args) {
  return shApi.call(fn, args);
}

async function act(fn, args, okMsg, btn) {
  const label = btn ? btn.innerHTML : null;
  if (btn) { btn.disabled = true; btn.textContent = 'Working\u2026'; }
  try {
    const res = await call(fn, ...args);
    if (res && res.subjects) S.data = res;
    else if (res && res.data) S.data = res.data;
    render();
    if (okMsg) toast(typeof okMsg === 'function' ? okMsg(res) : okMsg);
    return res;
  } catch (e) {
    toast(cleanErr(e), 'error');
    throw e;
  } finally {
    if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = label; }
  }
}

function cleanErr(e) { return String((e && e.message) || e).replace(/^Exception:\s*/, ''); }

/* ================= Helpers ================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&' + 'amp;', '<': '&' + 'lt;', '>': '&' + 'gt;', '"': '&' + 'quot;', "'": '&' + '#39;' }[c])); }
function subj(id) { return S.data.subjects.find(s => s.id === id); }
function colorOf(id) { const s = subj(id); return s ? s.color : '#888'; }
function isOpen(t) { return t.status !== 'Done' && t.status !== 'Dismissed'; }
function pd(s) { if (!s) return null; const d = new Date(s.length <= 10 ? s + 'T00:00' : s); return isNaN(d) ? null : d; }
function sod(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function dayDiff(d) { return Math.round((sod(d) - sod(new Date())) / 86400000); }
function fmt(d) {
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
function dueInfo(s) {
  const d = pd(s);
  if (!d) return { cls: 'none', text: 'No deadline', when: '' };
  const diff = dayDiff(d);
  let cls, text;
  if (d < new Date()) { cls = 'overdue'; text = diff === 0 ? 'was due earlier today' : diff === -1 ? 'was due yesterday' : 'overdue by ' + (-diff) + ' days'; }
  else if (diff === 0) { cls = 'today'; text = 'due today'; }
  else if (diff === 1) { cls = 'soon'; text = 'due tomorrow'; }
  else if (diff <= 3) { cls = 'soon'; text = 'due in ' + diff + ' days'; }
  else { cls = 'later'; text = 'due in ' + diff + ' days'; }
  return { cls, text, when: fmt(d), date: d };
}
function byDeadline(a, b) { return (a.deadline || '9999').localeCompare(b.deadline || '9999'); }
/** "#abc", "abc", "#AABBCC" \u2192 "#AABBCC"; anything else \u2192 null */
function normHex(v) {
  let h = String(v || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map(c => c + c).join('');
  return /^[0-9a-f]{6}$/i.test(h) ? '#' + h.toUpperCase() : null;
}
function slugType(t) { return t.toLowerCase().replace(/\s+/g, '-'); }

/** Every open deadline: whole tasks and their unfinished mini deadlines. */
function dueItems() {
  const out = [];
  S.data.tasks.filter(isOpen).forEach(t => {
    const d = pd(t.deadline);
    if (d) out.push({ kind: 'task', task: t, title: t.title, date: d, color: colorOf(t.subjectId) });
    (t.milestones || []).forEach(m => {
      const md = pd(m.dueDate);
      if (md && !m.done) out.push({ kind: 'mini', task: t, title: m.title, date: md, color: colorOf(t.subjectId), raw: m.dueDate });
    });
  });
  return out.sort((a, b) => a.date - b.date);
}

const I = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/><\/svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/><\/svg>',
  class: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4M8 12l2-3 2 2 3-4"/><\/svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/><\/svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/><\/svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/><\/svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/><\/svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/><\/svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><\/svg>',
  sync: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M3 21v-5h5"/><\/svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/><\/svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/><\/svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/><\/svg>',
  scale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/><\/svg>',
  pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/><\/svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/><path d="M9 7h7"/><\/svg>',
  music: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><\/svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/><\/svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/><\/svg>',
  next: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 6.2v11.6a.8.8 0 0 0 1.2.7l9-5.8a.8.8 0 0 0 0-1.4l-9-5.8a.8.8 0 0 0-1.2.7z"/><rect x="17" y="5" width="2.5" height="14" rx="1"/><\/svg>',
  prev: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.2v11.6a.8.8 0 0 1-1.2.7l-9-5.8a.8.8 0 0 1 0-1.4l9-5.8a.8.8 0 0 1 1.2.7z"/><rect x="4.5" y="5" width="2.5" height="14" rx="1"/><\/svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/><\/svg>',
  repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><\/svg>',
  vol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/><\/svg>',
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M22 9l-6 6M16 9l6 6"/><\/svg>',
  shrink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/><\/svg>',
  grow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/><\/svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/><\/svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/><\/svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/><\/svg>'
};

/* ================= Toasts & confirm ================= */
function toast(msg, kind) {
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' ' + kind : '');
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), kind === 'error' ? 7000 : 3500);
}

function openDialog(html) {
  const d = $('#dlg');
  d.innerHTML = html;
  if (!d.open) d.showModal();
  const first = $('input:not([type=radio]):not([type=checkbox]), select, textarea', d);
  if (first) first.focus();
  return d;
}
function closeDialog() { const d = $('#dlg'); if (d.open) d.close(); }

function confirmBox(title, message, okText, extraCheck) {
  return new Promise(resolve => {
    const d = openDialog(`
      <div class="dlg-head"><h3>${esc(title)}<\/h3><\/div>
      <div class="dlg-body"><p>${esc(message)}<\/p>
        ${extraCheck ? `<label class="check-line"><input type="checkbox" id="cfExtra"><span>${esc(extraCheck)}<\/span><\/label>` : ''}
      <\/div>
      <div class="dlg-foot"><div class="right">
        <button class="btn" id="cfNo">Cancel<\/button>
        <button class="btn primary" id="cfYes">${esc(okText)}<\/button>
      <\/div><\/div>`);
    $('#cfNo', d).onclick = () => { closeDialog(); resolve(null); };
    $('#cfYes', d).onclick = () => { const v = { extra: extraCheck ? $('#cfExtra', d).checked : false }; closeDialog(); resolve(v); };
    $('#cfYes', d).focus();
  });
}

/* ================= Rendering ================= */
function go(view, subjectId) {
  S.view = view;
  S.subjectId = subjectId || null;
  S.typeFilter = 'All';
  draft = null;
  $('#binder').classList.remove('open');
  render();
  window.scrollTo(0, 0);
  if (view === 'subject') loadFiles(subjectId);
}

function render() {
  if (!S.data) return;
  renderBinder();
  const main = $('#main');
  const ae = document.activeElement;
  const keep = ae && ae.id && main.contains(ae) && 'value' in ae ? { id: ae.id, v: ae.value } : null;
  if (S.view === 'subject' && !subj(S.subjectId)) S.view = 'dashboard';
  main.innerHTML = {
    dashboard: viewDashboard,
    subject: viewSubject,
    tasks: viewAllTasks,
    classrooms: () => viewClassrooms() + (S.data.classrooms.length && S.data.classroomAvailable ? filesPanel() : ''),
    settings: viewSettings,
    music: viewMusic,
    books: viewBooks,
    pdf: viewPdf,
    ru: viewRu
  }[S.view]();
  if (S.view === 'subject') wireDrop();
  if (S.view === 'music') wireMusic();
  if (S.view === 'books') wireBooks();
  if (S.view === 'pdf') wirePdf();
  if (S.view === 'ru' && S.ru.tab === 'planner') wireRetakes();
  { const tip = document.getElementById('bookTip'); if (tip && S.view !== 'books') tip.classList.add('hidden'); }
  if (keep) { const el = document.getElementById(keep.id); if (el) { if (el.tagName !== 'SELECT') el.value = keep.v; el.focus(); } }
  markNowPlaying();
}

function renderBinder() {
  const counts = {};
  S.data.tasks.filter(isOpen).forEach(t => { counts[t.subjectId] = (counts[t.subjectId] || 0) + 1; });
  const nav = (v, icon, label) => `<button class="${S.view === v ? 'active' : ''}" data-act="go" data-view="${v}">${icon}<span>${label}<\/span><\/button>`;
  $('#binder').innerHTML = `
    <div class="brand"><div class="brand-mark">S<\/div><h1>Study Hub<\/h1><\/div>
    ${binderTimer()}
    <nav class="nav">
      ${nav('dashboard', I.home, 'This week')}
      ${nav('tasks', I.list, 'All tasks')}
      ${nav('classrooms', I.class, 'Google Classroom')}
      ${nav('ru', I.scale, 'Ramkhamhaeng Hub')}
      ${nav('books', I.book, 'Bookstore')}
      ${nav('pdf', I.pdf, 'PDF tools')}
      ${nav('music', I.music, 'Study music')}
      ${nav('settings', I.gear, 'Email reminders')}
    <\/nav>
    <div>
      <div class="side-label"><span>Subjects<\/span><\/div>
      <div class="tabs">
        ${S.data.subjects.map(s => `
          <button class="tab ${S.view === 'subject' && S.subjectId === s.id ? 'active' : ''}" style="--c:${esc(s.color)}" data-act="go" data-view="subject" data-id="${s.id}">
            <span class="name">${esc(s.name)}<\/span><span class="count">${counts[s.id] || ''}<\/span>
          <\/button>`).join('')}
      <\/div>
    <\/div>
    <button class="add-subject" data-act="subject-new">+ Add subject<\/button>
    <div class="side-foot">
      <a href="${esc(S.data.dbUrl)}" target="_blank" rel="noopener">Open database sheet<\/a><br>
      <a href="${esc(S.data.rootFolderUrl)}" target="_blank" rel="noopener">Open Study Hub folder in Drive<\/a><br>
      <a href="../">Study timer<\/a><br>
      <button class="link-btn" data-act="api-disconnect">Disconnect this browser<\/button>
    <\/div>`;
}

function emptyNoSubjects() {
  return `<div class="panel empty-state">
    <h3>Start by adding your first subject<\/h3>
    <p>Each subject gets its own Google Drive folder, a place for the syllabus, and a list of homework and projects.<\/p>
    <button class="btn primary" data-act="subject-new">${I.plus} Add subject<\/button>
  <\/div>`;
}

/* ---------- This week (dashboard) ---------- */
function viewDashboard() {
  const now = new Date();
  const items = dueItems();
  const overdue = items.filter(it => it.date < now);
  const upcoming = items.filter(it => it.date >= now);
  const weekCount = upcoming.filter(it => dayDiff(it.date) < 7).length;
  const head = `<div class="page-head">
      <div><h2>${now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}<\/h2>
      <p>${S.data.subjects.length ? (weekCount ? `${weekCount} deadline${weekCount > 1 ? 's' : ''} in the next 7 days across ${S.data.subjects.length} subject${S.data.subjects.length > 1 ? 's' : ''}.` : 'Nothing due in the next 7 days.') : 'Welcome. Set up your subjects to get started.'}<\/p><\/div>
      <div class="head-actions">
        ${S.data.classrooms.length ? `<button class="btn" data-act="sync">${I.sync} Sync Classroom<\/button>` : ''}
        ${S.data.subjects.length ? `<button class="btn primary" data-act="task-new">${I.plus} Add task<\/button>` : ''}
      <\/div><\/div>`;
  if (!S.data.subjects.length) return head + emptyNoSubjects();

  const days = [...Array(7)].map((_, i) => { const d = sod(now); d.setDate(d.getDate() + i); return d; });
  const week = `<div class="week">${days.map((d, i) => {
    const list = upcoming.filter(it => dayDiff(it.date) === i);
    return `<div class="day ${i === 0 ? 'is-today' : ''}">
      <div class="day-head"><span class="dow">${i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short' })}<\/span><span class="dnum">${d.getDate()}<\/span><\/div>
      <ul>${list.length ? list.slice(0, 4).map(it => `<li style="--c:${esc(it.color)}" data-act="task-edit" data-id="${it.task.id}" title="${esc(it.title)}">${it.kind === 'mini' ? '\u21B3 ' : ''}${esc(it.title)}<\/li>`).join('') + (list.length > 4 ? `<li class="more">and ${list.length - 4} more<\/li>` : '') : '<li class="more">Free<\/li>'}<\/ul>
    <\/div>`;
  }).join('')}<\/div>`;

  const agendaRow = it => {
    const s = subj(it.task.subjectId);
    const di = dueInfo(it.kind === 'mini' ? it.raw : it.task.deadline);
    return `<li style="--c:${esc(it.color)}" data-act="task-edit" data-id="${it.task.id}">
      <span class="bar"><\/span>
      <div><div class="t">${esc(it.title)}<\/div><div class="m">${esc(s ? s.name : '')}, ${it.kind === 'mini' ? 'mini deadline for ' + esc(it.task.title) : esc(it.task.type.toLowerCase())}<\/div><\/div>
      <p class="due due-${di.cls}"><span class="mark">${di.when}<\/span><br><span>${di.text}<\/span><\/p>
    <\/li>`;
  };

  const overdueBox = overdue.length ? `<div class="panel overdue-box" style="margin-top:20px">
      <h3>Overdue (${overdue.length})<\/h3><p class="sub">Finish these or move their deadlines.<\/p>
      <ul class="agenda">${overdue.map(agendaRow).join('')}<\/ul><\/div>` : '';

  const next = upcoming.slice(0, 12);
  const noDeadline = S.data.tasks.filter(t => isOpen(t) && !t.deadline);
  return head + week + overdueBox + `
    <div class="grid-2" style="margin-top:20px">
      <div class="panel"><h3>Next up<\/h3><p class="sub">Deadlines and mini deadlines in order.<\/p>
        ${next.length ? `<ul class="agenda">${next.map(agendaRow).join('')}<\/ul>` : '<p class="muted">Nothing scheduled. Add a task with a deadline and it will show up here.<\/p>'}
      <\/div>
      <div>
        <div class="panel"><h3>Subjects<\/h3><p class="sub">Open tasks per subject.<\/p>
          <ul class="agenda">${S.data.subjects.map(s => {
            const open = S.data.tasks.filter(t => t.subjectId === s.id && isOpen(t)).length;
            return `<li style="--c:${esc(s.color)}" data-act="go" data-view="subject" data-id="${s.id}"><span class="bar"><\/span><div class="t">${esc(s.name)}<\/div><span class="muted">${open} open<\/span><\/li>`;
          }).join('')}<\/ul>
        <\/div>
        ${noDeadline.length ? `<div class="panel"><h3>Without a deadline<\/h3><p class="sub">Give these a date so reminders can catch them.<\/p>
          <ul class="agenda">${noDeadline.slice(0, 8).map(t => `<li style="--c:${esc(colorOf(t.subjectId))}" data-act="task-edit" data-id="${t.id}"><span class="bar"><\/span><div class="t">${esc(t.title)}<\/div><span class="muted">${esc(t.type)}<\/span><\/li>`).join('')}<\/ul><\/div>` : ''}
      <\/div>
    <\/div>`;
}

/* ---------- Task card ---------- */
function taskCard(t, showSubject) {
  const s = subj(t.subjectId);
  const done = t.status === 'Done';
  const di = dueInfo(t.deadline);
  const ms = t.milestones || [];
  const msDone = ms.filter(m => m.done).length;
  return `<article class="task ${done ? 'is-done' : ''}" style="--c:${esc(s ? s.color : '#888')}">
    <button class="check ${done ? 'on' : ''}" data-act="task-done" data-id="${t.id}" aria-label="${done ? 'Mark as not done' : 'Mark as done'}" title="${done ? 'Mark as not done' : 'Mark as done'}">${done ? I.check : ''}<\/button>
    <div>
      <div class="task-meta">
        ${showSubject && s ? `<span class="pill subj">${esc(s.name)}<\/span>` : ''}
        <span class="pill">${esc(t.type)}<\/span>
        ${t.source === 'classroom' ? '<span class="pill src">From Classroom<\/span>' : ''}
        ${t.status === 'In progress' ? '<span class="pill prog">In progress<\/span>' : ''}
        ${t.priority === 'High' && !done ? '<span class="pill hi">High priority<\/span>' : ''}
      <\/div>
      <h4 class="task-title">${esc(t.title)}<\/h4>
      ${done ? `<p class="due">Completed${t.completedAt ? ' ' + fmt(pd(t.completedAt)) : ''}<\/p>`
             : `<p class="due due-${di.cls}">${di.when ? `<span class="mark">${di.when}<\/span>, ` : ''}<span>${di.text}<\/span><\/p>`}
      ${t.type === 'Group Project' && t.members ? `<p class="members">With ${esc(t.members)}<\/p>` : ''}
      ${t.description && t.source !== 'classroom' ? `<p class="task-desc">${esc(t.description)}<\/p>` : ''}
      ${ms.length ? `<div class="minis">
        <div class="minis-head"><span>Mini deadlines ${msDone}/${ms.length}<\/span><span class="progress"><i style="width:${Math.round(msDone / ms.length * 100)}%"><\/i><\/span><\/div>
        <ul>${ms.map(m => { const mi = dueInfo(m.dueDate); return `<li class="${m.done ? 'done' : ''}">
          <label><input type="checkbox" data-change="mini" data-id="${m.id}" ${m.done ? 'checked' : ''}><span class="mini-title">${esc(m.title)}<\/span><\/label>
          <p class="due due-${m.done || done ? 'none' : mi.cls}">${mi.when ? `<span class="mark">${mi.when}<\/span>` : ''}<\/p><\/li>`; }).join('')}<\/ul>
      <\/div>` : ''}
    <\/div>
    <div class="task-actions">
      ${t.link ? `<a class="icon-btn" href="${esc(t.link)}" target="_blank" rel="noopener" title="Open link" aria-label="Open link">${I.link}<\/a>` : ''}
      <button class="icon-btn" data-act="task-edit" data-id="${t.id}" title="Edit" aria-label="Edit">${I.edit}<\/button>
      <button class="icon-btn" data-act="task-delete" data-id="${t.id}" title="${t.source === 'classroom' ? 'Hide' : 'Delete'}" aria-label="Delete">${I.trash}<\/button>
    <\/div>
  <\/article>`;
}

/* ---------- Subject page ---------- */
function viewSubject() {
  const s = subj(S.subjectId);
  const all = S.data.tasks.filter(t => t.subjectId === s.id && t.status !== 'Dismissed');
  const open = all.filter(isOpen).sort(byDeadline);
  const done = all.filter(t => t.status === 'Done').sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
  const f = S.typeFilter;
  const shown = f === 'Done' ? done : f === 'All' ? open : open.filter(t => t.type === f);
  const count = type => open.filter(t => t.type === type).length;
  const links = S.data.classrooms.filter(c => c.subjectId === s.id);
  const files = S.files[s.id];

  return `<div class="page-head">
      <div class="subject-head" style="--c:${esc(s.color)}">
        <h2>${esc(s.name)}<\/h2>
        <p>${open.length} open, ${done.length} done<\/p>
      <\/div>
      <div class="head-actions">
        <button class="btn" data-act="subject-edit" data-id="${s.id}">${I.edit} Edit subject<\/button>
        <button class="btn primary" data-act="task-new" data-subject="${s.id}">${I.plus} Add task<\/button>
      <\/div>
    <\/div>
    <div class="grid-2">
      <section>
        <div class="filters" role="tablist">
          ${['All', ...TYPES, 'Done'].map(x => `<button class="chip ${f === x ? 'active' : ''}" data-act="filter" data-type="${x}">${x === 'All' ? 'All open' : x}<b>${x === 'All' ? open.length : x === 'Done' ? done.length : count(x)}<\/b><\/button>`).join('')}
        <\/div>
        ${shown.length ? `<div class="task-list">${shown.map(t => taskCard(t, false)).join('')}<\/div>`
          : `<div class="panel empty-state"><h3>${f === 'Done' ? 'Nothing finished yet' : 'No open ' + (f === 'All' ? 'tasks' : f.toLowerCase() + ' tasks')}<\/h3>
             <p>${f === 'Done' ? 'Tick the circle on a task when you finish it.' : 'Add homework, a project or a group project with its deadline and mini deadlines.'}<\/p>
             ${f !== 'Done' ? `<button class="btn primary" data-act="task-new" data-subject="${s.id}" data-type="${TYPES.includes(f) ? f : 'Homework'}">${I.plus} Add task<\/button>` : ''}<\/div>`}
      <\/section>
      <aside>
        <div class="panel">
          <h3>Syllabus<\/h3><p class="sub">Saved in this subject\u2019s Drive folder.<\/p>
          ${s.syllabusUrl ? `<div class="syllabus-file">${I.folder}<a href="${esc(s.syllabusUrl)}" target="_blank" rel="noopener">${esc(s.syllabusName || 'Syllabus')}<\/a>
              <button class="icon-btn" data-act="syllabus-remove" data-id="${s.id}" title="Unlink syllabus" aria-label="Unlink syllabus">${I.x}<\/button><\/div>` : ''}
          <label class="drop" id="drop"><input type="file" id="sylFile" accept=".pdf,.doc,.docx,.txt,.ppt,.pptx,.png,.jpg,.jpeg">
            <strong>${s.syllabusUrl ? 'Replace syllabus' : 'Upload syllabus'}<\/strong><br><span class="muted">Drop a file here or click to choose<\/span><\/label>
          <div class="field" style="margin:12px 0 0"><span>Or use a file already in Drive<\/span>
            <div style="display:flex;gap:8px"><input class="input" id="sylLink" placeholder="Paste a Google Drive file link"><button class="btn small" data-act="syllabus-link" data-id="${s.id}">Use file<\/button><\/div><\/div>
        <\/div>
        <div class="panel">
          <h3>Google Classroom<\/h3><p class="sub">Optional. Homework from matched classes is pulled in automatically.<\/p>
          ${links.length ? `<ul class="class-list">${links.map(c => `<li><div><div class="cn">${esc(c.courseName)}<\/div><div class="cm">${c.section ? esc(c.section) + ', ' : ''}${c.lastSynced ? 'synced ' + fmt(pd(c.lastSynced)) : 'not synced yet'}<\/div><\/div>
              <button class="icon-btn" data-act="class-unlink" data-id="${c.id}" title="Unmatch classroom" aria-label="Unmatch classroom">${I.x}<\/button><\/li>`).join('')}<\/ul>` : ''}
          <div class="link-row">
            <button class="btn small" data-act="class-link" data-subject="${s.id}">${I.plus} Match a classroom<\/button>
            ${links.length ? `<button class="btn small" data-act="sync">${I.sync} Sync now<\/button>` : ''}
          <\/div>
        <\/div>
        <div class="panel">
          <h3>Drive folder<\/h3><p class="sub">Upload class files here. They go straight into this subject\u2019s Drive folder.<\/p>
          <label class="drop" id="fileDrop" style="margin-bottom:12px"><input type="file" id="upFiles" multiple>
            <strong>Upload files<\/strong><br><span class="muted">Drop files here or click to choose. Up to 25 MB each.<\/span><\/label>
          ${S.uploads && S.uploads.subjectId === s.id ? `<ul class="upload-queue">${S.uploads.items.map(u => `<li><span>${esc(u.name)}<\/span><span class="${u.state === 'Uploaded' ? 'ok' : u.state.indexOf('Failed') === 0 ? 'err' : ''}">${esc(u.state)}<\/span><\/li>`).join('')}<\/ul>` : ''}
          <div class="link-row" style="margin:0 0 10px"><a class="btn small" href="${esc(s.folderUrl)}" target="_blank" rel="noopener">${I.folder} Open folder<\/a>
            <button class="btn small" data-act="files-refresh" data-id="${s.id}">${I.sync} Refresh<\/button><\/div>
          ${files === 'loading' ? '<div class="spinner"><\/div>' : !files ? '' : files.length
            ? `<ul class="file-list">${files.map(fl => `<li><a href="${esc(fl.url)}" target="_blank" rel="noopener" title="${esc(fl.name)}${fl.folder ? ' (in ' + esc(fl.folder) + ')' : ''}">${esc(fl.name)}<\/a><span>${fl.folder ? '<b class="from-cr">Classroom<\/b> ' : ''}${pd(fl.updated).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}<\/span><\/li>`).join('')}<\/ul>`
            : '<p class="muted">This folder is empty.<\/p>'}
        <\/div>
      <\/aside>
    <\/div>`;
}

async function loadFiles(id, force) {
  if (!id || (S.files[id] && !force)) return;
  S.files[id] = 'loading';
  render();
  try { S.files[id] = await call('getSubjectFiles', id); }
  catch (e) { S.files[id] = []; toast(cleanErr(e), 'error'); }
  if (S.view === 'subject' && S.subjectId === id) render();
}

function wireDrop() {
  const fdrop = $('#fileDrop'), finput = $('#upFiles');
  if (fdrop) {
    finput.onchange = () => finput.files.length && uploadFiles([...finput.files]);
    fdrop.ondragover = e => { e.preventDefault(); fdrop.classList.add('over'); };
    fdrop.ondragleave = () => fdrop.classList.remove('over');
    fdrop.ondrop = e => { e.preventDefault(); fdrop.classList.remove('over'); if (e.dataTransfer.files.length) uploadFiles([...e.dataTransfer.files]); };
  }
  const drop = $('#drop'), input = $('#sylFile');
  if (!drop) return;
  input.onchange = () => input.files[0] && uploadSyllabus(input.files[0]);
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) uploadSyllabus(f); };
}

function readBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error('Could not read ' + file.name));
    r.readAsDataURL(file);
  });
}

/** Uploads files one at a time into the subject's matched Drive folder. */
async function uploadFiles(files) {
  const id = S.subjectId;
  if (S.uploads && S.uploads.busy) { toast('Wait for the current upload to finish.', 'error'); return; }
  S.uploads = { subjectId: id, busy: true, items: files.map(f => ({ name: f.name, state: f.size > 25 * 1024 * 1024 ? 'Failed: over 25 MB' : 'Waiting' })) };
  render();
  let ok = 0;
  for (let i = 0; i < files.length; i++) {
    const item = S.uploads.items[i];
    if (item.state !== 'Waiting') continue;
    item.state = 'Uploading\u2026'; render();
    try {
      const data = await readBase64(files[i]);
      await call('uploadToSubjectFolder', id, { name: files[i].name, mimeType: files[i].type, data });
      item.state = 'Uploaded'; ok++;
    } catch (e) { item.state = 'Failed: ' + cleanErr(e); }
    render();
  }
  S.uploads.busy = false;
  toast(ok === files.length ? `Uploaded ${ok} file${ok > 1 ? 's' : ''} to Drive` : `Uploaded ${ok} of ${files.length} files`, ok === files.length ? '' : 'error');
  loadFiles(id, true);
  setTimeout(() => { if (S.uploads && !S.uploads.busy) { S.uploads = null; if (S.view === 'subject') render(); } }, 6000);
}

function uploadSyllabus(file) {
  if (file.size > 25 * 1024 * 1024) { toast('That file is over 25 MB. Upload it to Drive directly and paste its link instead.', 'error'); return; }
  const id = S.subjectId;
  const reader = new FileReader();
  reader.onload = async () => {
    $('#drop').innerHTML = '<div class="spinner"><\/div><p>Uploading ' + esc(file.name) + '\u2026<\/p>';
    const data = String(reader.result).split(',')[1];
    try {
      await act('uploadSyllabus', [id, { name: file.name, mimeType: file.type, data }], 'Syllabus uploaded to Drive');
      S.files[id] = null; loadFiles(id, true);
    } catch (e) { render(); }
  };
  reader.readAsDataURL(file);
}

/* ---------- All tasks ---------- */
function viewAllTasks() {
  const F = S.allFilter;
  let list = S.data.tasks.filter(t => t.status !== 'Dismissed');
  if (F.subject) list = list.filter(t => t.subjectId === F.subject);
  if (F.type) list = list.filter(t => t.type === F.type);
  if (F.status === 'open') list = list.filter(isOpen);
  if (F.status === 'done') list = list.filter(t => t.status === 'Done');
  if (F.q) { const q = F.q.toLowerCase(); list = list.filter(t => (t.title + ' ' + t.description + ' ' + t.members).toLowerCase().includes(q)); }
  list.sort(byDeadline);
  return `<div class="page-head"><div><h2>All tasks<\/h2><p>Every homework, project and group project, sorted by deadline.<\/p><\/div>
      <div class="head-actions">${S.data.subjects.length ? `<button class="btn primary" data-act="task-new">${I.plus} Add task<\/button>` : ''}<\/div><\/div>
    ${!S.data.subjects.length ? emptyNoSubjects() : `
    <div class="filters" style="gap:10px">
      <select class="input" style="width:auto" data-filter="subject"><option value="">All subjects<\/option>${S.data.subjects.map(s => `<option value="${s.id}" ${F.subject === s.id ? 'selected' : ''}>${esc(s.name)}<\/option>`).join('')}<\/select>
      <select class="input" style="width:auto" data-filter="type"><option value="">All types<\/option>${TYPES.map(t => `<option ${F.type === t ? 'selected' : ''}>${t}<\/option>`).join('')}<\/select>
      <select class="input" style="width:auto" data-filter="status"><option value="open" ${F.status === 'open' ? 'selected' : ''}>Open<\/option><option value="done" ${F.status === 'done' ? 'selected' : ''}>Done<\/option><option value="" ${!F.status ? 'selected' : ''}>Open and done<\/option><\/select>
      <input class="input" style="width:auto;flex:1;min-width:160px" data-filter="q" placeholder="Search tasks" value="${esc(F.q)}">
    <\/div>
    ${list.length ? `<div class="task-list">${list.map(t => taskCard(t, true)).join('')}<\/div>` : '<div class="panel empty-state"><h3>No tasks match<\/h3><p>Change the filters above, or add a new task.<\/p><\/div>'}`}`;
}

/* ---------- Classrooms ---------- */
function viewClassrooms() {
  const head = `<div class="page-head"><div><h2>Google Classroom<\/h2><p>Match each class to a subject. Assignments come in as homework, and anything you turn in is ticked off automatically.<\/p><\/div>
    <div class="head-actions">${S.data.classrooms.length ? `<button class="btn" data-act="sync">${I.sync} Sync all<\/button>` : ''}
    ${S.data.subjects.length && S.data.classroomAvailable ? `<button class="btn primary" data-act="class-link">${I.plus} Match a classroom<\/button>` : ''}<\/div><\/div>`;
  if (!S.data.classroomAvailable) return head + `<div class="panel"><h3>Turn on the Classroom service<\/h3>
    <p class="sub">In the Apps Script editor, click the + next to Services, choose Google Classroom API and press Add. Then reload this page.<\/p><\/div>`;
  if (!S.data.subjects.length) return head + emptyNoSubjects();
  if (!S.data.classrooms.length) return head + `<div class="panel empty-state"><h3>No classrooms matched yet<\/h3>
    <p>You can match as many classrooms as you like. Several classes can share one subject.<\/p>
    <button class="btn primary" data-act="class-link">${I.plus} Match a classroom<\/button><\/div>`;
  return head + `<div class="panel table-wrap"><table class="list">
    <thead><tr><th>Classroom<\/th><th>Subject<\/th><th>Imported<\/th><th>Last synced<\/th><th><\/th><\/tr><\/thead>
    <tbody>${S.data.classrooms.map(c => {
      const s = subj(c.subjectId);
      const n = S.data.tasks.filter(t => t.externalId && t.externalId.indexOf(c.courseId + ':') === 0).length;
      return `<tr><td><strong>${esc(c.courseName)}<\/strong>${c.section ? `<div class="muted">${esc(c.section)}<\/div>` : ''}${c.link ? `<a href="${esc(c.link)}" target="_blank" rel="noopener">Open in Classroom<\/a>` : ''}<\/td>
        <td><span class="dot" style="--c:${esc(s ? s.color : '#888')}"><\/span>${esc(s ? s.name : 'Missing subject')}<\/td>
        <td>${n}<\/td><td>${c.lastSynced ? fmt(pd(c.lastSynced)) : 'Never'}<\/td>
        <td style="text-align:right"><button class="btn small danger" data-act="class-unlink" data-id="${c.id}">Unmatch<\/button><\/td><\/tr>`;
    }).join('')}<\/tbody><\/table><\/div>`;
}

/* ---------- Settings ---------- */
let draft = null;   // unsaved edits on the reminders page
function viewSettings() {
  const st = S.data.settings;
  if (!draft) draft = {
    email: st.email, times: st.reminderTimes.split(',').filter(Boolean), daysAhead: st.daysAhead,
    enabled: st.enabled === 'true', sendWhenEmpty: st.sendWhenEmpty === 'true', sync: st.syncBeforeReminder === 'true', dirty: false
  };
  const savedOn = st.enabled === 'true';
  const status = draft.dirty ? 'You have unsaved changes' : savedOn ? 'Reminders are on at ' + esc(st.reminderTimes.split(',').join(', ')) : 'Reminders are off';
  return `<div class="page-head"><div><h2>Email reminders<\/h2><p>Study Hub emails you a list of overdue work, today\u2019s deadlines and what is coming up, every day at the times you choose.<\/p><\/div><\/div>
    <div class="grid-2"><div class="panel">
      <div class="field"><span>Send reminders to<\/span><input class="input" id="stEmail" type="email" value="${esc(draft.email)}"><\/div>
      <div class="field"><span>Reminder times each day<\/span>
        <div class="times">${draft.times.length ? draft.times.map(t => `<span class="time-chip">${esc(t)}<button data-act="time-remove" data-time="${esc(t)}" aria-label="Remove ${esc(t)}">\u00D7<\/button><\/span>`).join('') : '<span class="muted">No times yet. Add one below.<\/span>'}<\/div>
        <div class="add-time"><input class="input" id="stNewTime" type="time" value="07:00"><button class="btn" data-act="time-add">Add time<\/button><\/div>
        <small>Times use the ${esc(S.data.timeZone)} time zone. Google runs each reminder within about 15 minutes of the time you set.<\/small><\/div>
      <div class="field"><span>Look ahead<\/span>
        <select class="input" id="stDays" style="max-width:220px">${[1, 2, 3, 5, 7, 10, 14, 21, 30].map(n => `<option value="${n}" ${String(n) === String(draft.daysAhead) ? 'selected' : ''}>${n} day${n > 1 ? 's' : ''}<\/option>`).join('')}<\/select>
        <small>Deadlines further away than this are left out of the email.<\/small><\/div>
      <label class="check-line"><input type="checkbox" id="stEnabled" ${draft.enabled ? 'checked' : ''}><span><strong>Send daily reminders<\/strong><\/span><\/label>
      <label class="check-line"><input type="checkbox" id="stSync" ${draft.sync ? 'checked' : ''}><span>Check Google Classroom for new homework before each email<\/span><\/label>
      <label class="check-line"><input type="checkbox" id="stEmpty" ${draft.sendWhenEmpty ? 'checked' : ''}><span>Email me even when nothing is due<\/span><\/label>
      <div class="link-row"><button class="btn primary" data-act="settings-save">Save reminders<\/button><button class="btn" data-act="settings-test">Send test email<\/button><\/div>
      <div class="status-line ${savedOn && !draft.dirty ? 'on' : ''}"><i><\/i>${status}<\/div>
    <\/div>
    <div class="panel"><h3>Where your data lives<\/h3>
      <p class="sub">Everything is stored in your own Google account.<\/p>
      <div class="link-row" style="flex-direction:column;align-items:flex-start">
        <a class="btn small" href="${esc(S.data.dbUrl)}" target="_blank" rel="noopener">Open database sheet<\/a>
        <a class="btn small" href="${esc(S.data.rootFolderUrl)}" target="_blank" rel="noopener">${I.folder} Open Study Hub folder<\/a>
      <\/div><\/div><\/div>`;
}

/** Copy what is on screen into the draft so a re-render keeps it. */
function readDraft() {
  if (!$('#stEmail')) return;
  Object.assign(draft, {
    email: $('#stEmail').value, daysAhead: $('#stDays').value, enabled: $('#stEnabled').checked,
    sendWhenEmpty: $('#stEmpty').checked, sync: $('#stSync').checked
  });
}

/* ---------- Study music: playlists ---------- */
S.music = { id: null };

function viewMusic() {
  const pls = S.data.playlists || [];
  let sel = pls.find(p => p.id === S.music.id) || pls[0];
  S.music.id = sel ? sel.id : null;
  const head = `<div class="page-head"><div><h2>Study music<\/h2>
      <p>Build playlists from YouTube links and listen right here. Music keeps playing while you move around Study Hub.<\/p><\/div><\/div>`;
  if (!sel) return head + `<div class="panel empty-state">
      <h3>Make your first playlist<\/h3><p>Name it, then paste in as many YouTube links as you like.<\/p>
      <div style="display:flex;gap:8px;max-width:420px;margin:0 auto"><input class="input" id="mxNewName" placeholder="e.g. Lo-fi for homework"><button class="btn primary" data-act="music-new">Create playlist<\/button><\/div><\/div>`;

  const isCur = P.playlistId === sel.id;
  return head + `<div class="grid-2">
    <section class="panel">
      <div class="pl-head">
        <div><h3>${esc(sel.name)}<\/h3><p class="sub" style="margin:4px 0 0">${sel.tracks.length} song${sel.tracks.length === 1 ? '' : 's'}<\/p><\/div>
        <div class="head-actions">
          <button class="btn primary" data-act="music-playall" data-id="${sel.id}" ${sel.tracks.length ? '' : 'disabled'}>${I.play} Play<\/button>
          <button class="btn" data-act="music-shuffleall" data-id="${sel.id}" ${sel.tracks.length ? '' : 'disabled'}>${I.shuffle} Shuffle<\/button>
          <button class="icon-btn" data-act="music-rename" data-id="${sel.id}" title="Rename playlist" aria-label="Rename playlist">${I.edit}<\/button>
          <button class="icon-btn" data-act="music-delete" data-id="${sel.id}" title="Delete playlist" aria-label="Delete playlist">${I.trash}<\/button>
        <\/div>
      <\/div>
      ${addPanel()}
      ${sel.tracks.length ? `<ol class="tracklist">${sel.tracks.map((t, i) => `
        <li class="track${S.music.flash && S.music.flash.indexOf(t.videoId) > -1 ? ' fresh' : ''}" data-act="music-play" data-pl="${sel.id}" data-index="${i}" data-id="${t.id}" data-vid="${esc(t.videoId)}" title="Play ${esc(t.title)}">
          <span class="num">${i + 1}<\/span>
          <img src="https://i.ytimg.com/vi/${esc(t.videoId)}/mqdefault.jpg" alt="" loading="lazy">
          <div style="min-width:0"><div class="tt">${esc(t.title)}<\/div><div class="tc">${esc(t.channel || 'YouTube')}<\/div><\/div>
          <div class="ta">
            <button class="icon-btn" data-act="track-up" data-id="${t.id}" title="Move up" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>${I.up}<\/button>
            <button class="icon-btn" data-act="track-down" data-id="${t.id}" title="Move down" aria-label="Move down" ${i === sel.tracks.length - 1 ? 'disabled' : ''}>${I.down}<\/button>
            <button class="icon-btn" data-act="track-remove" data-id="${t.id}" title="Remove from playlist" aria-label="Remove from playlist">${I.x}<\/button>
          <\/div>
        <\/li>`).join('')}<\/ol>`
        : '<p class="muted" style="margin-top:16px">This playlist is empty. Paste YouTube links in the box above to add songs.<\/p>'}
    <\/section>
    <aside class="panel">
      <h3>Playlists<\/h3><p class="sub">${pls.length} playlist${pls.length === 1 ? '' : 's'}${isCur ? ', this one is playing' : ''}<\/p>
      <div class="pl-list">${pls.map(p => `<button class="pl-item ${p.id === sel.id ? 'active' : ''}" data-act="music-select" data-id="${p.id}">
          ${P.playlistId === p.id ? I.music : ''}<span class="n">${esc(p.name)}<\/span><span class="c">${p.tracks.length}<\/span><\/button>`).join('')}<\/div>
      <div class="field" style="margin:0"><span>New playlist<\/span>
        <div style="display:flex;gap:8px"><input class="input" id="mxNewName" placeholder="e.g. Exam week focus"><button class="btn" data-act="music-new">Create<\/button><\/div><\/div>
    <\/aside>
  <\/div>`;
}

/* ---------- Study music: adding songs ---------- */
S.music.tray = [];      // links waiting to be added
S.music.cache = {};     // looked-up titles by video id
S.music.target = null;  // playlist to add to (defaults to the open one)
S.music.flash = null;   // video ids to highlight right after adding
let trayKey = 0;

function parseYt(s) {
  s = String(s || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/|\/v\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function trayTarget() {
  const pls = S.data.playlists || [];
  return pls.find(p => p.id === S.music.target) || pls.find(p => p.id === S.music.id) || pls[0];
}

function trayState(x, have) {
  if (!x.videoId) return 'bad';
  if (have.has(x.videoId)) return 'dupe';
  if (!x.info) return 'loading';
  return x.info.ok ? 'ok' : 'bad';
}

function addPanel() {
  const target = trayTarget();
  const have = new Set((target ? target.tracks : []).map(t => t.videoId));
  const tray = S.music.tray;
  const states = tray.map(x => trayState(x, have));
  const ready = states.filter(s => s === 'ok').length;
  const loading = states.filter(s => s === 'loading').length;
  const problems = states.filter(s => s === 'bad' || s === 'dupe').length;
  const pill = (x, st) => st === 'ok' ? '<span class="st ok">Ready<\/span>'
    : st === 'loading' ? '<span class="st load">Finding title<\/span>'
    : st === 'dupe' ? '<span class="st">Already added<\/span>'
    : '<span class="st bad">Can\u2019t add<\/span>';
  return `<div class="mx-add" id="mxDrop">
    <div class="mx-input">${I.link}
      <input class="mx-field" id="mxInput" placeholder="Paste YouTube links here" autocomplete="off" spellcheck="false" aria-label="YouTube links">
      <button class="btn primary" data-act="tray-stage">Find<\/button>
    <\/div>
    <p class="mx-hint">On YouTube, click <b>Share<\/b> then <b>Copy<\/b>, and paste here. Paste several links at once, or drag links in from another tab.<\/p>
    ${tray.length ? `<div class="tray">
      <div class="tray-head"><strong>${ready} ready to add<\/strong>
        <span class="muted">${loading ? loading + ' still loading' : ''}${loading && problems ? ', ' : ''}${problems ? problems + ' can\u2019t be added' : ''}<\/span><\/div>
      <ul>${tray.map((x, i) => {
        const st = states[i];
        const old = st === 'dupe' ? target.tracks.find(t => t.videoId === x.videoId) : null;
        const title = old ? old.title : x.info && x.info.ok ? x.info.title : (x.videoId ? 'YouTube video' : x.input);
        const sub = st === 'dupe' ? 'Already in ' + target.name
          : st === 'bad' ? (x.videoId ? x.info.reason : x.reason)
          : x.info && x.info.ok ? (x.info.channel || 'YouTube') : x.input;
        return `<li class="is-${st}">
          ${x.videoId ? `<img class="thumb" src="https://i.ytimg.com/vi/${esc(x.videoId)}/mqdefault.jpg" alt="">` : `<span class="thumb">${I.link}<\/span>`}
          <div style="min-width:0"><div class="tt" title="${esc(title)}">${esc(title)}<\/div><div class="tc${st === 'bad' ? ' bad' : ''}">${esc(sub)}<\/div><\/div>
          ${pill(x, st)}
          <button class="icon-btn" data-act="tray-remove" data-key="${x.key}" title="Remove" aria-label="Remove">${I.x}<\/button>
        <\/li>`;
      }).join('')}<\/ul>
      <div class="tray-foot">
        <label>Add to <select class="input" id="mxTarget">${(S.data.playlists || []).map(p => `<option value="${p.id}" ${p.id === target.id ? 'selected' : ''}>${esc(p.name)}<\/option>`).join('')}<\/select><\/label>
        <button class="btn" data-act="tray-clear">Clear<\/button>
        <button class="btn primary" data-act="tray-add" ${ready && !loading ? '' : 'disabled'}>${I.plus} ${loading ? 'Finding titles\u2026' : 'Add ' + ready + ' song' + (ready === 1 ? '' : 's')}<\/button>
      <\/div>
    <\/div>` : ''}
  <\/div>`;
}

function stageText(text) {
  const pieces = String(text || '').split(/[\s,]+/).filter(Boolean);
  if (!pieces.length) return;
  const tray = S.music.tray;
  const need = [];
  pieces.slice(0, 200).forEach(p => {
    const id = parseYt(p);
    if (id) {
      if (tray.some(x => x.videoId === id)) return;
      tray.push({ key: 'k' + (++trayKey), input: p, videoId: id, info: S.music.cache[id] || null });
      if (!S.music.cache[id] && need.indexOf(id) < 0) need.push(id);
    } else if (!tray.some(x => x.input === p)) {
      tray.push({ key: 'k' + (++trayKey), input: p, videoId: null,
        reason: /[?&]list=/.test(p) ? 'Playlist link. Add the single video links instead.' : 'Not a YouTube video link' });
    }
  });
  render();
  if (!need.length) return;
  const fill = info => {
    need.forEach(id => {
      const v = info[id] || { ok: true, title: 'YouTube video ' + id, channel: '' };
      S.music.cache[id] = v;
      S.music.tray.forEach(x => { if (x.videoId === id) x.info = v; });
    });
    if (S.view === 'music') render();
  };
  call('previewVideos', need).then(fill).catch(e => {
    toast('Couldn\u2019t look up titles: ' + cleanErr(e) + ' Songs can still be added.', 'error');
    fill({});
  });
}

function wireMusic() {
  const input = $('#mxInput'), drop = $('#mxDrop');
  if (!input) return;
  input.addEventListener('paste', () => setTimeout(() => { const v = input.value; input.value = ''; stageText(v); const i = $('#mxInput'); if (i) i.focus(); }, 0));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const v = input.value; input.value = ''; stageText(v); const i = $('#mxInput'); if (i) i.focus(); } });
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', e => { if (!drop.contains(e.relatedTarget)) drop.classList.remove('over'); });
  drop.addEventListener('drop', e => {
    e.preventDefault(); drop.classList.remove('over');
    stageText(e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain'));
  });
  const sel = $('#mxTarget');
  if (sel) sel.addEventListener('change', () => { S.music.target = sel.value; render(); });
}

/* ---------- Study music: YouTube player ---------- */
const P = { yt: null, api: null, tracks: [], order: [], pos: 0, playlistId: null, shuffle: false, repeat: 'all', volume: 70, playing: false, errors: 0, seeking: false };
try {
  const saved = JSON.parse(localStorage.getItem('studyhub-player') || '{}');
  P.shuffle = !!saved.shuffle; P.repeat = saved.repeat || 'all'; P.volume = saved.volume != null ? saved.volume : 70;
} catch (e) { /* storage unavailable */ }
function savePrefs() { try { localStorage.setItem('studyhub-player', JSON.stringify({ shuffle: P.shuffle, repeat: P.repeat, volume: P.volume })); } catch (e) { } }

function loadYouTubeApi() {
  if (P.api) return P.api;
  P.api = new Promise((resolve, reject) => {
    if (window.YT && YT.Player) return resolve();
    window.onYouTubeIframeAPIReady = resolve;
    const sc = document.createElement('script');
    sc.src = 'https://www.youtube.com/iframe_api';
    sc.onerror = () => { P.api = null; reject(new Error('The YouTube player could not load. Check your internet connection.')); };
    document.head.appendChild(sc);
  });
  return P.api;
}

function nowTrack() { return P.tracks[P.order[P.pos]]; }

function buildOrder(start) {
  const n = P.tracks.length;
  let idx = [...Array(n).keys()];
  if (P.shuffle) {
    idx = idx.filter(i => i !== start);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    idx.unshift(start);
    P.pos = 0;
  } else P.pos = start;
  P.order = idx;
}

async function playPlaylist(playlistId, startIndex, forceShuffle) {
  const pl = (S.data.playlists || []).find(p => p.id === playlistId);
  if (!pl || !pl.tracks.length) { toast('Add some YouTube links to this playlist first.', 'error'); return; }
  P.playlistId = playlistId;
  P.tracks = pl.tracks.slice();
  if (forceShuffle !== undefined) P.shuffle = forceShuffle;
  const start = startIndex != null ? startIndex : (P.shuffle ? Math.floor(Math.random() * P.tracks.length) : 0);
  buildOrder(start);
  P.errors = 0;
  savePrefs();
  if ($('#dock').classList.contains('hidden') && window.matchMedia('(max-width: 860px)').matches) $('#dock').classList.add('min');
  $('#dock').classList.remove('hidden');
  document.body.classList.add('has-player');
  updateDock();
  try { await loadYouTubeApi(); } catch (e) { toast(e.message, 'error'); return; }
  loadNow();
  if (S.view === 'music') render();
}

function loadNow() {
  const t = nowTrack();
  if (!t) return;
  if (!P.yt) {
    P.yt = new YT.Player('ytPlayer', {
      width: '100%', height: '100%', videoId: t.videoId,
      playerVars: { autoplay: 1, playsinline: 1, rel: 0, origin: location.origin },
      events: {
        onReady: e => { e.target.setVolume(P.volume); e.target.playVideo(); },
        onStateChange: onPlayerState,
        onError: onPlayerError
      }
    });
  } else {
    P.yt.loadVideoById(t.videoId);
  }
  updateDock();
}

function onPlayerState(e) {
  if (e.data === YT.PlayerState.ENDED) { nextTrack(true); return; }
  if (e.data === YT.PlayerState.PLAYING) { P.playing = true; P.errors = 0; }
  if (e.data === YT.PlayerState.PAUSED) P.playing = false;
  updateDock();
}

function onPlayerError(e) {
  const t = nowTrack();
  const why = { 2: 'the link is not valid', 5: 'the browser could not play it', 100: 'it was removed or made private', 101: 'its owner only allows playing on YouTube', 150: 'its owner only allows playing on YouTube', 153: 'YouTube blocked playback inside this page' }[e.data] || 'YouTube could not play it';
  P.errors++;
  if (P.errors >= P.tracks.length) {
    P.playing = false; updateDock();
    toast('None of the songs in this playlist can play here. Use the YouTube button in the player to open them on YouTube.', 'error');
    return;
  }
  toast('Skipped \u201C' + (t ? t.title : 'song') + '\u201D because ' + why + '.', 'error');
  setTimeout(() => nextTrack(false), 700);
}

function nextTrack(auto) {
  if (!P.yt || !P.order.length) return;
  if (auto && P.repeat === 'one') { P.yt.seekTo(0, true); P.yt.playVideo(); return; }
  if (P.pos + 1 < P.order.length) P.pos++;
  else if (!auto || P.repeat === 'all') { P.pos = 0; if (P.shuffle) buildOrder(P.order[Math.floor(Math.random() * P.order.length)]); }
  else { P.playing = false; updateDock(); return; }
  loadNow();
}

function prevTrack() {
  if (!P.yt || !P.order.length) return;
  if (P.yt.getCurrentTime && P.yt.getCurrentTime() > 3) { P.yt.seekTo(0, true); return; }
  P.pos = P.pos > 0 ? P.pos - 1 : P.order.length - 1;
  loadNow();
}

function closePlayer() {
  if (P.yt && P.yt.stopVideo) P.yt.stopVideo();
  P.playing = false; P.playlistId = null;
  $('#dock').classList.add('hidden');
  document.body.classList.remove('has-player');
  if (S.view === 'music') render();
}

function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
}

function updateDock() {
  const t = nowTrack();
  const pl = (S.data && S.data.playlists || []).find(p => p.id === P.playlistId);
  $('#dkTitle').textContent = t ? t.title : 'Nothing playing';
  $('#dkSub').textContent = t ? (t.channel || 'YouTube') + (pl ? ', from ' + pl.name : '') : '';
  $('#dkYt').href = t ? 'https://www.youtube.com/watch?v=' + t.videoId : '#';
  const play = $('#dkPlay');
  play.innerHTML = P.playing ? I.pause : I.play;
  play.title = P.playing ? 'Pause' : 'Play';
  play.setAttribute('aria-label', play.title);
  $('#dkShuffle').classList.toggle('on', P.shuffle);
  $('#dkShuffle').title = P.shuffle ? 'Shuffle is on' : 'Shuffle is off';
  const r = $('#dkRepeat');
  r.classList.toggle('on', P.repeat !== 'off');
  r.innerHTML = I.repeat + (P.repeat === 'one' ? '<b>1<\/b>' : '');
  r.title = { all: 'Repeat playlist', one: 'Repeat this song', off: 'Repeat is off' }[P.repeat];
  $('#dkVolIcon').innerHTML = P.volume == 0 ? I.mute : I.vol;
  const min = $('#dock').classList.contains('min');
  $('#dkMin').innerHTML = min ? I.grow : I.shrink;
  $('#dkMin').title = min ? 'Make player bigger' : 'Make player smaller';
  markNowPlaying();
}

function markNowPlaying() {
  const t = nowTrack();
  $$('.track').forEach(li => {
    const on = !!t && li.dataset.pl === P.playlistId && li.dataset.id === t.id;
    li.classList.toggle('now', on);
    li.classList.toggle('paused', on && !P.playing);
    const num = $('.num', li);
    if (num) num.innerHTML = on ? '<span class="eq"><i><\/i><i><\/i><i><\/i><\/span>' : String(+li.dataset.index + 1);
  });
}

// Static dock icons and controls
$('#dock [data-act=p-close]').innerHTML = I.x;
$('#dkPrev').innerHTML = I.prev;
$('#dkYt').innerHTML = I.link;
$('#dkNext').innerHTML = I.next;
$('#dkShuffle').innerHTML = I.shuffle;
$('#dkVol').value = P.volume;
$('#dkVol').addEventListener('input', e => {
  P.volume = +e.target.value;
  if (P.yt && P.yt.setVolume) { P.yt.setVolume(P.volume); if (P.volume > 0 && P.yt.isMuted && P.yt.isMuted()) P.yt.unMute(); }
  savePrefs(); updateDock();
});
$('#dkSeek').addEventListener('input', () => { P.seeking = true; });
$('#dkSeek').addEventListener('change', e => {
  P.seeking = false;
  if (P.yt && P.yt.getDuration) P.yt.seekTo(P.yt.getDuration() * e.target.value / 1000, true);
});
setInterval(() => {
  if (!P.yt || !P.yt.getCurrentTime || P.seeking) return;
  const cur = P.yt.getCurrentTime() || 0, dur = P.yt.getDuration() || 0;
  $('#dkCur').textContent = fmtTime(cur);
  $('#dkDur').textContent = fmtTime(dur);
  $('#dkSeek').value = dur ? Math.round(cur / dur * 1000) : 0;
}, 500);
updateDock();

function promptBox(title, label, value, okText) {
  return new Promise(resolve => {
    const d = openDialog(`
      <div class="dlg-head"><h3>${esc(title)}<\/h3><\/div>
      <div class="dlg-body"><label class="field"><span>${esc(label)}<\/span><input class="input" id="pbVal" value="${esc(value || '')}"><\/label><\/div>
      <div class="dlg-foot"><div class="right"><button class="btn" id="pbNo">Cancel<\/button><button class="btn primary" id="pbYes">${esc(okText)}<\/button><\/div><\/div>`);
    const done = v => { closeDialog(); resolve(v); };
    $('#pbNo', d).onclick = () => done(null);
    $('#pbYes', d).onclick = () => done($('#pbVal', d).value);
    $('#pbVal', d).onkeydown = e => { if (e.key === 'Enter') done($('#pbVal', d).value); };
  });
}

/* ================= Ramkhamhaeng Hub ================= */
S.ru = { tab: 'timer', month: null, day: null, termId: null, q: '', group: '', chartDays: 14, importRows: null };
const RU_BLANK = { sessions: [], courses: [], terms: [], plan: [], creditsNeeded: '', limits: { regular: { min: 9, max: 22 }, summer: { min: 0, max: 9 } } };
function ru() { return (S.data && S.data.ru) || RU_BLANK; }

const pad2 = n => String(n).padStart(2, '0');
function ymd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function localDt(d) { return ymd(d) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
function fmtMin(m) { m = Math.round(m || 0); const h = Math.floor(m / 60), r = m % 60; return h ? (r ? h + 'h ' + r + 'm' : h + 'h') : r + 'm'; }
function minutesByDay() { const map = {}; ru().sessions.forEach(s => { const k = (s.start || '').slice(0, 10); map[k] = (map[k] || 0) + (+s.minutes || 0); }); return map; }
function termName(t) { return 'Year ' + t.year + ' ' + (t.semester === 'S' ? 'Summer' : 'Semester ' + t.semester); }
function termShort(t) { return t.year + '/' + (t.semester === 'S' ? 'Summer' : t.semester); }
function termOrder(t) { return (+t.year) * 10 + ({ '1': 1, '2': 2, 'S': 3 }[t.semester] || 0); }
function termLimits(t) { return t.semester === 'S' ? ru().limits.summer : ru().limits.regular; }
function ruCourse(id) { return ru().courses.find(c => c.id === id); }
function courseText(code) { const c = ru().courses.find(x => x.code === code); return c ? c.code + ' ' + c.name : code; }
function termCredits(termId) { return ru().plan.filter(p => p.termId === termId).reduce((n, p) => n + (+(ruCourse(p.courseId) || {}).credits || 0), 0); }
function heat(m) { return !m ? '' : m < 30 ? 'h1' : m < 60 ? 'h2' : m < 120 ? 'h3' : 'h4'; }

const RU_LLB = {"courses":[["RAM1101","Thai Language Skills",3,"GE: Thai language (choose 1)",""],["RAM1102","Thai for Presentations",3,"GE: Thai language (choose 1)",""],["RAM1103","Thai for Communication at Work",3,"GE: Thai language (choose 1)","1B"],["RAM1111","English in Daily Life",3,"GE: English (required)","4B"],["RAM1112","English Language and Culture",3,"GE: Foreign language and culture (choose 1)","1B"],["RAM1113","Chinese Language and Culture",3,"GE: Foreign language and culture (choose 1)",""],["RAM1114","Japanese Language and Culture",3,"GE: Foreign language and culture (choose 1)",""],["RAM1115","Korean Language and Culture",3,"GE: Foreign language and culture (choose 1)",""],["RAM1116","Malay Language and Culture",3,"GE: Foreign language and culture (choose 1)",""],["RAM1117","Myanmar Language and Culture",3,"GE: Foreign language and culture (choose 1)",""],["RAM1118","Khmer Language and Culture",3,"GE: Foreign language and culture (choose 1)",""],["RAM1119","Vietnamese Language and Culture",3,"GE: Foreign language and culture (choose 1)",""],["RAM1121","Laotian Language and Culture",3,"GE: Foreign language and culture (choose 1)",""],["RAM1122","Arabic Language and Culture",3,"GE: Foreign language and culture (choose 1)",""],["RAM1123","Hindi Language and Indian Culture",3,"GE: Foreign language and culture (choose 1)",""],["RAM1124","French Language and Culture",3,"GE: Foreign language and culture (choose 1)",""],["RAM1125","German Language and Culture",3,"GE: Foreign language and culture (choose 1)",""],["RAM1126","Spanish Language and Culture",3,"GE: Foreign language and culture (choose 1)",""],["RAM1127","Russian Language and Culture",3,"GE: Foreign language and culture (choose 1)",""],["RAM1128","Greek Language and Culture",3,"GE: Foreign language and culture (choose 1)",""],["RAM1131","Digital Literacy",3,"GE: Technology (choose 1)",""],["RAM1132","Information Literacy",3,"GE: Technology (choose 1)","3A"],["RAM1141","Science of Personality",3,"GE: Adaptation (choose 1)","1A"],["RAM1142","Quality of Life and Society Development",3,"GE: Adaptation (choose 1)",""],["RAM1201","Creativity for Innovation Development",3,"GE: Thinking (choose 1)",""],["RAM1202","Creativity Arts",3,"GE: Thinking (choose 1)",""],["RAM1203","Thinking Science that Changes the World",3,"GE: Thinking (choose 1)","3B"],["RAM1204","Mathematics and Statistics for Daily Life in the Modern World",3,"GE: Thinking (choose 1)",""],["RAM1211","Principles of Entrepreneurship",3,"GE: Entrepreneurship (choose 1)",""],["RAM1212","Smart Entrepreneurs",3,"GE: Entrepreneurship (choose 1)",""],["RAM1213","Local Wisdom and Innovation Development for Society and Economy",3,"GE: Entrepreneurship (choose 1)","2A"],["RAM1214","Science, Technology and Innovation (STI) for the BCG Economy Model",3,"GE: Entrepreneurship (choose 1)",""],["RAM1301","Morality and Knowledge",3,"GE: Citizenship (required)","4B"],["RAM1302","Politics and Law in Daily Life",3,"GE: Citizenship (choose 1)",""],["RAM1303","Science for Sustainable Development",3,"GE: Citizenship (choose 1)","2B"],["RAM1311","Thai Local Art and Culture",3,"GE: Art and culture (choose 1)",""],["RAM1312","Contemporary Culture and Digital Disruption",3,"GE: Art and culture (choose 1)","2B"],["LAW1101","Principle of Public Law",2,"Required law","2A"],["LAW1102","Principle of Private Law",2,"Required law","4A"],["LAW1103","Civil and Commercial Code: Juristic Acts and Contracts",3,"Required law","2A"],["LAW1106","Thai Legal History and Major Legal Systems",3,"Required law","2B"],["LAW2101","Civil and Commercial Code: Property",3,"Required law","2B"],["LAW2102","Civil and Commercial Code: Obligation",3,"Required law","3A"],["LAW2103","Civil and Commercial Code: Torts, Management of Affairs without Mandate and Undue Enrichment",2,"Required law","2A"],["LAW2104","Constitutional Law and Political Institution",3,"Required law","1B"],["LAW2105","Civil and Commercial Code: Sale, Exchange, Gift",2,"Required law","4A"],["LAW2106","Criminal Law 1",3,"Required law","4A"],["LAW2107","Criminal Law 2",2,"Required law","1B"],["LAW2108","Civil and Commercial Code: Hire of Property, Hire Purchase, Hire of Services, Hire of Work, Carriages",2,"Required law","1A"],["LAW2109","Civil and Commercial Code: Loan, Deposit, Warehousing, Compromise, Gambling and Betting",2,"Required law","3B"],["LAW2110","Civil and Commercial Code: Suretyship, Mortgage, Pledge",2,"Required law","3B"],["LAW2111","Civil and Commercial Code: Agency, Brokerage",2,"Required law","2A"],["LAW2112","Civil and Commercial Code: Insurance",2,"Required law","4A"],["LAW2113","Civil and Commercial Code: Bills, Current Account",2,"Required law","4B"],["LAW3101","Criminal Law 3",2,"Required law","1A"],["LAW3102","Civil and Commercial Code: Partnerships, Companies, Public Company Limited",2,"Required law","2A"],["LAW3103","Civil and Commercial Code: Family",3,"Required law","2B"],["LAW3104","Law on Court Organization",2,"Required law","3A"],["LAW3105","Civil Procedure Code 1",3,"Required law","1B"],["LAW3106","Criminal Procedure Code 1",3,"Required law","4B"],["LAW3107","Civil Procedure Code 2",2,"Required law","4B"],["LAW3108","Criminal Procedure Code 2",2,"Required law","1B"],["LAW3109","Civil and Commercial Code: Succession",2,"Required law","2B"],["LAW3110","Bankruptcy and Reorganization Law",2,"Required law","3B"],["LAW3111","Law of Evidence",2,"Required law","4A"],["LAW3112","Administrative Law",3,"Required law","3A"],["LAW3117","Principle of Public Procedure Law",2,"Required law","3A"],["LAW4101","Law on Income Tax",2,"Required law","2A"],["LAW4102","Lawyer Practice and Legal Document Preparation",2,"Required law","4B"],["LAW4103","Public International Law",3,"Required law","1B"],["LAW4104","Labour and Social Security Law",2,"Required law","1A"],["LAW4105","Legal Profession, Ethics, Moral and Disciplines for Lawyers",2,"Required law","4A"],["LAW4106","Private and Criminal International Law",3,"Required law","1B"],["LAW4107","Philosophy of Law",2,"Required law","4B"],["LAW4108","Land Law",2,"Required law","1A"],["LAW4109","Intellectual Property Law 1",2,"Required law","3A"],["LAW4110","International Trade Law",2,"Required law","2B"],["LAW3131","Comparative Criminal Law",3,"Law elective: Criminal law and criminal justice",""],["LAW3132","Problems in Criminal Law",3,"Law elective: Criminal law and criminal justice",""],["LAW3133","Criminology and Penology",3,"Law elective: Criminal law and criminal justice","3B"],["LAW3134","Forensic Medicine",3,"Law elective: Criminal law and criminal justice",""],["LAW3135","Criminal Inquiry and Interrogation",3,"Law elective: Criminal law and criminal justice",""],["LAW3136","Problems in Criminal Procedure Law",3,"Law elective: Criminal law and criminal justice",""],["LAW3138","Law on Juvenile Delinquency and Procedure of the Court",3,"Law elective: Criminal law and criminal justice","3A"],["LAW3155","Economic Crime",3,"Law elective: Criminal law and criminal justice",""],["LAW3168","Law of Narcotic Drugs",3,"Law elective: Criminal law and criminal justice",""],["LAW3169","Cybercrime Law",3,"Law elective: Criminal law and criminal justice",""],["LAW4173","Comparative Criminal Justice",3,"Law elective: Criminal law and criminal justice",""],["LAW3137","Problems in Civil Procedure Law",3,"Law elective: Private and business law",""],["LAW3156","Arbitration",3,"Law elective: Private and business law",""],["LAW3161","Comparative Civil Law",3,"Law elective: Private and business law",""],["LAW3162","Comparative Business Law",3,"Law elective: Private and business law",""],["LAW3163","Major Business Contracts",3,"Law elective: Private and business law",""],["LAW3164","Problems in Civil Law",3,"Law elective: Private and business law",""],["LAW3165","Counsel for Problems in Business Law",3,"Law elective: Private and business law",""],["LAW3167","Insurance Business Law",3,"Law elective: Private and business law",""],["LAW4137","Law on Intellectual Property 2",3,"Law elective: Private and business law",""],["LAW4138","Customs Law",3,"Law elective: Private and business law",""],["LAW4143","Law on Real Estate Business",3,"Law elective: Private and business law",""],["LAW4154","Accounting for Lawyers",3,"Law elective: Private and business law",""],["LAW4159","Negotiation",3,"Law elective: Private and business law",""],["LAW4169","Problems in Intellectual Property Law",3,"Law elective: Private and business law",""],["LAW4170","International Trade Law in Digital Economy",3,"Law elective: Private and business law",""],["LAW4171","Comparative Company Law",3,"Law elective: Private and business law",""],["LAW4176","Law on Excise Tax",3,"Law elective: Private and business law",""],["LAW4177","Law on Value Added Tax, Specific Business Tax and Stamp Duty",3,"Law elective: Private and business law",""],["LAW4180","Basic Tax Planning for Business",3,"Law elective: Private and business law",""],["LAW4183","Introduction to International Tax Law",3,"Law elective: Private and business law",""],["LAW4184","Law on Financial Institutions",3,"Law elective: Private and business law",""],["LAW4185","Investment Law",3,"Law elective: Private and business law",""],["LAW4186","Securities and Exchange Law",3,"Law elective: Private and business law",""],["LAW4187","Problems in Commercial Law",3,"Law elective: Private and business law",""],["LAW4190","International Sale of Goods Law",3,"Law elective: Private and business law",""],["LAW4191","Construction Law",3,"Law elective: Private and business law",""],["LAW4192","Competition Law",3,"Law elective: Private and business law",""],["LAW4193","Digital Law",3,"Law elective: Private and business law",""],["LAW4194","Personal Data Protection Law for Business",3,"Law elective: Private and business law",""],["LAW4195","Problems in Bankruptcy Law",3,"Law elective: Private and business law",""],["LAW4131","Law on International Organizations",3,"Law elective: International law",""],["LAW4132","ASEAN Law",3,"Law elective: International law",""],["LAW4133","Problems of International Law",3,"Law elective: International law",""],["LAW4134","International Law of the Sea",3,"Law elective: International law","3B"],["LAW4135","International Economic Law",3,"Law elective: International law",""],["LAW4136","Maritime Law",3,"Law elective: International law",""],["LAW4149","Air Law",3,"Law elective: International law",""],["LAW4160","ASEAN Community Law",3,"Law elective: International law",""],["LAW4161","European Union Law",3,"Law elective: International law",""],["LAW4163","Human Rights",3,"Law elective: International law",""],["LAW4188","Diplomatic Law and Consular Relations",3,"Law elective: International law",""],["LAW4189","International Humanitarian Law",3,"Law elective: International law",""],["LAW3139","Comparative Constitutional Law",3,"Law elective: Public law",""],["LAW3140","Comparative Administrative Law",3,"Law elective: Public law",""],["LAW3141","Administrative Courts and Administrative Procedure",3,"Law elective: Public law",""],["LAW3142","Law on Administrative Procedure and Liability for the Wrongful Acts of Officials",3,"Law elective: Public law",""],["LAW3143","Law on Administration of State Affairs",3,"Law elective: Public law",""],["LAW3144","Public Personnel Administration",3,"Law elective: Public law",""],["LAW3145","Administrative Contracts",3,"Law elective: Public law",""],["LAW3146","Official Information Law",3,"Law elective: Public law",""],["LAW3147","Public Enterprise Law",3,"Law elective: Public law",""],["LAW3149","Law on Public Service",3,"Law elective: Public law",""],["LAW3150","Law on the Constitutional Court",3,"Law elective: Public law",""],["LAW3151","Parliamentary Law",3,"Law elective: Public law",""],["LAW3152","Law on Political Parties",3,"Law elective: Public law",""],["LAW3153","Election Law",3,"Law elective: Public law",""],["LAW3154","Law on State Fiscal Institutions",3,"Law elective: Public law",""],["LAW4144","Land Reform Law",3,"Law elective: Public law",""],["LAW4145","Law of Agriculture",3,"Law elective: Public law",""],["LAW4150","Environmental Law",3,"Law elective: Public law",""],["LAW4151","Legislative Drafting",3,"Law elective: Public law",""],["LAW4178","Law on Local Tax",3,"Law elective: Public law",""],["LAW4179","Law on Tax Case Procedure",3,"Law elective: Public law",""],["LAW4181","Comparative Tax Systems",3,"Law elective: Public law",""],["LAW3148","Sociology of Law",3,"Law elective: Special and general subjects",""],["LAW3157","Roman Law",3,"Law elective: Special and general subjects",""],["LAW3158","Anglo-American Law",3,"Law elective: Special and general subjects",""],["LAW3159","American Legal Institutions",3,"Law elective: Special and general subjects",""],["LAW3160","Islamic Law",3,"Law elective: Special and general subjects",""],["LAW3170","Moot Court 1",3,"Law elective: Special and general subjects",""],["LAW3171","Moot Court 2",3,"Law elective: Special and general subjects",""],["LAW4146","Transportation and Traffic Law",3,"Law elective: Special and general subjects",""],["LAW4147","Industrial Law",3,"Law elective: Special and general subjects",""],["LAW4148","Military Law",3,"Law elective: Special and general subjects",""],["LAW4152","Application and Interpretation of Laws",3,"Law elective: Special and general subjects",""],["LAW4153","Computer Law",3,"Law elective: Special and general subjects",""],["LAW4155","Language of Thai Law",3,"Law elective: Special and general subjects",""],["LAW4156","English for Lawyers",3,"Law elective: Special and general subjects","1A"],["LAW4157","French for Lawyers",3,"Law elective: Special and general subjects",""],["LAW4158","German for Lawyers",3,"Law elective: Special and general subjects",""],["LAW4164","Political Economics for Lawyers",3,"Law elective: Special and general subjects",""],["LAW4165","Political Sociology for Lawyers",3,"Law elective: Special and general subjects",""],["LAW4166","Economic Law",3,"Law elective: Special and general subjects",""],["LAW4167","Anti-Trust and Consumer Protection Law",3,"Law elective: Special and general subjects",""],["LAW4168","Product Liability Law",3,"Law elective: Special and general subjects",""],["LAW4172","Medical Law",3,"Law elective: Special and general subjects",""],["LAW4174","Law and Economics",3,"Law elective: Special and general subjects",""],["LAW4175","Sports Law",3,"Law elective: Special and general subjects",""],["LAW4182","Inheritance and Gift Tax Law",3,"Law elective: Special and general subjects",""],["LAW4196","Problems in Labour Law",3,"Law elective: Special and general subjects",""],["FREE1","Free elective 1 (edit to your chosen course)",3,"Free elective",""],["FREE2","Free elective 2 (edit to your chosen course)",3,"Free elective",""]],"plan":[[0,"1",["LAW1101","LAW1106","LAW2106","RAM1103","RAM1111","RAM1141"]],[0,"2",["LAW1102","RAM1112","RAM1132","RAM1203","RAM1213","RAM1301","RAM1303"]],[1,"1",["LAW1103","LAW2101","LAW2102","LAW2104","LAW2105","LAW4107","FREE1"]],[1,"2",["LAW2103","LAW2107","LAW2108","LAW2109","LAW2112","LAW2113","LAW3112","RAM1312"]],[2,"1",["LAW2110","LAW2111","LAW3101","LAW3103","LAW3104","LAW3105","LAW3106"]],[2,"2",["LAW3102","LAW3107","LAW3108","LAW3109","LAW3111","LAW3117","LAW3133","LAW4156"]],[3,"1",["LAW3110","LAW3138","LAW4102","LAW4103","LAW4104","FREE2"]],[3,"2",["LAW4101","LAW4105","LAW4106","LAW4108","LAW4109","LAW4110","LAW4134"]]],"ge":[["GE: Thai language (choose 1)",["RAM1101","RAM1102","RAM1103"]],["GE: English (required)",["RAM1111"]],["GE: Foreign language and culture (choose 1)",["RAM1112","RAM1113","RAM1114","RAM1115","RAM1116","RAM1117","RAM1118","RAM1119","RAM1121","RAM1122","RAM1123","RAM1124","RAM1125","RAM1126","RAM1127","RAM1128"]],["GE: Technology (choose 1)",["RAM1131","RAM1132"]],["GE: Adaptation (choose 1)",["RAM1141","RAM1142"]],["GE: Thinking (choose 1)",["RAM1201","RAM1202","RAM1203","RAM1204"]],["GE: Entrepreneurship (choose 1)",["RAM1211","RAM1212","RAM1213","RAM1214"]],["GE: Citizenship (required)",["RAM1301"]],["GE: Citizenship (choose 1)",["RAM1302","RAM1303"]],["GE: Art and culture (choose 1)",["RAM1311","RAM1312"]]],"required":["LAW1101","LAW1102","LAW1103","LAW1106","LAW2101","LAW2102","LAW2103","LAW2104","LAW2105","LAW2106","LAW2107","LAW2108","LAW2109","LAW2110","LAW2111","LAW2112","LAW2113","LAW3101","LAW3102","LAW3103","LAW3104","LAW3105","LAW3106","LAW3107","LAW3108","LAW3109","LAW3110","LAW3111","LAW3112","LAW3117","LAW4101","LAW4102","LAW4103","LAW4104","LAW4105","LAW4106","LAW4107","LAW4108","LAW4109","LAW4110"],"electives":["LAW3131","LAW3132","LAW3133","LAW3134","LAW3135","LAW3136","LAW3138","LAW3155","LAW3168","LAW3169","LAW4173","LAW3137","LAW3156","LAW3161","LAW3162","LAW3163","LAW3164","LAW3165","LAW3167","LAW4137","LAW4138","LAW4143","LAW4154","LAW4159","LAW4169","LAW4170","LAW4171","LAW4176","LAW4177","LAW4180","LAW4183","LAW4184","LAW4185","LAW4186","LAW4187","LAW4190","LAW4191","LAW4192","LAW4193","LAW4194","LAW4195","LAW4131","LAW4132","LAW4133","LAW4134","LAW4135","LAW4136","LAW4149","LAW4160","LAW4161","LAW4163","LAW4188","LAW4189","LAW3139","LAW3140","LAW3141","LAW3142","LAW3143","LAW3144","LAW3145","LAW3146","LAW3147","LAW3149","LAW3150","LAW3151","LAW3152","LAW3153","LAW3154","LAW4144","LAW4145","LAW4150","LAW4151","LAW4178","LAW4179","LAW4181","LAW3148","LAW3157","LAW3158","LAW3159","LAW3160","LAW3170","LAW3171","LAW4146","LAW4147","LAW4148","LAW4152","LAW4153","LAW4155","LAW4156","LAW4157","LAW4158","LAW4164","LAW4165","LAW4166","LAW4167","LAW4168","LAW4172","LAW4174","LAW4175","LAW4182","LAW4196"]};
/* ---------- Ramkhamhaeng LL.B. curriculum (built in) ---------- */
function currentTermGuess() {
  const now = new Date(), be = now.getFullYear() + 543, m = now.getMonth() + 1;
  const g = m >= 6 && m <= 11 ? [be, '1'] : m === 12 ? [be, '2'] : m <= 3 ? [be - 1, '2'] : [be - 1, 'S'];
  return ru().terms.find(t => t.year === String(g[0]) && t.semester === g[1]);
}
function isETest(slot) { return String(slot || '').toLowerCase() === 'e-testing'; }
function examTitle(slot) { return isETest(slot) ? 'Taken by e-Testing at a test centre, on a date you book. It never clashes with paper exams.' : 'Exam slot ' + slot + ': day ' + slot[0] + ', ' + (slot[1] === 'A' ? 'morning' : 'afternoon'); }
function examPill(c) { return c && c.exam ? `<span class="exam${isETest(c.exam) ? ' etest' : ''}" title="${esc(examTitle(c.exam))}">${isETest(c.exam) ? 'e-Testing' : 'Exam ' + esc(c.exam)}<\/span> ` : ''; }
function hasCurriculum() { return ru().courses.some(c => c.code === 'LAW1101') && ru().courses.some(c => c.code === 'RAM1111'); }

function ruLoaderDialog() {
  const now = new Date();
  const startDefault = now.getFullYear() + 543 - (now.getMonth() + 1 < 6 ? 1 : 0);
  const first = RU_LLB.plan[0][2].join(', ');
  const d = openDialog(`
    <div class="dlg-head"><h3>Load the LL.B. curriculum<\/h3><button class="icon-btn" data-act="close" aria-label="Close">${I.x}<\/button><\/div>
    <div class="dlg-body">
      <p style="margin-top:0">Bachelor of Laws, 2565 curriculum, 140 credits, taken from your handbooks:<\/p>
      <ul class="load-list">
        <li><b>General education<\/b>, 30 credits: RAM1111 and RAM1301 plus one course from each group<\/li>
        <li><b>Required law courses<\/b>, 92 credits: all 40 LAW courses<\/li>
        <li><b>Law electives<\/b>, 12 credits from 101 elective courses in 5 groups<\/li>
        <li><b>Free electives<\/b>, 6 credits: two placeholders you can rename to your chosen courses<\/li>
      <\/ul>
      <label class="check-line"><input type="checkbox" id="ldPlan" checked><span><b>Also lay out the regional-campus study plan<\/b><br><span class="muted">8 semesters from the 2567 regional handbook, with each course\u2019s exam slot. The first semester is ${esc(first)}.<\/span><\/span><\/label>
      <label class="field" id="ldYearWrap" style="margin-left:27px"><span>First academic year (B.E.)<\/span><input class="input" id="ldYear" type="number" min="2500" max="2700" value="${startDefault}" style="max-width:160px"><\/label>
      <label class="check-line"><input type="checkbox" id="ldNeed" checked><span>Set credits to graduate to 140<\/span><\/label>
      <p class="muted" style="font-size:13.5px">Courses you already have are kept, including your own edits. Courses already in a semester stay where they are.<\/p>
    <\/div>
    <div class="dlg-foot"><div class="right"><button class="btn" data-act="close">Cancel<\/button><button class="btn primary" id="ldGo">Load curriculum<\/button><\/div><\/div>`);
  $('#ldPlan', d).onchange = e => { $('#ldYearWrap', d).classList.toggle('hidden', !e.target.checked); };
  $('#ldGo', d).onclick = async e => {
    const withPlan = $('#ldPlan', d).checked;
    const input = {
      courses: RU_LLB.courses.map(c => ({ code: c[0], name: c[1], credits: c[2], category: c[3], exam: c[4] })),
      plan: withPlan ? RU_LLB.plan.map(p => ({ yearOffset: p[0], semester: p[1], codes: p[2] })) : [],
      startYear: $('#ldYear', d).value,
      setNeeded: $('#ldNeed', d).checked
    };
    try {
      const r = await act('ruLoadCurriculum', [input], r => {
        const x = r.report;
        return 'Loaded ' + (x.coursesAdded + x.coursesUpdated) + ' courses' + (withPlan ? ', ' + x.planned + ' placed in ' + (x.termsAdded ? x.termsAdded + ' new ' : '') + 'semesters' : '');
      }, e.currentTarget);
      if (r.report.skipped.length) toast('Not placed: ' + r.report.skipped.slice(0, 3).join('; ') + (r.report.skipped.length > 3 ? ' and more' : ''), 'error');
      const first = ru().terms[0];
      if (first) S.ru.termId = first.id;
      closeDialog(); render();
    } catch (err) { }
  };
}

/** Degree requirements of the LL.B. 2565 curriculum, checked against your plan. */
function ruRequirements() {
  const R = ru();
  const planOf = {};
  R.plan.forEach(p => { const c = ruCourse(p.courseId); if (c) planOf[c.code] = { p: { passed: coursePassed(c.id) }, c }; });
  const cr = code => planOf[code] ? +planOf[code].c.credits || 0 : 0;
  const rows = [];
  RU_LLB.ge.forEach(g => {
    const cat = g[0], codes = g[1];
    const label = cat.replace('GE: ', '').replace(' (choose 1)', '').replace(' (required)', '');
    const chosen = codes.filter(c => planOf[c]);
    const passed = chosen.filter(c => planOf[c].p.passed);
    const state = passed.length ? 'passed' : chosen.length ? 'planned' : 'missing';
    const detail = chosen.length ? chosen.map(c => c + ' ' + planOf[c].c.name).join(', ') : (codes.length === 1 ? 'Required: ' + codes[0] : 'Choose 1 of ' + codes.length + ' courses');
    rows.push({ label, state, detail, group: cat, section: 'General education, 30 credits' });
  });
  const req = RU_LLB.required;
  const reqPlanned = req.filter(c => planOf[c]), reqPassed = req.filter(c => planOf[c] && planOf[c].p.passed);
  const missing = req.filter(c => !planOf[c]);
  rows.push({ label: 'All 40 required law courses', section: 'Specialized law courses, 104 credits',
    state: reqPassed.length === req.length ? 'passed' : !missing.length ? 'planned' : 'missing', group: 'Required law',
    detail: reqPlanned.length + ' of 40 planned, ' + reqPassed.length + ' passed' + (missing.length ? '. Not planned: ' + missing.slice(0, 4).join(', ') + (missing.length > 4 ? ' and ' + (missing.length - 4) + ' more' : '') : '') });
  const elect = RU_LLB.electives.filter(c => planOf[c]);
  const eCr = elect.reduce((n, c) => n + cr(c), 0), ePass = elect.filter(c => planOf[c].p.passed).reduce((n, c) => n + cr(c), 0);
  rows.push({ label: 'Law electives', section: 'Specialized law courses, 104 credits',
    state: ePass >= 12 ? 'passed' : eCr >= 12 ? 'planned' : 'missing', group: '__elect',
    detail: Math.min(eCr, 12) + ' of 12 credits planned' + (elect.length ? ': ' + elect.join(', ') : '') });
  const free = [...new Set(R.plan.map(p => p.courseId))].map(ruCourse).filter(c => c && c.category === 'Free elective');
  const fCr = free.reduce((n, c) => n + (+c.credits || 0), 0) + Math.max(0, eCr - 12);
  const fPass = [...new Set(R.plan.filter(rowPassed).map(p => p.courseId))].map(ruCourse).filter(c => c && c.category === 'Free elective').reduce((n, c) => n + (+c.credits || 0), 0);
  rows.push({ label: 'Free electives', section: 'Free electives, 6 credits', state: fPass >= 6 ? 'passed' : fCr >= 6 ? 'planned' : 'missing', group: 'Free elective',
    detail: Math.min(fCr, 6) + ' of 6 credits planned. Any Ramkhamhaeng course except LAW1104, LAW1105, LAW2114 to LAW2116 and LAW3113 to LAW3116.' });
  return rows;
}

function requirementsPanel() {
  if (!hasCurriculum()) return '';
  const rows = ruRequirements();
  const done = rows.filter(r => r.state !== 'missing').length;
  let section = '';
  return `<div class="panel req-panel"><h3>Degree requirements<\/h3>
    <p class="sub">LL.B. 2565 curriculum, 140 credits. ${done} of ${rows.length} covered by your plan. Click one to see its courses.<\/p>
    <ul class="req-list">${rows.map(r => {
      const head = r.section !== section ? `<li class="req-sec">${esc(r.section)}<\/li>` : '';
      section = r.section;
      return head + `<li class="req ${r.state}${S.ru.group === r.group ? ' on' : ''}" data-act="ru-group" data-group="${esc(r.group)}">
        <span class="req-ic">${r.state === 'missing' ? '' : I.check}<\/span>
        <div style="min-width:0"><div class="req-t">${esc(r.label)}<\/div><div class="req-d">${esc(r.detail)}<\/div><\/div>
        <span class="st ${r.state === 'passed' ? 'ok' : ''}">${r.state === 'passed' ? 'Passed' : r.state === 'planned' ? 'Planned' : 'To do'}<\/span><\/li>`;
    }).join('')}<\/ul><\/div>`;
}

function groupOptions() {
  const cats = [];
  RU_LLB.courses.forEach(c => { if (cats.indexOf(c[3]) < 0) cats.push(c[3]); });
  ru().courses.forEach(c => { if (c.category && cats.indexOf(c.category) < 0) cats.push(c.category); });
  const present = cats.filter(cat => ru().courses.some(c => c.category === cat));
  const g = S.ru.group || '';
  return `<option value="">All groups<\/option>` +
    (present.some(c => c.indexOf('Law elective') === 0) ? `<option value="__elect" ${g === '__elect' ? 'selected' : ''}>All law electives<\/option>` : '') +
    present.map(cat => `<option value="${esc(cat)}" ${g === cat ? 'selected' : ''}>${esc(cat)}<\/option>`).join('');
}
function inGroup(c) {
  const g = S.ru.group;
  if (!g) return true;
  if (g === '__elect') return (c.category || '').indexOf('Law elective') === 0;
  return c.category === g;
}

/* ---------- Reading timer (keeps running while you use other pages) ---------- */
const T = { running: false, paused: false, startedAt: 0, accMs: 0, segStart: 0, label: '', courseCode: '', goal: 0, goalHit: false };
try { Object.assign(T, JSON.parse(localStorage.getItem('studyhub-timer') || '{}')); } catch (e) { }
function saveTimer() { try { localStorage.setItem('studyhub-timer', JSON.stringify(T)); } catch (e) { } }
function elapsedMs() { return T.running ? T.accMs + (T.paused ? 0 : Date.now() - T.segStart) : 0; }
function fmtClock(ms) { const s = Math.floor(ms / 1000); return pad2(Math.floor(s / 3600)) + ':' + pad2(Math.floor(s % 3600 / 60)) + ':' + pad2(s % 60); }
function readTimerForm() { const l = $('#tmLabel'), c = $('#tmCourse'); if (l) T.label = l.value; if (c) T.courseCode = c.value; saveTimer(); }
function timerStart() { readTimerForm(); Object.assign(T, { running: true, paused: false, startedAt: Date.now(), segStart: Date.now(), accMs: 0, goalHit: false }); saveTimer(); render(); }
function timerPause() { if (!T.running || T.paused) return; T.accMs += Date.now() - T.segStart; T.paused = true; saveTimer(); render(); }
function timerResume() { if (!T.running || !T.paused) return; T.segStart = Date.now(); T.paused = false; saveTimer(); render(); }
function timerReset() { Object.assign(T, { running: false, paused: false, accMs: 0, goalHit: false }); saveTimer(); render(); }
async function timerStop(btn) {
  readTimerForm();
  const minutes = Math.floor(elapsedMs() / 60000);
  if (minutes < 1) { toast('Read for at least a minute before saving, or press Discard.', 'error'); return; }
  const session = { start: localDt(new Date(T.startedAt)), end: localDt(new Date()), minutes, label: T.label, courseCode: T.courseCode };
  try { await act('ruSaveSession', [session], 'Saved ' + fmtMin(minutes) + ' of reading to your calendar', btn); timerReset(); } catch (e) { }
}
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35].forEach(t => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.15, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.3);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.3);
    });
  } catch (e) { }
}
setInterval(() => {
  if (!T.running) return;
  const ms = elapsedMs();
  const c = $('#ruClock'); if (c) c.textContent = fmtClock(ms);
  const b = $('#binderTimerClock'); if (b) b.textContent = fmtClock(ms);
  if (T.goal) {
    const g = $('#goalBar'); if (g) g.style.width = Math.min(100, ms / (T.goal * 600)) + '%';
    if (!T.goalHit && ms >= T.goal * 60000) { T.goalHit = true; saveTimer(); beep(); toast('Goal reached: ' + T.goal + ' minutes. Keep going, or press Stop and save.'); const gt = $('#goalText'); if (gt) gt.textContent = 'Goal of ' + T.goal + ' minutes reached'; }
  }
}, 1000);

function binderTimer() {
  if (!T.running) return '';
  return `<button class="binder-timer ${T.paused ? 'paused' : ''}" data-act="go" data-view="ru" title="Open the reading timer"><i><\/i><span>${T.paused ? 'Paused' : 'Reading'}<\/span><span id="binderTimerClock" style="margin-left:auto">${fmtClock(elapsedMs())}<\/span><\/button>`;
}

/* ---------- Page ---------- */
function viewRu() {
  const tabs = [['timer', 'Reading timer'], ['calendar', 'Reading calendar'], ['planner', 'Course planner']];
  return `<div class="page-head ru-head"><div><h2>Ramkhamhaeng Hub <span class="ru-badge">Faculty of Law<\/span><\/h2>
      <p>Time your reading, see it on a calendar, and plan your courses semester by semester within the credit rules.<\/p><\/div><\/div>
    <div class="ru-tabs">${tabs.map(t => `<button class="chip ${S.ru.tab === t[0] ? 'active' : ''}" data-act="ru-tab" data-tab="${t[0]}">${t[1]}<\/button>`).join('')}<\/div>
    ${S.ru.tab === 'calendar' ? ruCalendar() : S.ru.tab === 'planner' ? ruPlanner() : ruTimer()}`;
}

function courseOptions(selected) {
  const opt = c => `<option value="${esc(c.code)}" ${c.code === selected ? 'selected' : ''}>${esc(c.code + ' ' + c.name)}<\/option>`;
  const all = ru().courses.slice().sort((a, b) => a.code.localeCompare(b.code));
  const cur = currentTermGuess();
  const mine = cur ? ru().plan.filter(p => p.termId === cur.id).map(p => ruCourse(p.courseId)).filter(Boolean).sort((a, b) => a.code.localeCompare(b.code)) : [];
  const rest = all.filter(c => mine.indexOf(c) < 0);
  return `<option value="">No specific course<\/option>` +
    (mine.length ? `<optgroup label="This semester, ${esc(termName(cur))}">${mine.map(opt).join('')}<\/optgroup><optgroup label="All other courses">${rest.map(opt).join('')}<\/optgroup>` : all.map(opt).join(''));
}

function sessionRow(s, showDate) {
  const st = pd(s.start), en = pd(s.end);
  const t = (d) => d ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
  const title = s.label || (s.courseCode ? courseText(s.courseCode) : 'Reading');
  const sub = [showDate && st ? st.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : '', t(st) + ' to ' + t(en), s.label && s.courseCode ? s.courseCode : ''].filter(Boolean).join(', ');
  return `<li><div style="min-width:0"><div class="lb" title="${esc(title)}">${esc(title)}<\/div><div class="sb">${esc(sub)}<\/div><\/div>
    <span class="mn">${fmtMin(s.minutes)}<\/span>
    <button class="icon-btn" data-act="ru-sess-del" data-id="${s.id}" title="Delete session" aria-label="Delete session">${I.trash}<\/button><\/li>`;
}

function manualForm(dateStr) {
  return `<div class="mini-form">
    <label class="field wide" style="margin:0"><span>Date<\/span><input class="input" type="date" id="mfDate" value="${esc(dateStr)}"><\/label>
    <label class="field" style="margin:0"><span>From<\/span><input class="input" type="time" id="mfFrom" value="19:00"><\/label>
    <label class="field" style="margin:0"><span>To<\/span><input class="input" type="time" id="mfTo" value="20:00"><\/label>
    <label class="field wide" style="margin:0"><span>Course<\/span><select class="input" id="mfCourse">${courseOptions('')}<\/select><\/label>
    <label class="field wide" style="margin:0"><span>What did you read?<\/span><input class="input" id="mfLabel" placeholder="e.g. Criminal law, chapter 2"><\/label>
  <\/div>
  <div class="link-row"><button class="btn" data-act="ru-manual-add">${I.plus} Add session<\/button><\/div>`;
}

/* ---------- Timer tab ---------- */
function ruTimer() {
  const byDay = minutesByDay();
  const today = new Date();
  const todayKey = ymd(today);
  let week = 0;
  for (let i = 0; i < 7; i++) { const d = new Date(today); d.setDate(d.getDate() - i); week += byDay[ymd(d)] || 0; }
  let streak = 0;
  const d0 = new Date(today);
  if (!byDay[todayKey]) d0.setDate(d0.getDate() - 1);
  while (byDay[ymd(d0)]) { streak++; d0.setDate(d0.getDate() - 1); }
  const total = ru().sessions.reduce((n, s) => n + (+s.minutes || 0), 0);
  const todays = ru().sessions.filter(s => (s.start || '').slice(0, 10) === todayKey).sort((a, b) => b.start.localeCompare(a.start));

  const ms = elapsedMs();
  const state = !T.running ? '<p class="timer-state">Ready when you are<\/p>' : T.paused ? '<p class="timer-state">Paused<\/p>' : '<p class="timer-state live">Reading now<\/p>';
  const goals = [0, 25, 50, 90, 120];
  const actions = !T.running
    ? `<button class="btn primary big" data-act="tm-start">${I.play} Start reading<\/button>`
    : `${T.paused ? `<button class="btn primary big" data-act="tm-resume">${I.play} Resume<\/button>` : `<button class="btn big" data-act="tm-pause">${I.pause} Pause<\/button>`}
       <button class="btn primary big" data-act="tm-stop">${I.check} Stop and save<\/button>
       <button class="btn danger" data-act="tm-discard">Discard<\/button>`;

  // By course, this month
  const monthKey = todayKey.slice(0, 7);
  const byCourse = {};
  ru().sessions.filter(s => (s.start || '').slice(0, 7) === monthKey).forEach(s => { const k = s.courseCode || ''; byCourse[k] = (byCourse[k] || 0) + (+s.minutes || 0); });
  const courseRows = Object.keys(byCourse).map(k => ({ k, m: byCourse[k] })).sort((a, b) => b.m - a.m);
  const maxC = courseRows.length ? courseRows[0].m : 1;

  return `<div class="grid-2"><div>
    <div class="panel timer-card">
      ${state}
      <div class="clock ${T.paused ? 'paused' : ''}" id="ruClock">${fmtClock(ms)}<\/div>
      ${T.goal ? `<div class="goal-bar"><i id="goalBar" style="width:${Math.min(100, ms / (T.goal * 600))}%"><\/i><\/div>` : ''}
      <p class="goal-text" id="goalText">${T.goal ? (T.goalHit ? 'Goal of ' + T.goal + ' minutes reached' : 'Goal: ' + T.goal + ' minutes') : ''}<\/p>
      <div class="timer-form">
        <label class="field" style="margin:0"><span>Course<\/span><select class="input" id="tmCourse">${courseOptions(T.courseCode)}<\/select><\/label>
        <label class="field" style="margin:0"><span>What are you reading?<\/span><input class="input" id="tmLabel" value="${esc(T.label)}" placeholder="e.g. Civil and Commercial Code, book 1"><\/label>
      <\/div>
      <div class="goal-row" style="margin-top:14px"><span>Goal<\/span>${goals.map(g => `<button class="chip ${T.goal === g ? 'active' : ''}" data-act="tm-goal" data-min="${g}">${g ? g + ' min' : 'None'}<\/button>`).join('')}<\/div>
      <div class="timer-actions">${actions}<\/div>
    <\/div>
    <div class="stats">
      <div class="stat"><div class="v">${fmtMin(byDay[todayKey] || 0)}<\/div><div class="l">Today<\/div><\/div>
      <div class="stat"><div class="v">${fmtMin(week)}<\/div><div class="l">Last 7 days<\/div><\/div>
      <div class="stat"><div class="v">${streak} day${streak === 1 ? '' : 's'}<\/div><div class="l">Reading streak<\/div><\/div>
      <div class="stat"><div class="v">${fmtMin(total)}<\/div><div class="l">All time, ${ru().sessions.length} sessions<\/div><\/div>
    <\/div>
    <div class="panel chart">
      <div class="pl-head" style="margin-bottom:6px"><div><h3>Reading time<\/h3><p class="sub" style="margin:2px 0 0">Minutes read per day<\/p><\/div>
        <div class="filters" style="margin:0">${[7, 14, 30].map(n => `<button class="chip ${S.ru.chartDays === n ? 'active' : ''}" data-act="ru-chart" data-days="${n}">${n} days<\/button>`).join('')}<\/div><\/div>
      ${ruChart(S.ru.chartDays, byDay)}
    <\/div>
  <\/div>
  <aside>
    <div class="panel"><h3>Today<\/h3><p class="sub">${todays.length ? todays.length + ' session' + (todays.length === 1 ? '' : 's') + ', ' + fmtMin(byDay[todayKey] || 0) : 'No reading saved today yet.'}<\/p>
      ${todays.length ? `<ul class="sess-list">${todays.map(s => sessionRow(s, false)).join('')}<\/ul>` : ''}<\/div>
    <div class="panel"><h3>By course this month<\/h3><p class="sub">${today.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}<\/p>
      ${courseRows.length ? `<ul class="hbars">${courseRows.map(r => `<li><span class="nm">${esc(r.k ? courseText(r.k) : 'No specific course')}<\/span><span class="m">${fmtMin(r.m)}<\/span><span class="b"><i style="width:${Math.max(3, r.m / maxC * 100)}%"><\/i><\/span><\/li>`).join('')}<\/ul>` : '<p class="muted">Sessions you save this month will show up here.<\/p>'}<\/div>
    <div class="panel"><h3>Forgot the timer?<\/h3><p class="sub">Add a reading session by hand.<\/p>${manualForm(todayKey)}<\/div>
  <\/aside><\/div>`;
}

function ruChart(n, byDay) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) { const d = sod(new Date()); d.setDate(d.getDate() - i); days.push({ d, m: byDay[ymd(d)] || 0 }); }
  const W = 700, H = 230, L = 40, R = 10, Tp = 18, B = 34;
  const pw = W - L - R, ph = H - Tp - B;
  const peak = Math.max(60, ...days.map(x => x.m));
  const step = peak <= 120 ? 30 : peak <= 240 ? 60 : peak <= 480 ? 120 : 240;
  const top = Math.ceil(peak / step) * step;
  const slot = pw / n, bw = Math.max(4, slot * 0.62);
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Minutes read per day for the last ${n} days">`;
  for (let v = 0; v <= top; v += step) {
    const y = Tp + ph - v / top * ph;
    svg += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text x="${L - 8}" y="${y + 4}" text-anchor="end">${v < 60 ? v + 'm' : (v / 60) + 'h'}<\/text>`;
  }
  days.forEach((x, i) => {
    const h = x.m / top * ph, cx = L + slot * i + slot / 2;
    const isToday = i === n - 1;
    const label = x.d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    if (x.m) svg += `<rect class="bar ${isToday ? 'today' : ''}" x="${cx - bw / 2}" y="${Tp + ph - h}" width="${bw}" height="${h}" rx="3"><title>${esc(label)}: ${fmtMin(x.m)}<\/title><\/rect>`;
    if (x.m && n <= 14) svg += `<text class="val" x="${cx}" y="${Tp + ph - h - 5}" text-anchor="middle">${fmtMin(x.m)}<\/text>`;
    const showLabel = n <= 14 || i % 5 === (n - 1) % 5;
    if (showLabel) svg += `<text x="${cx}" y="${H - B + 16}" text-anchor="middle">${n <= 7 ? x.d.toLocaleDateString(undefined, { weekday: 'short' }) : x.d.getDate()}<\/text>`;
    if (n <= 7) svg += `<text x="${cx}" y="${H - B + 30}" text-anchor="middle">${x.d.getDate()}<\/text>`;
  });
  return svg + '<\/svg>';
}

/* ---------- Calendar tab ---------- */
function ruCalendar() {
  const today = new Date();
  const month = S.ru.month ? new Date(S.ru.month) : new Date(today.getFullYear(), today.getMonth(), 1);
  const sel = S.ru.day || ymd(today);
  const byDay = minutesByDay();
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first); start.setDate(1 - first.getDay());
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const weeks = Math.ceil((first.getDay() + lastDay.getDate()) / 7);
  const cells = [];
  for (let i = 0; i < weeks * 7; i++) { const d = new Date(start); d.setDate(start.getDate() + i); cells.push(d); }
  const dows = [...Array(7)].map((_, i) => new Date(2026, 1, 1 + i).toLocaleDateString(undefined, { weekday: 'short' }));
  const monthTotal = Object.keys(byDay).filter(k => k.slice(0, 7) === ymd(first).slice(0, 7)).reduce((n, k) => n + byDay[k], 0);
  const daysRead = Object.keys(byDay).filter(k => k.slice(0, 7) === ymd(first).slice(0, 7) && byDay[k] > 0).length;
  const selDate = pd(sel);
  const daySessions = ru().sessions.filter(s => (s.start || '').slice(0, 10) === sel).sort((a, b) => a.start.localeCompare(b.start));

  return `<div class="grid-2">
    <div class="panel">
      <div class="cal-head">
        <h3>${first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}<\/h3>
        <button class="btn small" data-act="cal-today">Today<\/button>
        <button class="icon-btn" data-act="cal-move" data-dir="-1" title="Previous month" aria-label="Previous month">${I.left}<\/button>
        <button class="icon-btn" data-act="cal-move" data-dir="1" title="Next month" aria-label="Next month">${I.right}<\/button>
      <\/div>
      <p class="sub">${monthTotal ? fmtMin(monthTotal) + ' read on ' + daysRead + ' day' + (daysRead === 1 ? '' : 's') + ' this month' : 'No reading saved in this month yet.'}<\/p>
      <div class="cal">
        ${dows.map(d => `<div class="dw">${d}<\/div>`).join('')}
        ${cells.map(d => { const k = ymd(d), m = byDay[k] || 0;
          return `<button class="dayc ${heat(m)} ${d.getMonth() !== first.getMonth() ? 'out' : ''} ${k === ymd(today) ? 'today' : ''} ${k === sel ? 'sel' : ''}" data-act="cal-day" data-day="${k}" aria-label="${esc(d.toDateString())}, ${m ? fmtMin(m) : 'no reading'}">
            <span class="n">${d.getDate()}<\/span><span class="mins">${m ? fmtMin(m) : ''}<\/span><\/button>`; }).join('')}
      <\/div>
      <div class="legend"><span>Less<\/span><i><\/i><i class="h1"><\/i><i class="h2"><\/i><i class="h3"><\/i><i class="h4"><\/i><span>More (2h+)<\/span><\/div>
    <\/div>
    <aside>
      <div class="panel"><h3>${selDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}<\/h3>
        <p class="sub">${daySessions.length ? fmtMin(byDay[sel]) + ' in ' + daySessions.length + ' session' + (daySessions.length === 1 ? '' : 's') : 'No reading on this day.'}<\/p>
        ${daySessions.length ? `<ul class="sess-list">${daySessions.map(s => sessionRow(s, false)).join('')}<\/ul>` : ''}<\/div>
      <div class="panel"><h3>Add a session to this day<\/h3><p class="sub">For reading you did without the timer.<\/p>${manualForm(sel)}<\/div>
    <\/aside><\/div>`;
}

/* ---------- Course planner tab ---------- */
function suggestTerm() {
  const terms = ru().terms;
  if (terms.length) {
    const last = terms[terms.length - 1];
    return last.semester === '1' ? { year: +last.year, semester: '2' } : last.semester === '2' ? { year: +last.year, semester: 'S' } : { year: +last.year + 1, semester: '1' };
  }
  const now = new Date(), be = now.getFullYear() + 543, m = now.getMonth() + 1;
  if (m >= 6 && m <= 10) return { year: be, semester: '2' };
  if (m >= 11) return { year: be + 1, semester: '1' };
  if (m <= 3) return { year: be - 1, semester: 'S' };
  return { year: be, semester: '1' };
}

function parseCourseLines(text) {
  const rows = [], bad = [];
  const cr = v => { const m = String(v).trim().match(/^(\d{1,2})(\s*\(.*\))?$/); return m ? +m[1] : null; };
  String(text || '').split(/\r?\n/).forEach(line => {
    const raw = line.trim();
    if (!raw) return;
    if (/^(code|course code|course)\b/i.test(raw)) return;
    let code = '', name = '', credits = null, prereqs = '';
    const parts = raw.indexOf('\t') > -1 ? raw.split('\t') : raw.indexOf(',') > -1 ? raw.split(',') : null;
    if (parts) {
      const p = parts.map(x => x.trim());
      let ci = -1;
      for (let i = p.length - 1; i >= 2; i--) if (cr(p[i]) !== null) { ci = i; break; }
      if (ci > 1) { code = p[0]; name = p.slice(1, ci).join(', '); credits = cr(p[ci]); prereqs = p.slice(ci + 1).join(' '); }
    } else {
      const m = raw.match(/^([A-Za-z]{2,4}\s?\d{3,4})\s+(.+?)\s+(\d{1,2})(?:\s*\(\s*\d+\s*-\s*\d+\s*-\s*\d+\s*\))?(?:\s+(.*))?$/);
      if (m) { code = m[1]; name = m[2]; credits = +m[3]; prereqs = m[4] || ''; }
    }
    if (code && name && credits !== null) rows.push({ code: code.toUpperCase().replace(/\s+/g, ''), name, credits, prereqs: ((prereqs.toUpperCase().match(/[A-Z]{2,4}\s?\d{3,4}/g)) || []).map(x => x.replace(/\s+/g, '')).join(', ') });
    else bad.push(raw);
  });
  return { rows, bad };
}

function importBox(open) {
  const pv = S.ru.importRows;
  return `<div class="import-box" ${open ? '' : 'style="margin-top:14px"'}>
    <label class="field" style="margin:0"><span>Paste your course list<\/span>
      <textarea class="input" id="ruImport" placeholder="One course per line: code, name, credits, prerequisites (optional)\nLAW1101, Introduction to Law, 3\nLAW2101, Example course, 3, LAW1101"><\/textarea>
      <small>Copy rows from Excel or Google Sheets, or type them with commas. Credits like 3(3-0-6) work too. Courses with the same code are updated.<\/small><\/label>
    <div class="link-row"><button class="btn" data-act="ru-import-read">Read list<\/button><\/div>
    ${pv ? `<div class="import-preview"><strong>Found ${pv.rows.length} course${pv.rows.length === 1 ? '' : 's'}<\/strong>${pv.bad.length ? `, ${pv.bad.length} line${pv.bad.length === 1 ? '' : 's'} not understood` : ''}
      <ul>${pv.rows.slice(0, 6).map(r => `<li>${esc(r.code)} ${esc(r.name)}, ${r.credits} credits${r.prereqs ? ', needs ' + esc(r.prereqs) : ''}<\/li>`).join('')}${pv.rows.length > 6 ? `<li>and ${pv.rows.length - 6} more<\/li>` : ''}<\/ul>
      ${pv.bad.length ? `<p style="margin:6px 0 0;color:var(--red)">Not understood: ${pv.bad.slice(0, 3).map(esc).join('; ')}${pv.bad.length > 3 ? '\u2026' : ''}<\/p>` : ''}
      <div class="link-row"><button class="btn primary small" data-act="ru-import-go" ${pv.rows.length ? '' : 'disabled'}>Import ${pv.rows.length} course${pv.rows.length === 1 ? '' : 's'}<\/button><button class="btn small" data-act="ru-import-cancel">Cancel<\/button><\/div><\/div>` : ''}
  <\/div>`;
}

/* ---------- Grades, GPA and retakes ---------- */
const GRADES = [['A', 4, 'Excellent', '\u0e14\u0e35\u0e40\u0e22\u0e35\u0e48\u0e22\u0e21'], ['B+', 3.5, 'Very good', '\u0e14\u0e35\u0e21\u0e32\u0e01'], ['B', 3, 'Good', '\u0e14\u0e35'], ['C+', 2.5, 'Fairly good', '\u0e1b\u0e32\u0e19\u0e01\u0e25\u0e32\u0e07'], ['C', 2, 'Fair', '\u0e1e\u0e2d\u0e43\u0e0a\u0e49'], ['D+', 1.5, 'Very poor', '\u0e2d\u0e48\u0e2d\u0e19'], ['D', 1, 'Poor', '\u0e2d\u0e48\u0e2d\u0e19\u0e21\u0e32\u0e01'], ['F', 0, 'Failure', '\u0e2a\u0e2d\u0e1a\u0e15\u0e01']];
const GP = {}; GRADES.forEach(g => { GP[g[0]] = g[1]; });
function rowPassed(p) { return p.grade ? p.grade !== 'F' : !!p.passed; }
function coursePassed(courseId) { return ru().plan.some(p => p.courseId === courseId && rowPassed(p)); }
function attemptOrder(p) { const t = ru().terms.find(x => x.id === p.termId); return (t ? termOrder(t) : 999999) * 10 + (p.kind === 'retake' ? 1 : 0); }
function gpaFor(rows) {
  let pts = 0, cr = 0;
  rows.forEach(p => { if (!(p.grade in GP)) return; const k = +((ruCourse(p.courseId) || {}).credits) || 0; pts += GP[p.grade] * k; cr += k; });
  return { gpa: cr ? pts / cr : null, credits: cr };
}
function cumulativeRows() {
  const graded = ru().plan.filter(p => p.grade in GP);
  if (ru().gpaPolicy === 'all') return graded;
  const best = {};
  graded.forEach(p => { const cur = best[p.courseId]; if (!cur || attemptOrder(p) > attemptOrder(cur)) best[p.courseId] = p; });
  return Object.keys(best).map(k => best[k]);
}
function fmtGpa(g) { return g === null ? '\u2013' : (Math.floor(g * 100 + 1e-9) / 100).toFixed(2); }
function uniqueCredits(rows) { const seen = {}; let n = 0; rows.forEach(p => { if (seen[p.courseId]) return; seen[p.courseId] = 1; n += +((ruCourse(p.courseId) || {}).credits) || 0; }); return n; }
function gradeSelect(p, label) {
  return `<select class="input grade-sel ${p.grade === 'F' ? 'is-f' : p.grade ? 'is-g' : ''}" data-change="ru-grade" data-id="${p.id}" aria-label="Grade for ${esc(label)}" title="Grade">
    <option value="">Grade<\/option>${GRADES.map(g => `<option value="${g[0]}" ${p.grade === g[0] ? 'selected' : ''}>${g[0]}  ${g[1].toFixed(2)}<\/option>`).join('')}<\/select>`;
}

function gpaPanel() {
  const R = ru();
  const cum = gpaFor(cumulativeRows());
  const terms = R.terms.slice().sort((a, b) => termOrder(a) - termOrder(b));
  const perTerm = terms.map(t => ({ t, g: gpaFor(R.plan.filter(p => p.termId === t.id)) })).filter(x => x.g.gpa !== null);
  const fails = R.plan.filter(p => p.grade === 'F' && !R.plan.some(q => q.courseId === p.courseId && attemptOrder(q) > attemptOrder(p)));
  return `<div class="panel gpa-panel">
    <div class="gpa-big"><span class="l">Cumulative GPA<\/span><span class="v">${fmtGpa(cum.gpa)}<\/span>
      <span class="sub">${cum.credits ? 'from ' + cum.credits + ' graded credit' + (cum.credits === 1 ? '' : 's') : 'Enter grades in your semesters to see it'}<\/span><\/div>
    <div class="gpa-terms">${perTerm.length ? perTerm.map(x => `<div class="gpa-term"><span>${esc(termShort(x.t))}<\/span><b>${fmtGpa(x.g.gpa)}<\/b><small>${x.g.credits} cr<\/small><\/div>`).join('') : '<p class="muted" style="margin:0">Semester GPAs appear here once you enter grades.<\/p>'}
      ${fails.length ? `<p class="fail-note">${fails.length} course${fails.length === 1 ? '' : 's'} with F not retaken yet: ${fails.map(p => esc((ruCourse(p.courseId) || {}).code || '')).join(', ')}<\/p>` : ''}<\/div>
    <div class="gpa-side">
      <div class="field" style="margin:0"><span>When a course is retaken, count<\/span>
        <div class="seg">${[['latest', 'Latest grade only'], ['all', 'Every attempt']].map(o => `<label><input type="radio" name="gpaPol" data-act="ru-gpa-policy" data-policy="${o[0]}" ${R.gpaPolicy === o[0] ? 'checked' : ''}><span>${o[1]}<\/span><\/label>`).join('')}<\/div><\/div>
      <details class="scale"><summary>Grade scale<\/summary><ul>${GRADES.map(g => `<li><b>${g[0]}<\/b><span>${g[1].toFixed(2)}<\/span><span>${g[3]} / ${g[2]}<\/span><\/li>`).join('')}<\/ul><\/details>
    <\/div><\/div>`;
}

function retakeTray(terms) {
  const R = ru();
  const tray = R.plan.filter(p => p.kind === 'retake' && !p.termId);
  const scheduled = R.plan.filter(p => p.kind === 'retake' && p.termId && !p.grade).length;
  return `<div class="panel retake-tray" data-drop-retake="1">
    <div class="pl-head" style="margin-bottom:4px"><div><h3>Retakes (\u0e0b\u0e48\u0e2d\u0e21)<\/h3>
      <p class="sub" style="margin:2px 0 0">Swipe a course left on your phone, drag it here on a computer, or press ${I.sync}. Schedule it into a semester, then enter the grade after the exam.<\/p><\/div><\/div>
    ${tray.length ? `<ul class="tray-list">${tray.map(p => {
      const c = ruCourse(p.courseId); if (!c) return '';
      const prev = R.plan.find(x => x.id === p.retakeOf);
      const prevT = prev && R.terms.find(t => t.id === prev.termId);
      return `<li draggable="true" data-retake-id="${p.id}">
        <span class="code">${esc(c.code)}<\/span><div style="min-width:0"><div class="nm" title="${esc(c.name)}">${esc(c.name)}<\/div>
        <div class="tc">${c.credits} credits, ${prev && prev.grade ? 'was ' + esc(prev.grade) + (prevT ? ' in ' + esc(termShort(prevT)) : '') : 'planned ahead, grade not known yet'}<\/div><\/div>
        <select class="input" data-change="ru-move" data-id="${p.id}" aria-label="Schedule retake of ${esc(c.code)}"><option value="">Schedule in<\/option>${terms.map(t => `<option value="${t.id}">${esc(termShort(t))}<\/option>`).join('')}<\/select>
        <button class="icon-btn" data-act="ru-plan-remove" data-id="${p.id}" title="Cancel retake" aria-label="Cancel retake">${I.x}<\/button><\/li>`;
    }).join('')}<\/ul>` : `<p class="tray-empty">No retakes waiting.${scheduled ? ' ' + scheduled + ' retake' + (scheduled === 1 ? ' is' : 's are') + ' scheduled in your semesters.' : ''}<\/p>`}
  <\/div>`;
}

function retakeDialog(planId) {
  const p = ru().plan.find(x => x.id === planId); const c = p && ruCourse(p.courseId); if (!c) return;
  const terms = ru().terms.slice().sort((a, b) => termOrder(a) - termOrder(b)).filter(t => t.id !== p.termId);
  const d = openDialog(`
    <div class="dlg-head"><h3>Retake ${esc(c.code)}<\/h3><button class="icon-btn" data-act="close" aria-label="Close">${I.x}<\/button><\/div>
    <div class="dlg-body"><p style="margin-top:0">${esc(c.name)}, ${c.credits} credits${p.grade ? '. Current grade: <b>' + esc(p.grade) + '<\/b>' : '. No grade yet, so this plans the retake ahead.'}<\/p>
      <label class="check-line"><input type="radio" name="rtWhere" value="" checked><span><b>Put it in the retake tray<\/b><br><span class="muted">Choose the semester later.<\/span><\/span><\/label>
      <label class="check-line"><input type="radio" name="rtWhere" value="term"><span><b>Plan it in a semester now<\/b><\/span><\/label>
      <select class="input" id="rtTerm" style="margin-left:27px;max-width:260px">${terms.map(t => `<option value="${t.id}">${esc(termName(t))}<\/option>`).join('')}<\/select>
      <p class="muted" style="font-size:13.5px">Your current grade stays on record. Enter the new grade after the retake exam.<\/p><\/div>
    <div class="dlg-foot"><div class="right"><button class="btn" data-act="close">Cancel<\/button><button class="btn primary" id="rtGo">Send to retake<\/button><\/div><\/div>`);
  $('#rtTerm', d).onfocus = () => { $('input[name=rtWhere][value=term]', d).checked = true; };
  $('#rtGo', d).onclick = async e => {
    const where = $('input[name=rtWhere]:checked', d).value === 'term' ? $('#rtTerm', d).value : '';
    try { await act('ruRetake', [planId, where], c.code + (where ? ' retake planned' : ' moved to the retake tray'), e.currentTarget); closeDialog(); } catch (err) { }
  };
}

/** Swipe left on touch screens, drag and drop with a mouse. */
function wireRetakes() {
  $$('.sw').forEach(li => {
    const body = $('.sw-body', li); if (!body) return;
    let x0 = null, dx = 0;
    body.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' || e.target.closest('select, button, input, a')) return;
      x0 = e.clientX; dx = 0; body.setPointerCapture(e.pointerId); body.style.transition = 'none';
    });
    body.addEventListener('pointermove', e => {
      if (x0 === null) return;
      dx = Math.min(0, Math.max(-140, e.clientX - x0));
      body.style.transform = `translateX(${dx}px)`; li.classList.toggle('armed', dx < -90);
    });
    const end = () => {
      if (x0 === null) return;
      body.style.transition = ''; body.style.transform = ''; li.classList.remove('armed');
      if (dx < -90) act('ruRetake', [li.dataset.id, ''], 'Moved to the retake tray').catch(() => {});
      x0 = null;
    };
    body.addEventListener('pointerup', end); body.addEventListener('pointercancel', end);
    body.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', 'plan:' + li.dataset.id); li.classList.add('dragging'); });
    body.addEventListener('dragend', () => li.classList.remove('dragging'));
  });
  $$('[data-retake-id]').forEach(li => {
    li.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', 'retake:' + li.dataset.retakeId));
  });
  const tray = $('[data-drop-retake]');
  if (tray) {
    tray.addEventListener('dragover', e => { e.preventDefault(); tray.classList.add('drop'); });
    tray.addEventListener('dragleave', e => { if (!tray.contains(e.relatedTarget)) tray.classList.remove('drop'); });
    tray.addEventListener('drop', e => {
      e.preventDefault(); tray.classList.remove('drop');
      const v = e.dataTransfer.getData('text/plain');
      if (v.indexOf('plan:') === 0) act('ruRetake', [v.slice(5), ''], 'Moved to the retake tray').catch(() => {});
    });
  }
  $$('.term[data-id]').forEach(card => {
    card.addEventListener('dragover', e => { if (e.dataTransfer.types.indexOf('text/plain') > -1) { e.preventDefault(); card.classList.add('drop'); } });
    card.addEventListener('dragleave', e => { if (!card.contains(e.relatedTarget)) card.classList.remove('drop'); });
    card.addEventListener('drop', e => {
      e.preventDefault(); card.classList.remove('drop');
      const v = e.dataTransfer.getData('text/plain');
      if (v.indexOf('retake:') === 0) act('ruPlanMove', [v.slice(7), card.dataset.id], 'Retake scheduled').catch(() => {});
    });
  });
}

function ruPlanner() {
  const R = ru();
  const terms = R.terms.slice().sort((a, b) => termOrder(a) - termOrder(b));
  if (!terms.find(t => t.id === S.ru.termId)) S.ru.termId = terms.length ? terms[terms.length - 1].id : null;
  const active = terms.find(t => t.id === S.ru.termId);
  const planned = uniqueCredits(R.plan);
  const passed = uniqueCredits(R.plan.filter(rowPassed));
  const need = +R.creditsNeeded || 0;
  const sug = suggestTerm();
  const termOf = {};
  R.plan.filter(p => p.kind !== 'retake').forEach(p => { termOf[p.courseId] = R.terms.find(t => t.id === p.termId); });
  const planByCode = {};
  R.plan.filter(p => p.kind !== 'retake').forEach(p => { const c = ruCourse(p.courseId); if (c) planByCode[c.code] = p; });

  const summary = `<div class="stats" style="margin-top:0">
    <div class="stat"><div class="v">${planned}<\/div><div class="l">Credits planned<\/div><\/div>
    <div class="stat"><div class="v">${passed}<\/div><div class="l">Credits passed<\/div><\/div>
    <div class="stat"><div class="v">${need ? Math.max(0, need - passed) : '\u2013'}<\/div><div class="l">${need ? 'Credits still to pass' : 'Set credits to graduate'}<\/div><\/div>
    <div class="stat"><div class="l" style="margin-bottom:4px">Credits to graduate<\/div>
      <div style="display:flex;gap:6px"><input class="input" id="ruNeed" type="number" min="1" max="400" value="${esc(R.creditsNeeded)}" placeholder="e.g. 140" style="padding:6px 8px"><button class="btn small" data-act="ru-need-save">Save<\/button><\/div>
      ${need ? `<div class="prog" title="${passed} passed, ${planned - passed} planned of ${need}"><span class="p1" style="width:${Math.min(100, passed / need * 100)}%"><\/span><span class="p2" style="width:${Math.max(0, Math.min(100 - passed / need * 100, (planned - passed) / need * 100))}%"><\/span><\/div>` : ''}<\/div>
  <\/div>`;

  const rule = `<div class="rule-note">${I.scale}<div><b>Credit rules:<\/b> a regular semester (1 or 2) must have <b>at least 9 and at most 22 credits<\/b>. A summer semester can have <b>at most 9 credits<\/b>. Study Hub won\u2019t let a semester go over its limit and warns you when a regular semester is under 9.<\/div><\/div>`;

  const termCard = t => {
    const lim = termLimits(t), total = termCredits(t.id);
    const rows = R.plan.filter(p => p.termId === t.id).map(p => ({ p, c: ruCourse(p.courseId) })).filter(x => x.c).sort((a, b) => a.c.code.localeCompare(b.c.code));
    const scale = Math.max(lim.max, total);
    const cls = total > lim.max ? 'over' : total < lim.min ? 'low' : '';
    const status = total === 0 ? '<span>No courses yet<\/span>'
      : total > lim.max ? `<span class="bad">${total - lim.max} over the ${lim.max}-credit limit<\/span>`
      : total < lim.min ? `<span class="warn">${lim.min - total} more credit${lim.min - total === 1 ? '' : 's'} needed (minimum ${lim.min})<\/span>`
      : `<span class="good">Within the rules<\/span>`;
    const isActive = active && active.id === t.id;
    const tg = gpaFor(R.plan.filter(p => p.termId === t.id));
    const slots = {};
    rows.forEach(({ c }) => { if (c.exam && !isETest(c.exam)) (slots[c.exam] = slots[c.exam] || []).push(c.code); });
    const clashes = Object.keys(slots).filter(k => slots[k].length > 1);
    return `<div class="term ${isActive ? 'active' : ''}" data-act="ru-term-pick" data-id="${t.id}">
      <div class="term-head"><h4>${esc(termName(t))}<\/h4>
        ${tg.gpa !== null ? `<span class="term-gpa" title="${tg.credits} graded credits">GPA ${fmtGpa(tg.gpa)}<\/span>` : ''}
        ${isActive ? '<span class="adding">Adding courses here<\/span>' : ''}
        <button class="icon-btn" data-act="ru-term-del" data-id="${t.id}" title="Remove semester" aria-label="Remove semester">${I.trash}<\/button><\/div>
      <div class="meter ${cls}"><i style="width:${Math.min(100, total / scale * 100)}%"><\/i>
        ${lim.min ? `<span class="tick" style="left:${lim.min / scale * 100}%" title="Minimum ${lim.min}"><\/span>` : ''}
        <span class="tick" style="left:${lim.max / scale * 100}%" title="Maximum ${lim.max}"><\/span><\/div>
      <div class="meter-labels"><span><b>${total}<\/b> credit${total === 1 ? '' : 's'}, ${status}<\/span><span>${lim.min ? 'min ' + lim.min + ', ' : ''}max ${lim.max}<\/span><\/div>
      ${clashes.length ? `<p class="clash">Possible exam clash: ${clashes.map(k => esc(slots[k].join(' and ')) + ' are both in slot ' + k).join('; ')}. Check the official timetable.<\/p>` : ''}
      ${rows.length ? `<ul>${rows.map(({ p, c }) => {
        const missing = (c.prereqs ? c.prereqs.split(/,\s*/) : []).filter(code => {
          const pp = planByCode[code]; if (!pp) return true;
          const pt = R.terms.find(x => x.id === pp.termId);
          return !pt || termOrder(pt) >= termOrder(t);
        });
        const isRt = p.kind === 'retake';
        const later = R.plan.some(q => q.courseId === p.courseId && q.id !== p.id && attemptOrder(q) > attemptOrder(p));
        const st = p.grade === 'F' ? 'failed' : rowPassed(p) ? 'passed' : '';
        return `<li class="sw ${st}" data-id="${p.id}"><div class="sw-bg">${I.sync} Send to retake<\/div>
          <div class="sw-body" draggable="true">
          ${gradeSelect(p, c.code)}
          <span class="code">${esc(c.code)}<\/span><span class="nm" title="${esc(c.name)}">${isRt ? '<span class="rt-tag">Retake<\/span>' : ''}${examPill(c)}${esc(c.name)}<\/span>
          <span class="cr">${c.credits} cr<\/span>
          <select class="input move-sel" data-change="ru-move" data-id="${p.id}" aria-label="Move ${esc(c.code)}"><option value="">Move to<\/option>${terms.filter(x => x.id !== t.id).map(x => `<option value="${x.id}">${esc(termShort(x))}<\/option>`).join('')}${isRt ? '<option value="__tray">Retake tray<\/option>' : ''}<\/select>
          <button class="icon-btn" data-act="ru-retake" data-id="${p.id}" title="Send to retake" aria-label="Send ${esc(c.code)} to retake">${I.sync}<\/button>
          <button class="icon-btn" data-act="ru-plan-remove" data-id="${p.id}" title="Remove from semester" aria-label="Remove from semester">${I.x}<\/button>
          ${missing.length ? `<span class="pre-warn">Needs ${esc(missing.join(', '))} in an earlier semester first<\/span>` : ''}
          ${p.grade === 'F' && !later ? `<span class="pre-warn" style="color:var(--red)">Failed. Swipe left, drag it to Retakes, or press the retake button.<\/span>` : ''}
          <\/div><\/li>`;
      }).join('')}<\/ul>` : `<p class="muted" style="margin:10px 0 0;font-size:14px">${isActive ? 'Add courses from the list on the right.' : 'Click this semester, then add courses from the list.'}<\/p>`}
    <\/div>`;
  };

  const q = S.ru.q.toLowerCase();
  const catalog = R.courses.filter(c => inGroup(c) && (!q || (c.code + ' ' + c.name).toLowerCase().includes(q))).sort((a, b) => a.code.localeCompare(b.code));
  const left = `<section>
    <div class="panel" style="margin-bottom:12px"><div class="field" style="margin:0"><span>Add a semester<\/span>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input class="input" id="ruYear" type="number" min="2500" max="2700" value="${sug.year}" style="width:120px" aria-label="Academic year (B.E.)">
        <select class="input" id="ruSem" style="width:auto">${[['1', 'Semester 1'], ['2', 'Semester 2'], ['S', 'Summer']].map(o => `<option value="${o[0]}" ${o[0] === sug.semester ? 'selected' : ''}>${o[1]}<\/option>`).join('')}<\/select>
        <button class="btn" data-act="ru-term-add">${I.plus} Add semester<\/button><\/div>
      <small>Academic year in Buddhist Era, for example 2569.<\/small><\/div><\/div>
    ${retakeTray(terms)}
    ${terms.length ? `<div class="terms">${terms.map(termCard).join('')}<\/div>` : '<div class="panel empty-state"><h3>No semesters yet<\/h3><p>Add your first semester above, then fill it with courses.<\/p><\/div>'}
  <\/section>`;

  const right = `<div>${requirementsPanel()}<aside class="panel">
    <div class="pl-head" style="margin-bottom:8px"><div><h3>Courses<\/h3><p class="sub" style="margin:2px 0 0">${R.courses.length} in your list${active ? ', adding to ' + esc(termName(active)) : ''}<\/p><\/div>
      <div class="head-actions">${R.courses.length ? `<button class="btn small" data-act="ru-load">Load LL.B. curriculum<\/button>` : ''}<button class="btn small" data-act="ru-course-new">${I.plus} New course<\/button><\/div><\/div>
    ${R.courses.length ? `<div class="cat-tools"><input class="input" id="ruQ" placeholder="Search by code or name" value="${esc(S.ru.q)}"><select class="input" id="ruGroup" style="flex:0 1 220px">${groupOptions()}<\/select><\/div>
      <p class="sub" style="margin:0 0 6px">${catalog.length} course${catalog.length === 1 ? '' : 's'} shown${S.ru.group || q ? ` <button class="btn small" data-act="ru-group-clear" style="margin-left:6px">Show all<\/button>` : ''}<\/p>
      <ul class="cat-list">${catalog.map(c => {
        const t = termOf[c.id];
        return `<li><div style="min-width:0"><span class="code">${esc(c.code)}<\/span> <span class="cr">${c.credits} credits<\/span> ${examPill(c)}
          <div class="cn" title="${esc(c.name)}">${esc(c.name)}<\/div>${c.prereqs ? `<div class="pr">Needs ${esc(c.prereqs)}<\/div>` : ''}<\/div>
          ${t ? `<span class="in-term">In ${esc(termShort(t))}<\/span>` : `<button class="btn small" data-act="ru-add" data-id="${c.id}" ${active ? '' : 'disabled title="Add a semester first"'}>${I.plus} Add<\/button>`}
          <button class="icon-btn" data-act="ru-course-edit" data-id="${c.id}" title="Edit course" aria-label="Edit course">${I.edit}<\/button><\/li>`;
      }).join('') || '<li class="muted">No courses match.<\/li>'}<\/ul>
      ${importBox(false)}`
      : `<div class="loader-card"><p>Load all 180 courses of the Ramkhamhaeng LL.B. curriculum, with the regional study plan and exam slots, in one click.<\/p>
          <button class="btn primary" data-act="ru-load">Load LL.B. curriculum<\/button><\/div>
         <p class="muted" style="margin:16px 0 8px;font-size:13.5px">Or paste a course list of your own:<\/p>${importBox(true)}`}
  <\/aside><\/div>`;

  return summary + gpaPanel() + rule + `<div class="grid-2 planner">${left}${right}<\/div>`;
}

function ruCourseDialog(id) {
  const c = id ? ruCourse(id) : null;
  const d = openDialog(`
    <div class="dlg-head"><h3>${c ? 'Edit course' : 'New course'}<\/h3><button class="icon-btn" data-act="close" aria-label="Close">${I.x}<\/button><\/div>
    <div class="dlg-body">
      <div class="row">
        <label class="field"><span>Course code<\/span><input class="input" id="rcCode" value="${esc(c ? c.code : '')}" placeholder="e.g. LAW1101"><\/label>
        <label class="field"><span>Credits<\/span><input class="input" id="rcCredits" type="number" min="0" max="12" value="${esc(c ? c.credits : '3')}"><\/label>
      <\/div>
      <label class="field"><span>Course name<\/span><input class="input" id="rcName" value="${esc(c ? c.name : '')}" placeholder="e.g. Introduction to Law"><\/label>
      <label class="field"><span>Prerequisites<\/span><input class="input" id="rcPre" value="${esc(c ? c.prereqs : '')}" placeholder="Course codes, for example LAW1101, LAW1102"><small>Optional. Study Hub warns you if these aren\u2019t planned in an earlier semester.<\/small><\/label>
      <label class="field"><span>Exam slot<\/span><input class="input" id="rcExam" list="rcExams" value="${esc(c ? c.exam : '')}" placeholder="e.g. 2A, or e-testing"><datalist id="rcExams">${['1A','1B','2A','2B','3A','3B','4A','4B','e-testing'].map(x => `<option value="${x}">`).join('')}<\/datalist><small>Day number plus A for morning or B for afternoon. Use e-testing for courses you take by e-Testing.<\/small><\/label>
      <label class="field"><span>Group<\/span><input class="input" id="rcCat" value="${esc(c ? c.category : '')}" placeholder="Optional, e.g. Required law courses"><\/label>
    <\/div>
    <div class="dlg-foot">${c ? `<button class="btn danger" data-act="ru-course-del" data-id="${c.id}">Delete course<\/button>` : ''}
      <div class="right"><button class="btn" data-act="close">Cancel<\/button><button class="btn primary" id="rcSave">${c ? 'Save course' : 'Add course'}<\/button><\/div><\/div>`);
  $('#rcSave', d).onclick = async e => {
    const input = { id: c ? c.id : '', code: $('#rcCode', d).value, name: $('#rcName', d).value, credits: $('#rcCredits', d).value, prereqs: $('#rcPre', d).value, category: $('#rcCat', d).value, exam: $('#rcExam', d).value };
    try { await act('ruSaveCourse', [input], c ? 'Course saved' : 'Course added', e.currentTarget); closeDialog(); } catch (err) { }
  };
}
