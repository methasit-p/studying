/*
 * Connection between the GitHub Pages site and the Study Hub Apps Script.
 * Replaces google.script.run: every call is a POST of { fn, args, key } to the web app.
 * text/plain keeps it a "simple" request, so the browser skips the CORS preflight Apps Script can't answer.
 */
(function () {
  var STORE = 'studyhub-connection';
  var cfg = window.STUDY_HUB_CONFIG || {};

  function load() { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (e) { return {}; } }
  function save(v) { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch (e) { /* private mode */ } }

  var conn = load();
  if (!conn.url) conn.url = cfg.apiUrl || '';

  function validUrl(u) { return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec\/?$/.test(String(u || '').trim()); }

  function post(url, body) {
    return fetch(url, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).catch(function () {
      throw new Error('Could not reach your Apps Script. Check your internet connection, and that the web app is deployed with access set to Anyone.');
    }).then(function (res) { return res.text(); }).then(function (text) {
      try { return JSON.parse(text); } catch (e) {
        throw new Error('Apps Script answered with a web page instead of data. Deploy a new version with access set to Anyone, and use the URL that ends in /exec.');
      }
    });
  }

  function call(fn, args) {
    if (!conn.url || !conn.key) {
      showConnect();
      return Promise.reject(new Error('Connect Study Hub to your Apps Script first.'));
    }
    var body = { fn: fn, args: args || [], key: conn.key };
    if (fn === 'getAppData') body.site = location.origin + location.pathname;
    return post(conn.url, body).then(function (data) {
      if (data.ok) return data.result;
      if (data.code === 'auth' || data.code === 'nokey') {
        conn.key = ''; save(conn);
        showConnect(data.error);
      }
      throw new Error(data.error || 'Something went wrong on the server.');
    });
  }

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function showConnect(message) {
    var main = document.getElementById('main');
    if (!main) return;
    var binder = document.getElementById('binder');
    if (binder && !(window.S && S.data)) binder.innerHTML = '<div class="brand"><div class="brand-mark">S</div><h1>Study Hub</h1></div>';
    main.innerHTML =
      '<div class="panel connect"><h3>Connect Study Hub</h3>' +
      '<p class="sub">Study Hub keeps your data in your own Google account. This page needs your Apps Script address and access key once on each device.</p>' +
      '<ol><li>In the Apps Script editor, run <code>showApiKey</code> and open the execution log.</li>' +
      '<li>Copy the access key from the log.</li>' +
      '<li>Copy the web app URL from <b>Deploy &gt; Manage deployments</b>. It ends in <code>/exec</code>.</li></ol>' +
      (message ? '<p class="err">' + escHtml(message) + '</p>' : '') +
      '<form id="connectForm">' +
      '<label class="field"><span>Web app URL</span><input class="input" id="cnUrl" placeholder="https://script.google.com/macros/s/.../exec" value="' + escHtml(conn.url) + '" spellcheck="false" autocomplete="off"></label>' +
      '<label class="field"><span>Access key</span><input class="input" id="cnKey" type="password" placeholder="Paste the key from the log" spellcheck="false" autocomplete="off"></label>' +
      '<div class="link-row"><button class="btn primary" type="submit" id="cnGo">Connect</button></div>' +
      '</form></div>';
    var form = document.getElementById('connectForm');
    var urlIn = document.getElementById('cnUrl'), keyIn = document.getElementById('cnKey'), go = document.getElementById('cnGo');
    (conn.url ? keyIn : urlIn).focus();
    form.onsubmit = function (e) {
      e.preventDefault();
      var url = urlIn.value.trim(), key = keyIn.value.trim();
      var old = form.querySelector('.err'); if (old) old.remove();
      var fail = function (msg) {
        var p = document.createElement('p'); p.className = 'err'; p.textContent = msg;
        form.insertBefore(p, form.firstChild);
        go.disabled = false; go.textContent = 'Connect';
      };
      if (!validUrl(url)) return fail('The URL should look like https://script.google.com/macros/s/.../exec');
      if (!key) return fail('Paste the access key.');
      go.disabled = true; go.textContent = 'Checking…';
      post(url, { fn: 'ping', key: key }).then(function (data) {
        if (!data.ok) return fail(data.error || 'The script did not accept the key.');
        conn = { url: url, key: key }; save(conn);
        location.reload();
      }).catch(function (err) { fail(err.message); });
    };
  }

  window.shApi = {
    call: call,
    configured: function () { return !!(conn.url && conn.key); },
    showConnect: showConnect,
    disconnect: function () { conn.key = ''; save(conn); location.reload(); }
  };
})();
