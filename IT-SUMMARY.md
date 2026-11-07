# Watson's Writing: summary for school IT

**What it is.** A letter and number handwriting practice app for young children (ages about 3 to 6), made by a parent. It runs in the browser and can be installed to the home screen as a Progressive Web App. Address: https://watsons-writing-production.up.railway.app. Source: GitHub `ZingsHub/watsons-writing`.

**Accounts and data.** No accounts, no sign-in, no ads, no analytics, no trackers, no cookies.
- Everything is saved only in the browser's local storage on that device: each child's first name (a grown-up types it; up to 20 letters), an animal face, letters practiced, quiz scores, stars, practice dates and the child's game farm.
- Nothing is sent to any server. The server has no endpoint that accepts or stores data.
- Data leaves the device only if a grown-up chooses **Share progress file** and sends the file themselves (for example, to a teacher). Teachers can load these files into **Class view**; the import is checked strictly: size limit 200 KB, exact format, every field type-checked, numbers clamped, names shown as plain text only. This is covered by automated tests with broken, oversized, wrongly typed and script-carrying files.
- An in-app **Privacy** page (Grown-ups > Privacy) says the same in plain language.

**Domains contacted.** Only the app's own address. Fonts, sounds, icons and code are all served by the app itself. There are no third-party scripts, fonts or services.
- The only outside link is **"Send a suggestion or report a problem"**, a Google Form (`forms.gle`) behind a grown-up math gate. It opens in a new tab only when tapped, with no referrer sent. Google's privacy policy applies to anything typed there.
- The service worker only stores this app's own files for offline use. It never contacts other sites.

**Security headers** (on every response, set in `server.js`):
- `Content-Security-Policy`: own origin only. The single inline script is allowed by its SHA-256 hash. No `eval`, no other sites, no frames (`frame-ancestors 'none'`), no plugins, no forms. Inline styles and `data:`/`blob:` images and sounds are allowed: the app draws with them.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Strict-Transport-Security: max-age=31536000`, `Cross-Origin-Resource-Policy: same-origin`.
- `Permissions-Policy`: camera, microphone, location, motion sensors, payment, USB and others are switched off.
- The server answers only GET and HEAD (others: 405) and serves only files inside `public/`.
- `/.well-known/security.txt` gives a security contact.

**Dependencies.** None. The server uses only Node's built-in modules, and the app is one HTML file with no libraries. `npm audit`: 0 vulnerabilities. `npm outdated`: nothing to update. It runs on Node.js 22 LTS (`engines` in package.json is `22.x`, so the host always uses the newest Node 22 with its security fixes).

**Repository check.** No passwords, keys, tokens or `.env` files in the repository or its history.

**How updates are published.** Changes are pushed to the `main` branch on GitHub; Railway rebuilds and redeploys automatically in about a minute. Every change bumps a version number shown at the bottom of Grown-ups (for example `ww-v33`), so staff can confirm which version a device has. Installed copies pick up the new version the next time the app is opened online. Automated browser tests (Playwright, in `tests/`) are run before each change is published.

**Contact.** watsonswriting@gmail.com
