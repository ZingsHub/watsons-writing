# Watson's Writing

Letter and number writing PWA for a 4-year-old (Print Rhythm Leader method). Deployed on Railway from GitHub `ZingsHub/watsons-writing` (branch `main`); every push to main redeploys. Live: https://watsons-writing-production.up.railway.app

## Layout
- `public/index.html`: the entire app (HTML, CSS, JS in one file, about 2,700 lines). Read and edit small sections; don't print the whole file.
- `public/audio/`: her recorded voice clips (`001.mp3` ...) plus `manifest.json`, which maps each exact script line to its clip.
- `public/sw.js`: service worker for offline use; it also caches every clip in the audio manifest. Bump `VERSION` (ww-v11 -> ww-v12 ...) in the same commit whenever index.html or audio changes, or devices keep the old copy. Change the "App version" line at the bottom of Grown-ups (`#gVer` in index.html) to the same text, so grown-ups can tell which version they have.
- `public/manifest.webmanifest`, `public/icons/`: install (PWA) files.
- `public/fonts/`: Fredoka and Nunito (woff2, SIL OFL in LICENSE.txt), served by the app itself so nothing is fetched from elsewhere.
- `server.js`: dependency-free static server for Railway (`npm start`).
- `voice-needed.txt`: spoken lines that still need a recording from Zach.

## Finding things in index.html
Sections are marked with `/* ---------- name ---------- */` comments; grep for them rather than relying on line numbers.
- Styles first (with blocks for Write my name, My Farm, sideways layout), then the screen markup, then one `<script>`.
- Sound: `speak()` uses her clip if one exists, else the device voice (`speakTTS`). `VOICE` is filled from `/audio/manifest.json` at startup.
- Letter templates: `WD_(char, strokeNames, strokes)` calls, 62 of them (A-Z, a-z, 0-9), in a 100x160 space (top line y=20, midline 70, baseline 120, descender 150).
- Grading: `evalStroke` scores each stroke on pointer release; the "whole-letter shape check" judges the finished letter in Writing Quiz and Write my name levels 2-3. It is tuned (in `SHAPE`) for a finger on tablets that report few touch points (Amazon Fire / Silk): `shInk` keeps the point where the finger lifts and treats only a stroke that stays in one spot as a dot, every bundled touch point is used, and the wobble allowance (`nearU`) is in letter units, so small letters get the same room as capitals. In Write my name, a new try written over a missed one is also judged on its own.
- Writing game sections: state, pointer input, guided practice, quiz, hints, menus, idle reminders.
- Write my name: a grown-up types a word; levels 1 trace, 2 dots only, 3 just the lines. Names are saved in localStorage (`ww_names`). Each letter waits for the big green check (`#nCheck`): nothing is judged until he taps it; a miss keeps his ink with a gentle line (no penalty); the eraser (`#nErase`) starts the letter over; idle with ink makes the check glow. Level 1 still traces stroke by stroke.
- Back button and Grown-ups: a math problem first, then the list of children (add, edit name and face, delete asked twice) and Reset progress for the child playing. Next to Reset, "Send a suggestion or report a problem" (`#gSuggest`) is a plain link to a Google Form that opens in a new tab; offline it shows a short note instead. The app sends nothing itself, and the service worker ignores other sites.
- Progress report (Grown-ups > Progress report): `rpBuild(host, id)` fills one child's page from that child's saved data, text only (textContent); built into `#gRepBox` on screen and into `#printRep` (outside the app), which is all that prints (letter, 0.5 in margins, one page; `@media print` block). Anything not tracked before profiles shows "Not tracked yet".
- Progress files and Class view (Grown-ups): "Share progress file" makes Watson-Writing-<Name>-<date>.json via the share sheet, a download, or (iPhone home-screen app) a new tab with instructions. Format `{ app: "watsons-writing-progress", format: 1, exported, children: [{ id, name, face, progress }] }`, progress = `rpData` without name/face; the id is a random device code (`ww_device`) plus the profile id. "Class view (for teachers)" imports files into its own key `ww_class` (max 40), newest export wins per id; every file and every read of `ww_class` goes through `clFile`/`clKid` (200 KB limit, exact schema, clamped numbers, 12-character text). Print all = one report per page.
- Child profiles ("child profiles" section, first in the script): every progress key is saved per child as `ww_p_<id>_<key>` via `pkey(k)`; the list is `ww_profiles` (max 8, 12 faces in `PFACES`), each child also has a name tag `ww_p_<id>_meta` used to rebuild a damaged list. The first run copies everything to `ww_backup_premigrate` (never deleted) and makes it Watson's. Shared: voice clips, mute, `ty_voice`. With 2+ children the start screen is "Who's playing?"; the face in the menu corner (`#pMe`) goes back to it. Switching reloads that child's data in memory (`pReload`). Report tracking per child in `ww_stats` (`stDone`): quiz best and plays per set, names and highest level, practice days, stars earned.
- My Farm: stars earned from writing build a farm. Settings live in the `FARM` object; inline SVG pictures, Web Audio animal sounds, and dragging (animals any time, items only in build mode).

## How the app works
- Menu modes: Learn to write, Writing Quiz, Free writing, Write my name, plus My Farm.
- Free writing is a drawing page (`dPlay`, the "Free writing" section; settings in `DRAW`): colors, brush sizes, eraser, undo, clear (asks first), writing-lines toggle, stamps, save as PNG. It never speaks and gives no stars. Stamps of animals play her clips ("Oink!" etc.) only if recorded.
- Voice: any NEW spoken line needs a new recording from Zach; until then it falls back to the device voice. Add new lines to `voice-needed.txt`. When clips arrive, put them in `public/audio/` and add them to `manifest.json`.
- Stars are paid only for improving (all numbers in `STARS`, paid through `rPay`; record in localStorage `ww_reward`, letter bests in `ty_write`): best per letter and quiz set, names once per name and level (first 5 names), a daily star, mastery bonuses. `ty_stars` is lifetime; the farm spends from it.
- My Farm opens on a map (`fMapShow`); areas are listed in `AREAS` (id, name, map position, size, price from `AREA_PRICES`, map picture, open function). Starter areas: Barnyard (the animals, `fBarnyardOpen`), Tractor Shed (`SHED`, `fShedOpen`), Farmhouse and Garden (`HOUSE`, `GARDEN`, `fHouseOpen`). Add a new area by adding an entry and its open function. Back goes area -> map -> out. The save (v3) adds `areas`, `shed`, `house`, `garden`; v4 adds `away` (sent home; `animals`/`items` in the save still list everything owned).
- My Farm has 7 animals (`FARM.animals`; drawings in `FDRAW`, colors in `FPAL`, attachment points in `FANC`). Customizations are slots with one worn each (`FARM.looks` + `FARM.lookMore`, drawn by `fAcc`/`FACC`). World items: `FARM.items`, `itemOf`, `spots`, `itemSize`, drawings in `FITEM`/`fItemSVG`. Save is `ww_farm` v2 `{ looks: { animal: { own, wear } } }`; `fLoad` converts the old v1 `decor` and drops anything unknown.
- My Farm animals: sizes and baby proportions per growth stage in `FARM.growthStages`; one plan per animal in the "what the animals do" section (home, go, act, back), with the interactions as timed step lists (`fPigMud`, `fPigWash`, `fHenEat`, `fHorseHay`, `fHorseDrink`). Timings in `FARM` (actEvery, mudSeconds, flowersBack, hayBack). Only transforms and opacity animate.
- My Farm voice lines are in `FSAY`: shop answers may cut in, other farm lines are dropped if a line is playing, and a missing clip stays silent. Animal sounds (`dClip`) overlap freely, even over her lines: decoded once, up to 8 at a time (the oldest stops), all stopped by mute.
- Barnyard zoom and pan (`fZm`, `fZoom`, `fZApply`): pinch, + / - / fit buttons, drag empty field, double-tap to fit; 0.6x to 2.5x (`FARM.zoom`). The whole field sits in `#fWorld`, scaled by one transform; drag code turns finger positions back into farm positions. Resets when leaving the Barnyard.
- Send home (build mode): the house button on an animal or item asks (green check / red X), then moves it to `FST.away`; the barn button (`#fHomeBtn`) lists them and brings one back free (`fSendHome`, `fBringBack`). Use `fOwns` for "does he own it" (on the field or at home).
- Idle reminder after 10 s: repeats instructions, then highlights Hint.

## Workflow
- Zach is non-technical: explain changes plainly, keep them small, test before committing.
- After a change: bump sw.js VERSION (and #gVer to match), `git add .`, `git commit -m "..."`, `git push`. Railway deploys in about a minute.
- Run locally: `node server.js` then open http://localhost:3000.
- Only commit files inside this folder. Do not add personal files.
