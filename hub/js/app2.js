/* ================= Bookstore ================= */
S.books = { arrange: 'status', q: '', draft: null, results: null, searching: false };
const BOOK_SHELVES = ['Reading', 'Want to read', 'Finished'];
const SPINE_COLORS = ['#7A2E2E', '#2E4A7A', '#2F5D50', '#8A6A2F', '#5B3A6E', '#3E4A61', '#9A4B2F', '#1F5E73', '#56651A', '#6B3B2A', '#8C3A5C', '#24534A'];
function books() { return (S.data && S.data.books) || []; }
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
function bookColor(b) { return SPINE_COLORS[hashStr(b.title + b.author) % SPINE_COLORS.length]; }
function bookPct(b) { const p = +b.pages || 0, c = +b.currentPage || 0; return b.status === 'Finished' ? 100 : p ? Math.min(100, Math.round(c / p * 100)) : 0; }
function bookCover(b, cls) {
  return `<span class="cover ${cls || ''}" style="--bk:${bookColor(b)}">${b.cover ? `<img src="${esc(b.cover)}" alt="" loading="lazy">` : ''}
    ${b.cover ? '' : `<span class="gen"><b>${esc(b.title)}<\/b><small>${esc(b.author || '')}<\/small><\/span>`}<\/span>`;
}
function bookMatches(b, q) { return !q || (b.title + ' ' + b.author + ' ' + b.category + ' ' + b.courseCode + ' ' + b.isbn).toLowerCase().includes(q); }

function spine(b, draggable) {
  const pages = +b.pages || 250;
  const w = Math.max(24, Math.min(58, Math.round(18 + pages / 14)));
  const h = 150 + hashStr(b.id) % 46;
  const q = S.books.q.toLowerCase();
  const cls = q ? (bookMatches(b, q) ? 'match' : 'dim') : '';
  return `<button class="spine ${cls}" style="--bk:${bookColor(b)};--w:${w}px;--h:${h}px" data-act="book-open" data-id="${b.id}"
      ${draggable ? 'draggable="true"' : ''} data-tip="${esc(b.title)}" data-tip2="${esc([b.author, b.pages ? b.pages + ' pages' : '', b.status === 'Reading' ? bookPct(b) + '% read' : ''].filter(Boolean).join(', '))}"
      aria-label="${esc(b.title + (b.author ? ' by ' + b.author : ''))}">
    <span class="st-title">${esc(b.title)}<\/span>${+b.rating ? `<span class="stars-mini">${'\u2605'.repeat(+b.rating)}<\/span>` : ''}<\/button>`;
}

function viewBooks() {
  const all = books();
  const q = S.books.q.toLowerCase();
  const year = String(new Date().getFullYear());
  const reading = all.filter(b => b.status === 'Reading');
  const finishedYear = all.filter(b => b.status === 'Finished' && (b.finishedAt || '').slice(0, 4) === year);
  const pagesYear = finishedYear.reduce((n, b) => n + (+b.pages || 0), 0);
  const arrange = S.books.arrange;

  let shelves;
  if (arrange === 'status') {
    shelves = BOOK_SHELVES.map(st => ({ key: st, label: st === 'Reading' ? 'Reading now' : st, list: all.filter(b => b.status === st), drop: st }));
  } else {
    const keyOf = b => arrange === 'category' ? (b.category || 'No category') : (b.courseCode ? courseText(b.courseCode) : 'Not linked to a course');
    const keys = [...new Set(all.map(keyOf))].sort((a, b) => a.localeCompare(b));
    shelves = keys.map(k => ({ key: k, label: k, list: all.filter(b => keyOf(b) === k), drop: '' }));
  }

  const sign = `<div class="store-front"><div class="awning"><\/div>
    <div class="store-sign"><div><h2>Study Hub Books <span class="open-sign">OPEN<\/span><\/h2>
      <p>Your own bookstore. Browse the shelves, pull a book out to read it, or drag it to another shelf.<\/p><\/div>
      <button class="btn primary" data-act="book-new">${I.plus} Add a book<\/button><\/div>
    <div class="store-stats"><span><strong>${all.length}<\/strong>book${all.length === 1 ? '' : 's'} on the shelves<\/span>
      <span><strong>${reading.length}<\/strong>reading now<\/span>
      <span><strong>${finishedYear.length}<\/strong>finished in ${year}<\/span>
      ${pagesYear ? `<span><strong>${pagesYear.toLocaleString()}<\/strong>pages finished this year<\/span>` : ''}<\/div>
    ${all.length ? `<div class="store-tools">
      <input class="input search" id="bkQ" placeholder="Find a book by title, author, ISBN or course" value="${esc(S.books.q)}">
      <span class="muted" style="font-size:14px;margin-left:6px">Arrange by<\/span>
      ${[['status', 'Shelf'], ['category', 'Category'], ['course', 'Course']].map(a => `<button class="chip ${arrange === a[0] ? 'active' : ''}" data-act="book-arrange" data-by="${a[0]}">${a[1]}<\/button>`).join('')}
    <\/div>` : ''}<\/div>`;

  const windowDisplay = `<div class="window"><h3>In the window: books you\u2019re reading<\/h3>
    ${reading.length ? `<div class="display">${reading.map(b => `<button class="face" data-act="book-open" data-id="${b.id}">
        ${bookCover(b)}<div class="t">${esc(b.title)}<\/div>
        <div class="pbar"><i style="width:${bookPct(b)}%"><\/i><\/div><div class="pp">${b.pages ? (+b.currentPage || 0) + ' of ' + b.pages + ' pages' : 'Reading'}<\/div><\/button>`).join('')}<\/div>`
      : `<p class="empty-window">Nothing in the window yet. Drag a book onto the Reading now shelf to put it here.<\/p>`}
    <div class="stand"><\/div><\/div>`;

  const q2 = q && all.filter(b => bookMatches(b, q)).length;
  const caseHtml = `<div class="bookcase">
    ${q ? `<p class="sub" style="margin:0 0 12px">${q2 ? q2 + ' book' + (q2 === 1 ? '' : 's') + ' found, highlighted on the shelves' : 'No books match your search'}<\/p>` : ''}
    ${!all.length ? `<div class="shelf"><div class="shelf-head"><span class="plate">Your first shelf<\/span><\/div>
        <div class="row-books"><p class="shelf-empty">The shelves are empty. Add a book and it lands here, ready to be pulled out.<\/p><\/div><div class="plank"><\/div><\/div>` : ''}
    ${shelves.map(sh => `<div class="shelf"><div class="shelf-head"><span class="plate">${esc(sh.label)} <span>${sh.list.length}<\/span><\/span><\/div>
        <div class="row-books" ${sh.drop ? `data-drop="${esc(sh.drop)}"` : ''}>
          ${sh.list.length ? sh.list.slice().sort((a, b) => a.title.localeCompare(b.title)).map(b => spine(b, arrange === 'status')).join('') + '<span class="bookend"><\/span>'
            : `<p class="shelf-empty">${sh.drop === 'Reading' ? 'Drag a book here to start reading it.' : sh.drop === 'Finished' ? 'Books you finish end up here.' : 'Empty shelf.'}<\/p>`}
        <\/div><div class="plank"><\/div><\/div>`).join('')}
    <\/div>`;
  return sign + windowDisplay + caseHtml;
}

function wireBooks() {
  const tip = document.getElementById('bookTip') || Object.assign(document.body.appendChild(document.createElement('div')), { id: 'bookTip', className: 'tooltip-book hidden' });
  $$('.spine').forEach(sp => {
    sp.addEventListener('mouseenter', () => { tip.innerHTML = `<b>${sp.dataset.tip}<\/b>${sp.dataset.tip2 || ''}`; tip.classList.remove('hidden'); });
    sp.addEventListener('mousemove', e => { tip.style.left = Math.min(window.innerWidth - 270, e.clientX + 14) + 'px'; tip.style.top = (e.clientY + 16) + 'px'; });
    sp.addEventListener('mouseleave', () => tip.classList.add('hidden'));
    sp.addEventListener('dragstart', e => { tip.classList.add('hidden'); sp.classList.add('dragging'); e.dataTransfer.setData('text/plain', sp.dataset.id); e.dataTransfer.effectAllowed = 'move'; });
    sp.addEventListener('dragend', () => sp.classList.remove('dragging'));
  });
  $$('.row-books[data-drop]').forEach(row => {
    row.addEventListener('dragover', e => { e.preventDefault(); row.classList.add('drop'); });
    row.addEventListener('dragleave', e => { if (!row.contains(e.relatedTarget)) row.classList.remove('drop'); });
    row.addEventListener('drop', e => {
      e.preventDefault(); row.classList.remove('drop');
      const id = e.dataTransfer.getData('text/plain'), st = row.dataset.drop;
      const b = books().find(x => x.id === id);
      if (!b || b.status === st) return;
      b.status = st; render();
      act('setBookStatus', [id, st], '\u201C' + b.title + '\u201D moved to ' + (st === 'Reading' ? 'Reading now' : st)).catch(() => render());
    });
  });
}

function bookDialog(id, preset) {
  const b = id ? books().find(x => x.id === id) : Object.assign({ status: 'Want to read', rating: '' }, preset || {});
  const isNew = !id;
  const courses = ru().courses.slice().sort((a, c) => a.code.localeCompare(c.code));
  const d = openDialog(`
    <div class="dlg-head"><h3>${isNew ? 'Add a book' : esc(b.title)}<\/h3><button class="icon-btn" data-act="close" aria-label="Close">${I.x}<\/button><\/div>
    <div class="dlg-body">
      ${isNew ? `<div class="field"><span>Find the book<\/span>
        <div style="display:flex;gap:8px"><input class="input" id="bkFind" placeholder="Title, author or ISBN" value="${esc(S.books.lastQuery || '')}"><button class="btn" data-act="book-search">Search<\/button><\/div>
        <small>Search fills in the cover, author and page count. You can also skip this and type the details below.<\/small>
        <div id="bkResults"><\/div><\/div>` : ''}
      <div class="book-detail">
        <div class="book-side">${bookCover(b)}
          ${!isNew ? `<div class="link-row">
            <button class="btn primary" data-act="book-read" data-id="${b.id}">${I.play} Read now<\/button>
            ${b.link ? `<a class="btn" href="${esc(b.link)}" target="_blank" rel="noopener">${I.link} Open link<\/a>` : ''}<\/div>` : ''}
        <\/div>
        <div>
          <label class="field"><span>Title<\/span><input class="input" id="bkTitle" value="${esc(b.title || '')}"><\/label>
          <div class="row">
            <label class="field"><span>Author<\/span><input class="input" id="bkAuthor" value="${esc(b.author || '')}"><\/label>
            <label class="field"><span>Category<\/span><input class="input" id="bkCat" value="${esc(b.category || '')}" placeholder="e.g. Civil law, Novel" list="bkCats"><\/label>
          <\/div>
          <datalist id="bkCats">${[...new Set(books().map(x => x.category).filter(Boolean))].map(c => `<option value="${esc(c)}">`).join('')}<\/datalist>
          <div class="field"><span>Shelf<\/span><div class="seg">${BOOK_SHELVES.map(st => `<label><input type="radio" name="bkStatus" value="${st}" ${b.status === st ? 'checked' : ''}><span>${st === 'Reading' ? 'Reading now' : st}<\/span><\/label>`).join('')}<\/div><\/div>
          <div class="field"><span>Progress<\/span>
            <div class="prog-row"><input type="range" id="bkRange" min="0" max="${+b.pages || 100}" value="${+b.currentPage || 0}" aria-label="Pages read">
              <div class="prog-num"><input class="input" id="bkPage" type="number" min="0" value="${esc(b.currentPage || '')}" placeholder="0"> of <input class="input" id="bkPages" type="number" min="0" value="${esc(b.pages || '')}" placeholder="pages"><\/div><\/div>
            <small id="bkPct">${b.pages ? bookPct(b) + '% read' : 'Enter the page count to track progress.'}<\/small><\/div>
          <div class="field"><span>Your rating<\/span><div class="stars" id="bkStars" data-v="${+b.rating || 0}">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-star="${n}" class="${n <= (+b.rating || 0) ? 'on' : ''}" aria-label="${n} star${n > 1 ? 's' : ''}">\u2605<\/button>`).join('')}<\/div><\/div>
          <div class="row">
            <label class="field"><span>Course<\/span><select class="input" id="bkCourse"><option value="">Not for a course<\/option>${courses.map(c => `<option value="${esc(c.code)}" ${c.code === b.courseCode ? 'selected' : ''}>${esc(c.code + ' ' + c.name)}<\/option>`).join('')}<\/select><\/label>
            <label class="field"><span>Where it is<\/span><input class="input" id="bkLoc" value="${esc(b.location || '')}" placeholder="e.g. Desk shelf, Kindle"><\/label>
          <\/div>
          <div class="row">
            <label class="field"><span>ISBN<\/span><input class="input" id="bkIsbn" value="${esc(b.isbn || '')}"><\/label>
            <label class="field"><span>Link<\/span><input class="input" id="bkLink" value="${esc(b.link || '')}" placeholder="PDF in Drive, e-book, store page"><\/label>
          <\/div>
          <label class="field"><span>Cover image link<\/span><input class="input" id="bkCover" value="${esc(b.cover || '')}" placeholder="https://"><\/label>
          <label class="field"><span>Notes<\/span><textarea class="input" id="bkNotes" placeholder="Chapters to review, quotes, thoughts">${esc(b.notes || '')}<\/textarea><\/label>
        <\/div>
      <\/div>
    <\/div>
    <div class="dlg-foot">${!isNew ? `<button class="btn danger" data-act="book-delete" data-id="${b.id}">Remove from shelves<\/button>` : ''}
      <div class="right"><button class="btn" data-act="close">Cancel<\/button><button class="btn primary" id="bkSave">${isNew ? 'Put it on the shelf' : 'Save book'}<\/button><\/div><\/div>`);
  d.classList.add('book-dlg');
  d.addEventListener('close', () => d.classList.remove('book-dlg'), { once: true });
  const range = $('#bkRange', d), page = $('#bkPage', d), pages = $('#bkPages', d), pct = $('#bkPct', d);
  const sync = () => {
    const p = +pages.value || 0, c = Math.min(+page.value || 0, p || Infinity);
    range.max = p || 100; range.value = c;
    pct.textContent = p ? Math.round(c / p * 100) + '% read' : 'Enter the page count to track progress.';
  };
  range.oninput = () => { page.value = range.value; sync(); };
  page.oninput = sync; pages.oninput = sync;
  $('#bkStars', d).onclick = e => {
    const s = e.target.closest('[data-star]'); if (!s) return;
    const box = $('#bkStars', d); const v = +s.dataset.star === +box.dataset.v ? 0 : +s.dataset.star;
    box.dataset.v = v; $$('#bkStars button', d).forEach(x => x.classList.toggle('on', +x.dataset.star <= v));
  };
  const find = $('#bkFind', d);
  if (find) find.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); bookSearch(); } };
  $('#bkSave', d).onclick = async e => {
    const input = {
      id: isNew ? '' : b.id, title: $('#bkTitle', d).value, author: $('#bkAuthor', d).value, category: $('#bkCat', d).value,
      status: $('input[name=bkStatus]:checked', d).value, currentPage: page.value, pages: pages.value,
      rating: $('#bkStars', d).dataset.v, courseCode: $('#bkCourse', d).value, location: $('#bkLoc', d).value,
      isbn: $('#bkIsbn', d).value, link: $('#bkLink', d).value, cover: $('#bkCover', d).value, notes: $('#bkNotes', d).value
    };
    try { await act('saveBook', [input], isNew ? '\u201C' + input.title.trim() + '\u201D is on the shelf' : 'Book saved', e.currentTarget); closeDialog(); } catch (err) { }
  };
}

async function bookSearch() {
  const box = $('#bkResults'), q = $('#bkFind').value.trim();
  if (!q) { toast('Type a title, author or ISBN to search.', 'error'); return; }
  S.books.lastQuery = q;
  box.innerHTML = '<div class="loading" style="min-height:120px"><div><div class="spinner"><\/div><p>Searching the catalogue\u2026<\/p><\/div><\/div>';
  try {
    const res = await call('searchBooks', q);
    S.books.results = res;
    box.innerHTML = res.length ? `<div class="results">${res.map((r, i) => `<button class="result" data-act="book-pick" data-i="${i}">
        ${bookCover({ title: r.title, author: r.author, cover: r.cover, id: String(i) })}
        <div class="t">${esc(r.title)}<\/div><div class="a">${esc(r.author || 'Unknown author')}${r.year ? ', ' + esc(r.year) : ''}<\/div><\/button>`).join('')}<\/div>`
      : '<p class="muted">No books found. Try other words, or type the details below.<\/p>';
  } catch (e) { box.innerHTML = `<p class="muted">${esc(cleanErr(e))}<\/p>`; }
}

function bookPick(i) {
  const r = S.books.results[i]; if (!r) return;
  const d = $('#dlg');
  const set = (sel, v) => { const el = $(sel, d); if (el && v !== undefined && v !== null && v !== '') el.value = v; };
  set('#bkTitle', r.title); set('#bkAuthor', r.author); set('#bkPages', r.pages); set('#bkIsbn', r.isbn); set('#bkCover', r.cover); set('#bkCat', r.category);
  $('#bkPages', d).dispatchEvent(new Event('input'));
  const side = $('.book-side', d);
  side.innerHTML = bookCover({ title: r.title, author: r.author, cover: r.cover, id: 'pick' });
  $('#bkResults', d).innerHTML = `<p class="muted" style="margin:8px 0 0">Picked \u201C${esc(r.title)}\u201D. Check the details, then put it on the shelf.<\/p>`;
  $('#bkTitle', d).focus();
}

function bookReadNow(id) {
  const b = books().find(x => x.id === id); if (!b) return;
  closeDialog();
  if (T.running) { toast('The reading timer is already running. Stop it first to start this book.', 'error'); go('ru'); return; }
  T.label = b.title; T.courseCode = ru().courses.some(c => c.code === b.courseCode) ? b.courseCode : ''; saveTimer();
  if (b.status !== 'Reading') act('setBookStatus', [id, 'Reading']).catch(() => {});
  S.ru.tab = 'timer'; go('ru');
  timerStart();
  toast('Timer started for \u201C' + b.title + '\u201D');
}

/* ---------- Classroom files to Drive ---------- */
function filesPanel() {
  const st = S.data.settings, rows = S.data.classroomFiles || [];
  const on = st.filesAuto === 'true';
  const hours = String(st.filesEveryHours || '6');
  const copied = rows.filter(r => r.status === 'copied').length;
  const links = rows.filter(r => r.status === 'link').length;
  const failed = rows.filter(r => r.status === 'failed');
  const every = h => h === '24' ? 'day' : h === '1' ? 'hour' : h + ' hours';
  const shown = failed.concat(rows.filter(r => r.status !== 'failed')).slice(0, 30);
  const kindLabel = r => r.status === 'failed' ? 'Problem' : r.kind === 'file' ? 'File' : r.kind === 'video' ? 'Video' : r.kind === 'form' ? 'Form' : 'Link';
  return `<div class="panel files-panel" style="margin-top:16px">
    <div class="pl-head"><div><h3>Teacher files to Drive<\/h3>
      <p class="sub" style="margin:2px 0 0;max-width:70ch">Study Hub copies every file your teachers attach to materials, assignments and announcements into the matching subject\u2019s Drive folder, inside a folder called \u201CClassroom files - class name\u201D. Links, videos and forms are listed here instead.<\/p><\/div>
      <button class="btn primary" data-act="files-now">${I.sync} Copy new files now<\/button><\/div>
    <div class="files-set">
      <label class="check-line" style="margin:0"><input type="checkbox" id="flAuto" ${on ? 'checked' : ''}><span><b>Copy new files automatically<\/b><\/span><\/label>
      <label class="files-every">every <select class="input" id="flHours">${['1', '2', '4', '6', '12', '24'].map(h => `<option value="${h}" ${h === hours ? 'selected' : ''}>${every(h)}<\/option>`).join('')}<\/select><\/label>
      <button class="btn small" data-act="files-save">Save<\/button>
      <span class="status-line ${on ? 'on' : ''}" style="margin:0"><i><\/i>${on ? 'On, every ' + every(hours) : 'Off'}${st.filesLastRun ? '. Last checked ' + fmt(pd(st.filesLastRun)) : ''}<\/span>
    <\/div>
    ${st.filesLastError ? `<div class="files-err"><b>Some teacher posts could not be read on the last run:<\/b><ul>${st.filesLastError.split('\n').map(x => `<li>${esc(x)}<\/li>`).join('')}<\/ul><\/div>` : ''}
    ${(S.pdfUnmatched || []).length ? `<div class="files-err warn"><b>These classes are not matched to a subject, so their files are not copied:<\/b> ${S.pdfUnmatched.map(esc).join(', ')}. Use Match a classroom above.<\/div>` : ''}
    <div class="files-stats"><span><strong>${copied}<\/strong> file${copied === 1 ? '' : 's'} copied<\/span><span><strong>${links}<\/strong> link${links === 1 ? '' : 's'}, videos and forms<\/span>
      ${failed.length ? `<span class="bad"><strong>${failed.length}<\/strong> couldn\u2019t be copied<\/span>` : ''}<\/div>
    ${shown.length ? `<ul class="cf-list">${shown.map(r => `<li class="${r.status}">
        <span class="cf-kind">${kindLabel(r)}<\/span>
        <div style="min-width:0"><a class="cf-t" href="${esc(r.copyUrl)}" target="_blank" rel="noopener" title="${esc(r.title)}">${esc(r.title)}<\/a>
          <div class="cf-s">${esc(r.courseName)}, ${esc(r.source.toLowerCase())}: ${esc(r.postTitle)}<\/div>
          ${r.status === 'failed' ? `<div class="cf-err">${esc(r.note || 'Copy failed')}. The teacher may have blocked copying; the link opens the original. Study Hub tries again on the next run.<\/div>` : ''}<\/div>
        <span class="cf-when">${r.copiedAt ? pd(r.copiedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''}<\/span><\/li>`).join('')}<\/ul>`
      : '<p class="muted" style="margin:6px 0 0">Nothing copied yet. Press Copy new files now to fetch everything your teachers have shared so far.<\/p>'}
  <\/div>`;
}

/* ================= PDF tools: merge, split, watermark ================= */
S.pdf = { tool: 'merge', files: { merge: [], split: [], watermark: [] }, results: [], busy: false, splitMode: 'each', wm: null, wmImage: null, dest: '' };
let fileSeq = 0;
const PDFLIB_URLS = ['https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js'];
let pdfLibPromise = null;
function loadPdfLib() {
  if (window.PDFLib) return Promise.resolve(window.PDFLib);
  if (pdfLibPromise) return pdfLibPromise;
  pdfLibPromise = new Promise((resolve, reject) => {
    const tryAt = i => {
      if (i >= PDFLIB_URLS.length) { pdfLibPromise = null; reject(new Error('The PDF engine could not load. Check your internet connection and try again.')); return; }
      const sc = document.createElement('script'); sc.src = PDFLIB_URLS[i];
      sc.onload = () => window.PDFLib ? resolve(window.PDFLib) : tryAt(i + 1);
      sc.onerror = () => tryAt(i + 1);
      document.head.appendChild(sc);
    };
    tryAt(0);
  });
  return pdfLibPromise;
}

function fmtSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
function b64ToBytes(b64) { const bin = atob(b64); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
function bytesToB64(bytes) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error('Could not prepare the file.'));
    r.readAsDataURL(new Blob([bytes]));
  });
}
function baseName(n) { return String(n || 'document').replace(/\.[^.]+$/, ''); }
function kindOf(mime, name) { return /pdf/.test(mime) || /\.pdf$/i.test(name) ? 'pdf' : /png/.test(mime) || /\.png$/i.test(name) ? 'png' : /jpe?g/.test(mime) || /\.jpe?g$/i.test(name) ? 'jpg' : ''; }

/** "1-3, 5, 8-" -> [[0,1,2],[4],[7,8,...]] (0-based), checked against the page count. */
function parseRanges(text, total) {
  const groups = [];
  String(text || '').split(/[,;]+/).map(x => x.trim()).filter(Boolean).forEach(part => {
    const m = part.match(/^(\d*)\s*(?:-\s*(\d*))?$/);
    if (!m || (!m[1] && !m[2])) throw new Error('\u201C' + part + '\u201D is not a page range. Use forms like 1-3, 5, 8-.');
    const a = m[1] ? +m[1] : 1;
    const b = part.indexOf('-') > -1 ? (m[2] ? +m[2] : total) : a;
    if (a < 1 || b > total || a > b) throw new Error('Pages ' + part + ' don\u2019t fit a ' + total + '-page file.');
    const g = []; for (let i = a; i <= b; i++) g.push(i - 1); groups.push(g);
  });
  return groups;
}

async function addPdfFile(tool, name, mime, bytes) {
  const kind = kindOf(mime, name);
  if (!kind) { toast(name + ' is not a PDF, PNG or JPG file.', 'error'); return; }
  if (tool !== 'merge' && kind !== 'pdf') { toast('Use a PDF here. Images can be turned into a PDF with Merge.', 'error'); return; }
  if (bytes.length > 20 * 1024 * 1024) { toast(name + ' is larger than 20 MB.', 'error'); return; }
  let pages = 1;
  if (kind === 'pdf') {
    try {
      const L = await loadPdfLib();
      const doc = await L.PDFDocument.load(bytes, { ignoreEncryption: true });
      pages = doc.getPageCount();
      if (doc.isEncrypted) toast(name + ' is password-protected. The result may not open correctly.', 'error');
    } catch (e) { toast(name + ' could not be read as a PDF: ' + cleanErr(e), 'error'); return; }
  }
  const item = { id: 'f' + (++fileSeq), name, kind, bytes, pages, range: '' };
  if (tool === 'split') S.pdf.files.split = [item]; else S.pdf.files[tool].push(item);
  if (tool === 'split') S.pdf.picked = {};
  S.pdf.results = [];
  render();
}

/** Reads files one after another so they keep the order you picked them in. */
async function addLocalFiles(fileList) {
  const tool = S.pdf.tool;
  for (const f of [...fileList]) {
    const bytes = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(new Uint8Array(r.result));
      r.onerror = () => reject(new Error('Could not read ' + f.name));
      r.readAsArrayBuffer(f);
    }).catch(e => { toast(cleanErr(e), 'error'); return null; });
    if (bytes) await addPdfFile(tool, f.name, f.type, bytes);
  }
}

async function driveFilePicker() {
  const d = openDialog(`<div class="dlg-head"><h3>Choose from Drive<\/h3><button class="icon-btn" data-act="close" aria-label="Close">${I.x}<\/button><\/div>
    <div class="dlg-body"><div class="loading" style="min-height:140px"><div><div class="spinner"><\/div><p>Looking through your subject folders\u2026<\/p><\/div><\/div><\/div>`);
  let list;
  try { list = await call('listToolFiles'); } catch (e) { $('.dlg-body', d).innerHTML = `<p>${esc(cleanErr(e))}<\/p>`; return; }
  const tool = S.pdf.tool;
  const usable = list.filter(f => tool === 'merge' || f.mimeType === 'application/pdf');
  $('.dlg-body', d).innerHTML = usable.length ? `
    <input class="input" id="dpQ" placeholder="Search files" style="margin-bottom:10px">
    <ul class="drive-pick">${usable.map(f => `<li data-name="${esc((f.name + ' ' + f.place).toLowerCase())}">
      <button class="dp-item" data-act="pdf-drive-pick" data-id="${esc(f.id)}" data-name="${esc(f.name)}" data-mime="${esc(f.mimeType)}">
        <span class="dp-kind">${f.mimeType === 'application/pdf' ? 'PDF' : 'Image'}<\/span>
        <span style="min-width:0"><b>${esc(f.name)}<\/b><small>${esc(f.place)}, ${fmtSize(f.size)}<\/small><\/span><\/button><\/li>`).join('')}<\/ul>`
    : '<p class="muted">No PDF files found in your subject folders yet. Teacher files copied from Classroom show up here too.<\/p>';
  const q = $('#dpQ', d);
  if (q) q.oninput = () => $$('.drive-pick li', d).forEach(li => li.classList.toggle('hidden', !li.dataset.name.includes(q.value.toLowerCase())));
}

async function pickDriveFile(el) {
  el.disabled = true; el.querySelector('small').textContent = 'Loading\u2026';
  try {
    const f = await call('getToolFile', el.dataset.id);
    closeDialog();
    await addPdfFile(S.pdf.tool, f.name, f.mimeType, b64ToBytes(f.data));
  } catch (e) { toast(cleanErr(e), 'error'); el.disabled = false; }
}

/* ---------- Watermark image (drawn on a canvas, so Thai text works) ---------- */
function wmSettings() {
  const w = S.pdf.wm || (S.pdf.wm = { text: 'CONFIDENTIAL', color: '#C8102E', opacity: 25, angle: 45, size: 60, layout: 'center', pages: '', useImage: false });
  return w;
}
function watermarkCanvas(w) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const rad = w.angle * Math.PI / 180;
  if (w.useImage && S.pdf.wmImage) {
    const img = S.pdf.wmImage, iw = img.naturalWidth, ih = img.naturalHeight;
    const bw = Math.abs(iw * Math.cos(rad)) + Math.abs(ih * Math.sin(rad)), bh = Math.abs(iw * Math.sin(rad)) + Math.abs(ih * Math.cos(rad));
    c.width = Math.ceil(bw); c.height = Math.ceil(bh);
    g.translate(c.width / 2, c.height / 2); g.rotate(-rad); g.drawImage(img, -iw / 2, -ih / 2);
    return c;
  }
  const px = 140, font = `800 ${px}px "Bricolage Grotesque", "Noto Sans Thai", "Leelawadee UI", Tahoma, sans-serif`;
  g.font = font;
  const lines = String(w.text || ' ').split('\n');
  const tw = Math.max(...lines.map(l => g.measureText(l).width)) + 20, th = px * 1.25 * lines.length;
  const bw = Math.abs(tw * Math.cos(rad)) + Math.abs(th * Math.sin(rad)), bh = Math.abs(tw * Math.sin(rad)) + Math.abs(th * Math.cos(rad));
  c.width = Math.ceil(bw); c.height = Math.ceil(bh);
  g.translate(c.width / 2, c.height / 2); g.rotate(-rad);
  g.font = font; g.fillStyle = w.color; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((l, i) => g.fillText(l, 0, (i - (lines.length - 1) / 2) * px * 1.25));
  return c;
}
/** Where watermark copies go on a page of size W x H. Returns [{x,y,w,h}] in page units (origin bottom-left). */
function wmPlacements(w, W, H, cw, ch) {
  const ratio = ch / cw;
  if (w.layout === 'tile') {
    const tw = Math.min(W, H) * (w.size / 100) * 0.5, thh = tw * ratio, out = [];
    for (let y = -thh / 2; y < H; y += thh * 1.6) for (let x = (Math.round(y / thh) % 2 ? tw * 0.4 : -tw * 0.3); x < W; x += tw * 1.5) out.push({ x, y, w: tw, h: thh });
    return out;
  }
  let ww = Math.min(W, H) * (w.size / 100) * 1.25, hh = ww * ratio;
  if (hh > H * 0.9) { hh = H * 0.9; ww = hh / ratio; }
  if (w.layout === 'bottom') return [{ x: (W - ww * 0.5) / 2, y: H * 0.04, w: ww * 0.5, h: hh * 0.5 }];
  return [{ x: (W - ww) / 2, y: (H - hh) / 2, w: ww, h: hh }];
}
function drawWmPreview() {
  const cv = $('#wmPreview'); if (!cv) return;
  const w = wmSettings(), g = cv.getContext('2d'), W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#d9dde6'; for (let y = 34; y < H - 30; y += 14) g.fillRect(26, y, (y / 14) % 5 === 0 ? W * 0.5 : W - 52, 5);
  g.fillStyle = '#9aa3b5'; g.fillRect(26, 14, W * 0.45, 10);
  const c = watermarkCanvas(w);
  g.globalAlpha = w.opacity / 100;
  wmPlacements(w, W, H, c.width, c.height).forEach(p => g.drawImage(c, p.x, H - p.y - p.h, p.w, p.h));
  g.globalAlpha = 1;
}

/* ---------- Running the tools ---------- */
async function runPdfTool(btn) {
  const tool = S.pdf.tool, files = S.pdf.files[tool];
  if (!files.length) { toast('Add a file first.', 'error'); return; }
  const label = btn.innerHTML; btn.disabled = true; btn.textContent = 'Working\u2026';
  try {
    const L = await loadPdfLib();
    const results = [];
    if (tool === 'merge') {
      const out = await L.PDFDocument.create();
      for (const f of files) {
        if (f.kind === 'pdf') {
          const src = await L.PDFDocument.load(f.bytes, { ignoreEncryption: true });
          const idx = f.range.trim() ? [].concat(...parseRanges(f.range, src.getPageCount())) : src.getPageIndices();
          (await out.copyPages(src, idx)).forEach(p => out.addPage(p));
        } else {
          const img = f.kind === 'png' ? await out.embedPng(f.bytes) : await out.embedJpg(f.bytes);
          const land = img.width > img.height, A = [595.28, 841.89], pw = land ? A[1] : A[0], ph = land ? A[0] : A[1];
          const s = Math.min((pw - 36) / img.width, (ph - 36) / img.height);
          const page = out.addPage([pw, ph]);
          page.drawImage(img, { x: (pw - img.width * s) / 2, y: (ph - img.height * s) / 2, width: img.width * s, height: img.height * s });
        }
      }
      const name = ($('#mgName') && $('#mgName').value.trim()) || 'Merged';
      results.push({ name: baseName(name) + '.pdf', bytes: await out.save(), pages: out.getPageCount() });
    } else if (tool === 'split') {
      const f = files[0];
      const src = await L.PDFDocument.load(f.bytes, { ignoreEncryption: true });
      const n = src.getPageCount();
      let groups;
      if (S.pdf.splitMode === 'each') groups = src.getPageIndices().map(i => [i]);
      else if (S.pdf.splitMode === 'every') {
        const k = Math.max(1, parseInt($('#spEvery').value, 10) || 1); groups = [];
        for (let i = 0; i < n; i += k) groups.push(src.getPageIndices().slice(i, i + k));
      } else if (S.pdf.splitMode === 'ranges') {
        if (!$('#spRanges').value.trim()) throw new Error('Type the page ranges, for example 1-3, 4-10.');
        groups = parseRanges($('#spRanges').value, n);
      } else {
        const picked = Object.keys(S.pdf.picked || {}).map(Number).sort((a, b) => a - b);
        if (!picked.length) throw new Error('Click the pages you want to keep.');
        groups = [picked];
      }
      for (const g of groups) {
        const d = await L.PDFDocument.create();
        (await d.copyPages(src, g)).forEach(p => d.addPage(p));
        const label2 = g.length === 1 ? 'page ' + (g[0] + 1) : 'pages ' + (g[0] + 1) + '-' + (g[g.length - 1] + 1);
        results.push({ name: baseName(f.name) + (S.pdf.splitMode === 'pick' ? ' (selected pages)' : ' (' + label2 + ')') + '.pdf', bytes: await d.save(), pages: g.length });
      }
    } else {
      const w = wmSettings();
      if (!w.useImage && !String(w.text).trim()) throw new Error('Type the watermark text.');
      if (w.useImage && !S.pdf.wmImage) throw new Error('Choose a watermark image.');
      const c = watermarkCanvas(w);
      const pngBytes = b64ToBytes(c.toDataURL('image/png').split(',')[1]);
      for (const f of files) {
        const doc = await L.PDFDocument.load(f.bytes, { ignoreEncryption: true });
        const png = await doc.embedPng(pngBytes);
        const pages = doc.getPages();
        const idx = w.pages.trim() ? [].concat(...parseRanges(w.pages, pages.length)) : pages.map((_, i) => i);
        idx.forEach(i => {
          const page = pages[i], sz = page.getSize();
          wmPlacements(w, sz.width, sz.height, c.width, c.height).forEach(p => page.drawImage(png, { x: p.x, y: p.y, width: p.w, height: p.h, opacity: w.opacity / 100 }));
        });
        results.push({ name: baseName(f.name) + ' (watermarked).pdf', bytes: await doc.save(), pages: pages.length });
      }
    }
    S.pdf.results = results.map((r, i) => Object.assign(r, { id: 'r' + i, saved: null }));
    render();
    toast(results.length === 1 ? 'Done: ' + results[0].name : 'Done: ' + results.length + ' files ready');
  } catch (e) {
    toast(cleanErr(e), 'error');
  } finally {
    if (btn.isConnected) { btn.disabled = false; btn.innerHTML = label; }
  }
}

function downloadBytes(name, bytes) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 3000);
}

async function saveResults(ids, btn) {
  const dest = ($('#pdfDest') || {}).value || '';
  const list = S.pdf.results.filter(r => ids.indexOf(r.id) > -1 && !r.saved);
  if (!list.length) return;
  const label = btn.innerHTML; btn.disabled = true;
  const sub = S.pdf.tool === 'split' && list.length > 1 ? baseName((S.pdf.files.split[0] || {}).name) + ' (split)' : '';
  try {
    for (let i = 0; i < list.length; i++) {
      btn.textContent = list.length > 1 ? 'Saving ' + (i + 1) + ' of ' + list.length + '\u2026' : 'Saving\u2026';
      const r = list[i];
      r.saved = await call('saveToolFile', { name: r.name, mimeType: 'application/pdf', data: await bytesToB64(r.bytes), subjectId: dest, subfolder: sub });
    }
    toast(list.length === 1 ? 'Saved to Drive' : 'Saved ' + list.length + ' files to Drive');
    render();
  } catch (e) { toast(cleanErr(e), 'error'); if (btn.isConnected) { btn.disabled = false; btn.innerHTML = label; } }
}

/* ---------- Page ---------- */
function viewPdf() {
  const t = S.pdf.tool, files = S.pdf.files[t];
  const tabs = [['merge', 'Merge', 'Join PDFs and images into one PDF'], ['split', 'Split', 'Cut one PDF into several files'], ['watermark', 'Watermark', 'Stamp text or a logo on every page']];
  const drop = `<label class="drop pdf-drop" id="pdfDrop"><input type="file" id="pdfFiles" ${t === 'split' ? '' : 'multiple'} accept="${t === 'merge' ? '.pdf,.png,.jpg,.jpeg' : '.pdf'}">
      <strong>${t === 'split' ? (files.length ? 'Choose another PDF' : 'Choose a PDF') : 'Add files'}<\/strong><br><span class="muted">Drop ${t === 'merge' ? 'PDFs or images' : t === 'split' ? 'a PDF' : 'PDFs'} here or click to choose from your computer<\/span><\/label>
    <button class="btn" data-act="pdf-drive" style="margin-top:8px">${I.folder} Choose from Drive<\/button>`;

  let body = '';
  if (t === 'merge') {
    const pages = files.reduce((n, f) => n + (f.kind === 'pdf' && !f.range.trim() ? f.pages : f.kind === 'pdf' ? 0 : 1), 0);
    body = `${files.length ? `<ol class="pdf-files">${files.map((f, i) => `<li draggable="true" data-fid="${f.id}">
        <span class="pf-kind ${f.kind}">${f.kind.toUpperCase()}<\/span>
        <div style="min-width:0"><b title="${esc(f.name)}">${esc(f.name)}<\/b><small>${f.kind === 'pdf' ? f.pages + ' page' + (f.pages === 1 ? '' : 's') : 'Image, becomes one page'}, ${fmtSize(f.bytes.length)}<\/small><\/div>
        ${f.kind === 'pdf' ? `<input class="input pf-range" data-fid="${f.id}" placeholder="All pages" value="${esc(f.range)}" title="Pages to include, for example 1-3, 5" aria-label="Pages of ${esc(f.name)}">` : '<span><\/span>'}
        <button class="icon-btn" data-act="pdf-up" data-fid="${f.id}" ${i ? '' : 'disabled'} aria-label="Move up">${I.up}<\/button>
        <button class="icon-btn" data-act="pdf-down" data-fid="${f.id}" ${i < files.length - 1 ? '' : 'disabled'} aria-label="Move down">${I.down}<\/button>
        <button class="icon-btn" data-act="pdf-remove" data-fid="${f.id}" aria-label="Remove">${I.x}<\/button><\/li>`).join('')}<\/ol>
      <p class="sub" style="margin:8px 0 0">Drag to reorder. Leave the page box empty for all pages, or type ranges like 1-3, 5.<\/p>` : ''}
      <div class="pdf-run"><label class="field" style="margin:0;flex:1;min-width:200px"><span>Name of the merged file<\/span><input class="input" id="mgName" value="${esc(files.length ? baseName(files[0].name) + ' (merged)' : 'Merged')}"><\/label>
        <button class="btn primary big" data-act="pdf-run" ${files.length > 0 ? '' : 'disabled'}>Merge ${files.length} file${files.length === 1 ? '' : 's'}${files.length ? '' : ''}<\/button><\/div>`;
  } else if (t === 'split') {
    const f = files[0];
    const m = S.pdf.splitMode;
    body = f ? `<div class="pdf-one"><span class="pf-kind pdf">PDF<\/span><div><b>${esc(f.name)}<\/b><small>${f.pages} pages, ${fmtSize(f.bytes.length)}<\/small><\/div><\/div>
      <div class="field"><span>How to split<\/span><div class="seg">${[['each', 'Every page'], ['every', 'Every N pages'], ['ranges', 'By page ranges'], ['pick', 'Pick pages']].map(o => `<label><input type="radio" name="spMode" data-act="pdf-split-mode" data-mode="${o[0]}" ${m === o[0] ? 'checked' : ''}><span>${o[1]}<\/span><\/label>`).join('')}<\/div><\/div>
      ${m === 'each' ? `<p class="sub">Makes ${f.pages} separate one-page files.<\/p>` : ''}
      ${m === 'every' ? `<label class="field"><span>Pages per file<\/span><input class="input" id="spEvery" type="number" min="1" max="${f.pages}" value="${Math.min(10, f.pages)}" style="max-width:140px"><\/label>` : ''}
      ${m === 'ranges' ? `<label class="field"><span>Page ranges<\/span><input class="input" id="spRanges" placeholder="e.g. 1-3, 4-10, 11-" style="max-width:360px"><small>Each range becomes its own file. 11- means page 11 to the end.<\/small><\/label>` : ''}
      ${m === 'pick' ? `<div class="field"><span>Click the pages to keep in one new file<\/span><div class="page-grid">${Array.from({ length: f.pages }, (_, i) => `<button class="pg ${(S.pdf.picked || {})[i] ? 'on' : ''}" data-act="pdf-pick" data-i="${i}">${i + 1}<\/button>`).join('')}<\/div>
        <div class="link-row" style="margin-top:6px"><button class="btn small" data-act="pdf-pick-all">All<\/button><button class="btn small" data-act="pdf-pick-none">None<\/button><button class="btn small" data-act="pdf-pick-odd">Odd<\/button><button class="btn small" data-act="pdf-pick-even">Even<\/button><\/div><\/div>` : ''}
      <div class="pdf-run"><button class="btn primary big" data-act="pdf-run">Split ${esc(f.name.length > 30 ? 'PDF' : f.name)}<\/button><\/div>` : '';
  } else {
    const w = wmSettings();
    body = `${files.length ? `<ol class="pdf-files">${files.map(f => `<li data-fid="${f.id}"><span class="pf-kind pdf">PDF<\/span><div style="min-width:0"><b>${esc(f.name)}<\/b><small>${f.pages} pages, ${fmtSize(f.bytes.length)}<\/small><\/div><span><\/span><span><\/span><span><\/span>
        <button class="icon-btn" data-act="pdf-remove" data-fid="${f.id}" aria-label="Remove">${I.x}<\/button><\/li>`).join('')}<\/ol>` : ''}
      <div class="wm-grid"><div>
        <div class="field"><span>Watermark<\/span><div class="seg"><label><input type="radio" name="wmKind" data-act="wm-kind" data-v="text" ${w.useImage ? '' : 'checked'}><span>Text<\/span><\/label><label><input type="radio" name="wmKind" data-act="wm-kind" data-v="image" ${w.useImage ? 'checked' : ''}><span>Image or logo<\/span><\/label><\/div><\/div>
        ${w.useImage ? `<label class="field"><span>Image<\/span><input class="input" type="file" id="wmImg" accept=".png,.jpg,.jpeg"><small>${S.pdf.wmImage ? 'Image loaded. A PNG with a transparent background looks best.' : 'A PNG with a transparent background looks best.'}<\/small><\/label>`
          : `<label class="field"><span>Text<\/span><textarea class="input wm-in" id="wmText" data-k="text" rows="2">${esc(w.text)}<\/textarea><small>Thai text works too. Press Enter for a second line.<\/small><\/label>`}
        <div class="row">
          ${w.useImage ? '<span><\/span>' : `<label class="field"><span>Colour<\/span><div class="color-code"><input type="color" class="wm-in" data-k="color" value="${esc(w.color)}"><span class="muted">${esc(w.color)}<\/span><\/div><\/label>`}
          <label class="field"><span>Position<\/span><select class="input wm-in" data-k="layout">${[['center', 'Middle'], ['tile', 'Repeated'], ['bottom', 'Bottom, small']].map(o => `<option value="${o[0]}" ${w.layout === o[0] ? 'selected' : ''}>${o[1]}<\/option>`).join('')}<\/select><\/label>
        <\/div>
        <label class="field"><span>Opacity <b id="wmOpV">${w.opacity}%<\/b><\/span><input type="range" class="wm-in" data-k="opacity" min="5" max="100" value="${w.opacity}"><\/label>
        <label class="field"><span>Size <b id="wmSzV">${w.size}%<\/b><\/span><input type="range" class="wm-in" data-k="size" min="15" max="100" value="${w.size}"><\/label>
        <label class="field"><span>Angle <b id="wmAnV">${w.angle}\u00B0<\/b><\/span><input type="range" class="wm-in" data-k="angle" min="-90" max="90" step="5" value="${w.angle}"><\/label>
        <label class="field"><span>Pages<\/span><input class="input wm-in" data-k="pages" placeholder="All pages" value="${esc(w.pages)}"><small>Leave empty for every page, or type ranges like 1, 3-5.<\/small><\/label>
      <\/div>
      <div class="wm-prev"><span class="muted" style="font-size:13px">Preview<\/span><canvas id="wmPreview" width="300" height="424"><\/canvas><\/div><\/div>
      <div class="pdf-run"><button class="btn primary big" data-act="pdf-run" ${files.length ? '' : 'disabled'}>Watermark ${files.length} file${files.length === 1 ? '' : 's'}<\/button><\/div>`;
  }

  const subjects = S.data.subjects;
  const res = S.pdf.results;
  const results = res.length ? `<div class="panel pdf-results"><div class="pl-head"><div><h3>Ready<\/h3><p class="sub" style="margin:2px 0 0">${res.length} file${res.length === 1 ? '' : 's'}, made in your browser. Save them to Drive or download them.<\/p><\/div>
      <div class="head-actions"><select class="input" id="pdfDest" style="width:auto">${'<option value="">Study Hub / PDF tools<\/option>' + subjects.map(s => `<option value="${s.id}" ${S.pdf.dest === s.id ? 'selected' : ''}>${esc(s.name)} / PDF tools<\/option>`).join('')}<\/select>
      ${res.length > 1 ? `<button class="btn primary" data-act="pdf-save-all">${I.folder} Save all to Drive<\/button>` : ''}<\/div><\/div>
    <ul class="pdf-out">${res.map(r => `<li><span class="pf-kind pdf">PDF<\/span><div style="min-width:0"><b title="${esc(r.name)}">${esc(r.name)}<\/b><small>${r.pages} page${r.pages === 1 ? '' : 's'}, ${fmtSize(r.bytes.length)}<\/small><\/div>
      ${r.saved ? `<a class="btn small" href="${esc(r.saved.url)}" target="_blank" rel="noopener">${I.check} Open in Drive<\/a>` : `<button class="btn small primary" data-act="pdf-save" data-rid="${r.id}">${I.folder} Save to Drive<\/button>`}
      <button class="btn small" data-act="pdf-download" data-rid="${r.id}">Download<\/button><\/li>`).join('')}<\/ul><\/div>` : '';

  return `<div class="page-head"><div><h2>PDF tools<\/h2><p>Merge, split and watermark PDFs. Your files are processed right here in the browser, then saved to Drive when you choose.<\/p><\/div><\/div>
    <div class="tool-tabs">${tabs.map(x => `<button class="tool-tab ${t === x[0] ? 'active' : ''}" data-act="pdf-tool" data-tool="${x[0]}"><b>${x[1]}<\/b><span>${x[2]}<\/span><\/button>`).join('')}<\/div>
    <div class="grid-2 pdf-grid"><section class="panel">${body || '<p class="muted" style="margin:0">Add a file to start.<\/p>'}<\/section><aside class="panel">${drop}<\/aside><\/div>
    ${results}`;
}

function wirePdf() {
  const drop = $('#pdfDrop'), input = $('#pdfFiles');
  if (input) input.onchange = () => { addLocalFiles(input.files); input.value = ''; };
  if (drop) {
    drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); addLocalFiles(e.dataTransfer.files); };
  }
  $$('.pf-range').forEach(inp => inp.oninput = () => { const f = S.pdf.files.merge.find(x => x.id === inp.dataset.fid); if (f) f.range = inp.value; });
  $$('.pdf-files li[draggable]').forEach(li => {
    li.ondragstart = e => { e.dataTransfer.setData('text/plain', 'pf:' + li.dataset.fid); li.classList.add('dragging'); };
    li.ondragend = () => li.classList.remove('dragging');
    li.ondragover = e => e.preventDefault();
    li.ondrop = e => {
      e.preventDefault();
      const v = e.dataTransfer.getData('text/plain'); if (v.indexOf('pf:') !== 0) return;
      const list = S.pdf.files.merge, from = list.findIndex(f => f.id === v.slice(3)), to = list.findIndex(f => f.id === li.dataset.fid);
      if (from < 0 || to < 0 || from === to) return;
      list.splice(to, 0, list.splice(from, 1)[0]); render();
    };
  });
  const dest = $('#pdfDest'); if (dest) dest.onchange = () => { S.pdf.dest = dest.value; };
  $$('.wm-in').forEach(inp => {
    const upd = () => {
      const w = wmSettings(), k = inp.dataset.k;
      w[k] = ['opacity', 'size', 'angle'].indexOf(k) > -1 ? +inp.value : inp.value;
      const lab = { opacity: ['#wmOpV', '%'], size: ['#wmSzV', '%'], angle: ['#wmAnV', '\u00b0'] }[k];
      if (lab) $(lab[0]).textContent = inp.value + lab[1];
      if (k === 'color') inp.nextElementSibling.textContent = inp.value.toUpperCase();
      drawWmPreview();
    };
    inp.oninput = upd; inp.onchange = upd;
  });
  const img = $('#wmImg');
  if (img) img.onchange = () => {
    const f = img.files[0]; if (!f) return;
    const im = new Image(); im.onload = () => { S.pdf.wmImage = im; render(); }; im.onerror = () => toast('That image could not be read.', 'error');
    im.src = URL.createObjectURL(f);
  };
  drawWmPreview();
  if (S.pdf.tool) loadPdfLib().catch(() => {});
}

/* ================= Dialogs ================= */
function subjectDialog(id) {
  const s = id ? subj(id) : null;
  const color = s ? s.color : COLORS[S.data.subjects.length % COLORS.length];
  const d = openDialog(`
    <div class="dlg-head"><h3>${s ? 'Edit subject' : 'New subject'}<\/h3><button class="icon-btn" data-act="close" aria-label="Close">${I.x}<\/button><\/div>
    <div class="dlg-body">
      <div class="field"><span>Name<\/span><input class="input" id="sbName" value="${esc(s ? s.name : '')}" placeholder="e.g. Biology"><\/div>
      <div class="field"><span>Colour code<\/span>
        <div class="color-code">
          <input type="color" id="sbPicker" value="${esc(color.toLowerCase())}" aria-label="Pick a colour">
          <input class="input" id="sbColor" value="${esc(color.toUpperCase())}" maxlength="7" placeholder="#2B50D6" aria-label="Hex colour code" spellcheck="false">
          <span class="color-preview" id="sbPreview" style="--c:${esc(color)}">${esc(s ? s.name : 'Subject tab')}<\/span>
        <\/div>
        <small id="sbColorHint">Type a hex code like #2B50D6, or click the square to pick one.<\/small><\/div>
      <div class="field"><span>Google Drive folder<\/span>
        <div class="seg">
          ${s ? '<label><input type="radio" name="sbFolder" value="keep" checked><span>Keep current folder<\/span><\/label>' : ''}
          <label><input type="radio" name="sbFolder" value="new" ${s ? '' : 'checked'}><span>Create a new folder<\/span><\/label>
          <label><input type="radio" name="sbFolder" value="existing"><span>Use a folder I already have<\/span><\/label>
        <\/div>
        <input class="input hidden" id="sbFolderInput" placeholder="Paste the Drive folder link" style="margin-top:8px">
        <small id="sbFolderHint">${s ? 'Currently: <a href="' + esc(s.folderUrl) + '" target="_blank" rel="noopener">open folder<\/a>' : 'A folder with this subject\u2019s name is created inside your Study Hub folder.'}<\/small>
      <\/div>
    <\/div>
    <div class="dlg-foot">
      ${s ? `<button class="btn danger" data-act="subject-delete" data-id="${s.id}">Delete subject<\/button>` : ''}
      <div class="right"><button class="btn" data-act="close">Cancel<\/button><button class="btn primary" id="sbSave">${s ? 'Save subject' : 'Add subject'}<\/button><\/div>
    <\/div>`);
  const picker = $('#sbPicker', d), code = $('#sbColor', d), preview = $('#sbPreview', d);
  picker.oninput = () => { code.value = picker.value.toUpperCase(); code.classList.remove('bad'); preview.style.setProperty('--c', picker.value); };
  code.oninput = () => {
    const hex = normHex(code.value);
    code.classList.toggle('bad', !hex && code.value.trim().length > 0);
    if (hex) { picker.value = hex.toLowerCase(); preview.style.setProperty('--c', hex); }
  };
  code.onblur = () => { const hex = normHex(code.value); if (hex) code.value = hex; };
  $('#sbName', d).oninput = e => { preview.textContent = e.target.value || 'Subject tab'; };
  $$('input[name=sbFolder]', d).forEach(r => r.onchange = () => $('#sbFolderInput', d).classList.toggle('hidden', r.value !== 'existing' || !r.checked));
  $('#sbSave', d).onclick = async e => {
    const mode = $('input[name=sbFolder]:checked', d).value;
    const hex = normHex(code.value);
    if (!hex) { code.classList.add('bad'); code.focus(); toast('Enter a colour code like #2B50D6.', 'error'); return; }
    const input = { name: $('#sbName', d).value, color: hex, folderMode: mode === 'keep' ? '' : mode, folderInput: $('#sbFolderInput', d).value };
    try {
      if (s) await act('updateSubject', [s.id, input], 'Subject saved', e.currentTarget);
      else {
        const res = await act('addSubject', [input], 'Subject added with its Drive folder', e.currentTarget);
        const added = res.subjects.find(x => x.name.toLowerCase() === input.name.trim().toLowerCase());
        closeDialog(); if (added) go('subject', added.id); return;
      }
      closeDialog();
    } catch (err) { /* toast already shown */ }
  };
}

function taskDialog(id, preset) {
  preset = preset || {};
  const t = id ? S.data.tasks.find(x => x.id === id) : null;
  const v = t || { type: preset.type || 'Homework', subjectId: preset.subjectId || S.subjectId || (S.data.subjects[0] || {}).id, status: 'To do', priority: 'Normal', milestones: [] };
  const fromClass = t && t.source === 'classroom';
  const miniRow = m => `<div class="mini-edit" data-mid="${esc(m.id || '')}" data-done="${m.done ? 1 : 0}">
      <input class="input mt" placeholder="e.g. Finish outline" value="${esc(m.title || '')}">
      <input class="input md" type="datetime-local" value="${esc(m.dueDate || '')}">
      <button class="icon-btn" data-act="mini-remove" aria-label="Remove mini deadline">${I.x}<\/button><\/div>`;
  const d = openDialog(`
    <div class="dlg-head"><h3>${t ? 'Edit task' : 'New task'}<\/h3><button class="icon-btn" data-act="close" aria-label="Close">${I.x}<\/button><\/div>
    <div class="dlg-body">
      ${fromClass ? `<p class="muted" style="margin-top:0">Imported from Google Classroom. Title and deadline update on each sync; your status and mini deadlines are kept.<\/p>` : ''}
      <div class="field"><span>Type<\/span><div class="seg">${TYPES.map(x => `<label><input type="radio" name="tkType" value="${x}" ${v.type === x ? 'checked' : ''}><span>${x}<\/span><\/label>`).join('')}<\/div><\/div>
      <div class="field"><span>Title<\/span><input class="input" id="tkTitle" value="${esc(v.title || '')}" placeholder="e.g. Chapter 4 worksheet"><\/div>
      <div class="row">
        <div class="field"><span>Subject<\/span><select class="input" id="tkSubject">${S.data.subjects.map(s => `<option value="${s.id}" ${s.id === v.subjectId ? 'selected' : ''}>${esc(s.name)}<\/option>`).join('')}<\/select><\/div>
        <div class="field"><span>Deadline<\/span><input class="input" id="tkDeadline" type="datetime-local" value="${esc(v.deadline || '')}"><\/div>
      <\/div>
      <div class="row">
        <div class="field"><span>Status<\/span><select class="input" id="tkStatus">${['To do', 'In progress', 'Done'].map(x => `<option ${v.status === x ? 'selected' : ''}>${x}<\/option>`).join('')}<\/select><\/div>
        <div class="field"><span>Priority<\/span><select class="input" id="tkPriority">${['Low', 'Normal', 'High'].map(x => `<option ${v.priority === x ? 'selected' : ''}>${x}<\/option>`).join('')}<\/select><\/div>
      <\/div>
      <div class="field ${v.type === 'Group Project' ? '' : 'hidden'}" id="tkMembersWrap"><span>Group members<\/span><input class="input" id="tkMembers" value="${esc(v.members || '')}" placeholder="e.g. Ploy, Ken, Mai"><\/div>
      <div class="field"><span>Link<\/span><input class="input" id="tkLink" value="${esc(v.link || '')}" placeholder="Assignment page, shared doc or slides"><\/div>
      <div class="field"><span>Notes<\/span><textarea class="input" id="tkDesc" placeholder="What needs to be done">${esc(v.description || '')}<\/textarea><\/div>
      <div class="field"><span>Mini deadlines<\/span><small>Break the work into steps. Each step gets its own date and shows up in your reminder emails.<\/small>
        <div id="minis" style="margin-top:6px">${(v.milestones || []).map(miniRow).join('')}<\/div>
        <button class="btn small" data-act="mini-add" style="align-self:flex-start">${I.plus} Add mini deadline<\/button><\/div>
    <\/div>
    <div class="dlg-foot">
      ${t ? `<button class="btn danger" data-act="task-delete" data-id="${t.id}">${fromClass ? 'Hide task' : 'Delete task'}<\/button>` : ''}
      <div class="right"><button class="btn" data-act="close">Cancel<\/button><button class="btn primary" id="tkSave">${t ? 'Save task' : 'Add task'}<\/button><\/div>
    <\/div>`);
  d._miniRow = miniRow;
  $$('input[name=tkType]', d).forEach(r => r.onchange = () => $('#tkMembersWrap', d).classList.toggle('hidden', $('input[name=tkType]:checked', d).value !== 'Group Project'));
  $('#tkSave', d).onclick = async e => {
    const input = {
      id: t ? t.id : '',
      type: $('input[name=tkType]:checked', d).value,
      title: $('#tkTitle', d).value,
      subjectId: $('#tkSubject', d).value,
      deadline: $('#tkDeadline', d).value,
      status: $('#tkStatus', d).value,
      priority: $('#tkPriority', d).value,
      members: $('#tkMembers', d).value,
      link: $('#tkLink', d).value.trim(),
      description: $('#tkDesc', d).value,
      milestones: $$('.mini-edit', d).map(r => ({ id: r.dataset.mid, title: $('.mt', r).value, dueDate: $('.md', r).value, done: r.dataset.done === '1' })).filter(m => m.title.trim())
    };
    const late = input.deadline && input.milestones.find(m => m.dueDate && m.dueDate > input.deadline);
    if (late) { toast('\u201C' + late.title + '\u201D is after the main deadline. Move it earlier.', 'error'); return; }
    try { await act('saveTask', [input], t ? 'Task saved' : 'Task added', e.currentTarget); closeDialog(); } catch (err) { }
  };
}

async function classroomDialog(subjectId) {
  const d = openDialog(`<div class="dlg-head"><h3>Match a classroom<\/h3><button class="icon-btn" data-act="close" aria-label="Close">${I.x}<\/button><\/div>
    <div class="dlg-body"><div class="loading" style="min-height:120px"><div><div class="spinner"><\/div><p>Loading your classes\u2026<\/p><\/div><\/div><\/div>`);
  try { if (!S.courses) S.courses = await call('listMyCourses'); }
  catch (e) { $('.dlg-body', d).innerHTML = `<p>${esc(cleanErr(e))}<\/p>`; return; }
  const linked = {};
  S.data.classrooms.forEach(c => { linked[c.courseId] = subj(c.subjectId); });
  $('.dlg-body', d).innerHTML = S.courses.length ? `
    <div class="field"><span>Classroom<\/span><select class="input" id="clCourse">${S.courses.map(c => `<option value="${c.id}" ${linked[c.id] ? 'disabled' : ''}>${esc(c.name)}${c.section ? ' (' + esc(c.section) + ')' : ''}${linked[c.id] ? ', already matched to ' + esc(linked[c.id].name) : ''}<\/option>`).join('')}<\/select>
      <small>Classes already matched to a subject are greyed out.<\/small><\/div>
    <div class="field"><span>Subject<\/span><select class="input" id="clSubject">${S.data.subjects.map(s => `<option value="${s.id}" ${s.id === subjectId ? 'selected' : ''}>${esc(s.name)}<\/option>`).join('')}<\/select><\/div>
    <p class="muted">Assignments from this class are imported as homework right away and on every sync.<\/p>`
    : '<p>No active classes were found for your Google account.<\/p>';
  const opt = $('#clCourse option:not([disabled])', d);
  if (opt) opt.selected = true;
  const foot = document.createElement('div');
  foot.className = 'dlg-foot';
  foot.innerHTML = `<div class="right"><button class="btn" data-act="close">Cancel<\/button>${S.courses.length ? '<button class="btn primary" id="clSave">Match classroom<\/button>' : ''}<\/div>`;
  d.appendChild(foot);
  const save = $('#clSave', d);
  if (save) save.onclick = async e => {
    try { await act('linkClassroom', [$('#clSubject', d).value, $('#clCourse', d).value], 'Classroom matched and homework imported', e.currentTarget); closeDialog(); } catch (err) { }
  };
}

/* ================= Events ================= */
document.addEventListener('click', async e => {
  if (['SELECT', 'OPTION', 'INPUT', 'TEXTAREA', 'LABEL'].indexOf(e.target.tagName) > -1 && !e.target.dataset.act) return;
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.act, id = el.dataset.id;
  if (el.tagName === 'A') return;
  e.preventDefault();
  switch (a) {
    case 'go': go(el.dataset.view, id); break;
    case 'close': closeDialog(); break;
    case 'filter': S.typeFilter = el.dataset.type; render(); break;
    case 'subject-new': subjectDialog(); break;
    case 'subject-edit': subjectDialog(id); break;
    case 'subject-delete': {
      const s = subj(id);
      const ok = await confirmBox('Delete ' + s.name + '?', 'Its tasks, mini deadlines and classroom matches are removed from Study Hub. The Drive folder and its files stay in Drive.', 'Delete subject');
      if (ok) { await act('deleteSubject', [id], 'Subject deleted').catch(() => {}); go('dashboard'); }
      break;
    }
    case 'task-new': taskDialog(null, { subjectId: el.dataset.subject, type: el.dataset.type }); break;
    case 'task-edit': taskDialog(id); break;
    case 'task-done': {
      const t = S.data.tasks.find(x => x.id === id);
      act('setTaskStatus', [id, t.status === 'Done' ? 'To do' : 'Done'], t.status === 'Done' ? 'Moved back to open' : 'Marked as done').catch(() => {});
      break;
    }
    case 'task-delete': {
      const t = S.data.tasks.find(x => x.id === id);
      const cls = t.source === 'classroom';
      const ok = await confirmBox(cls ? 'Hide this task?' : 'Delete this task?', cls ? 'It stays in Google Classroom but will not come back on the next sync.' : '\u201C' + t.title + '\u201D and its mini deadlines will be removed.', cls ? 'Hide task' : 'Delete task');
      if (ok) act('deleteTask', [id], cls ? 'Task hidden' : 'Task deleted').catch(() => {});
      break;
    }
    case 'mini-add': { const box = $('#minis'); box.insertAdjacentHTML('beforeend', $('#dlg')._miniRow({})); $('.mini-edit:last-child .mt', box).focus(); break; }
    case 'mini-remove': el.closest('.mini-edit').remove(); break;
    case 'sync': act('syncClassrooms', [], r => { const x = r.report; return x.errors.length ? 'Synced with problems: ' + x.errors.join('; ') : `Classroom synced: ${x.added} new, ${x.completed} turned in`; }, el).catch(() => {}); break;
    case 'class-link': classroomDialog(el.dataset.subject || S.subjectId); break;
    case 'class-unlink': {
      const c = S.data.classrooms.find(x => x.id === id);
      const ok = await confirmBox('Unmatch ' + c.courseName + '?', 'New homework from this class will stop coming in.', 'Unmatch classroom', 'Also remove the homework already imported from it');
      if (ok) act('unlinkClassroom', [id, ok.extra], 'Classroom unmatched').catch(() => {});
      break;
    }
    case 'syllabus-remove': {
      const ok = await confirmBox('Unlink syllabus?', 'The file stays in your Drive folder. It just will not be shown as the syllabus.', 'Unlink');
      if (ok) act('removeSyllabus', [id], 'Syllabus unlinked').catch(() => {});
      break;
    }
    case 'syllabus-link': {
      const v = $('#sylLink').value.trim();
      if (!v) { toast('Paste a Google Drive file link first.', 'error'); break; }
      act('linkSyllabus', [id, v], 'Syllabus linked', el).catch(() => {});
      break;
    }
    case 'files-refresh': loadFiles(id, true); break;
    case 'time-add': {
      readDraft();
      const v = $('#stNewTime').value;
      if (!v || draft.times.includes(v)) break;
      if (draft.times.length >= 6) { toast('Use at most 6 reminder times a day.', 'error'); break; }
      draft.times.push(v); draft.times.sort(); draft.dirty = true; render(); break;
    }
    case 'time-remove': readDraft(); draft.times = draft.times.filter(t => t !== el.dataset.time); draft.dirty = true; render(); break;
    case 'settings-save': {
      readDraft();
      if (draft.enabled && !draft.times.length) { toast('Add at least one reminder time.', 'error'); break; }
      const input = { email: draft.email, reminderTimes: draft.times.join(','), daysAhead: draft.daysAhead, enabled: draft.enabled, sendWhenEmpty: draft.sendWhenEmpty, syncBeforeReminder: draft.sync };
      const saved = draft;
      draft = null;
      try { await act('saveSettings', [input], input.enabled ? 'Reminders saved for ' + input.reminderTimes.split(',').join(', ') : 'Reminders turned off', el); }
      catch (err) { draft = saved; render(); }
      break;
    }
    case 'music-new': {
      const name = ($('#mxNewName') || {}).value || '';
      if (!name.trim()) { toast('Type a name for the playlist.', 'error'); break; }
      try { const r = await act('createPlaylist', [name], 'Playlist created', el); S.music.id = r.id; render(); setTimeout(() => { const t = $('#mxLinks'); if (t) t.focus(); }, 0); } catch (err) { }
      break;
    }
    case 'music-select': S.music.id = id; S.music.target = null; render(); break;
    case 'tray-stage': { const i = $('#mxInput'); if (!i.value.trim()) { toast('Paste a YouTube link first.', 'error'); i.focus(); break; } const v = i.value; i.value = ''; stageText(v); break; }
    case 'tray-remove': S.music.tray = S.music.tray.filter(x => x.key !== el.dataset.key); render(); break;
    case 'tray-clear': S.music.tray = []; render(); break;
    case 'tray-add': {
      const pl = trayTarget();
      const have = new Set(pl.tracks.map(t => t.videoId));
      const ready = S.music.tray.filter(x => trayState(x, have) === 'ok');
      if (!ready.length) break;
      try {
        await act('addVideos', [pl.id, ready.map(x => ({ videoId: x.videoId, title: x.info.title, channel: x.info.channel }))],
          r => 'Added ' + r.report.added + ' song' + (r.report.added === 1 ? '' : 's') + ' to ' + r.report.playlistName, el);
        S.music.tray = [];
        S.music.id = pl.id;
        S.music.flash = ready.map(x => x.videoId);
        render();
        setTimeout(() => { S.music.flash = null; }, 2600);
      } catch (err) { }
      break;
    }

    case 'music-play': playPlaylist(el.dataset.pl, +el.dataset.index); break;
    case 'music-playall': playPlaylist(id, null, false); break;
    case 'music-shuffleall': playPlaylist(id, null, true); break;
    case 'music-rename': {
      const pl = S.data.playlists.find(p => p.id === id);
      const name = await promptBox('Rename playlist', 'Playlist name', pl.name, 'Rename');
      if (name != null) act('renamePlaylist', [id, name], 'Playlist renamed').catch(() => {});
      break;
    }
    case 'music-delete': {
      const pl = S.data.playlists.find(p => p.id === id);
      const ok = await confirmBox('Delete ' + pl.name + '?', 'The playlist and its ' + pl.tracks.length + ' songs are removed from Study Hub. Nothing is deleted on YouTube.', 'Delete playlist');
      if (ok) { if (P.playlistId === id) closePlayer(); S.music.id = null; act('deletePlaylist', [id], 'Playlist deleted').catch(() => {}); }
      break;
    }
    case 'music-add': {
      const text = $('#mxLinks').value.trim();
      if (!text) { toast('Paste at least one YouTube link.', 'error'); break; }
      try {
        const r = await act('addTracks', [id, text], r => {
          const n = r.report.added, k = r.report.skipped.length;
          return n ? `Added ${n} song${n === 1 ? '' : 's'}` + (k ? `, skipped ${k}` : '') : `Nothing added, skipped ${k}`;
        }, el);
        S.music.report = Object.assign({ playlistId: id }, r.report);
        render();
      } catch (err) { }
      break;
    }
    case 'track-up': act('moveTrack', [id, -1]).catch(() => {}); break;
    case 'track-down': act('moveTrack', [id, 1]).catch(() => {}); break;
    case 'track-remove': act('removeTrack', [id], 'Removed from playlist').catch(() => {}); break;
    case 'p-toggle': if (P.yt && P.yt.getPlayerState) { P.playing ? P.yt.pauseVideo() : P.yt.playVideo(); } break;
    case 'p-next': nextTrack(false); break;
    case 'p-prev': prevTrack(); break;
    case 'p-shuffle': P.shuffle = !P.shuffle; if (P.order.length) buildOrder(P.order[P.pos]); savePrefs(); updateDock(); break;
    case 'p-repeat': P.repeat = { all: 'one', one: 'off', off: 'all' }[P.repeat]; savePrefs(); updateDock(); break;
    case 'p-min': $('#dock').classList.toggle('min'); updateDock(); break;
    case 'p-close': closePlayer(); break;
    case 'ru-tab': S.ru.tab = el.dataset.tab; render(); break;
    case 'ru-load': ruLoaderDialog(); break;
    case 'ru-retake': retakeDialog(id); break;
    case 'ru-gpa-policy': act('ruSetGpaPolicy', [el.dataset.policy], el.dataset.policy === 'all' ? 'Every attempt now counts in your GPA' : 'Only the latest grade of each course counts now').catch(() => {}); break;
    case 'ru-group': S.ru.group = S.ru.group === el.dataset.group ? '' : el.dataset.group; S.ru.q = ''; render(); break;
    case 'ru-group-clear': S.ru.group = ''; S.ru.q = ''; render(); break;
    case 'tm-start': timerStart(); break;
    case 'tm-pause': timerPause(); break;
    case 'tm-resume': timerResume(); break;
    case 'tm-stop': timerStop(el); break;
    case 'tm-discard': {
      const ok = await confirmBox('Discard this session?', 'The ' + fmtClock(elapsedMs()) + ' on the timer won\u2019t be saved.', 'Discard');
      if (ok) timerReset();
      break;
    }
    case 'tm-goal': readTimerForm(); T.goal = +el.dataset.min; T.goalHit = T.running && T.goal > 0 && elapsedMs() >= T.goal * 60000; saveTimer(); render(); break;
    case 'ru-chart': S.ru.chartDays = +el.dataset.days; render(); break;
    case 'ru-sess-del': {
      const ok = await confirmBox('Delete this reading session?', 'It will be removed from your calendar and graphs.', 'Delete');
      if (ok) act('ruDeleteSession', [id], 'Session deleted').catch(() => {});
      break;
    }
    case 'ru-manual-add': {
      const date = $('#mfDate').value, from = $('#mfFrom').value, to = $('#mfTo').value;
      if (!date || !from || !to) { toast('Fill in the date and both times.', 'error'); break; }
      act('ruSaveSession', [{ start: date + 'T' + from, end: date + 'T' + to, courseCode: $('#mfCourse').value, label: $('#mfLabel').value }], 'Session added', el).catch(() => {});
      break;
    }
    case 'cal-move': { const m = S.ru.month ? new Date(S.ru.month) : new Date(new Date().getFullYear(), new Date().getMonth(), 1); m.setMonth(m.getMonth() + (+el.dataset.dir)); S.ru.month = m.getTime(); render(); break; }
    case 'cal-today': S.ru.month = null; S.ru.day = ymd(new Date()); render(); break;
    case 'cal-day': {
      S.ru.day = el.dataset.day;
      const d = pd(el.dataset.day), m = S.ru.month ? new Date(S.ru.month) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      if (d.getMonth() !== m.getMonth() || d.getFullYear() !== m.getFullYear()) S.ru.month = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      render(); break;
    }
    case 'ru-term-add':
      try { const r = await act('ruAddTerm', [$('#ruYear').value, $('#ruSem').value], 'Semester added', el); S.ru.termId = r.id; render(); } catch (err) { }
      break;
    case 'ru-term-pick': if (S.ru.termId !== id) { S.ru.termId = id; render(); } break;
    case 'ru-term-del': {
      const t = ru().terms.find(x => x.id === id);
      const n = ru().plan.filter(p => p.termId === id).length;
      const ok = await confirmBox('Remove ' + termName(t) + '?', n ? 'Its ' + n + ' planned course' + (n === 1 ? '' : 's') + ' go back to your course list.' : 'This semester has no courses.', 'Remove semester');
      if (ok) act('ruDeleteTerm', [id], 'Semester removed').catch(() => {});
      break;
    }
    case 'ru-add': {
      const c = ruCourse(id), t = ru().terms.find(x => x.id === S.ru.termId);
      if (!t) { toast('Add a semester first.', 'error'); break; }
      const lim = termLimits(t), total = termCredits(t.id);
      if (total + (+c.credits) > lim.max) { toast(termName(t) + ' would have ' + (total + (+c.credits)) + ' credits. ' + (t.semester === 'S' ? 'Summer' : 'A regular semester') + ' allows at most ' + lim.max + '.', 'error'); break; }
      act('ruPlanAdd', [t.id, id], c.code + ' added to ' + termName(t)).catch(() => {});
      break;
    }
    case 'ru-plan-remove': act('ruPlanRemove', [id], 'Removed from semester').catch(() => {}); break;
    case 'ru-need-save': act('ruSetCreditsNeeded', [$('#ruNeed').value], 'Saved', el).catch(() => {}); break;
    case 'ru-course-new': ruCourseDialog(); break;
    case 'ru-course-edit': ruCourseDialog(id); break;
    case 'ru-course-del': {
      const c = ruCourse(id);
      const ok = await confirmBox('Delete ' + c.code + '?', 'It will also be removed from any semester it\u2019s planned in. Reading sessions stay.', 'Delete course');
      if (ok) act('ruDeleteCourse', [id], 'Course deleted').catch(() => {});
      break;
    }
    case 'ru-import-read': {
      const txt = $('#ruImport').value;
      if (!txt.trim()) { toast('Paste your course list first.', 'error'); break; }
      S.ru.importRows = parseCourseLines(txt); S.ru.importText = txt; render();
      const box = $('#ruImport'); if (box) box.value = txt;
      break;
    }
    case 'ru-import-cancel': S.ru.importRows = null; render(); break;
    case 'ru-import-go':
      try {
        const r = await act('ruImportCourses', [S.ru.importRows.rows], r => 'Imported: ' + r.report.added + ' new, ' + r.report.updated + ' updated' + (r.report.errors.length ? ', ' + r.report.errors.length + ' with problems' : ''), el);
        if (r.report.errors.length) toast(r.report.errors.slice(0, 2).join(' '), 'error');
        S.ru.importRows = null; render();
      } catch (err) { }
      break;
    case 'book-new': S.books.results = null; bookDialog(); break;
    case 'book-open': {
      if (el.classList.contains('spine')) { el.classList.add('pulling'); setTimeout(() => bookDialog(id), 160); }
      else bookDialog(id);
      const tip = document.getElementById('bookTip'); if (tip) tip.classList.add('hidden');
      break;
    }
    case 'book-arrange': S.books.arrange = el.dataset.by; render(); break;
    case 'book-search': bookSearch(); break;
    case 'book-pick': bookPick(+el.dataset.i); break;
    case 'book-read': bookReadNow(id); break;
    case 'book-delete': {
      const b = books().find(x => x.id === id);
      const ok = await confirmBox('Remove \u201C' + b.title + '\u201D?', 'It will be taken off your shelves. Reading sessions you timed for it stay in your calendar.', 'Remove book');
      if (ok) act('deleteBook', [id], 'Book removed').catch(() => {});
      break;
    }
    case 'files-now':
      act('copyClassroomFilesNow', [], r => {
        const x = r.report;
        if (x.busy) return 'A copy is already running. Check back in a few minutes.';
        S.pdfUnmatched = x.unmatched || [];
        if ((x.errors || []).length && !x.added) return 'Some classes could not be read. See the details in Teacher files to Drive.';
        return (x.added ? 'Copied ' + x.added + ' new file' + (x.added === 1 ? '' : 's') + ' to Drive' : 'No new files to copy')
          + (x.links ? ', listed ' + x.links + ' link' + (x.links === 1 ? '' : 's') : '')
          + (x.failed ? ', ' + x.failed + ' couldn\u2019t be copied' : '')
          + (x.more ? '. More to go: press again or wait for the next automatic run' : '');
      }, el).catch(() => {});
      break;
    case 'files-save': {
      const auto = $('#flAuto').checked, h = $('#flHours').value;
      act('saveFilesSettings', [{ auto, everyHours: h }], auto ? 'Teacher files will be copied automatically' : 'Automatic copying turned off', el).catch(() => {});
      break;
    }
    case 'pdf-tool': S.pdf.tool = el.dataset.tool; S.pdf.results = []; render(); break;
    case 'pdf-drive': driveFilePicker(); break;
    case 'pdf-drive-pick': pickDriveFile(el); break;
    case 'pdf-remove': { const t = S.pdf.tool; S.pdf.files[t] = S.pdf.files[t].filter(f => f.id !== el.dataset.fid); S.pdf.results = []; render(); break; }
    case 'pdf-up': case 'pdf-down': {
      const l = S.pdf.files.merge, i = l.findIndex(f => f.id === el.dataset.fid), j = i + (a === 'pdf-up' ? -1 : 1);
      if (i > -1 && j > -1 && j < l.length) { [l[i], l[j]] = [l[j], l[i]]; render(); }
      break;
    }
    case 'pdf-split-mode': S.pdf.splitMode = el.dataset.mode; render(); break;
    case 'pdf-pick': { S.pdf.picked = S.pdf.picked || {}; const i = +el.dataset.i; if (S.pdf.picked[i]) delete S.pdf.picked[i]; else S.pdf.picked[i] = 1; el.classList.toggle('on'); break; }
    case 'pdf-pick-all': case 'pdf-pick-none': case 'pdf-pick-odd': case 'pdf-pick-even': {
      const n = (S.pdf.files.split[0] || {}).pages || 0; S.pdf.picked = {};
      for (let i = 0; i < n; i++) if (a === 'pdf-pick-all' || (a === 'pdf-pick-odd' && i % 2 === 0) || (a === 'pdf-pick-even' && i % 2 === 1)) S.pdf.picked[i] = 1;
      render(); break;
    }
    case 'wm-kind': wmSettings().useImage = el.dataset.v === 'image'; render(); break;
    case 'pdf-run': runPdfTool(el); break;
    case 'pdf-download': { const r = S.pdf.results.find(x => x.id === el.dataset.rid); if (r) downloadBytes(r.name, r.bytes); break; }
    case 'pdf-save': saveResults([el.dataset.rid], el); break;
    case 'pdf-save-all': saveResults(S.pdf.results.map(r => r.id), el); break;
    case 'settings-test': act('sendTestReminder', [], r => r, el).catch(() => {}); break;
    case 'api-disconnect': {
      const ok = await confirmBox('Disconnect this browser?', 'Study Hub forgets the access key on this device. Your data stays in your Google account, and you can connect again with the same key.', 'Disconnect');
      if (ok) shApi.disconnect();
      break;
    }
  }
});

document.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'ruGroup') { S.ru.group = el.value; render(); }
  if (el.dataset.change === 'ru-pass') act('ruPlanPassed', [el.dataset.id, el.checked], el.checked ? 'Marked as passed' : null).catch(() => {});
  if (el.dataset.change === 'ru-grade') act('ruSetGrade', [el.dataset.id, el.value], el.value ? 'Grade ' + el.value + ' saved' : 'Grade cleared').catch(() => render());
  if (el.dataset.change === 'ru-move' && el.value) act('ruPlanMove', [el.dataset.id, el.value === '__tray' ? '' : el.value], el.value === '__tray' ? 'Moved back to the retake tray' : 'Course moved').catch(() => render());
  if (el.id === 'tmCourse' || el.id === 'tmLabel') readTimerForm();
  if (el.dataset.change === 'mini') act('toggleMilestone', [el.dataset.id, el.checked], el.checked ? 'Mini deadline done' : null).catch(() => {});
  if (el.closest && el.closest('.main') && el.id && el.id.indexOf('st') === 0 && draft) { readDraft(); }
  if (el.dataset.filter && el.tagName === 'SELECT') { S.allFilter[el.dataset.filter] = el.value; render(); }
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'tmLabel') readTimerForm();
  if (el.id === 'bkQ') { S.books.q = el.value; clearTimeout(window._bkQ); window._bkQ = setTimeout(render, 200); }
  if (el.id === 'ruQ') { S.ru.q = el.value; clearTimeout(window._ruQ); window._ruQ = setTimeout(render, 200); }
  if (el.dataset.filter === 'q') {
    S.allFilter.q = el.value;
    clearTimeout(window._qT);
    window._qT = setTimeout(() => { render(); const q = $('[data-filter=q]'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250);
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'mxNewName') { e.preventDefault(); const b = $('[data-act=music-new]'); if (b) b.click(); }
});
$('#dlg').addEventListener('click', e => { if (e.target.id === 'dlg') closeDialog(); });
$('#menuBtn').onclick = () => $('#binder').classList.toggle('open');

/* ================= Boot ================= */
if (!shApi.configured()) shApi.showConnect();
else call('getAppData')
  .then(d => {
    if (!d) throw new Error('The server sent back no data. Run setup in the Apps Script editor, then reload.');
    S.data = d; render();
  })
  .catch(e => {
    if (document.getElementById('connectForm')) return;   // a wrong key already opened the connect screen
    $('#main').innerHTML = `<div class="panel empty-state"><h3>Study Hub could not load<\/h3><p>${esc(cleanErr(e))}<\/p><p>Open the script editor, run the setup function once to grant access, then reload this page.<\/p><p><button class="btn" onclick="shApi.showConnect()">Check the connection<\/button><\/p><\/div>`;
  });

window.__shPart2 = true;
