/**
 * STUDY HUB — Google Apps Script backend
 * Storage: Google Sheets (auto-created)   Files: Google Drive
 * Homework import: Google Classroom        Reminders: Gmail
 *
 * First run: select `setup` in the editor toolbar and press Run to authorize.
 * Then Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 *
 * The page itself now lives on GitHub Pages and talks to this script through
 * doPost (see "JSON API" at the bottom). Every request must carry the access key
 * that `setup` / `showApiKey` print in the execution log.
 */

const APP_NAME = 'Study Hub';
const TASK_TYPES = ['Homework', 'Project', 'Group Project'];
const STATUSES = ['To do', 'In progress', 'Done', 'Dismissed'];
const SCHEMA_VERSION = '8';
const DT_FORMAT = "yyyy-MM-dd'T'HH:mm";

const SHEETS = {
  Subjects:   ['id', 'name', 'color', 'folderId', 'folderUrl', 'syllabusId', 'syllabusUrl', 'syllabusName', 'createdAt'],
  Classrooms: ['id', 'subjectId', 'courseId', 'courseName', 'section', 'link', 'lastSynced'],
  Tasks:      ['id', 'subjectId', 'type', 'title', 'description', 'deadline', 'status', 'priority',
               'members', 'link', 'source', 'externalId', 'createdAt', 'completedAt'],
  Milestones: ['id', 'taskId', 'title', 'dueDate', 'done'],
  Playlists:  ['id', 'name', 'createdAt'],
  Tracks:     ['id', 'playlistId', 'videoId', 'title', 'channel', 'position', 'addedAt'],
  RuSessions: ['id', 'start', 'end', 'minutes', 'label', 'courseCode', 'note'],
  RuCourses:  ['id', 'code', 'name', 'credits', 'prereqs', 'category', 'exam'],
  RuTerms:    ['id', 'year', 'semester'],
  RuPlan:     ['id', 'termId', 'courseId', 'passed', 'grade', 'kind', 'retakeOf'],
  Books:      ['id', 'title', 'author', 'isbn', 'cover', 'pages', 'currentPage', 'status', 'rating', 'category',
               'courseCode', 'location', 'link', 'notes', 'addedAt', 'startedAt', 'finishedAt'],
  ClassroomFiles: ['id', 'linkId', 'courseId', 'courseName', 'source', 'postId', 'postTitle', 'sourceFileId',
                   'title', 'kind', 'copyId', 'copyUrl', 'status', 'note', 'copiedAt'],
  Settings:   ['key', 'value']
};

const DEFAULT_SETTINGS = {
  email: '',
  reminderTimes: '07:00',
  daysAhead: '7',
  enabled: 'false',
  sendWhenEmpty: 'false',
  syncBeforeReminder: 'true',
  filesAuto: 'false',
  filesEveryHours: '6',
  filesLastRun: '',
  filesLastError: ''
};

/* ============================================================
 *  WEB APP ENTRY
 * ============================================================ */

/**
 * The old all-in-one page (Index, Styles, App, App2) is only safe while the deployment is
 * "Only myself". Once access is "Anyone" for the GitHub Pages site, that page would let
 * anyone with the link use your Drive and Gmail, so it stays off unless you turn it back on.
 */
const SERVE_OLD_PAGE = false;

function doGet() {
  if (SERVE_OLD_PAGE) {
    return HtmlService.createTemplateFromFile('Index').evaluate()
      .setTitle(APP_NAME)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setFaviconUrl('https://fonts.gstatic.com/s/e/notoemoji/latest/1f4da/512.png');
  }
  const site = PropertiesService.getScriptProperties().getProperty('SITE_URL');
  const html = '<div style="font-family:system-ui,sans-serif;max-width:520px;margin:60px auto;padding:0 16px;line-height:1.6">' +
    '<h2>Study Hub has moved</h2><p>This address is now the data connection for Study Hub on GitHub Pages.</p>' +
    (site ? '<p><a href="' + esc_(site) + '" target="_top">Open Study Hub</a></p>' : '<p>Open your GitHub Pages site to use Study Hub.</p>') + '</div>';
  return HtmlService.createHtmlOutput(html).setTitle(APP_NAME);
}

/** Puts the Styles and App files into the page (the page is split so each file is small enough to paste safely). */
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/** Run once from the editor to authorize every Google service the app uses. */
function setup() {
  PropertiesService.getScriptProperties().deleteProperty('SHEETS_OK');
  const ss = getDb_();
  getRootFolder_();
  try {
    const c = Classroom.Courses.list({ pageSize: 1, studentId: 'me' });
    const first = (c.courses || [])[0];
    if (first) {
      Classroom.Courses.CourseWorkMaterials.list(first.id, { pageSize: 1 });
      Classroom.Courses.Announcements.list(first.id, { pageSize: 1 });
      Logger.log('Classroom check: classes, materials and announcements can all be read.');
    }
  } catch (e) { Logger.log('Classroom check: ' + e.message); }
  GmailApp.getAliases();
  ScriptApp.getProjectTriggers();
  Logger.log('Study Hub is ready. Database: ' + ss.getUrl());
  Logger.log('Access key for the GitHub Pages site: ' + ensureApiKey_());
}

/* ============================================================
 *  DATABASE (Google Sheets)
 * ============================================================ */

let _db = null;

function tz_() {
  return Session.getScriptTimeZone();
}

function uid_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 12);
}

function nowStr_() {
  return Utilities.formatDate(new Date(), tz_(), DT_FORMAT);
}

function getRootFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('ROOT_FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* recreate below */ }
  }
  const folder = DriveApp.createFolder(APP_NAME);
  props.setProperty('ROOT_FOLDER_ID', folder.getId());
  return folder;
}

function rootUrl_() {
  const props = PropertiesService.getScriptProperties();
  let url = props.getProperty('ROOT_URL');
  if (!url) { url = getRootFolder_().getUrl(); props.setProperty('ROOT_URL', url); }
  return url;
}

function getDb_() {
  if (_db) return _db;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('DB_ID');
  let ss = null;
  if (id) {
    try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create(APP_NAME + ' — Database');
    DriveApp.getFileById(ss.getId()).moveTo(getRootFolder_());
    props.setProperty('DB_ID', ss.getId());
  }
  // Checking every sheet is only needed once per version of the app
  if (props.getProperty('SHEETS_OK') !== SCHEMA_VERSION) {
    ensureSheets_(ss);
    props.setProperty('SHEETS_OK', SCHEMA_VERSION);
  }
  _db = ss;
  return ss;
}

function ensureSheets_(ss) {
  Object.keys(SHEETS).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (sh) {
      const headers = SHEETS[name];
      const current = sh.getRange(1, 1, 1, headers.length).getValues()[0];
      if (current.join('|') !== headers.join('|')) {
        sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#E8EDF7');
      }
    }
    if (!sh) {
      sh = ss.insertSheet(name);
      const headers = SHEETS[name];
      sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#E8EDF7');
      sh.setFrozenRows(1);
      sh.getRange(1, 1, sh.getMaxRows(), headers.length).setNumberFormat('@');
      if (name === 'Settings') {
        const defaults = Object.assign({}, DEFAULT_SETTINGS, { email: Session.getEffectiveUser().getEmail() });
        const rows = Object.keys(defaults).map(function (k) { return [k, defaults[k]]; });
        sh.getRange(2, 1, rows.length, 2).setValues(rows);
      }
    }
  });
  const stray = ss.getSheetByName('Sheet1');
  if (stray && ss.getSheets().length > 1) ss.deleteSheet(stray);
}

/** Small in-memory table: load all rows, change them, save once. */
function Table_(name) {
  this.name = name;
  this.headers = SHEETS[name];
  this.sheet = getDb_().getSheetByName(name);
  const tz = tz_();
  const headers = this.headers;
  const lastRow = this.sheet.getLastRow();
  const values = lastRow > 1 ? this.sheet.getRange(2, 1, lastRow - 1, headers.length).getValues() : [];
  this.rows = values
    .filter(function (r) { return String(r[0]) !== ''; })
    .map(function (r) {
      const o = {};
      headers.forEach(function (h, i) {
        let v = r[i];
        if (v instanceof Date) v = Utilities.formatDate(v, tz, DT_FORMAT);
        o[h] = v == null ? '' : String(v);
      });
      return o;
    });
}

Table_.prototype.byId = function (id) {
  return this.rows.find(function (r) { return r.id === id; });
};

Table_.prototype.insert = function (obj) {
  const row = {};
  this.headers.forEach(function (h) { row[h] = obj[h] == null ? '' : String(obj[h]); });
  this.rows.push(row);
  return row;
};

Table_.prototype.update = function (id, patch) {
  const row = this.byId(id);
  if (!row) throw new Error('Could not find that item. Reload the page and try again.');
  const headers = this.headers;
  Object.keys(patch).forEach(function (k) {
    if (headers.indexOf(k) > -1 && k !== 'id') row[k] = patch[k] == null ? '' : String(patch[k]);
  });
  return row;
};

Table_.prototype.removeWhere = function (pred) {
  const before = this.rows.length;
  this.rows = this.rows.filter(function (r) { return !pred(r); });
  return before - this.rows.length;
};

Table_.prototype.save = function () {
  const sh = this.sheet;
  const width = this.headers.length;
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, width).clearContent();
  if (this.rows.length) {
    const headers = this.headers;
    const range = sh.getRange(2, 1, this.rows.length, width);
    range.setNumberFormat('@');
    range.setValues(this.rows.map(function (r) { return headers.map(function (h) { return r[h]; }); }));
  }
};

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function getSettings_() {
  const out = Object.assign({}, DEFAULT_SETTINGS);
  new Table_('Settings').rows.forEach(function (r) { out[r.key] = r.value; });
  if (!out.email) out.email = Session.getEffectiveUser().getEmail();
  return out;
}

/* ============================================================
 *  APP DATA (one call loads everything the UI needs)
 * ============================================================ */

function getAppData() {
  const subjects = new Table_('Subjects').rows;
  const classrooms = new Table_('Classrooms').rows;
  const milestones = new Table_('Milestones').rows.map(function (m) {
    return Object.assign({}, m, { done: m.done === 'TRUE' });
  });
  const tasks = new Table_('Tasks').rows.map(function (t) {
    const ms = milestones
      .filter(function (m) { return m.taskId === t.id; })
      .sort(function (a, b) { return (a.dueDate || '').localeCompare(b.dueDate || ''); });
    return Object.assign({}, t, { milestones: ms });
  });
  let webAppUrl = '';
  webAppUrl = PropertiesService.getScriptProperties().getProperty('SITE_URL') || '';
  if (!webAppUrl) { try { webAppUrl = ScriptApp.getService().getUrl() || ''; } catch (e) { /* not deployed */ } }
  return {
    subjects: subjects,
    classrooms: classrooms,
    tasks: tasks,
    settings: getSettings_(),
    timeZone: tz_(),
    now: nowStr_(),
    rootFolderUrl: rootUrl_(),
    dbUrl: getDb_().getUrl(),
    webAppUrl: webAppUrl,
    classroomAvailable: typeof Classroom !== 'undefined',
    playlists: getPlaylists_(),
    ru: getRu_(),
    books: new Table_('Books').rows,
    classroomFiles: new Table_('ClassroomFiles').rows
      .sort(function (a, b) { return (b.copiedAt || '').localeCompare(a.copiedAt || ''); }).slice(0, 300)
  };
}

/* ============================================================
 *  SUBJECTS + DRIVE FOLDERS
 * ============================================================ */

function folderIdFromInput_(input) {
  const s = String(input || '').trim();
  const m = s.match(/folders\/([a-zA-Z0-9_-]+)/) || s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : s;
}

function fileIdFromInput_(input) {
  const s = String(input || '').trim();
  const m = s.match(/\/d\/([a-zA-Z0-9_-]+)/) || s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : s;
}

function resolveFolder_(mode, input, subjectName) {
  if (mode === 'existing') {
    const id = folderIdFromInput_(input);
    if (!id) throw new Error('Paste a Google Drive folder link to match this subject.');
    try {
      const f = DriveApp.getFolderById(id);
      f.getName();
      return f;
    } catch (e) {
      throw new Error('That Drive folder could not be opened. Check the link and that you have access.');
    }
  }
  return getRootFolder_().createFolder(subjectName);
}

function addSubject(input) {
  return withLock_(function () {
    const name = String(input.name || '').trim();
    if (!name) throw new Error('Give the subject a name.');
    const t = new Table_('Subjects');
    if (t.rows.some(function (r) { return r.name.toLowerCase() === name.toLowerCase(); })) {
      throw new Error('You already have a subject called "' + name + '".');
    }
    const folder = resolveFolder_(input.folderMode, input.folderInput, name);
    t.insert({
      id: uid_(), name: name, color: normalizeColor_(input.color || '#2B50D6'),
      folderId: folder.getId(), folderUrl: folder.getUrl(), createdAt: nowStr_()
    });
    t.save();
    return getAppData();
  });
}

function updateSubject(id, input) {
  return withLock_(function () {
    const t = new Table_('Subjects');
    const patch = {};
    if (input.name != null) {
      const name = String(input.name).trim();
      if (!name) throw new Error('Give the subject a name.');
      patch.name = name;
    }
    if (input.color) patch.color = normalizeColor_(input.color);
    if (input.folderMode === 'existing' || input.folderMode === 'new') {
      const folder = resolveFolder_(input.folderMode, input.folderInput, patch.name || t.byId(id).name);
      patch.folderId = folder.getId();
      patch.folderUrl = folder.getUrl();
    }
    t.update(id, patch);
    t.save();
    return getAppData();
  });
}

/** Removes the subject from Study Hub. Drive files are never deleted. */
function deleteSubject(id) {
  return withLock_(function () {
    const subjects = new Table_('Subjects');
    const tasks = new Table_('Tasks');
    const ms = new Table_('Milestones');
    const links = new Table_('Classrooms');
    const taskIds = tasks.rows.filter(function (r) { return r.subjectId === id; }).map(function (r) { return r.id; });
    ms.removeWhere(function (m) { return taskIds.indexOf(m.taskId) > -1; });
    tasks.removeWhere(function (r) { return r.subjectId === id; });
    links.removeWhere(function (r) { return r.subjectId === id; });
    subjects.removeWhere(function (r) { return r.id === id; });
    [ms, tasks, links, subjects].forEach(function (x) { x.save(); });
    return getAppData();
  });
}

function getSubjectFiles(subjectId) {
  const s = new Table_('Subjects').byId(subjectId);
  if (!s || !s.folderId) return [];
  const root = DriveApp.getFolderById(s.folderId);
  const files = [];
  const add = function (it, where) {
    let n = 0;
    while (it.hasNext() && n < 200) {
      const f = it.next();
      n++;
      files.push({
        name: f.getName(), url: f.getUrl(), mimeType: f.getMimeType(), folder: where || '',
        updated: Utilities.formatDate(f.getLastUpdated(), tz_(), DT_FORMAT)
      });
    }
  };
  add(root.getFiles(), '');
  const subs = root.getFolders();
  while (subs.hasNext()) {
    const sub = subs.next();
    if (sub.getName().indexOf('Classroom files') === 0) add(sub.getFiles(), sub.getName());
  }
  files.sort(function (a, b) { return b.updated.localeCompare(a.updated); });
  return files.slice(0, 60);
}

/** Accepts #ABC, ABC, #AABBCC. Returns #AABBCC or throws. */
function normalizeColor_(value) {
  let h = String(value || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map(function (ch) { return ch + ch; }).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error('Colour code must look like #2B50D6.');
  return '#' + h.toUpperCase();
}

/** file = { name, mimeType, data (base64) } — saved into the subject's matched Drive folder. */
function uploadToSubjectFolder(subjectId, file) {
  const s = new Table_('Subjects').byId(subjectId);
  if (!s) throw new Error('Subject not found.');
  if (!s.folderId) throw new Error('This subject has no Drive folder. Edit the subject to match one.');
  let folder;
  try { folder = DriveApp.getFolderById(s.folderId); folder.getName(); } catch (e) {
    throw new Error('The matched Drive folder could not be opened. Edit the subject and match a folder again.');
  }
  const blob = Utilities.newBlob(Utilities.base64Decode(file.data), file.mimeType || 'application/octet-stream', file.name);
  const created = folder.createFile(blob);
  return { name: created.getName(), url: created.getUrl() };
}

/* ============================================================
 *  SYLLABUS
 * ============================================================ */

/** file = { name, mimeType, data (base64) } — saved into the subject's Drive folder. */
function uploadSyllabus(subjectId, file) {
  return withLock_(function () {
    const t = new Table_('Subjects');
    const s = t.byId(subjectId);
    if (!s) throw new Error('Subject not found.');
    const folder = s.folderId ? DriveApp.getFolderById(s.folderId) : getRootFolder_();
    const blob = Utilities.newBlob(Utilities.base64Decode(file.data), file.mimeType || 'application/octet-stream', file.name);
    const created = folder.createFile(blob);
    created.setDescription('Syllabus for ' + s.name + ' (uploaded via Study Hub)');
    t.update(subjectId, { syllabusId: created.getId(), syllabusUrl: created.getUrl(), syllabusName: created.getName() });
    t.save();
    return getAppData();
  });
}

/** Use a file that is already in Drive as the syllabus. */
function linkSyllabus(subjectId, urlOrId) {
  return withLock_(function () {
    const id = fileIdFromInput_(urlOrId);
    let f;
    try { f = DriveApp.getFileById(id); f.getName(); } catch (e) {
      throw new Error('That Drive file could not be opened. Check the link and that you have access.');
    }
    const t = new Table_('Subjects');
    t.update(subjectId, { syllabusId: f.getId(), syllabusUrl: f.getUrl(), syllabusName: f.getName() });
    t.save();
    return getAppData();
  });
}

function removeSyllabus(subjectId) {
  return withLock_(function () {
    const t = new Table_('Subjects');
    t.update(subjectId, { syllabusId: '', syllabusUrl: '', syllabusName: '' });
    t.save();
    return getAppData();
  });
}

/* ============================================================
 *  GOOGLE CLASSROOM
 * ============================================================ */

function requireClassroom_() {
  if (typeof Classroom === 'undefined') {
    throw new Error('Google Classroom is not turned on. In the script editor, open Services (+) and add "Google Classroom API".');
  }
}

function listMyCourses() {
  requireClassroom_();
  const out = [];
  let pageToken = null;
  do {
    const resp = Classroom.Courses.list({ courseStates: ['ACTIVE'], pageSize: 100, pageToken: pageToken });
    (resp.courses || []).forEach(function (c) {
      out.push({ id: c.id, name: c.name, section: c.section || '', link: c.alternateLink || '' });
    });
    pageToken = resp.nextPageToken;
  } while (pageToken);
  out.sort(function (a, b) { return a.name.localeCompare(b.name); });
  return out;
}

function linkClassroom(subjectId, courseId) {
  requireClassroom_();
  return withLock_(function () {
    const links = new Table_('Classrooms');
    const existing = links.rows.find(function (r) { return r.courseId === courseId; });
    if (existing) {
      const subj = new Table_('Subjects').byId(existing.subjectId);
      throw new Error('That classroom is already matched to ' + (subj ? subj.name : 'another subject') + '.');
    }
    const c = Classroom.Courses.get(courseId);
    const link = links.insert({
      id: uid_(), subjectId: subjectId, courseId: c.id, courseName: c.name,
      section: c.section || '', link: c.alternateLink || '', lastSynced: ''
    });
    const tasks = new Table_('Tasks');
    syncCourse_(link, tasks);
    link.lastSynced = nowStr_();
    tasks.save();
    links.save();
    return getAppData();
  });
}

function unlinkClassroom(linkId, removeImported) {
  return withLock_(function () {
    const links = new Table_('Classrooms');
    const link = links.byId(linkId);
    if (!link) throw new Error('That classroom link no longer exists.');
    links.removeWhere(function (r) { return r.id === linkId; });
    if (removeImported) {
      const tasks = new Table_('Tasks');
      const ms = new Table_('Milestones');
      const prefix = link.courseId + ':';
      const ids = tasks.rows
        .filter(function (t) { return t.source === 'classroom' && t.externalId.indexOf(prefix) === 0; })
        .map(function (t) { return t.id; });
      tasks.removeWhere(function (t) { return ids.indexOf(t.id) > -1; });
      ms.removeWhere(function (m) { return ids.indexOf(m.taskId) > -1; });
      tasks.save();
      ms.save();
    }
    links.save();
    return getAppData();
  });
}

/** Called from the UI. Returns fresh data plus a short report. */
function syncClassrooms() {
  requireClassroom_();
  return withLock_(function () {
    const report = syncAll_();
    return { data: getAppData(), report: report };
  });
}

function syncAll_() {
  const links = new Table_('Classrooms');
  const tasks = new Table_('Tasks');
  const report = { added: 0, updated: 0, completed: 0, errors: [] };
  links.rows.forEach(function (link) {
    try {
      const r = syncCourse_(link, tasks);
      report.added += r.added;
      report.updated += r.updated;
      report.completed += r.completed;
      link.lastSynced = nowStr_();
    } catch (e) {
      report.errors.push(link.courseName + ': ' + e.message);
    }
  });
  tasks.save();
  links.save();
  return report;
}

function classroomDue_(w) {
  if (!w.dueDate) return '';
  const d = w.dueDate;
  const t = w.dueTime || {};
  const utc = new Date(Date.UTC(d.year, d.month - 1, d.day, t.hours || 0, t.minutes || 0));
  return Utilities.formatDate(utc, tz_(), DT_FORMAT);
}

function syncCourse_(link, tasks) {
  const result = { added: 0, updated: 0, completed: 0 };
  const works = [];
  let pageToken = null;
  do {
    const resp = Classroom.Courses.CourseWork.list(link.courseId, { pageSize: 100, pageToken: pageToken });
    (resp.courseWork || []).forEach(function (w) { works.push(w); });
    pageToken = resp.nextPageToken;
  } while (pageToken);

  // Which assignments have I already turned in?
  const turnedIn = {};
  try {
    pageToken = null;
    do {
      const r = Classroom.Courses.CourseWork.StudentSubmissions.list(link.courseId, '-', {
        userId: 'me', pageSize: 100, pageToken: pageToken
      });
      (r.studentSubmissions || []).forEach(function (s) {
        if (s.state === 'TURNED_IN' || s.state === 'RETURNED') turnedIn[s.courseWorkId] = true;
      });
      pageToken = r.nextPageToken;
    } while (pageToken);
  } catch (e) { /* teachers have no submissions of their own */ }

  const byExternal = {};
  tasks.rows.forEach(function (t) { if (t.externalId) byExternal[t.externalId] = t; });

  works.forEach(function (w) {
    const externalId = link.courseId + ':' + w.id;
    const fields = {
      subjectId: link.subjectId,
      title: w.title || 'Untitled assignment',
      description: String(w.description || '').slice(0, 2000),
      deadline: classroomDue_(w),
      link: w.alternateLink || ''
    };
    const existing = byExternal[externalId];
    if (existing) {
      tasks.update(existing.id, fields);
      result.updated++;
      if (turnedIn[w.id] && existing.status !== 'Done' && existing.status !== 'Dismissed') {
        tasks.update(existing.id, { status: 'Done', completedAt: nowStr_() });
        result.completed++;
      }
    } else {
      const done = !!turnedIn[w.id];
      tasks.insert(Object.assign(fields, {
        id: uid_(), type: 'Homework', status: done ? 'Done' : 'To do', priority: 'Normal',
        members: '', source: 'classroom', externalId: externalId, createdAt: nowStr_(),
        completedAt: done ? nowStr_() : ''
      }));
      result.added++;
    }
  });
  return result;
}

/* ============================================================
 *  TASKS (homework, projects, group projects) + MINI DEADLINES
 * ============================================================ */

function saveTask(input) {
  return withLock_(function () {
    if (TASK_TYPES.indexOf(input.type) < 0) throw new Error('Choose homework, project or group project.');
    if (!String(input.title || '').trim()) throw new Error('Give the task a title.');
    if (!input.subjectId) throw new Error('Choose a subject for this task.');

    const tasks = new Table_('Tasks');
    const ms = new Table_('Milestones');
    const status = STATUSES.indexOf(input.status) > -1 ? input.status : 'To do';
    const fields = {
      subjectId: input.subjectId,
      type: input.type,
      title: String(input.title).trim(),
      description: input.description || '',
      deadline: input.deadline || '',
      status: status,
      priority: input.priority || 'Normal',
      members: input.type === 'Group Project' ? (input.members || '') : '',
      link: input.link || ''
    };

    let id = input.id;
    if (id) {
      const prev = tasks.byId(id);
      if (status === 'Done' && prev && prev.status !== 'Done') fields.completedAt = nowStr_();
      if (status !== 'Done') fields.completedAt = '';
      tasks.update(id, fields);
    } else {
      id = uid_();
      tasks.insert(Object.assign(fields, {
        id: id, source: 'manual', externalId: '', createdAt: nowStr_(),
        completedAt: status === 'Done' ? nowStr_() : ''
      }));
    }

    ms.removeWhere(function (m) { return m.taskId === id; });
    (input.milestones || []).forEach(function (m) {
      if (!String(m.title || '').trim()) return;
      ms.insert({ id: m.id || uid_(), taskId: id, title: String(m.title).trim(), dueDate: m.dueDate || '', done: m.done ? 'TRUE' : 'FALSE' });
    });

    tasks.save();
    ms.save();
    return getAppData();
  });
}

function setTaskStatus(id, status) {
  return withLock_(function () {
    if (STATUSES.indexOf(status) < 0) throw new Error('Unknown status.');
    const tasks = new Table_('Tasks');
    tasks.update(id, { status: status, completedAt: status === 'Done' ? nowStr_() : '' });
    tasks.save();
    return getAppData();
  });
}

/** Manual tasks are deleted. Classroom tasks are dismissed so the next sync does not bring them back. */
function deleteTask(id) {
  return withLock_(function () {
    const tasks = new Table_('Tasks');
    const t = tasks.byId(id);
    if (!t) return getAppData();
    if (t.source === 'classroom') {
      tasks.update(id, { status: 'Dismissed' });
    } else {
      tasks.removeWhere(function (r) { return r.id === id; });
      const ms = new Table_('Milestones');
      ms.removeWhere(function (m) { return m.taskId === id; });
      ms.save();
    }
    tasks.save();
    return getAppData();
  });
}

function toggleMilestone(id, done) {
  return withLock_(function () {
    const ms = new Table_('Milestones');
    ms.update(id, { done: done ? 'TRUE' : 'FALSE' });
    ms.save();
    return getAppData();
  });
}

/* ============================================================
 *  SETTINGS + DAILY GMAIL REMINDER TRIGGERS
 * ============================================================ */

function saveSettings(input) {
  return withLock_(function () {
    const times = String(input.reminderTimes || '')
      .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    times.forEach(function (t) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) throw new Error('Reminder times must look like 07:30.');
    });
    if (times.length > 6) throw new Error('Use at most 6 reminder times a day.');
    const email = String(input.email || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter a valid email address.');
    const days = Math.max(1, Math.min(60, parseInt(input.daysAhead, 10) || 7));

    const clean = {
      email: email,
      reminderTimes: Array.from(new Set(times)).sort().join(','),
      daysAhead: String(days),
      enabled: input.enabled ? 'true' : 'false',
      sendWhenEmpty: input.sendWhenEmpty ? 'true' : 'false',
      syncBeforeReminder: input.syncBeforeReminder ? 'true' : 'false'
    };
    const t = new Table_('Settings');
    Object.keys(clean).forEach(function (k) {
      const row = t.rows.find(function (r) { return r.key === k; });
      if (row) row.value = clean[k]; else t.insert({ key: k, value: clean[k] });
    });
    t.save();
    installReminderTriggers_(clean);
    return getAppData();
  });
}

function installReminderTriggers_(settings) {
  ScriptApp.getProjectTriggers()
    .filter(function (tr) { return tr.getHandlerFunction() === 'sendDailyReminder'; })
    .forEach(function (tr) { ScriptApp.deleteTrigger(tr); });
  if (settings.enabled !== 'true') return;
  settings.reminderTimes.split(',').filter(Boolean).forEach(function (time) {
    const parts = time.split(':').map(Number);
    ScriptApp.newTrigger('sendDailyReminder')
      .timeBased().everyDays(1).atHour(parts[0]).nearMinute(parts[1]).inTimezone(tz_())
      .create();
  });
}

/** Trigger target — runs every day at each reminder time. */
function sendDailyReminder() {
  const settings = getSettings_();
  if (settings.syncBeforeReminder === 'true' && typeof Classroom !== 'undefined') {
    try { withLock_(syncAll_); } catch (e) { Logger.log('Sync before reminder failed: ' + e.message); }
  }
  buildAndSendReminder_(settings, false);
}

/** "Send test email" button. */
function sendTestReminder() {
  const sent = buildAndSendReminder_(getSettings_(), true);
  return 'Test reminder sent to ' + sent;
}

/* ============================================================
 *  REMINDER EMAIL
 * ============================================================ */

function parseDt_(s) {
  if (!s) return null;
  try {
    const fmt = s.length > 10 ? DT_FORMAT : 'yyyy-MM-dd';
    return Utilities.parseDate(s.slice(0, 16), tz_(), fmt);
  } catch (e) { return null; }
}

function dayDiff_(date, now) {
  const tz = tz_();
  const a = Utilities.parseDate(Utilities.formatDate(date, tz, 'yyyy-MM-dd'), tz, 'yyyy-MM-dd');
  const b = Utilities.parseDate(Utilities.formatDate(now, tz, 'yyyy-MM-dd'), tz, 'yyyy-MM-dd');
  return Math.round((a - b) / 86400000);
}

function esc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function collectDueItems_(daysAhead) {
  const data = getAppData();
  const now = new Date();
  const subjects = {};
  data.subjects.forEach(function (s) { subjects[s.id] = s; });
  const items = [];

  data.tasks.forEach(function (t) {
    if (t.status === 'Done' || t.status === 'Dismissed') return;
    const subj = subjects[t.subjectId] || { name: 'No subject', color: '#888' };
    const due = parseDt_(t.deadline);
    if (due) items.push({ kind: 'task', task: t, subject: subj, title: t.title, due: due, diff: dayDiff_(due, now) });
    t.milestones.forEach(function (m) {
      if (m.done) return;
      const md = parseDt_(m.dueDate);
      if (md) items.push({ kind: 'mini', task: t, subject: subj, title: m.title, due: md, diff: dayDiff_(md, now) });
    });
  });

  const groups = { overdue: [], today: [], upcoming: [] };
  items.forEach(function (it) {
    if (it.due < now && it.diff <= 0) groups.overdue.push(it);
    else if (it.diff === 0) groups.today.push(it);
    else if (it.diff > 0 && it.diff <= daysAhead) groups.upcoming.push(it);
  });
  Object.keys(groups).forEach(function (k) { groups[k].sort(function (a, b) { return a.due - b.due; }); });
  return { groups: groups, webAppUrl: data.webAppUrl };
}

function relText_(it) {
  if (it.diff < 0) return Math.abs(it.diff) === 1 ? 'was due yesterday' : 'overdue by ' + Math.abs(it.diff) + ' days';
  if (it.diff === 0) return it.due < new Date() ? 'was due earlier today' : 'due today';
  if (it.diff === 1) return 'due tomorrow';
  return 'due in ' + it.diff + ' days';
}

function buildAndSendReminder_(settings, isTest) {
  const daysAhead = parseInt(settings.daysAhead, 10) || 7;
  const res = collectDueItems_(daysAhead);
  const g = res.groups;
  const total = g.overdue.length + g.today.length + g.upcoming.length;
  if (!total && settings.sendWhenEmpty !== 'true' && !isTest) return null;

  const tz = tz_();
  const dateLabel = Utilities.formatDate(new Date(), tz, 'EEEE, d MMMM');
  const parts = [];
  if (g.overdue.length) parts.push(g.overdue.length + ' overdue');
  if (g.today.length) parts.push(g.today.length + ' due today');
  if (g.upcoming.length) parts.push(g.upcoming.length + ' coming up');
  const subject = (isTest ? '[Test] ' : '') + 'Study Hub: ' + (parts.length ? parts.join(', ') : 'nothing due') + ' (' + dateLabel + ')';

  function row(it, accent) {
    const when = Utilities.formatDate(it.due, tz, 'EEE d MMM, HH:mm');
    const kindLabel = it.kind === 'mini'
      ? 'Mini deadline for “' + esc_(it.task.title) + '”'
      : esc_(it.task.type) + (it.task.source === 'classroom' ? ' from Classroom' : '');
    const link = it.task.link ? ' <a href="' + esc_(it.task.link) + '" style="color:#2F5BEA">Open</a>' : '';
    return '<tr><td style="padding:10px 0;border-bottom:1px solid #E4E8F0;">' +
      '<div style="border-left:4px solid ' + esc_(it.subject.color) + ';padding-left:12px;">' +
      '<div style="font-size:12px;color:#5B6478;">' + esc_(it.subject.name) + ' / ' + kindLabel + '</div>' +
      '<div style="font-size:16px;color:#1E2A4A;font-weight:600;margin:2px 0;">' + esc_(it.title) + '</div>' +
      '<div style="font-size:13px;color:' + accent + ';">' + when + ', ' + relText_(it) + link + '</div>' +
      '</div></td></tr>';
  }

  function section(title, list, accent) {
    if (!list.length) return '';
    return '<h3 style="font-size:15px;color:' + accent + ';margin:24px 0 4px;">' + title + ' (' + list.length + ')</h3>' +
      '<table width="100%" cellpadding="0" cellspacing="0">' + list.map(function (it) { return row(it, accent); }).join('') + '</table>';
  }

  let html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:auto;color:#1E2A4A;">' +
    '<h2 style="margin:0 0 4px;font-size:22px;">Your study plan for ' + esc_(dateLabel) + '</h2>' +
    '<p style="margin:0;color:#5B6478;">Homework, projects and mini deadlines due in the next ' + daysAhead + ' days.</p>';
  html += section('Overdue', g.overdue, '#C8102E');
  html += section('Due today', g.today, '#A15C00');
  html += section('Coming up', g.upcoming, '#2F5BEA');
  if (!total) html += '<p style="margin-top:24px;font-size:16px;">Nothing due. Enjoy the free time, or get ahead on a project.</p>';
  if (res.webAppUrl) {
    html += '<p style="margin-top:28px;"><a href="' + esc_(res.webAppUrl) + '" style="background:#1E2A4A;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">Open Study Hub</a></p>';
  }
  html += '<p style="margin-top:24px;font-size:12px;color:#8A93A6;">Change reminder times in Study Hub settings.</p></div>';

  const plain = ['Study Hub — ' + dateLabel].concat(
    [['OVERDUE', g.overdue], ['DUE TODAY', g.today], ['COMING UP', g.upcoming]]
      .filter(function (p) { return p[1].length; })
      .map(function (p) {
        return p[0] + '\n' + p[1].map(function (it) {
          return '- [' + it.subject.name + '] ' + it.title + ' (' + relText_(it) + ')';
        }).join('\n');
      })
  ).join('\n\n');

  GmailApp.sendEmail(settings.email, subject, plain, { htmlBody: html, name: APP_NAME });
  return settings.email;
}

/* ============================================================
 *  MUSIC: YouTube playlists played inside the app
 * ============================================================ */

function getPlaylists_() {
  const tracks = new Table_('Tracks').rows;
  return new Table_('Playlists').rows.map(function (p) {
    const list = tracks
      .filter(function (t) { return t.playlistId === p.id; })
      .sort(function (a, b) { return (parseInt(a.position, 10) || 0) - (parseInt(b.position, 10) || 0); });
    return Object.assign({}, p, { tracks: list });
  });
}

/** Pulls the 11-character video id out of any common YouTube link (or a bare id). */
function parseYouTubeId_(input) {
  const s = String(input || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/|\/v\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function renumber_(table, playlistId) {
  table.rows
    .filter(function (t) { return t.playlistId === playlistId; })
    .sort(function (a, b) { return (parseInt(a.position, 10) || 0) - (parseInt(b.position, 10) || 0); })
    .forEach(function (t, i) { t.position = String(i + 1); });
}

function createPlaylist(name) {
  return withLock_(function () {
    const n = String(name || '').trim();
    if (!n) throw new Error('Give the playlist a name.');
    const t = new Table_('Playlists');
    if (t.rows.some(function (r) { return r.name.toLowerCase() === n.toLowerCase(); })) {
      throw new Error('You already have a playlist called "' + n + '".');
    }
    const id = uid_();
    t.insert({ id: id, name: n, createdAt: nowStr_() });
    t.save();
    return { data: getAppData(), id: id };
  });
}

function renamePlaylist(id, name) {
  return withLock_(function () {
    const n = String(name || '').trim();
    if (!n) throw new Error('Give the playlist a name.');
    const t = new Table_('Playlists');
    t.update(id, { name: n });
    t.save();
    return getAppData();
  });
}

function deletePlaylist(id) {
  return withLock_(function () {
    const p = new Table_('Playlists');
    const tr = new Table_('Tracks');
    p.removeWhere(function (r) { return r.id === id; });
    tr.removeWhere(function (r) { return r.playlistId === id; });
    p.save();
    tr.save();
    return getAppData();
  });
}

/** Looks up titles for video ids with YouTube's oEmbed endpoint. Returns { id: {ok, title, channel, reason} }. */
function lookupVideos_(ids) {
  const info = {};
  for (let i = 0; i < ids.length; i += 25) {
    const chunk = ids.slice(i, i + 25);
    let responses = [];
    try {
      responses = UrlFetchApp.fetchAll(chunk.map(function (id) {
        return {
          url: 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id),
          muteHttpExceptions: true
        };
      }));
    } catch (e) { responses = []; }
    chunk.forEach(function (id, j) {
      const fallback = { ok: true, title: 'YouTube video ' + id, channel: '' };
      const r = responses[j];
      if (!r) { info[id] = fallback; return; }
      const code = r.getResponseCode();
      if (code === 200) {
        try {
          const d = JSON.parse(r.getContentText());
          info[id] = { ok: true, title: d.title || fallback.title, channel: d.author_name || '' };
        } catch (e) { info[id] = fallback; }
      } else if (code === 401 || code === 403) {
        info[id] = { ok: false, reason: 'Its owner only allows it on YouTube' };
      } else if (code === 404 || code === 400) {
        info[id] = { ok: false, reason: 'Video not found, private or removed' };
      } else {
        info[id] = fallback;
      }
    });
  }
  return info;
}

/** Called while you paste links, so you can see titles before adding. */
function previewVideos(ids) {
  const clean = (ids || []).filter(function (id) { return /^[A-Za-z0-9_-]{11}$/.test(id); }).slice(0, 200);
  return lookupVideos_(clean);
}

/** videos = [{ videoId, title, channel }] already checked by previewVideos. */
function addVideos(playlistId, videos) {
  return withLock_(function () {
    const pl = new Table_('Playlists').byId(playlistId);
    if (!pl) throw new Error('Playlist not found.');
    const tracks = new Table_('Tracks');
    const already = {};
    tracks.rows.forEach(function (t) { if (t.playlistId === playlistId) already[t.videoId] = true; });
    let pos = tracks.rows.filter(function (t) { return t.playlistId === playlistId; }).length;
    let added = 0;
    const skipped = [];
    (videos || []).slice(0, 200).forEach(function (v) {
      const id = String(v.videoId || '');
      if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return;
      if (already[id]) { skipped.push({ input: v.title || id, reason: 'already in this playlist' }); return; }
      already[id] = true;
      pos++;
      added++;
      tracks.insert({
        id: uid_(), playlistId: playlistId, videoId: id,
        title: String(v.title || ('YouTube video ' + id)).slice(0, 300),
        channel: String(v.channel || '').slice(0, 200),
        position: pos, addedAt: nowStr_()
      });
    });
    tracks.save();
    return { data: getAppData(), report: { added: added, skipped: skipped, playlistName: pl.name } };
  });
}

/**
 * text = any number of YouTube links separated by new lines, spaces or commas.
 * Kept for older versions of the page; the current page uses previewVideos + addVideos.
 */
function addTracks(playlistId, text) {
  const pieces = String(text || '').split(/[\s,]+/).filter(Boolean);
  if (!pieces.length) throw new Error('Paste at least one YouTube link.');
  const ids = [];
  const skipped = [];
  pieces.forEach(function (p) {
    const id = parseYouTubeId_(p);
    if (!id) skipped.push({ input: p, reason: 'not a YouTube video link' });
    else if (ids.indexOf(id) < 0) ids.push(id);
  });
  const info = lookupVideos_(ids);
  const videos = [];
  ids.forEach(function (id) {
    if (info[id].ok) videos.push({ videoId: id, title: info[id].title, channel: info[id].channel });
    else skipped.push({ input: id, reason: info[id].reason });
  });
  const res = addVideos(playlistId, videos);
  res.report.skipped = skipped.concat(res.report.skipped);
  return res;
}

function removeTrack(id) {
  return withLock_(function () {
    const tr = new Table_('Tracks');
    const t = tr.byId(id);
    if (!t) return getAppData();
    tr.removeWhere(function (r) { return r.id === id; });
    renumber_(tr, t.playlistId);
    tr.save();
    return getAppData();
  });
}

/** dir = -1 (up) or 1 (down) */
function moveTrack(id, dir) {
  return withLock_(function () {
    const tr = new Table_('Tracks');
    const t = tr.byId(id);
    if (!t) return getAppData();
    renumber_(tr, t.playlistId);
    const list = tr.rows
      .filter(function (r) { return r.playlistId === t.playlistId; })
      .sort(function (a, b) { return parseInt(a.position, 10) - parseInt(b.position, 10); });
    const i = list.indexOf(t);
    const j = i + (dir < 0 ? -1 : 1);
    if (j >= 0 && j < list.length) {
      const tmp = list[i].position;
      list[i].position = list[j].position;
      list[j].position = tmp;
    }
    tr.save();
    return getAppData();
  });
}

/* ============================================================
 *  RAMKHAMHAENG HUB: reading timer, calendar, course planner
 * ============================================================ */

// Thai higher-education credit rules for one semester
const RU_LIMITS = {
  regular: { min: 9, max: 22 },
  summer: { min: 0, max: 9 }
};

function ruLimits_(semester) {
  return semester === 'S' ? RU_LIMITS.summer : RU_LIMITS.regular;
}

function ruTermName_(t) {
  return 'Year ' + t.year + ' ' + (t.semester === 'S' ? 'Summer' : 'Semester ' + t.semester);
}

function ruTermOrder_(t) {
  return (parseInt(t.year, 10) || 0) * 10 + ({ '1': 1, '2': 2, 'S': 3 }[t.semester] || 0);
}

function getRu_() {
  const settings = getSettings_();
  return {
    sessions: new Table_('RuSessions').rows,
    courses: new Table_('RuCourses').rows,
    terms: new Table_('RuTerms').rows.sort(function (a, b) { return ruTermOrder_(a) - ruTermOrder_(b); }),
    plan: new Table_('RuPlan').rows.map(function (p) { return Object.assign({}, p, { passed: p.passed === 'TRUE' }); }),
    creditsNeeded: settings.ruCreditsNeeded || '',
    gpaPolicy: settings.ruGpaPolicy === 'all' ? 'all' : 'latest',
    limits: RU_LIMITS
  };
}

/* ---------- Reading sessions ---------- */

/** s = { id?, start, end, label, courseCode, note, minutes? } — start/end like 2026-10-27T19:30 */
function ruSaveSession(s) {
  return withLock_(function () {
    const start = parseDt_(s.start), end = parseDt_(s.end);
    if (!start || !end) throw new Error('Enter a start and an end time.');
    if (end <= start) throw new Error('The end time must be after the start time.');
    const span = Math.round((end - start) / 60000);
    let minutes = s.minutes != null && s.minutes !== '' ? Math.round(Number(s.minutes)) : span;
    if (!(minutes >= 1)) throw new Error('A reading session needs at least 1 minute.');
    if (minutes > span) minutes = span;
    if (minutes > 24 * 60) throw new Error('A session can’t be longer than 24 hours.');
    const t = new Table_('RuSessions');
    const row = {
      start: s.start.slice(0, 16), end: s.end.slice(0, 16), minutes: minutes,
      label: String(s.label || '').slice(0, 200), courseCode: String(s.courseCode || '').slice(0, 40), note: String(s.note || '').slice(0, 1000)
    };
    if (s.id && t.byId(s.id)) t.update(s.id, row);
    else t.insert(Object.assign({ id: uid_() }, row));
    t.save();
    return getAppData();
  });
}

function ruDeleteSession(id) {
  return withLock_(function () {
    const t = new Table_('RuSessions');
    t.removeWhere(function (r) { return r.id === id; });
    t.save();
    return getAppData();
  });
}

/* ---------- Course catalogue ---------- */

function ruCleanCourse_(c) {
  const code = String(c.code || '').toUpperCase().replace(/\s+/g, '').trim();
  const name = String(c.name || '').trim();
  const credits = parseInt(c.credits, 10);
  if (!code) throw new Error('Every course needs a code.');
  if (!name) throw new Error('Course ' + code + ' needs a name.');
  if (!(credits >= 0 && credits <= 12)) throw new Error('Course ' + code + ' needs credits between 0 and 12.');
  const prereqs = (String(c.prereqs || '').toUpperCase().match(/[A-Z]{2,4}\s?\d{3,4}/g) || [])
    .map(function (x) { return x.replace(/\s+/g, ''); }).join(', ');
  const exam = String(c.exam || '').toUpperCase().replace(/\s+/g, '').trim();
  return {
    code: code, name: name.slice(0, 200), credits: String(credits), prereqs: prereqs,
    category: String(c.category || '').trim().slice(0, 80),
    exam: /^[1-9][AB]$/.test(exam) ? exam : (exam === 'E-TESTING' || exam === 'ETESTING') ? 'e-testing' : ''
  };
}

/** courses = [{code, name, credits, prereqs, category}]. Updates courses with the same code. */
function ruImportCourses(courses) {
  return withLock_(function () {
    const t = new Table_('RuCourses');
    let added = 0, updated = 0;
    const errors = [];
    (courses || []).slice(0, 500).forEach(function (c) {
      try {
        const clean = ruCleanCourse_(c);
        const existing = t.rows.find(function (r) { return r.code === clean.code; });
        if (existing) { t.update(existing.id, clean); updated++; }
        else { t.insert(Object.assign({ id: uid_() }, clean)); added++; }
      } catch (e) { errors.push(e.message); }
    });
    t.save();
    return { data: getAppData(), report: { added: added, updated: updated, errors: errors } };
  });
}

function ruSaveCourse(c) {
  return withLock_(function () {
    const t = new Table_('RuCourses');
    const clean = ruCleanCourse_(c);
    const clash = t.rows.find(function (r) { return r.code === clean.code && r.id !== c.id; });
    if (clash) throw new Error('There is already a course with code ' + clean.code + '.');
    if (c.id && t.byId(c.id)) {
      // Editing credits must not push a semester over its limit
      const plan = new Table_('RuPlan').rows.find(function (p) { return p.courseId === c.id; });
      if (plan) ruCheckFits_(plan.termId, c.id, parseInt(clean.credits, 10), t);
      if (c.exam === undefined) delete clean.exam;
      t.update(c.id, clean);
    } else {
      t.insert(Object.assign({ id: uid_() }, clean));
    }
    t.save();
    return getAppData();
  });
}

function ruDeleteCourse(id) {
  return withLock_(function () {
    const t = new Table_('RuCourses');
    const p = new Table_('RuPlan');
    t.removeWhere(function (r) { return r.id === id; });
    p.removeWhere(function (r) { return r.courseId === id; });
    t.save();
    p.save();
    return getAppData();
  });
}

/* ---------- Semesters and the plan ---------- */

function ruAddTerm(year, semester) {
  return withLock_(function () {
    const y = parseInt(year, 10);
    if (!(y >= 2500 && y <= 2700)) throw new Error('Enter the academic year in Buddhist Era, for example 2569.');
    if (['1', '2', 'S'].indexOf(String(semester)) < 0) throw new Error('Choose semester 1, semester 2 or summer.');
    const t = new Table_('RuTerms');
    if (t.rows.some(function (r) { return r.year === String(y) && r.semester === String(semester); })) {
      throw new Error(ruTermName_({ year: y, semester: String(semester) }) + ' is already in your plan.');
    }
    const id = uid_();
    t.insert({ id: id, year: String(y), semester: String(semester) });
    t.save();
    return { data: getAppData(), id: id };
  });
}

function ruDeleteTerm(id) {
  return withLock_(function () {
    const t = new Table_('RuTerms');
    const p = new Table_('RuPlan');
    t.removeWhere(function (r) { return r.id === id; });
    p.removeWhere(function (r) { return r.termId === id; });
    t.save();
    p.save();
    return getAppData();
  });
}

/** Throws if putting this course in this semester would break the maximum-credit rule. */
function ruCheckFits_(termId, courseId, credits, coursesTable) {
  const term = new Table_('RuTerms').byId(termId);
  if (!term) throw new Error('Semester not found.');
  const courses = coursesTable || new Table_('RuCourses');
  const lim = ruLimits_(term.semester);
  let total = 0;
  new Table_('RuPlan').rows.forEach(function (p) {
    if (p.termId === termId && p.courseId !== courseId) {
      const c = courses.byId(p.courseId);
      total += c ? parseInt(c.credits, 10) || 0 : 0;
    }
  });
  if (total + credits > lim.max) {
    throw new Error(ruTermName_(term) + ' would have ' + (total + credits) + ' credits. ' +
      (term.semester === 'S' ? 'A summer semester' : 'A regular semester') + ' allows at most ' + lim.max + '.');
  }
}

function ruPlanAdd(termId, courseId) {
  return withLock_(function () {
    const courses = new Table_('RuCourses');
    const c = courses.byId(courseId);
    if (!c) throw new Error('Course not found.');
    const p = new Table_('RuPlan');
    const already = p.rows.find(function (r) { return r.courseId === courseId; });
    if (already) {
      const term = new Table_('RuTerms').byId(already.termId);
      throw new Error(c.code + ' is already planned in ' + (term ? ruTermName_(term) : 'another semester') + '.');
    }
    ruCheckFits_(termId, courseId, parseInt(c.credits, 10) || 0, courses);
    p.insert({ id: uid_(), termId: termId, courseId: courseId, passed: 'FALSE' });
    p.save();
    return getAppData();
  });
}

function ruPlanMove(planId, termId) {
  return withLock_(function () {
    const p = new Table_('RuPlan');
    const row = p.byId(planId);
    if (!row) throw new Error('That course is no longer in your plan.');
    if (!termId && row.kind !== 'retake') throw new Error('Only retakes can wait without a semester.');
    if (termId) {
      const c = new Table_('RuCourses').byId(row.courseId);
      ruCheckFits_(termId, row.courseId, c ? parseInt(c.credits, 10) || 0 : 0);
    }
    p.update(planId, { termId: termId || '' });
    p.save();
    return getAppData();
  });
}

function ruPlanRemove(planId) {
  return withLock_(function () {
    const p = new Table_('RuPlan');
    p.removeWhere(function (r) { return r.id === planId || r.retakeOf === planId; });
    p.save();
    return getAppData();
  });
}

function ruPlanPassed(planId, passed) {
  return withLock_(function () {
    const p = new Table_('RuPlan');
    p.update(planId, { passed: passed ? 'TRUE' : 'FALSE' });
    p.save();
    return getAppData();
  });
}

function ruSetCreditsNeeded(n) {
  return withLock_(function () {
    const v = String(n || '').trim();
    if (v && !(parseInt(v, 10) > 0 && parseInt(v, 10) <= 400)) throw new Error('Enter the total credits as a number, for example 140.');
    const t = new Table_('Settings');
    const row = t.rows.find(function (r) { return r.key === 'ruCreditsNeeded'; });
    if (row) row.value = v ? String(parseInt(v, 10)) : '';
    else t.insert({ key: 'ruCreditsNeeded', value: v ? String(parseInt(v, 10)) : '' });
    t.save();
    return getAppData();
  });
}

/**
 * Loads the LL.B. curriculum in one go.
 * input = { courses: [{code,name,credits,category,exam}], plan: [{yearOffset, semester, codes:[]}], startYear, setNeeded }
 * Courses with the same code are updated. Semesters that already exist are reused, and courses
 * that are already planned somewhere are left where they are.
 */
function ruLoadCurriculum(input) {
  return withLock_(function () {
    const ct = new Table_('RuCourses');
    const tt = new Table_('RuTerms');
    const pt = new Table_('RuPlan');
    const report = { coursesAdded: 0, coursesUpdated: 0, termsAdded: 0, planned: 0, skipped: [] };

    (input.courses || []).slice(0, 600).forEach(function (c) {
      const clean = ruCleanCourse_(c);
      const existing = ct.rows.find(function (r) { return r.code === clean.code; });
      if (existing) {
        // Keep the user's own edits to name, credits and prerequisites; refresh group and exam slot
        ct.update(existing.id, { category: clean.category, exam: existing.exam || clean.exam });
        report.coursesUpdated++;
      } else {
        ct.insert(Object.assign({ id: uid_() }, clean));
        report.coursesAdded++;
      }
    });

    const plan = input.plan || [];
    if (plan.length) {
      const start = parseInt(input.startYear, 10);
      if (!(start >= 2500 && start <= 2700)) throw new Error('Enter the first academic year in Buddhist Era, for example 2569.');
      const creditsOf = function (courseId) { const c = ct.byId(courseId); return c ? parseInt(c.credits, 10) || 0 : 0; };
      plan.forEach(function (sem) {
        const year = String(start + (parseInt(sem.yearOffset, 10) || 0));
        const semester = String(sem.semester);
        let term = tt.rows.find(function (r) { return r.year === year && r.semester === semester; });
        if (!term) { term = tt.insert({ id: uid_(), year: year, semester: semester }); report.termsAdded++; }
        const lim = ruLimits_(semester);
        (sem.codes || []).forEach(function (code) {
          const c = ct.rows.find(function (r) { return r.code === code; });
          if (!c) return;
          if (pt.rows.some(function (p) { return p.courseId === c.id; })) { report.skipped.push(code + ' is already planned'); return; }
          const total = pt.rows.filter(function (p) { return p.termId === term.id; })
            .reduce(function (n, p) { return n + creditsOf(p.courseId); }, 0);
          if (total + creditsOf(c.id) > lim.max) { report.skipped.push(code + ' would put ' + ruTermName_(term) + ' over ' + lim.max + ' credits'); return; }
          pt.insert({ id: uid_(), termId: term.id, courseId: c.id, passed: 'FALSE' });
          report.planned++;
        });
      });
    }

    ct.save();
    tt.save();
    pt.save();
    if (input.setNeeded) {
      const st = new Table_('Settings');
      const row = st.rows.find(function (r) { return r.key === 'ruCreditsNeeded'; });
      if (row) row.value = '140'; else st.insert({ key: 'ruCreditsNeeded', value: '140' });
      st.save();
    }
    return { data: getAppData(), report: report };
  });
}

/* ============================================================
 *  BOOKSTORE: your own book storage
 * ============================================================ */

const BOOK_STATUSES = ['Want to read', 'Reading', 'Finished'];

/** b = { id?, title, author, isbn, cover, pages, currentPage, status, rating, category, courseCode, location, link, notes } */
function saveBook(b) {
  return withLock_(function () {
    const title = String(b.title || '').trim();
    if (!title) throw new Error('Give the book a title.');
    const pages = Math.max(0, parseInt(b.pages, 10) || 0);
    let current = Math.max(0, parseInt(b.currentPage, 10) || 0);
    if (pages && current > pages) current = pages;
    let status = BOOK_STATUSES.indexOf(b.status) > -1 ? b.status : 'Want to read';
    if (pages && current >= pages && status === 'Reading') status = 'Finished';
    const rating = Math.max(0, Math.min(5, parseInt(b.rating, 10) || 0));
    const cover = String(b.cover || '').trim();
    if (cover && !/^https:\/\//.test(cover)) throw new Error('The cover must be an https:// image link.');
    const link = String(b.link || '').trim();

    const t = new Table_('Books');
    const prev = b.id ? t.byId(b.id) : null;
    const now = nowStr_();
    const row = {
      title: title.slice(0, 300), author: String(b.author || '').trim().slice(0, 200),
      isbn: String(b.isbn || '').replace(/[^0-9Xx]/g, '').slice(0, 13), cover: cover.slice(0, 1000),
      pages: pages || '', currentPage: current || '', status: status, rating: rating || '',
      category: String(b.category || '').trim().slice(0, 80), courseCode: String(b.courseCode || '').trim().slice(0, 40),
      location: String(b.location || '').trim().slice(0, 120), link: link.slice(0, 1000), notes: String(b.notes || '').slice(0, 4000)
    };
    if (prev) {
      if (status === 'Reading' && !prev.startedAt) row.startedAt = now;
      if (status === 'Finished' && prev.status !== 'Finished') row.finishedAt = now;
      if (status !== 'Finished') row.finishedAt = '';
      t.update(prev.id, row);
    } else {
      t.insert(Object.assign({ id: uid_(), addedAt: now, startedAt: status === 'Reading' ? now : '', finishedAt: status === 'Finished' ? now : '' }, row));
    }
    t.save();
    return getAppData();
  });
}

/** Moves a book to another shelf (drag and drop on the shelves). */
function setBookStatus(id, status) {
  return withLock_(function () {
    if (BOOK_STATUSES.indexOf(status) < 0) throw new Error('Unknown shelf.');
    const t = new Table_('Books');
    const b = t.byId(id);
    if (!b) throw new Error('That book is no longer on your shelves.');
    const patch = { status: status };
    if (status === 'Reading' && !b.startedAt) patch.startedAt = nowStr_();
    if (status === 'Finished') { patch.finishedAt = nowStr_(); if (b.pages) patch.currentPage = b.pages; }
    else patch.finishedAt = '';
    t.update(id, patch);
    t.save();
    return getAppData();
  });
}

function deleteBook(id) {
  return withLock_(function () {
    const t = new Table_('Books');
    t.removeWhere(function (r) { return r.id === id; });
    t.save();
    return getAppData();
  });
}

/** Looks books up on Google Books by title, author or ISBN so covers and page counts fill in by themselves. */
function searchBooks(query) {
  const q = String(query || '').trim();
  if (!q) return [];
  const digits = q.replace(/[^0-9Xx]/g, '');
  const term = (digits.length === 10 || digits.length === 13) && digits.length >= q.replace(/[\s-]/g, '').length - 1 ? 'isbn:' + digits : q;
  const url = 'https://www.googleapis.com/books/v1/volumes?maxResults=12&printType=books&q=' + encodeURIComponent(term);
  let resp;
  try { resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true }); } catch (e) {
    throw new Error('Book search is unavailable right now. You can still add the book by hand.');
  }
  if (resp.getResponseCode() !== 200) throw new Error('Book search is unavailable right now. You can still add the book by hand.');
  const data = JSON.parse(resp.getContentText());
  return (data.items || []).map(function (it) {
    const v = it.volumeInfo || {};
    const ids = v.industryIdentifiers || [];
    const isbn = (ids.find(function (x) { return x.type === 'ISBN_13'; }) || ids.find(function (x) { return x.type === 'ISBN_10'; }) || {}).identifier || '';
    const img = (v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail)) || '';
    return {
      title: (v.title || '') + (v.subtitle ? ': ' + v.subtitle : ''),
      author: (v.authors || []).join(', '),
      pages: v.pageCount || '',
      isbn: isbn,
      category: (v.categories || [])[0] || '',
      year: String(v.publishedDate || '').slice(0, 4),
      cover: img ? img.replace(/^http:/, 'https:').replace('&edge=curl', '') : ''
    };
  });
}

/* ---------- Grades, GPA and retakes ---------- */

const RU_GRADES = { 'A': 4, 'B+': 3.5, 'B': 3, 'C+': 2.5, 'C': 2, 'D+': 1.5, 'D': 1, 'F': 0 };

/** grade = 'A' ... 'F', or '' to clear. Any grade except F counts as passed. */
function ruSetGrade(planId, grade) {
  return withLock_(function () {
    const g = String(grade || '').toUpperCase().trim();
    if (g && !(g in RU_GRADES)) throw new Error('Use one of A, B+, B, C+, C, D+, D or F.');
    const p = new Table_('RuPlan');
    const row = p.byId(planId);
    if (!row) throw new Error('That course is no longer in your plan.');
    if (g && !row.termId) throw new Error('Put this retake into a semester before entering its grade.');
    p.update(planId, { grade: g, passed: g && g !== 'F' ? 'TRUE' : 'FALSE' });
    p.save();
    return getAppData();
  });
}

/**
 * Sends a course to retake (ซ่อม). termId '' puts it in the retake tray to schedule later;
 * a termId plans the retake in that semester straight away. The grade is entered later.
 */
function ruRetake(planId, termId) {
  return withLock_(function () {
    const p = new Table_('RuPlan');
    const row = p.byId(planId);
    if (!row) throw new Error('That course is no longer in your plan.');
    const original = row.kind === 'retake' && row.retakeOf ? (p.byId(row.retakeOf) || row) : row;
    const open = p.rows.find(function (r) { return r.courseId === row.courseId && r.kind === 'retake' && !r.grade; });
    if (open) throw new Error('This course already has a retake waiting for its grade.');
    if (termId) {
      const c = new Table_('RuCourses').byId(row.courseId);
      ruCheckFits_(termId, row.courseId, c ? parseInt(c.credits, 10) || 0 : 0);
    }
    p.insert({ id: uid_(), termId: termId || '', courseId: row.courseId, passed: 'FALSE', grade: '', kind: 'retake', retakeOf: original.id });
    p.save();
    return getAppData();
  });
}

/** 'latest' counts only the newest graded attempt of each course; 'all' counts every attempt. */
function ruSetGpaPolicy(policy) {
  return withLock_(function () {
    const v = policy === 'all' ? 'all' : 'latest';
    const t = new Table_('Settings');
    const row = t.rows.find(function (r) { return r.key === 'ruGpaPolicy'; });
    if (row) row.value = v; else t.insert({ key: 'ruGpaPolicy', value: v });
    t.save();
    return getAppData();
  });
}

/* ============================================================
 *  CLASSROOM FILES: copy what teachers attach into your Drive
 * ============================================================ */

/** Everything a class has posted that can carry attachments: materials, assignments and announcements. */
function listClassroomPosts_(courseId, errors) {
  const posts = [];
  errors = errors || [];
  const pull = function (fetch, key, source, titleOf) {
    let token = null;
    try {
      do {
        const r = fetch({ pageSize: 100, pageToken: token });
        (r[key] || []).forEach(function (it) {
          if (it.materials && it.materials.length) {
            posts.push({ source: source, id: it.id, title: titleOf(it), materials: it.materials, link: it.alternateLink || '' });
          }
        });
        token = r.nextPageToken;
      } while (token);
    } catch (e) {
      Logger.log(source + ' list failed for ' + courseId + ': ' + e.message);
      errors.push({ source: source, message: e.message });
    }
  };
  pull(function (o) { return Classroom.Courses.CourseWorkMaterials.list(courseId, o); }, 'courseWorkMaterial', 'Material',
    function (it) { return it.title || 'Material'; });
  pull(function (o) { return Classroom.Courses.CourseWork.list(courseId, o); }, 'courseWork', 'Assignment',
    function (it) { return it.title || 'Assignment'; });
  pull(function (o) { return Classroom.Courses.Announcements.list(courseId, o); }, 'announcements', 'Announcement',
    function (it) { return String(it.text || 'Announcement').replace(/\s+/g, ' ').slice(0, 80); });
  return posts;
}

/** Subject folder > "Classroom files - <class name>", created the first time it's needed. */
function classroomFolder_(link, subjects, cache) {
  if (cache[link.id]) return cache[link.id];
  const subj = subjects.find(function (s) { return s.id === link.subjectId; });
  let parent;
  try { parent = subj && subj.folderId ? DriveApp.getFolderById(subj.folderId) : getRootFolder_(); } catch (e) { parent = getRootFolder_(); }
  const name = ('Classroom files - ' + link.courseName).replace(/[\\/]/g, '-').slice(0, 120);
  const found = parent.getFoldersByName(name);
  cache[link.id] = found.hasNext() ? found.next() : parent.createFolder(name);
  return cache[link.id];
}

/**
 * Copies new teacher files into Drive. Runs from the time trigger and from the "Copy new files now" button.
 * Each run stops after about 4.5 minutes and carries on from where it left off next time.
 */
function syncClassroomFiles() {
  if (typeof Classroom === 'undefined') return { added: 0, links: 0, failed: 0, more: false, note: 'Classroom service is off' };
  const props = PropertiesService.getScriptProperties();
  const started = Date.now();
  const running = parseInt(props.getProperty('FILES_SYNC_AT') || '0', 10);
  if (running && started - running < 6 * 60 * 1000) return { busy: true, added: 0, links: 0, failed: 0, more: true };
  props.setProperty('FILES_SYNC_AT', String(started));
  const report = { added: 0, links: 0, failed: 0, more: false, errors: [] };
  try {
    const links = new Table_('Classrooms').rows;
    const subjects = new Table_('Subjects').rows;
    const known = {};
    new Table_('ClassroomFiles').rows.forEach(function (r) { known[r.courseId + ':' + (r.sourceFileId || r.copyUrl)] = r.status; });
    const fresh = [];
    const retried = {};
    const folders = {};
    const now = function () { return nowStr_(); };

    outer:
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const listErrors = [];
      const posts = listClassroomPosts_(link.courseId, listErrors);
      listErrors.forEach(function (er) { report.errors.push(link.courseName + ' (' + er.source + '): ' + friendlyClassroomError_(er.message)); });
      for (let j = 0; j < posts.length; j++) {
        const post = posts[j];
        for (let k = 0; k < post.materials.length; k++) {
          if (Date.now() - started > 4.5 * 60 * 1000) { report.more = true; break outer; }
          const m = post.materials[k];
          const base = { linkId: link.id, courseId: link.courseId, courseName: link.courseName, source: post.source, postId: post.id, postTitle: post.title };
          if (m.driveFile && m.driveFile.driveFile) {
            const f = m.driveFile.driveFile;
            const key = link.courseId + ':' + f.id;
            if (known[key] === 'copied') continue;
            try {
              const src = DriveApp.getFileById(f.id);
              const copy = src.makeCopy(src.getName(), classroomFolder_(link, subjects, folders));
              copy.setDescription('Copied by Study Hub from ' + link.courseName + ' (' + post.source + ': ' + post.title + ')');
              fresh.push(Object.assign(base, { sourceFileId: f.id, title: src.getName(), kind: 'file', copyId: copy.getId(), copyUrl: copy.getUrl(), status: 'copied', note: '', copiedAt: now() }));
              report.added++;
              known[key] = 'copied';
            } catch (e) {
              if (known[key] === 'failed') { retried[key] = e.message; continue; }
              fresh.push(Object.assign(base, { sourceFileId: f.id, title: f.title || 'Drive file', kind: 'file', copyId: '', copyUrl: f.alternateLink || '', status: 'failed', note: String(e.message).slice(0, 200), copiedAt: now() }));
              report.failed++;
              known[key] = 'failed';
            }
          } else {
            const url = m.link ? m.link.url : m.youtubeVideo ? m.youtubeVideo.alternateLink : m.form ? m.form.formUrl : '';
            if (!url) continue;
            const key = link.courseId + ':' + url;
            if (known[key]) continue;
            const title = m.link ? (m.link.title || url) : m.youtubeVideo ? (m.youtubeVideo.title || 'YouTube video') : (m.form.title || 'Google Form');
            fresh.push(Object.assign(base, { sourceFileId: '', title: title, kind: m.link ? 'link' : m.youtubeVideo ? 'video' : 'form', copyId: '', copyUrl: url, status: 'link', note: '', copiedAt: now() }));
            known[key] = 'link';
            report.links++;
          }
        }
      }
    }

    withLock_(function () {
      const t = new Table_('ClassroomFiles');
      // A file that failed before and copied now replaces its old "failed" row
      fresh.forEach(function (r) {
        if (r.status === 'copied') t.removeWhere(function (x) { return x.status === 'failed' && x.courseId === r.courseId && x.sourceFileId === r.sourceFileId; });
        t.insert(Object.assign({ id: uid_() }, r));
      });
      Object.keys(retried).forEach(function (key) {
        const row = t.rows.find(function (x) { return x.status === 'failed' && x.courseId + ':' + x.sourceFileId === key; });
        if (row) row.note = String(retried[key]).slice(0, 200);
      });
      t.save();
      const st = new Table_('Settings');
      const last = st.rows.find(function (r) { return r.key === 'filesLastRun'; });
      if (last) last.value = nowStr_(); else st.insert({ key: 'filesLastRun', value: nowStr_() });
      const errText = report.errors.slice(0, 8).join('\n').slice(0, 2000);
      const errRow = st.rows.find(function (r) { return r.key === 'filesLastError'; });
      if (errRow) errRow.value = errText; else st.insert({ key: 'filesLastError', value: errText });
      st.save();
    });
  } finally {
    props.deleteProperty('FILES_SYNC_AT');
  }
  return report;
}

/** "Copy new files now" button. */
function copyClassroomFilesNow() {
  requireClassroom_();
  const report = syncClassroomFiles();
  report.unmatched = unmatchedClassrooms_();
  return { data: getAppData(), report: report };
}

/** Turns Google's error text into something that says what to do. */
function friendlyClassroomError_(msg) {
  const m = String(msg || '');
  if (/insufficient|scope|permission|PERMISSION_DENIED|403/i.test(m)) {
    return 'Study Hub is not allowed to read this yet. Open the Apps Script editor, run setup, and press Allow.';
  }
  if (/not found|404/i.test(m)) return 'The class could not be found. It may have been archived or removed.';
  return m.slice(0, 200);
}

/** Active classes you are a student in that are not matched to a subject yet. */
function unmatchedClassrooms_() {
  try {
    const matched = {};
    new Table_('Classrooms').rows.forEach(function (r) { matched[String(r.courseId)] = true; });
    const r = Classroom.Courses.list({ studentId: 'me', courseStates: ['ACTIVE'], pageSize: 100 });
    return (r.courses || []).filter(function (c) { return !matched[String(c.id)]; }).map(function (c) { return c.name + (c.section ? ' ' + c.section : ''); });
  } catch (e) { return []; }
}

/** input = { auto: true/false, everyHours: 1 | 2 | 4 | 6 | 12 | 24 } */
function saveFilesSettings(input) {
  return withLock_(function () {
    const hours = [1, 2, 4, 6, 12, 24].indexOf(parseInt(input.everyHours, 10)) > -1 ? parseInt(input.everyHours, 10) : 6;
    const values = { filesAuto: input.auto ? 'true' : 'false', filesEveryHours: String(hours) };
    const t = new Table_('Settings');
    Object.keys(values).forEach(function (k) {
      const row = t.rows.find(function (r) { return r.key === k; });
      if (row) row.value = values[k]; else t.insert({ key: k, value: values[k] });
    });
    t.save();
    ScriptApp.getProjectTriggers()
      .filter(function (tr) { return tr.getHandlerFunction() === 'syncClassroomFiles'; })
      .forEach(function (tr) { ScriptApp.deleteTrigger(tr); });
    if (input.auto) {
      const b = ScriptApp.newTrigger('syncClassroomFiles').timeBased();
      if (hours === 24) b.everyDays(1).atHour(5).inTimezone(tz_()).create();
      else b.everyHours(hours).create();
    }
    return getAppData();
  });
}

/* ============================================================
 *  PDF TOOLS: split, merge and watermark (work happens in the browser;
 *  the server only reads source files from Drive and saves results)
 * ============================================================ */

const TOOL_MAX_BYTES = 20 * 1024 * 1024;
const TOOL_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];

function toolsFolder_(subjectId) {
  let parent = getRootFolder_();
  if (subjectId) {
    const s = new Table_('Subjects').byId(subjectId);
    if (s && s.folderId) { try { parent = DriveApp.getFolderById(s.folderId); } catch (e) { /* fall back to root */ } }
  }
  const found = parent.getFoldersByName('PDF tools');
  return found.hasNext() ? found.next() : parent.createFolder('PDF tools');
}

/** PDFs and images in your subject folders (including Classroom files) and in the PDF tools folders. */
function listToolFiles() {
  const out = [];
  const seen = {};
  const scan = function (folder, label, depth) {
    const files = folder.getFiles();
    let n = 0;
    while (files.hasNext() && n < 150) {
      const f = files.next(); n++;
      if (TOOL_TYPES.indexOf(f.getMimeType()) < 0 || seen[f.getId()]) continue;
      seen[f.getId()] = true;
      out.push({ id: f.getId(), name: f.getName(), mimeType: f.getMimeType(), size: f.getSize(), place: label,
        updated: Utilities.formatDate(f.getLastUpdated(), tz_(), DT_FORMAT) });
    }
    if (depth > 0) {
      const subs = folder.getFolders();
      while (subs.hasNext()) {
        const sub = subs.next();
        const nm = sub.getName();
        if (nm.indexOf('Classroom files') === 0 || nm === 'PDF tools') scan(sub, label + ' / ' + nm, depth - 1);
      }
    }
  };
  new Table_('Subjects').rows.forEach(function (s) {
    if (!s.folderId) return;
    try { scan(DriveApp.getFolderById(s.folderId), s.name, 1); } catch (e) { /* folder gone */ }
  });
  try {
    const root = getRootFolder_();
    const found = root.getFoldersByName('PDF tools');
    if (found.hasNext()) scan(found.next(), 'Study Hub / PDF tools', 1);
  } catch (e) { /* ignore */ }
  out.sort(function (a, b) { return b.updated.localeCompare(a.updated); });
  return out.slice(0, 300);
}

function getToolFile(id) {
  const f = DriveApp.getFileById(id);
  if (TOOL_TYPES.indexOf(f.getMimeType()) < 0) throw new Error('Only PDF, PNG and JPG files can be used here.');
  if (f.getSize() > TOOL_MAX_BYTES) throw new Error(f.getName() + ' is larger than 20 MB.');
  return { name: f.getName(), mimeType: f.getMimeType(), data: Utilities.base64Encode(f.getBlob().getBytes()) };
}

/** file = { name, mimeType, data (base64), subjectId, subfolder } — saved into "PDF tools" of that subject (or Study Hub). */
function saveToolFile(file) {
  const name = String(file.name || 'document.pdf').replace(/[\\/]/g, '-').slice(0, 200);
  let folder = toolsFolder_(file.subjectId || '');
  if (file.subfolder) {
    const sub = String(file.subfolder).replace(/[\\/]/g, '-').slice(0, 120);
    const found = folder.getFoldersByName(sub);
    folder = found.hasNext() ? found.next() : folder.createFolder(sub);
  }
  const blob = Utilities.newBlob(Utilities.base64Decode(file.data), file.mimeType || 'application/pdf', name);
  const created = folder.createFile(blob);
  return { name: created.getName(), url: created.getUrl(), folderUrl: folder.getUrl() };
}

/* ============================================================
 *  JSON API for the GitHub Pages site
 *  The page sends POST { fn, args, key } as text/plain and gets back
 *  { ok: true, result } or { ok: false, error, code }.
 * ============================================================ */

/** Only these functions can be called from the site. Everything else in this file stays private. */
const API_FUNCTIONS = {
  getAppData: getAppData,
  addSubject: addSubject, updateSubject: updateSubject, deleteSubject: deleteSubject,
  getSubjectFiles: getSubjectFiles, uploadToSubjectFolder: uploadToSubjectFolder,
  uploadSyllabus: uploadSyllabus, linkSyllabus: linkSyllabus, removeSyllabus: removeSyllabus,
  listMyCourses: listMyCourses, linkClassroom: linkClassroom, unlinkClassroom: unlinkClassroom, syncClassrooms: syncClassrooms,
  saveTask: saveTask, setTaskStatus: setTaskStatus, deleteTask: deleteTask, toggleMilestone: toggleMilestone,
  saveSettings: saveSettings, sendTestReminder: sendTestReminder,
  createPlaylist: createPlaylist, renamePlaylist: renamePlaylist, deletePlaylist: deletePlaylist,
  previewVideos: previewVideos, addVideos: addVideos, addTracks: addTracks, removeTrack: removeTrack, moveTrack: moveTrack,
  ruSaveSession: ruSaveSession, ruDeleteSession: ruDeleteSession,
  ruImportCourses: ruImportCourses, ruSaveCourse: ruSaveCourse, ruDeleteCourse: ruDeleteCourse,
  ruAddTerm: ruAddTerm, ruDeleteTerm: ruDeleteTerm, ruPlanAdd: ruPlanAdd, ruPlanMove: ruPlanMove,
  ruPlanRemove: ruPlanRemove, ruPlanPassed: ruPlanPassed, ruSetCreditsNeeded: ruSetCreditsNeeded,
  ruLoadCurriculum: ruLoadCurriculum, ruSetGrade: ruSetGrade, ruRetake: ruRetake, ruSetGpaPolicy: ruSetGpaPolicy,
  saveBook: saveBook, setBookStatus: setBookStatus, deleteBook: deleteBook, searchBooks: searchBooks,
  copyClassroomFilesNow: copyClassroomFilesNow, saveFilesSettings: saveFilesSettings,
  listToolFiles: listToolFiles, getToolFile: getToolFile, saveToolFile: saveToolFile
};

function doPost(e) {
  let body;
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return apiOut_({ ok: false, error: 'The request could not be read.', code: 'bad' }); }
  try {
    checkApiKey_(body.key);
    if (body.fn === 'ping') return apiOut_({ ok: true, result: { app: APP_NAME, schema: SCHEMA_VERSION } });
    const fn = Object.prototype.hasOwnProperty.call(API_FUNCTIONS, body.fn) ? API_FUNCTIONS[body.fn] : null;
    if (!fn) throw new Error('Unknown action: ' + String(body.fn).slice(0, 60));
    if (body.fn === 'getAppData' && body.site) rememberSiteUrl_(body.site);
    const result = fn.apply(null, Array.isArray(body.args) ? body.args : []);
    return apiOut_({ ok: true, result: result === undefined ? null : result });
  } catch (err) {
    return apiOut_({ ok: false, error: String((err && err.message) || err), code: (err && err.apiCode) || '' });
  }
}

function apiOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function checkApiKey_(key) {
  const saved = PropertiesService.getScriptProperties().getProperty('API_KEY');
  if (!saved) {
    const e = new Error('This script has no access key yet. In the Apps Script editor, run showApiKey and copy the key from the execution log.');
    e.apiCode = 'nokey';
    throw e;
  }
  if (typeof key !== 'string' || key.length !== saved.length || key !== saved) {
    const e = new Error('That access key is not right. Copy it again from showApiKey in the Apps Script editor.');
    e.apiCode = 'auth';
    throw e;
  }
}

function ensureApiKey_() {
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty('API_KEY');
  if (!key) {
    key = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    props.setProperty('API_KEY', key);
  }
  return key;
}

/** Run from the editor to see the access key (one is created the first time). */
function showApiKey() {
  Logger.log('Access key for the GitHub Pages site: ' + ensureApiKey_());
}

/** Run from the editor if the key leaks. Every browser has to connect again with the new key. */
function resetApiKey() {
  PropertiesService.getScriptProperties().deleteProperty('API_KEY');
  Logger.log('New access key: ' + ensureApiKey_());
}

/** The reminder email's "Open Study Hub" button points at the GitHub Pages address the site reports. */
function rememberSiteUrl_(url) {
  const u = String(url || '').slice(0, 300);
  if (!/^https:\/\/[^\s"'<>]+$/.test(u)) return;
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('SITE_URL') !== u) props.setProperty('SITE_URL', u);
}
