# Watson's Writing

Letter and number writing PWA for a 4-year-old (Print Rhythm Leader method). Deployed on Railway from GitHub `ZingsHub/watsons-writing` (branch `main`); every push to main redeploys. Live: https://watsons-writing-production.up.railway.app

## Layout
- `public/index.html`: the entire app (HTML, CSS, JS in one file, about 2,700 lines). Read and edit small sections; don't print the whole file.
- `public/audio/`: her recorded voice clips (`001.mp3` ...) plus `manifest.json`, which maps each exact script line to its clip.
- `public/sw.js`: service worker for offline use; it also caches every clip in the audio manifest. Bump `VERSION` (ww-v11 -> ww-v12 ...) in the same commit whenever index.html or audio changes, or devices keep the old copy.
- `public/manifest.webmanifest`, `public/icons/`: install (PWA) files.
- `server.js`: dependency-free static server for Railway (`npm start`).
- `voice-needed.txt`: spoken lines that still need a recording from Zach.

## Finding things in index.html
Sections are marked with `/* ---------- name ---------- */` comments; grep for them rather than relying on line numbers.
- Styles first (with blocks for Write my name, My Farm, sideways layout), then the screen markup, then one `<script>`.
- Sound: `speak()` uses her clip if one exists, else the device voice (`speakTTS`). `VOICE` is filled from `/audio/manifest.json` at startup.
- Letter templates: `WD_(char, strokeNames, strokes)` calls, 62 of them (A-Z, a-z, 0-9), in a 100x160 space (top line y=20, midline 70, baseline 120, descender 150).
- Grading: `evalStroke` scores each stroke on pointer release; the "whole-letter shape check" judges the finished letter in Writing Quiz and Write my name levels 2-3.
- Writing game sections: state, pointer input, guided practice, quiz, hints, menus, idle reminders.
- Write my name: a grown-up types a word; levels 1 trace, 2 dots only, 3 just the lines. Names are saved in localStorage (`ww_names`).
- Back button and Grown-ups (reset all progress behind a math problem).
- My Farm: stars earned from writing build a farm. Settings live in the `FARM` object; inline SVG pictures, Web Audio animal sounds, and dragging (animals any time, items only in build mode).

## How the app works
- Menu modes: Learn to write, Writing Quiz, Free writing, Write my name, plus My Farm.
- Free writing is a drawing page (`dPlay`, the "Free writing" section; settings in `DRAW`): colors, brush sizes, eraser, undo, clear (asks first), writing-lines toggle, stamps, save as PNG. It never speaks and gives no stars. Stamps of animals play her clips ("Oink!" etc.) only if recorded.
- Voice: any NEW spoken line needs a new recording from Zach; until then it falls back to the device voice. Add new lines to `voice-needed.txt`. When clips arrive, put them in `public/audio/` and add them to `manifest.json`.
- Stars are paid only for improving (all numbers in `STARS`, paid through `rPay`; record in localStorage `ww_reward`, letter bests in `ty_write`): best per letter and quiz set, names once per name and level (first 5 names), a daily star, mastery bonuses. `ty_stars` is lifetime; the farm spends from it.
- My Farm has 7 animals (`FARM.animals`; drawings in `FDRAW`, colors in `FPAL`, attachment points in `FANC`). Customizations are slots with one worn each (`FARM.looks` + `FARM.lookMore`, drawn by `fAcc`/`FACC`). World items: `FARM.items`, `itemOf`, `spots`, `itemSize`, drawings in `FITEM`/`fItemSVG`. Save is `ww_farm` v2 `{ looks: { animal: { own, wear } } }`; `fLoad` converts the old v1 `decor` and drops anything unknown.
- My Farm animals: sizes and baby proportions per growth stage in `FARM.growthStages`; one plan per animal in the "what the animals do" section (home, go, act, back), with the interactions as timed step lists (`fPigMud`, `fPigWash`, `fHenEat`, `fHorseHay`, `fHorseDrink`). Timings in `FARM` (actEvery, mudSeconds, flowersBack, hayBack). Only transforms and opacity animate.
- My Farm voice lines are in `FSAY`: shop answers may cut in, other farm lines are dropped if a line is playing, and a missing clip stays silent.
- Idle reminder after 10 s: repeats instructions, then highlights Hint.

## Workflow
- Zach is non-technical: explain changes plainly, keep them small, test before committing.
- After a change: bump sw.js VERSION, `git add .`, `git commit -m "..."`, `git push`. Railway deploys in about a minute.
- Run locally: `node server.js` then open http://localhost:3000.
- Only commit files inside this folder. Do not add personal files.
