// My Farm as it was before the shop change: the map and its areas, the Barnyard (animals, build mode, send home),
// the Tractor Shed and Farmhouse screens, and sounds (only in My Farm, none when muted).
const { test, expect } = require('@playwright/test');
const { openWith, withFarm, farmNow, openFarm, openBarnyard, tapItem } = require('./helpers');

const SAVE = { v: 4, spent: 0, animals: ['pig', 'horse'], looks: { pig: { own: ['crown'], wear: { head: 'crown' } } }, items: ['mud', 'hay'], away: [], pos: {}, areas: ['barnyard'] };

// count every sound the page starts (beeps, animal sounds and her clips all go through Web Audio)
async function countSounds(page) {
  await page.addInitScript(() => {
    window.__snd = 0;
    const P = (window.BaseAudioContext || window.AudioContext).prototype;
    ['createOscillator', 'createBufferSource'].forEach((m) => { const f = P[m]; P[m] = function () { window.__snd++; return f.apply(this, arguments); }; });
  });
}
const sounds = (page) => page.evaluate(() => window.__snd);

test('the map: three areas, locked ones show a lock and price, unlocking costs its stars', async ({ page }) => {
  await openWith(page, withFarm(20, SAVE));
  await openFarm(page);
  await expect(page.locator('#fMap .fmarea')).toHaveCount(3);
  await expect(page.locator('#fMap [data-area="barnyard"]')).not.toHaveClass(/locked/);
  await expect(page.locator('#fMap [data-area="shed"]')).toHaveClass(/locked/);
  await expect(page.locator('#fMap [data-area="shed"] .fmprice')).toHaveText('★6');
  await expect(page.locator('#fMap [data-area="house"] .fmprice')).toHaveText('★12');
  await page.locator('#fMap [data-area="shed"]').click();
  await expect(page.locator('#fUnlock')).toBeVisible();
  await page.locator('#fUnlBuy').click();
  await expect(page.locator('#fMap [data-area="shed"]')).not.toHaveClass(/locked/);
  const f = await farmNow(page);
  expect(f.areas).toEqual(['barnyard', 'shed']);
  expect(f.spent).toBe(6);
  await page.locator('#topBack').click();
  await expect(page.locator('#wMenu')).toBeVisible();
});

test('a locked area he cannot afford just wiggles', async ({ page }) => {
  await openWith(page, withFarm(3, SAVE));
  await openFarm(page);
  await page.locator('#fMap [data-area="shed"]').click();
  await expect(page.locator('#fUnlock')).toBeHidden();
  expect((await farmNow(page)).areas).toEqual(['barnyard']);
});

test('the Barnyard: animals and items drawn, tap selects, Back goes to the map then out', async ({ page }) => {
  await openWith(page, withFarm(50, SAVE));
  await openFarm(page);
  await openBarnyard(page);
  await expect(page.locator('#fLayer .fa')).toHaveCount(2);
  await expect(page.locator('#fLayer [data-i="mud"]')).toBeVisible();
  await expect(page.locator('#fLayer [data-i="hay"]')).toBeVisible();
  await page.locator('#fLayer [data-a="pig"]').click();
  await expect(page.locator('#fLayer [data-a="pig"]')).toHaveClass(/sel/);
  await expect(page.locator('#fPaint')).toBeVisible();
  await page.locator('#fZIn').click();
  await page.locator('#fZFit').click();
  await page.locator('#topBack').click();
  await expect(page.locator('#fMap .fmarea').first()).toBeVisible();
  await page.locator('#topBack').click();
  await expect(page.locator('#wMenu')).toBeVisible();
});

test('build mode: send an item home and bring it back, free', async ({ page }) => {
  await openWith(page, withFarm(50, SAVE));
  await openFarm(page);
  await openBarnyard(page);
  await page.locator('#fHammer').click();
  await expect(page.locator('#fScene')).toHaveClass(/build/);
  await page.locator('#fShop .fx-close').click();   // the hammer opens the shop on its Barnyard tab
  await expect(page.locator('#fScene')).toHaveClass(/build/);
  await tapItem(page, 'hay');   // in build mode a tap selects it
  await page.locator('#fSend').click();
  await page.locator('#fAskYes').click();
  await expect(page.locator('#fLayer [data-i="hay"]')).toHaveCount(0);
  let f = await farmNow(page);
  expect(f.away).toEqual(['hay']);
  expect(f.items).toContain('hay');   // still his
  await page.locator('#fHomeBtn').click();
  await page.locator('#fTiles [data-k="hay"]').click();
  await expect(page.locator('#fLayer [data-i="hay"]')).toBeVisible();
  f = await farmNow(page);
  expect(f.away).toEqual([]);
  expect(f.spent).toBe(0);
});

test('Tractor Shed and Farmhouse screens: free paint and wheels, garden picking', async ({ page }) => {
  await openWith(page, withFarm(50, Object.assign({}, SAVE, { areas: ['barnyard', 'shed', 'house'] })));
  await openFarm(page);
  await page.locator('#fMap [data-area="shed"]').click();
  await expect(page.locator('#fVeh')).toBeVisible();
  await page.locator('#fTools [data-c="5"]').click();
  await page.locator('#fTools [data-w="star"]').click();
  let f = await farmNow(page);
  expect(f.shed.look.tractor).toEqual({ c: 5, d: 'none', w: 'star' });
  expect(f.spent).toBe(0);
  await page.locator('#fVeh').click();   // honk and drive
  await page.locator('#topBack').click();
  await page.locator('#fMap [data-area="house"]').click();
  await expect(page.locator('#fPlots .fplot')).toHaveCount(4);
  await page.locator('#fTools [data-wall="2"]').click();
  expect((await farmNow(page)).house.wall).toBe(2);
});

test('sounds play in My Farm, stop when leaving it, and none play when muted', async ({ page }) => {
  await countSounds(page);
  await openWith(page, withFarm(50, SAVE));
  await openFarm(page);
  await openBarnyard(page);
  const n0 = await sounds(page);
  await page.locator('#fLayer [data-a="pig"]').click();
  await expect.poll(() => sounds(page)).toBeGreaterThan(n0);
  // the shop's preview and buying make the usual pops and chimes
  const n1 = await sounds(page);
  await page.locator('#fPaint').click();
  await page.locator('[data-e="look:bow:pig"]').click();
  await page.locator('#fPvBuy').click();
  await expect.poll(() => sounds(page)).toBeGreaterThan(n1);
  // leave My Farm: nothing more from the farm
  await page.locator('#fShop .fx-close').click().catch(() => {});
  await page.locator('#topBack').click();
  await page.locator('#topBack').click();
  await expect(page.locator('#wMenu')).toBeVisible();
  await page.waitForTimeout(800);
  const n2 = await sounds(page);
  await page.waitForTimeout(3000);
  expect(await sounds(page)).toBe(n2);
  // muted: tapping an animal makes no sound
  await page.locator('#mute').click();
  await page.locator('#wMenu [data-m="farm"]').click();
  await openBarnyard(page);
  const n3 = await sounds(page);
  await page.locator('#fLayer [data-a="pig"]').click();
  await page.waitForTimeout(800);
  expect(await sounds(page)).toBe(n3);
});
