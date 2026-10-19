# Watson's Writing

Letter and number writing PWA for a 4-year-old (Print Rhythm Leader method). Deployed on Railway from GitHub `ZingsHub/watsons-writing` (branch `main`); every push to main redeploys. Live: https://watsons-writing-production.up.railway.app

## Layout
- `public/index.html`: the entire app (HTML, CSS, JS in one file, about 1.9 MB because her recorded voice clips are embedded as base64 in the `VOICE` object). Never print or paste the whole file; read and edit small sections.
- `public/sw.js`: service worker for offline use. Bump `VERSION` (ww-v1 -> ww-v2 ...) in the same commit whenever index.html changes, or devices keep the old copy.
- `public/manifest.webmanifest`, `public/icons/`: install (PWA) files.
- `server.js`: dependency-free static server for Railway (`npm start`).

## How the app works
- Modes: Learn to write, Writing Quiz, Free writing. Letters/numbers are stroke templates (`WD_(...)`) in a 100x160 space; `evalStroke` scores each stroke. Grading happens only on pointer release.
- Voice: `VOICE` maps exact script lines to her recorded clips. If a spoken line has no clip it falls back to the device voice, so any NEW spoken line needs a new recording from Zach.
- Idle reminder after 10 s: repeats instructions, then highlights Hint.

## Workflow
- Zach is non-technical: explain changes plainly, keep them small, test before committing.
- After a change: bump sw.js VERSION, `git add .`, `git commit -m "..."`, `git push`. Railway deploys in about a minute.
- Run locally: `node server.js` then open http://localhost:3000.
- Only commit files inside this folder. Do not add personal files.
