// The device voice: only on-device voices (localService true) are ever used, so no spoken line is sent to Google or Microsoft.
// With no on-device voice, lines without a recording stay silent (never the browser's default voice).
// The clip list is hidden, so the welcome line after Start has to go to the device voice.
const { test, expect } = require('@playwright/test');

const ONLINE = { name: 'Microsoft Aria Online (Natural) - English (United States)', voiceURI: 'Microsoft Aria Online (Natural) - English (United States)', lang: 'en-US', localService: false, default: true };
const LOCAL = { name: 'Microsoft Zira - English (United States)', voiceURI: 'Microsoft Zira - English (United States)', lang: 'en-US', localService: true, default: false };

// a stand-in speechSynthesis with just these voices; records every line and the voice it was given
async function fakeVoices(page, list) {
  await page.addInitScript((list) => {
    window.__said = [];
    const voices = list.map((v) => Object.freeze(Object.assign({}, v)));
    const fake = {
      getVoices: () => voices.slice(), speak: (u) => { window.__said.push({ text: u.text, voice: u.voice ? u.voice.name : null }); },
      cancel: () => {}, pause: () => {}, resume: () => {}, speaking: false, pending: false, onvoiceschanged: null,
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, get: () => fake });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; this.voice = null; this.lang = ''; };
  }, list);
  await page.route('**/audio/manifest.json', (r) => r.fulfill({ status: 404, body: '' }));
}

async function startWatson(page, saved) {
  await page.goto('/');
  await page.evaluate((s) => { localStorage.clear(); for (const k in s) localStorage.setItem(k, s[k]); }, saved);
  await page.reload();
  await page.locator('#startBtn').click();
  await expect(page.locator('#wMenu')).toBeVisible();
}
const WATSON = {
  ww_profiles: JSON.stringify({ v: 1, cur: 'p1', list: [{ id: 'p1', name: 'Watson', face: 0 }] }),
  ww_p_p1_meta: JSON.stringify({ name: 'Watson', face: 0 }),
};

test('with an online and an on-device voice, only the on-device one is ever used', async ({ page }) => {
  await fakeVoices(page, [ONLINE, LOCAL]);
  await startWatson(page, Object.assign({ ty_voice: ONLINE.name }, WATSON));   // even an old saved choice of the online voice is ignored
  await expect.poll(() => page.evaluate(() => window.__said.length)).toBeGreaterThan(0);
  const said = await page.evaluate(() => window.__said);
  expect(said.every((s) => s.voice === LOCAL.name)).toBe(true);
});

test('with only an online voice, the device voice stays silent', async ({ page }) => {
  await fakeVoices(page, [ONLINE]);
  await startWatson(page, WATSON);
  await page.waitForTimeout(2500);
  expect(await page.evaluate(() => window.__said)).toEqual([]);
});
