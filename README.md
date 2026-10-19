# Watson's Writing

Letter and number writing practice (Print Rhythm Leader method) as an installable web app (PWA).

- `public/` the app (index.html, manifest, service worker, icons)
- `server.js` tiny static server (no dependencies); `npm start` runs it on `$PORT`

## Run locally
    node server.js        # then open http://localhost:3000

## Deploy on Railway
1. Push this folder to a GitHub repo.
2. Railway: New Project > Deploy from GitHub repo > pick it. It detects Node and runs `npm start`.
3. Service > Settings > Networking > Generate Domain.
4. Open the domain on the tablet/phone and use "Add to Home Screen" / "Install".

## Updating
Edit `public/index.html`, bump `VERSION` in `public/sw.js` (e.g. ww-v2), push. Railway redeploys; devices pick up the new version on next open.
