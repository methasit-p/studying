# studying

Two study tools, hosted with GitHub Pages at **https://methasit-p.github.io/studying/**

| Path | What it is | Backend |
|---|---|---|
| `/` (`index.html`) | Study Timer: YPT-style subject timer with ranking | Its own Apps Script + Google Sheet |
| `/hub/` | Study Hub: tasks and deadlines, Google Classroom sync, Drive folders, email reminders, Ramkhamhaeng course planner and GPA, reading timer, bookstore, PDF tools, study music | `apps-script/study-hub/Code.gs` |

## Study Hub setup

Study Hub's page runs on GitHub Pages. Your data stays in your Google account: the page talks to your Apps Script, which reads and writes your Sheet, Drive, Classroom and Gmail.

1. **Update the Apps Script.** Open your Study Hub Apps Script project, replace all of `Code.gs` with `apps-script/study-hub/Code.gs` from this repo, and save. The other files (Index, Styles, App, App2) can stay; they are no longer served.
2. **Get the access key.** Choose `showApiKey` in the function menu, press **Run**, and copy the key from the execution log. Keep it private.
3. **Deploy.** Deploy > Manage deployments > edit (pencil) > Version: **New version**, with *Execute as: Me* and *Who has access: **Anyone***. Copy the URL ending in `/exec`.
4. **Connect.** Open https://methasit-p.github.io/studying/hub/, paste the URL and the key, and press Connect. Each browser asks once.

Optional: put the `/exec` URL in `hub/js/config.js` so you only paste the key on new devices. Never commit the key, because this repository is public.

### Security notes

- With access set to *Anyone*, the Apps Script URL is reachable by anyone, but every request must carry the access key, and only the functions listed in `API_FUNCTIONS` can be called.
- If the key leaks, run `resetApiKey` in the editor and connect again with the new key.
- The old Apps Script page is turned off (`SERVE_OLD_PAGE = false` in `Code.gs`), because with *Anyone* access it would have no key check.
- The reminder email's "Open Study Hub" button points to the GitHub Pages address automatically after you open the site once.

### Files

```
hub/index.html      page shell (was Index.html)
hub/css/styles.css  was Styles.html
hub/js/app.js       was App.html
hub/js/app2.js      was App2.html
hub/js/api.js       replaces google.script.run with fetch to the web app, plus the connect screen
hub/js/config.js    optional default web app URL
apps-script/study-hub/Code.gs   backend with the JSON API (doPost) added
```
