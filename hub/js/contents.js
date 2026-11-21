/* ================= Ramkhamhaeng Hub: course contents checklist =================
 * Each course gets a table of contents you write yourself, up to 3 levels deep
 * (chapter > section > sub-topic). Tick topics as you study; the tick date is saved
 * to the RuToc sheet. Uses the helpers from app.js (S, ru, esc, I, act, call, render...).
 */
const TOC_LEVELS = 3;
S.ru.tocCourse = (function () { try { return localStorage.getItem('studyhub-toc-course') || ''; } catch (e) { return ''; } })();
S.ru.tocFold = {};          // id -> true when a chapter is collapsed
let te = null;              // the open contents editor: { code, rows: [{ id, level, title }], dirty }

/* ---------- Data helpers ---------- */
function tocRows(code) {
  return (ru().toc || []).filter(r => r.courseCode === code).sort((a, b) => a.pos - b.pos);
}

/** Builds the tree and works out leaf progress for every node. */
function tocTree(code) {
  const rows = tocRows(code);
  const byId = {}, roots = [];
  rows.forEach(r => { byId[r.id] = Object.assign({}, r, { kids: [] }); });
  rows.forEach(r => {
    const n = byId[r.id];
    if (r.parentId && byId[r.parentId]) byId[r.parentId].kids.push(n); else roots.push(n);
  });
  const walk = n => {
    if (!n.kids.length) { n.leaves = 1; n.doneLeaves = n.done ? 1 : 0; n.lastAt = n.done ? n.doneAt : ''; return; }
    n.leaves = 0; n.doneLeaves = 0; n.lastAt = '';
    n.kids.forEach(k => { walk(k); n.leaves += k.leaves; n.doneLeaves += k.doneLeaves; if (k.lastAt > n.lastAt) n.lastAt = k.lastAt; });
  };
  roots.forEach(walk);
  const total = roots.reduce((s, n) => s + n.leaves, 0);
  const done = roots.reduce((s, n) => s + n.doneLeaves, 0);
  const lastAt = roots.reduce((m, n) => n.lastAt > m ? n.lastAt : m, '');
  return { roots, byId, total, done, lastAt, count: rows.length };
}

function tocState(n) { return n.doneLeaves === 0 ? 'false' : n.doneLeaves === n.leaves ? 'true' : 'mixed'; }
function tocPct(done, total) { return total ? Math.round(done / total * 100) : 0; }
function tocDate(s) { const d = pd(s); return d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''; }

function tocPickCourse() {
  const courses = ru().courses;
  if (S.ru.tocCourse && courses.some(c => c.code === S.ru.tocCourse)) return S.ru.tocCourse;
  const withToc = new Set((ru().toc || []).map(r => r.courseCode));
  const cur = currentTermGuess();
  const mine = cur ? ru().plan.filter(p => p.termId === cur.id).map(p => ruCourse(p.courseId)).filter(Boolean) : [];
  const pick = mine.find(c => withToc.has(c.code)) || courses.find(c => withToc.has(c.code)) || mine[0] || null;
  return pick ? pick.code : '';
}

function tocSetCourse(code) {
  S.ru.tocCourse = code;
  try { localStorage.setItem('studyhub-toc-course', code); } catch (e) { }
  render();
}

/* ---------- Page ---------- */
function ruContents() {
  if (!ru().courses.length) {
    return `<div class="panel empty-state"><h3>No courses yet<\/h3>
      <p>Load the LL.B. curriculum or add your courses in the Course planner, then come back to write each course's contents.<\/p>
      <p><button class="btn primary" data-act="ru-tab" data-tab="planner">Open the course planner<\/button><\/p><\/div>`;
  }
  const code = tocPickCourse();
  const course = ru().courses.find(c => c.code === code);
  const tree = code ? tocTree(code) : null;

  let main;
  if (!course) {
    main = `<div class="panel empty-state"><h3>Pick a course<\/h3><p>Choose a course above to write or tick its contents.<\/p><\/div>`;
  } else if (!tree.count) {
    main = `<div class="panel empty-state toc-empty"><h3>No contents for ${esc(course.code)} yet<\/h3>
      <p>Copy the table of contents from your textbook or course sheet. You can nest it up to 3 levels: chapter, section and sub-topic.<\/p>
      <p><button class="btn primary" data-act="toc-edit">${I.edit} Write the contents<\/button><\/p><\/div>`;
  } else {
    const pct = tocPct(tree.done, tree.total);
    const allOpen = tree.roots.every(n => !S.ru.tocFold[n.id]);
    main = `<div class="panel toc">
      <div class="toc-head">
        <div style="min-width:0"><h3>${esc(course.code)} ${esc(course.name)}<\/h3>
          <p class="sub">${tree.done} of ${tree.total} topic${tree.total === 1 ? '' : 's'} studied${tree.lastAt ? ', last on ' + esc(tocDate(tree.lastAt)) : ''}<\/p><\/div>
        <div class="toc-actions">
          ${tree.roots.some(n => n.kids.length) ? `<button class="btn" data-act="toc-fold-all">${allOpen ? 'Collapse all' : 'Expand all'}<\/button>` : ''}
          <button class="btn" data-act="toc-edit">${I.edit} Edit contents<\/button>
        <\/div>
      <\/div>
      <div class="toc-bar" title="${pct}%"><i style="width:${pct}%"><\/i><\/div>
      <ul class="toc-list">${tree.roots.map(n => tocItem(n)).join('')}<\/ul>
    <\/div>`;
  }

  return `<div class="toc-picker">
      <label class="field" style="margin:0"><span>Course<\/span><select class="input" id="tocCourse">${tocCourseOptions(code)}<\/select><\/label>
    <\/div>
    <div class="grid-2"><div>${main}<\/div><aside>${tocOverview(code)}${tocRecent()}<\/aside><\/div>`;
}

function tocCourseOptions(selected) {
  const withToc = new Set((ru().toc || []).map(r => r.courseCode));
  const opt = c => `<option value="${esc(c.code)}" ${c.code === selected ? 'selected' : ''}>${esc(c.code + ' ' + c.name)}${withToc.has(c.code) ? ' ✓' : ''}<\/option>`;
  const all = ru().courses.slice().sort((a, b) => a.code.localeCompare(b.code));
  const cur = currentTermGuess();
  const mine = cur ? ru().plan.filter(p => p.termId === cur.id).map(p => ruCourse(p.courseId)).filter(Boolean).sort((a, b) => a.code.localeCompare(b.code)) : [];
  const started = all.filter(c => withToc.has(c.code) && mine.indexOf(c) < 0);
  const rest = all.filter(c => mine.indexOf(c) < 0 && !withToc.has(c.code));
  let html = selected ? '' : `<option value="" selected>Choose a course<\/option>`;
  if (mine.length) html += `<optgroup label="This semester, ${esc(termName(cur))}">${mine.map(opt).join('')}<\/optgroup>`;
  if (started.length) html += `<optgroup label="Courses with contents">${started.map(opt).join('')}<\/optgroup>`;
  html += `<optgroup label="${mine.length || started.length ? 'All other courses' : 'All courses'}">${rest.map(opt).join('')}<\/optgroup>`;
  return html;
}

function tocItem(n) {
  const st = tocState(n);
  const folded = n.kids.length && S.ru.tocFold[n.id];
  const meta = n.kids.length
    ? `<span class="toc-count ${st === 'true' ? 'all' : ''}">${n.doneLeaves}/${n.leaves}<\/span>`
    : (n.done && n.doneAt ? `<span class="toc-when">${esc(tocDate(n.doneAt))}<\/span>` : '');
  return `<li class="toc-item l${n.level} ${st === 'true' ? 'done' : ''}">
    <div class="toc-row">
      ${n.kids.length
        ? `<button class="toc-fold ${folded ? '' : 'open'}" data-act="toc-fold" data-id="${n.id}" aria-label="${folded ? 'Expand' : 'Collapse'}" aria-expanded="${folded ? 'false' : 'true'}">${I.right}<\/button>`
        : '<span class="toc-fold-gap"><\/span>'}
      <button class="tick ${st === 'true' ? 'on' : st === 'mixed' ? 'part' : ''}" role="checkbox" aria-checked="${st}" data-act="toc-tick" data-id="${n.id}"
        title="${n.kids.length ? (st === 'true' ? 'Untick everything in this part' : 'Tick everything in this part') : (st === 'true' ? 'Mark as not studied' : 'Mark as studied')}">${st === 'mixed' ? '<i><\/i>' : I.check}<\/button>
      <span class="toc-title">${esc(n.title)}<\/span>
      ${meta}
      <button class="icon-btn toc-read" data-act="toc-read" data-id="${n.id}" title="Start the reading timer on this topic" aria-label="Start the reading timer on this topic">${I.play}<\/button>
    <\/div>
    ${n.kids.length && !folded ? `<ul>${n.kids.map(k => tocItem(k)).join('')}<\/ul>` : ''}
  <\/li>`;
}

function tocOverview(selected) {
  const codes = [...new Set((ru().toc || []).map(r => r.courseCode))];
  const cur = currentTermGuess();
  const mine = cur ? ru().plan.filter(p => p.termId === cur.id).map(p => ruCourse(p.courseId)).filter(Boolean).map(c => c.code) : [];
  mine.forEach(c => { if (codes.indexOf(c) < 0) codes.push(c); });
  if (!codes.length) return '';
  const rows = codes.map(code => {
    const t = tocTree(code), c = ru().courses.find(x => x.code === code);
    return { code, name: c ? c.name : '', t, pct: tocPct(t.done, t.total) };
  }).filter(r => ru().courses.some(c => c.code === r.code))
    .sort((a, b) => (b.t.count ? 1 : 0) - (a.t.count ? 1 : 0) || a.code.localeCompare(b.code));
  return `<div class="panel"><h3>Progress by course<\/h3><p class="sub">Topics studied out of each course's contents.<\/p>
    <ul class="toc-over">${rows.map(r => `<li>
      <button class="${r.code === selected ? 'active' : ''}" data-act="toc-pick" data-code="${esc(r.code)}">
        <span class="nm" title="${esc(r.code + ' ' + r.name)}"><b>${esc(r.code)}<\/b> ${esc(r.name)}<\/span>
        <span class="m">${r.t.count ? r.pct + '%' : 'No contents'}<\/span>
        <span class="b"><i style="width:${r.t.count ? Math.max(2, r.pct) : 0}%"><\/i><\/span>
      <\/button><\/li>`).join('')}<\/ul><\/div>`;
}

function tocRecent() {
  const parents = new Set((ru().toc || []).map(r => r.parentId).filter(Boolean));
  const recent = (ru().toc || []).filter(r => r.done && r.doneAt && !parents.has(r.id))
    .sort((a, b) => b.doneAt.localeCompare(a.doneAt)).slice(0, 8);
  if (!recent.length) return '';
  return `<div class="panel"><h3>Recently studied<\/h3><p class="sub">Your latest ticks across all courses.<\/p>
    <ul class="sess-list">${recent.map(r => `<li><div style="min-width:0"><div class="lb" title="${esc(r.title)}">${esc(r.title)}<\/div>
      <div class="sb">${esc(r.courseCode)}<\/div><\/div><span class="mn">${esc(tocDate(r.doneAt))}<\/span><\/li>`).join('')}<\/ul><\/div>`;
}

/* ---------- Ticking ---------- */
async function tocTick(id) {
  const code = tocPickCourse();
  const tree = tocTree(code);
  const n = tree.byId[id];
  if (!n) return;
  const target = tocState(n) !== 'true';
  const ids = [];
  const collect = x => { ids.push(x.id); x.kids.forEach(collect); };
  collect(n);
  // Parents follow their children: include every ancestor whose all-done state flips to the target
  const rows = tocRows(code);
  const rowBy = {}; rows.forEach(r => { rowBy[r.id] = r; });
  const sub = new Set(ids);
  const leafDone = x => x.kids.length ? x.kids.every(leafDone) : (sub.has(x.id) ? target : x.done);
  let p = n.parentId ? tree.byId[n.parentId] : null;
  while (p) {
    if (leafDone(p) === target && rowBy[p.id].done !== target) ids.push(p.id);
    p = p.parentId ? tree.byId[p.parentId] : null;
  }
  // Show it straight away, then save
  const stamp = localDt(new Date());
  const before = ids.map(i => [rowBy[i], rowBy[i].done, rowBy[i].doneAt]);
  ids.forEach(i => { const r = rowBy[i]; if (target && !r.done) r.doneAt = stamp; if (!target) r.doneAt = ''; r.done = target; });
  render();
  try {
    await call('ruTocSetDone', ids, target);
  } catch (e) {
    before.forEach(([r, d, a]) => { r.done = d; r.doneAt = a; });
    render();
    toast('Could not save the tick: ' + cleanErr(e), 'error');
  }
}

function tocRead(id) {
  const code = tocPickCourse();
  const tree = tocTree(code);
  const n = tree.byId[id];
  if (!n) return;
  if (T.running) { toast('The reading timer is already running. Stop and save it first.', 'error'); return; }
  const path = [];
  for (let x = n; x; x = x.parentId ? tree.byId[x.parentId] : null) path.unshift(x.title);
  T.courseCode = code;
  T.label = path.join(' › ').slice(0, 200);
  S.ru.tab = 'timer';
  timerStart();
  window.scrollTo(0, 0);
  toast('Timer started: ' + n.title);
}

/* ---------- Editor ---------- */
function tocEditor() {
  const code = tocPickCourse();
  const course = ru().courses.find(c => c.code === code);
  if (!course) return;
  const rows = tocRows(code).map(r => ({ id: r.id, level: r.level, title: r.title }));
  te = { code, rows: rows.length ? rows : [{ id: '', level: 1, title: '' }], dirty: false };
  const d = openDialog(`
    <div class="dlg-head"><h3>Contents of ${esc(course.code)}<\/h3><button class="icon-btn" data-te-close aria-label="Close">${I.x}<\/button><\/div>
    <div class="dlg-body">
      <p class="sub" style="margin:0 0 10px">${esc(course.name)}<\/p>
      <div class="te-help"><span><kbd>Enter<\/kbd> new line<\/span><span><kbd>Tab<\/kbd> make it a sub-topic<\/span><span><kbd>Shift<\/kbd>+<kbd>Tab<\/kbd> move it back out<\/span><span>Up to 3 levels<\/span><\/div>
      <ol class="te-list" id="teList"><\/ol>
      <div class="link-row">
        <button class="btn" id="teAdd">${I.plus} Add a line<\/button>
        <button class="btn" id="tePasteToggle">Paste a list<\/button>
      <\/div>
      <div class="te-paste" id="tePaste" hidden>
        <label class="field"><span>Paste the contents, one topic per line<\/span>
          <textarea class="input" id="tePasteText" rows="8" placeholder="บทที่ 1 บทนำ\n  1.1 ความหมาย\n    1.1.1 หลักทั่วไป\nบทที่ 2 ..."><\/textarea>
          <small>Indent sub-topics with spaces or a tab, or number them like 1, 1.1, 1.1.1. Lines are added below what you already have.<\/small><\/label>
        <div class="link-row" style="margin-top:0"><button class="btn primary" id="tePasteGo">Add these lines<\/button><\/div>
      <\/div>
    <\/div>
    <div class="dlg-foot"><span class="muted" id="teCount"><\/span><div class="right">
      <button class="btn" data-te-close>Cancel<\/button>
      <button class="btn primary" id="teSave">Save contents<\/button>
    <\/div><\/div>`);
  d.classList.add('te-dlg');
  d.dataset.sticky = '1';
  teDraw(0);

  d.querySelectorAll('[data-te-close]').forEach(b => b.onclick = teClose);
  $('#teAdd', d).onclick = () => { const last = te.rows[te.rows.length - 1]; teInsert(te.rows.length, last ? last.level : 1); };
  $('#tePasteToggle', d).onclick = () => { const p = $('#tePaste', d); p.hidden = !p.hidden; if (!p.hidden) $('#tePasteText', d).focus(); };
  $('#tePasteGo', d).onclick = () => {
    const lines = parseOutline($('#tePasteText', d).value);
    if (!lines.length) { toast('Paste at least one line first.', 'error'); return; }
    if (te.rows.length === 1 && !te.rows[0].title.trim()) te.rows = [];
    te.rows.push(...lines.map(l => ({ id: '', level: l.level, title: l.title })));
    te.dirty = true;
    $('#tePasteText', d).value = '';
    $('#tePaste', d).hidden = true;
    teDraw(te.rows.length - 1);
    toast('Added ' + lines.length + ' line' + (lines.length === 1 ? '' : 's'));
  };
  $('#teSave', d).onclick = async e => {
    teNormalize();
    const items = te.rows.filter(r => r.title.trim()).map(r => ({ id: r.id, level: r.level, title: r.title.trim() }));
    const had = tocRows(te.code).length;
    if (!items.length && had && !window.confirm('Remove all contents of ' + te.code + '? Every topic and its ticks will be deleted.')) return;
    try {
      await act('ruTocSave', [te.code, items], items.length ? 'Saved ' + items.length + ' topic' + (items.length === 1 ? '' : 's') : 'Contents removed', e.currentTarget);
      te = null;
      closeDialog();
    } catch (err) { /* act already showed the error */ }
  };

  const list = $('#teList', d);
  list.addEventListener('input', e => {
    const li = e.target.closest('.te-row'); if (!li) return;
    te.rows[+li.dataset.i].title = e.target.value; te.dirty = true; teCount();
  });
  list.addEventListener('click', e => {
    const b = e.target.closest('[data-te]'); if (!b) return;
    const i = +b.closest('.te-row').dataset.i;
    teOp(b.dataset.te, i);
  });
  list.addEventListener('keydown', e => {
    const li = e.target.closest('.te-row'); if (!li || e.target.tagName !== 'INPUT') return;
    const i = +li.dataset.i, input = e.target;
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      // Split the line at the cursor, like a word processor
      const at = input.selectionStart, rest = input.value.slice(at);
      te.rows[i].title = input.value.slice(0, at);
      teInsert(i + 1, te.rows[i].level, rest);
    } else if (e.key === 'Tab') {
      e.preventDefault(); teOp(e.shiftKey ? 'out' : 'in', i);
    } else if (e.key === 'Backspace' && input.selectionStart === 0 && input.selectionEnd === 0 && te.rows.length > 1) {
      e.preventDefault();
      if (!input.value && te.rows[i].level > 1) { teOp('out', i); return; }
      if (i === 0) return;
      const prev = te.rows[i - 1], join = prev.title.length;
      prev.title += input.value;
      te.rows.splice(i, 1); te.dirty = true;
      teDraw(i - 1, join);
    } else if (e.key === 'ArrowUp' && i > 0) {
      e.preventDefault(); teFocus(i - 1);
    } else if (e.key === 'ArrowDown' && i < te.rows.length - 1) {
      e.preventDefault(); teFocus(i + 1);
    }
  });
}

function teClose() {
  if (te && te.dirty && !window.confirm('Close without saving? Your changes to the contents will be lost.')) return;
  te = null;
  closeDialog();
}

function teNormalize() {
  let prev = 0;
  te.rows.forEach(r => { r.level = Math.max(1, Math.min(TOC_LEVELS, r.level, prev + 1)); prev = r.level; });
}

function teInsert(at, level, title) {
  te.rows.splice(at, 0, { id: '', level: level || 1, title: title || '' });
  te.dirty = true;
  teDraw(at, 0);
}

function teOp(op, i) {
  const r = te.rows[i];
  if (op === 'in') {
    const prev = te.rows[i - 1];
    if (!prev) { toast('The first line is always a main topic.', 'error'); return; }
    if (r.level >= TOC_LEVELS) { toast('Contents can go 3 levels deep.', 'error'); return; }
    if (r.level > prev.level) return;
    // Its own sub-topics move in with it
    const end = teBlockEnd(i);
    if (te.rows.slice(i, end).some(x => x.level >= TOC_LEVELS)) { toast('Its sub-topics would go deeper than 3 levels.', 'error'); return; }
    for (let k = i; k < end; k++) te.rows[k].level++;
  } else if (op === 'out') {
    if (r.level <= 1) return;
    const end = teBlockEnd(i);
    for (let k = i; k < end; k++) te.rows[k].level--;
  } else if (op === 'up' || op === 'down') {
    const end = teBlockEnd(i), block = te.rows.slice(i, end);
    if (op === 'up') {
      const j = tePrevSibling(i);
      if (j < 0) return;
      te.rows.splice(i, block.length); te.rows.splice(j, 0, ...block); i = j;
    } else {
      if (!teHasNextSibling(i)) return;
      const nextEnd = teBlockEnd(end);
      te.rows.splice(i, block.length); te.rows.splice(i + (nextEnd - end), 0, ...block); i = i + (nextEnd - end);
    }
  } else if (op === 'del') {
    if (te.rows.length === 1) { te.rows[0].title = ''; te.rows[0].level = 1; }
    else te.rows.splice(i, 1);
    i = Math.max(0, Math.min(i, te.rows.length - 1));
  }
  te.dirty = true;
  teNormalize();
  teDraw(i);
}

/** Start of the topic just above row i at the same level and under the same parent, or -1. */
function tePrevSibling(i) {
  let j = i - 1;
  while (j >= 0 && te.rows[j].level > te.rows[i].level) j--;
  return j >= 0 && te.rows[j].level === te.rows[i].level ? j : -1;
}
function teHasNextSibling(i) {
  const end = teBlockEnd(i);
  return end < te.rows.length && te.rows[end].level === te.rows[i].level;
}

/** Index just past row i and all of its sub-topics. */
function teBlockEnd(i) {
  let k = i + 1;
  while (k < te.rows.length && te.rows[k].level > te.rows[i].level) k++;
  return k;
}

function teDraw(focusIndex, caret) {
  teNormalize();
  const list = $('#teList'); if (!list) return;
  const names = ['Chapter', 'Section', 'Sub-topic'];
  list.innerHTML = te.rows.map((r, i) => `<li class="te-row" data-i="${i}" style="--lv:${r.level - 1}">
    <span class="te-lv l${r.level}" title="${names[r.level - 1]}">${r.level}<\/span>
    <input class="input te-in" value="${esc(r.title)}" placeholder="${names[r.level - 1]} title" aria-label="${names[r.level - 1]} ${i + 1}" maxlength="200">
    <span class="te-tools">
      <button class="icon-btn" data-te="out" title="Move out a level (Shift+Tab)" aria-label="Move out a level" ${r.level <= 1 ? 'disabled' : ''}>${I.left}<\/button>
      <button class="icon-btn" data-te="in" title="Make it a sub-topic (Tab)" aria-label="Make it a sub-topic" ${i === 0 || r.level >= TOC_LEVELS || r.level > te.rows[i - 1].level ? 'disabled' : ''}>${I.right}<\/button>
      <button class="icon-btn" data-te="up" title="Move up" aria-label="Move up" ${tePrevSibling(i) < 0 ? 'disabled' : ''}>${I.up}<\/button>
      <button class="icon-btn" data-te="down" title="Move down" aria-label="Move down" ${teHasNextSibling(i) ? '' : 'disabled'}>${I.down}<\/button>
      <button class="icon-btn" data-te="del" title="Delete line" aria-label="Delete line">${I.trash}<\/button>
    <\/span><\/li>`).join('');
  teCount();
  if (focusIndex != null) teFocus(focusIndex, caret);
}

function teFocus(i, caret) {
  const inp = $(`#teList .te-row[data-i="${i}"] .te-in`);
  if (!inp) return;
  inp.focus();
  const pos = caret == null ? inp.value.length : caret;
  try { inp.setSelectionRange(pos, pos); } catch (e) { }
}

function teCount() {
  const c = $('#teCount'); if (!c || !te) return;
  const n = te.rows.filter(r => r.title.trim()).length;
  c.textContent = n + ' topic' + (n === 1 ? '' : 's');
}

/** "1.2 Title", indented lines or bullets -> [{ level, title }] */
function parseOutline(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n').filter(l => l.trim());
  const ws = l => l.match(/^[\t ]*/)[0].replace(/\t/g, '    ').length;
  const indents = lines.map(ws).filter(n => n > 0);
  const unit = indents.length ? Math.min(...indents) : 2;
  return lines.map(line => {
    let title = line.trim().replace(/^[-*•·▪◦]\s+/, '');
    const num = title.match(/^([0-9๐-๙]+(?:\.[0-9๐-๙]+)*)[.)]?\s/);
    const level = num ? num[1].split('.').length : Math.round(ws(line) / unit) + 1;
    return { level: Math.max(1, Math.min(TOC_LEVELS, level)), title: title.slice(0, 200) };
  }).filter(l => l.title);
}

/* ---------- Events ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.tagName === 'A') return;
  switch (el.dataset.act) {
    case 'toc-edit': e.preventDefault(); tocEditor(); break;
    case 'toc-tick': e.preventDefault(); tocTick(el.dataset.id); break;
    case 'toc-read': e.preventDefault(); tocRead(el.dataset.id); break;
    case 'toc-pick': e.preventDefault(); tocSetCourse(el.dataset.code); break;
    case 'toc-fold': e.preventDefault(); S.ru.tocFold[el.dataset.id] = !S.ru.tocFold[el.dataset.id]; render(); break;
    case 'toc-fold-all': {
      e.preventDefault();
      const roots = tocTree(tocPickCourse()).roots.filter(n => n.kids.length);
      const collapse = roots.every(n => !S.ru.tocFold[n.id]);
      roots.forEach(n => { S.ru.tocFold[n.id] = collapse; });
      render();
      break;
    }
  }
});
document.addEventListener('change', e => {
  if (e.target.id === 'tocCourse' && e.target.value) tocSetCourse(e.target.value);
});

// The editor asks before throwing away unsaved lines (backdrop click or Escape)
$('#dlg').addEventListener('click', e => {
  if (e.target.id === 'dlg' && $('#dlg').dataset.sticky) { e.stopImmediatePropagation(); teClose(); }
}, true);
$('#dlg').addEventListener('cancel', e => {
  if ($('#dlg').dataset.sticky) { e.preventDefault(); teClose(); }
});

window.__shContents = true;
