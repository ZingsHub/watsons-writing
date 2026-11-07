// My Farm finds her clips ignoring capitals: "Chicken coop" plays the clip saved as "chicken coop".
// Farm voice still stops when leaving My Farm, and nothing plays when muted.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { openWith, withFarm, openFarm, openShop } = require('./helpers');

const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'audio', 'manifest.json'), 'utf8'));
const COOP = MANIFEST['chicken coop'];   // saved with a small c; the app says "Chicken coop"
const SAVE = { v: 4, spent: 0, animals: ['chicken'], looks: {}, items: [], away: [], pos: {}, areas: ['barnyard'] };

// every clip the page asks for, and every line handed to the device voice
async function listen(page) {
  const clips = [];
  page.on('request', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/audio/') && u.pathname.endsWith('.mp3')) clips.push(u.pathname); });
  await page.addInitScript(() => {
    window.__tts = []; window.__snd = 0;
    try { const s = window.speechSynthesis; if (s) { const f = s.speak.bind(s); s.speak = (u) => { window.__tts.push(u.text); return f(u); }; } } catch (e) {}
    const P = (window.BaseAudioContext || window.AudioContext).prototype;
    ['createOscillator', 'createBufferSource'].forEach((m) => { const f = P[m]; P[m] = function () { window.__snd++; return f.apply(this, arguments); }; });
  });
  return clips;
}
async function buyCoop(page) {
  await openShop(page, 'barnyard');
  await page.locator('[data-e="item:coop:"]').click();
  await expect(page.locator('#fPvT')).toHaveText('Chicken coop');
  await page.locator('#fPvBuy').click();
}

test('the manifest has the coop clip only in lowercase (what this test is about)', async () => {
  expect(COOP).toBeTruthy();
  expect(MANIFEST['Chicken coop']).toBeUndefined();
});

test('"Chicken coop" plays her recorded clip in My Farm, not the device voice', async ({ page }) => {
  const clips = await listen(page);
  await openWith(page, withFarm(50, SAVE));
  await openFarm(page);
  await buyCoop(page);
  await expect.poll(() => clips.includes(COOP), { timeout: 8000 }).toBe(true);
  expect(await page.evaluate(() => window.__tts.filter((t) => /chicken coop/i.test(t)))).toEqual([]);
});

test('farm sounds stop when leaving My Farm', async ({ page }) => {
  const clips = await listen(page);
  await openWith(page, withFarm(50, SAVE));
  await openFarm(page);
  await buyCoop(page);
  await expect.poll(() => clips.includes(COOP), { timeout: 8000 }).toBe(true);
  await page.locator('#fShop .fx-close').click();
  await page.locator('#topBack').click();
  await expect(page.locator('#wMenu')).toBeVisible();
  await page.waitForTimeout(800);
  const n = await page.evaluate(() => window.__snd), c = clips.length;
  await page.waitForTimeout(3000);
  expect(await page.evaluate(() => window.__snd)).toBe(n);
  expect(clips.length).toBe(c);
});

test('muted: "Chicken coop" and the other farm lines stay silent', async ({ page }) => {
  const clips = await listen(page);
  await openWith(page, withFarm(50, SAVE));
  await page.locator('#startBtn').click();
  await page.locator('#mute').click();
  await expect(page.locator('#mute')).toHaveText('Sound: off');
  const n = await page.evaluate(() => window.__snd);
  await page.locator('#wMenu [data-m="farm"]').click();
  await expect(page.locator('#fMap .fmarea').first()).toBeVisible();
  await buyCoop(page);
  await page.waitForTimeout(1500);
  expect(clips.filter((u) => u === COOP)).toEqual([]);
  expect(await page.evaluate(() => window.__tts)).toEqual([]);
  expect(await page.evaluate(() => window.__snd)).toBe(n);
});
