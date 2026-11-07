// Feeding: vegetables picked in the garden (garden.picked) feed the animals in the Barnyard, one at a time.
// No stars, no new save fields. Screenshots go to feed-screenshots/.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { openWith, withFarm, farmNow, openFarm, openBarnyard } = require('./helpers');

const SIZES = [[400, 780], [844, 390], [800, 1100], [1100, 800]];
const SHOTS = path.join(__dirname, '..', 'feed-screenshots');
const now = Date.now();
function save(picked, extra) {
  return Object.assign({ v: 4, spent: 0, animals: ['pig', 'horse'], looks: {}, items: [], away: [], pos: {}, areas: ['barnyard', 'shed', 'house'],
    garden: { plots: ['carrot', 'tomato', 'pumpkin', 'corn'].map((v) => ({ v, t: now })), picked } }, extra || {});
}
function overlap(a, b) { return a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5; }
async function listen(page) {
  const clips = [];
  page.on('request', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/audio/') && u.pathname.endsWith('.mp3')) clips.push(u.pathname); });
  await page.addInitScript(() => {
    window.__snd = 0;
    const P = (window.BaseAudioContext || window.AudioContext).prototype;
    ['createOscillator', 'createBufferSource'].forEach((m) => { const f = P[m]; P[m] = function () { window.__snd++; return f.apply(this, arguments); }; });
  });
  return clips;
}
const snd = (page) => page.evaluate(() => window.__snd);
async function barnyard(page, s) { await openWith(page, withFarm(50, s)); await openFarm(page); await openBarnyard(page); }
async function tapGround(page) { const b = await page.locator('#fScene').boundingBox(); await page.mouse.click(b.x + b.width * 0.5, b.y + b.height * 0.1); }

test('the basket count shows on the Barnyard', async ({ page }) => {
  await barnyard(page, save(5));
  await expect(page.locator('#fBasketBy')).toBeVisible();
  await expect(page.locator('#fBasketN')).toHaveText('5');
  await expect(page.locator('#fBasketBy svg')).toHaveCount(1);
});

test('Feed shows with Home and the paintbrush, and hides when deselected', async ({ page }) => {
  await barnyard(page, save(5));
  await expect(page.locator('#fFeed')).toBeHidden();
  await page.locator('#fLayer [data-a="pig"]').click();
  await expect(page.locator('#fFeed')).toBeVisible();
  await expect(page.locator('#fFeed')).toContainText('Feed');
  await expect(page.locator('#fFeedN')).toHaveText('5');
  const size = (sel) => page.locator(sel).evaluate((e) => [e.offsetWidth, e.offsetHeight]);
  expect(await size('#fFeed')).toEqual(await size('#fSend'));
  expect(await size('#fFeed')).toEqual(await size('#fPaint'));
  await tapGround(page);
  await expect(page.locator('#fFeed')).toBeHidden();
  await page.locator('#fLayer [data-a="horse"]').click();
  await expect(page.locator('#fFeed')).toBeVisible();
  await page.locator('#fLayer [data-a="horse"]').click();
  await expect(page.locator('#fFeed')).toBeHidden();
});

test('feeding uses one vegetable: it pops up, gets eaten, and the animal hops and makes its sound', async ({ page }) => {
  const clips = await listen(page);
  await barnyard(page, save(5));
  await page.locator('#fLayer [data-a="pig"]').click();
  await page.waitForTimeout(1500);   // the tap's own hop and sound are over
  const n0 = await snd(page), c0 = clips.length;
  await page.locator('#fFeed').click();
  await expect(page.locator('#fBasketN')).toHaveText('4');
  await expect(page.locator('#fFeedN')).toHaveText('4');
  const food = page.locator('#fLayer .ffood');
  await expect(food).toHaveCount(1);
  expect(['carrot', 'tomato', 'pumpkin', 'corn']).toContain(await food.getAttribute('data-veg'));
  await expect(page.locator('#fLayer [data-a="pig"] .fa-hop')).toHaveClass(/hop/);
  await expect(food).toHaveCount(0, { timeout: 3000 });   // eaten
  await expect.poll(async () => (await snd(page)) > n0 || clips.length > c0).toBe(true);
  const f = await farmNow(page);
  expect(f.garden.picked).toBe(4);
  expect(f.spent).toBe(0);   // no stars spent or paid
  expect(await page.evaluate(() => localStorage.getItem('ww_p_p1_ty_stars'))).toBe('50');
  await expect(page.locator('#fLayer [data-a="pig"]')).toHaveClass(/sel/);   // still selected
});

test('an empty basket: Feed is dimmed with 0, and tapping it only wiggles the basket', async ({ page }) => {
  const s = JSON.stringify(save(0));
  await barnyard(page, s);
  await page.locator('#fLayer [data-a="pig"]').click();
  await expect(page.locator('#fFeed')).toHaveClass(/empty/);
  await expect(page.locator('#fFeedN')).toHaveText('0');
  await page.locator('#fFeed').click();
  await expect(page.locator('#fBasketBy')).toHaveClass(/shake/);
  await expect(page.locator('#fLayer .ffood')).toHaveCount(0);
  await expect(page.locator('#fBasketN')).toHaveText('0');
  expect(await page.evaluate(() => localStorage.getItem('ww_p_p1_ww_farm'))).toBe(s);   // nothing saved
  await expect(page.locator('#toast')).not.toHaveClass(/on/);   // no message
});

test('the count never goes below 0', async ({ page }) => {
  await barnyard(page, save(1));
  await page.locator('#fLayer [data-a="horse"]').click();
  for (let i = 0; i < 4; i++) await page.locator('#fFeed').click();
  await expect(page.locator('#fBasketN')).toHaveText('0');
  expect((await farmNow(page)).garden.picked).toBe(0);
  // a damaged save with a negative count loads as 0 and stays 0
  await openWith(page, withFarm(50, save(-3)));
  await openFarm(page);
  await openBarnyard(page);
  await expect(page.locator('#fBasketN')).toHaveText('0');
  await page.locator('#fLayer [data-a="pig"]').click();
  await page.locator('#fFeed').click();
  await expect(page.locator('#fBasketN')).toHaveText('0');
});

test('muted: feeding still works, with no sound at all', async ({ page }) => {
  const clips = await listen(page);
  await openWith(page, withFarm(50, save(3)));
  await page.locator('#startBtn').click();
  await page.locator('#mute').click();
  await page.locator('#wMenu [data-m="farm"]').click();
  await openBarnyard(page);
  const n0 = await snd(page), c0 = clips.length;
  await page.locator('#fLayer [data-a="pig"]').click();
  await page.locator('#fFeed').click();
  await expect(page.locator('#fBasketN')).toHaveText('2');
  await page.waitForTimeout(1500);
  expect(await snd(page)).toBe(n0);
  expect(clips.length).toBe(c0);
});

test('sounds stop when leaving My Farm after feeding', async ({ page }) => {
  await listen(page);
  await barnyard(page, save(3));
  await page.locator('#fLayer [data-a="pig"]').click();
  await page.locator('#fFeed').click();
  await page.locator('#topBack').click();
  await page.locator('#topBack').click();
  await expect(page.locator('#wMenu')).toBeVisible();
  await page.waitForTimeout(800);
  const n = await snd(page);
  await page.waitForTimeout(2500);
  expect(await snd(page)).toBe(n);
});

test('old saves load unchanged: with a basket, and from before the garden existed', async ({ page }) => {
  const s = JSON.stringify(save(7));
  await barnyard(page, s);
  await expect(page.locator('#fBasketN')).toHaveText('7');
  expect(await page.evaluate(() => localStorage.getItem('ww_p_p1_ww_farm'))).toBe(s);
  const old = JSON.stringify({ spent: 2, animals: ['pig'], decor: { pig: { hat: true } }, items: ['mud'] });   // the first save format
  await openWith(page, withFarm(20, old));
  await openFarm(page);
  await openBarnyard(page);
  await expect(page.locator('#fBasketN')).toHaveText('0');
  expect(await page.evaluate(() => localStorage.getItem('ww_p_p1_ww_farm'))).toBe(old);
});

test('picking in the garden still adds to the basket (no stars), and the Barnyard shows it', async ({ page }) => {
  const ripe = save(2); ripe.garden.plots[0].t = 0;   // planted long ago: ready
  await openWith(page, withFarm(50, ripe));
  await openFarm(page);
  await page.locator('#fMap [data-area="house"]').click();
  await expect(page.locator('#fPlots [data-p="0"]')).toHaveClass(/ripe/);
  await page.locator('#fPlots [data-p="0"]').click();
  await expect(page.locator('#fPicked')).toHaveText('3');
  let f = await farmNow(page);
  expect(f.garden.picked).toBe(3);
  expect(f.garden.plots[0].t).toBeGreaterThan(Date.now() - 60000);   // replanted
  expect(f.spent).toBe(0);
  // not ready: just a wiggle
  await page.locator('#fPlots [data-p="1"]').click();
  await expect(page.locator('#fPicked')).toHaveText('3');
  await page.locator('#topBack').click();
  await openBarnyard(page);
  await expect(page.locator('#fBasketN')).toHaveText('3');
  expect(await page.evaluate(() => localStorage.getItem('ww_p_p1_ty_stars'))).toBe('50');
});

for (const [w, h] of SIZES) {
  for (const n of [6, 0]) {
    test('the bar and basket fit at ' + w + 'x' + h + ' with ' + (n ? 'a full' : 'an empty') + ' basket', async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await barnyard(page, save(n, { items: ['mud'], away: ['mud'] }));   // something at home: the barn button shows too (5 buttons)
      await page.locator('#fLayer [data-a="pig"]').click();
      await expect(page.locator('#fFeed')).toBeVisible();
      await page.waitForTimeout(1300);   // the paintbrush's glow and the pig's hop are over
      const btns = await page.locator('.fbar2 button:visible').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, id: e.id }; }));
      expect(btns.map((b) => b.id)).toEqual(['fHomeBtn', 'fSend', 'fFeed', 'fPaint', 'fHammer']);
      btns.forEach((b) => {
        expect(b.width, b.id).toBeGreaterThanOrEqual(48); expect(b.height, b.id).toBeGreaterThanOrEqual(48);
        expect(b.x, b.id).toBeGreaterThanOrEqual(0); expect(b.x + b.width, b.id).toBeLessThanOrEqual(w); expect(b.y + b.height, b.id).toBeLessThanOrEqual(h);
      });
      for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) expect(overlap(btns[i], btns[j]), btns[i].id + ' / ' + btns[j].id).toBe(false);
      const scene = await page.locator('#fScene').boundingBox(), bar = await page.locator('.fbar2').boundingBox();
      const basket = await page.locator('#fBasketBy').boundingBox(), zoom = await page.locator('.fzoom').boundingBox();
      expect(overlap(bar, scene), 'bar over the field').toBe(false);
      expect(basket.x).toBeGreaterThanOrEqual(scene.x); expect(basket.x + basket.width).toBeLessThanOrEqual(scene.x + scene.width);
      expect(basket.y).toBeGreaterThanOrEqual(scene.y); expect(basket.y + basket.height).toBeLessThanOrEqual(scene.y + scene.height);
      expect(overlap(basket, zoom), 'basket / zoom buttons').toBe(false);
      for (const a of ['pig', 'horse']) expect(overlap(basket, await page.locator('#fLayer [data-a="' + a + '"]').boundingBox()), 'basket / ' + a).toBe(false);
      await page.screenshot({ path: path.join(SHOTS, 'feed-' + (n ? 'full' : 'empty') + '-' + w + 'x' + h + '.png') });
    });
  }
}
