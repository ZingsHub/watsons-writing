// The 10 s idle reminder ("Welcome, writer!") is for the child: it never plays on a Grown-ups screen,
// and still plays on the child's menu as before.
const { test, expect } = require('@playwright/test');
const { openWith, tapStart, grownUps, WATSON } = require('./helpers');

// count what actually plays: her clips (Web Audio or an audio element) and the device voice
async function listen(page) {
  await page.addInitScript(() => {
    window.__tts = []; window.__play = 0;
    try { const s = speechSynthesis, f = s.speak.bind(s); s.speak = (u) => { window.__tts.push(u.text); return f(u); }; } catch (e) {}
    const P = (window.BaseAudioContext || window.AudioContext).prototype, b = P.createBufferSource; P.createBufferSource = function () { window.__play++; return b.apply(this, arguments); };
    const pl = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { if (this.src && !/^data:/.test(this.src)) window.__play++; return pl.apply(this, arguments); };
  });
}
const heard = (page) => page.evaluate(() => window.__play + window.__tts.length);
async function quiet(page, what) {
  await page.waitForTimeout(800);   // the tap's own pop is over
  const n = await heard(page);
  await page.waitForTimeout(12000);   // longer than the 10 s idle reminder
  expect(await heard(page), what).toBe(n);
}

const SCREENS = {
  'Grown-ups menu': async () => {},
  'Progress report': async (page) => {
    await page.locator('#gRepBtn').click();
    const kid = page.locator('#gRepKids .pkid');
    if (await kid.count()) await kid.first().click();
    await expect(page.locator('#gRep')).toBeVisible();
  },
  'Share': async (page) => { await page.locator('#gShareBtn').click(); await expect(page.locator('#gShare')).toBeVisible(); },
  'Class view': async (page) => { await page.locator('#gClassBtn').click(); await expect(page.locator('#gClass')).toBeVisible(); },
  'Add a child': async (page) => { await page.locator('#gAdd').click(); await expect(page.locator('#gEdit')).toBeVisible(); },
  'Privacy': async (page) => { await page.locator('#gPrivBtn').click(); await expect(page.locator('#gPriv')).toBeVisible(); },
};

for (const [name, go] of Object.entries(SCREENS)) {
  test('no idle reminder on Grown-ups > ' + name, async ({ page }) => {
    await listen(page);
    await openWith(page, WATSON);
    await tapStart(page);
    await grownUps(page);
    await go(page);
    await quiet(page, name);
  });
}

test('the idle reminder still plays on the child\'s menu, and again after leaving Grown-ups', async ({ page }) => {
  test.setTimeout(90000);   // her welcome, then 10 s of quiet (about 16 s), twice
  await listen(page);
  await openWith(page, WATSON);
  await tapStart(page);
  await page.waitForTimeout(800);
  let n = await heard(page);
  await expect.poll(() => heard(page), { timeout: 25000 }).toBeGreaterThan(n);
  // into Grown-ups and back out: the menu talks again
  await grownUps(page);
  await page.locator('#topBack').click();
  await expect(page.locator('#wMenu')).toBeVisible();
  await page.waitForTimeout(800);
  n = await heard(page);
  await expect.poll(() => heard(page), { timeout: 25000 }).toBeGreaterThan(n);
});
