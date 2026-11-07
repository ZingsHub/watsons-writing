// Sending an animal home: the Home button sits in the bar under the farm (next to the paintbrush) while an animal is selected,
// nothing is drawn over the animal, and the selection is easy to dismiss. Screenshots go to farm-home-screenshots/.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { openWith, withFarm, farmNow, openFarm, openBarnyard } = require('./helpers');

const SAVE = { v: 4, spent: 0, animals: ['pig', 'horse'], looks: {}, items: ['mud'], away: [], pos: {}, areas: ['barnyard'] };
const SIZES = [[400, 780], [844, 390], [800, 1100], [1100, 800]];
const SHOTS = path.join(__dirname, '..', 'farm-home-screenshots');

function overlap(a, b) { return a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5; }
async function farmAt(page, save) { await openWith(page, withFarm(50, save || SAVE)); await openFarm(page); await openBarnyard(page); }
// empty sky over the field: no animal, item or button there
async function tapGround(page) { const b = await page.locator('#fScene').boundingBox(); await page.mouse.click(b.x + b.width * 0.75, b.y + b.height * 0.12); }
async function nothingOver(page, id) {
  const a = page.locator('#fLayer [data-a="' + id + '"]');
  await expect(a.locator('button, .fsend')).toHaveCount(0);   // nothing drawn on the animal itself
  const ab = await a.boundingBox();
  const btns = await page.locator('#farm button:visible').evaluateAll((els) => els.filter((e) => !e.closest('#fLayer')).map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, id: e.id || e.className }; }));
  btns.forEach((b) => expect(overlap(ab, b), 'button ' + b.id + ' over the ' + id).toBe(false));
}

test('tapping an animal shows Home and the paintbrush in the bar, with nothing over the animal', async ({ page }) => {
  await farmAt(page);
  await expect(page.locator('#fSend')).toBeHidden();
  await expect(page.locator('#fPaint')).toBeHidden();
  await page.locator('#fLayer [data-a="pig"]').click();
  await expect(page.locator('#fLayer [data-a="pig"]')).toHaveClass(/sel/);
  await expect(page.locator('.fbar2 #fSend')).toBeVisible();
  await expect(page.locator('#fSend')).toContainText('Home');
  await expect(page.locator('#fPaint')).toBeVisible();
  await nothingOver(page, 'pig');
  // same size as the paintbrush (its layout size: the paintbrush glows bigger for a moment when it appears)
  const size = (sel) => page.locator(sel).evaluate((e) => [e.offsetWidth, e.offsetHeight]);
  expect(await size('#fSend')).toEqual(await size('#fPaint'));
  // in build mode too: nothing drawn on the animals or the items (items use the same Home button: item-home.spec.js)
  await page.locator('#fHammer').click();
  await page.locator('#fShop .fx-close').click();
  await expect(page.locator('#fLayer .fsend')).toHaveCount(0);
  await expect(page.locator('#fLayer [data-i="mud"] button')).toHaveCount(0);
});

test('tapping empty ground deselects and hides the animal\'s buttons', async ({ page }) => {
  await farmAt(page);
  await page.locator('#fLayer [data-a="pig"]').click();
  await expect(page.locator('#fSend')).toBeVisible();
  await tapGround(page);
  await expect(page.locator('#fSend')).toBeHidden();
  await expect(page.locator('#fPaint')).toBeHidden();
  await expect(page.locator('#fLayer [data-a="pig"]')).not.toHaveClass(/sel/);
});

test('tapping the selected animal again deselects it; tapping another switches', async ({ page }) => {
  await farmAt(page);
  await page.locator('#fLayer [data-a="pig"]').click();
  await page.locator('#fLayer [data-a="horse"]').click();
  await expect(page.locator('#fLayer [data-a="horse"]')).toHaveClass(/sel/);
  await expect(page.locator('#fLayer [data-a="pig"]')).not.toHaveClass(/sel/);
  await expect(page.locator('#fSend')).toBeVisible();
  await page.locator('#fLayer [data-a="horse"]').click();
  await expect(page.locator('#fLayer [data-a="horse"]')).not.toHaveClass(/sel/);
  await expect(page.locator('#fSend')).toBeHidden();
});

test('Home asks first (X keeps it, check sends it home), and the barn brings it back', async ({ page }) => {
  await farmAt(page);
  await page.locator('#fLayer [data-a="pig"]').click();
  await page.locator('#fSend').click();
  await expect(page.locator('#fAsk')).toBeVisible();
  await page.locator('#fAskNo').click();
  await expect(page.locator('#fAsk')).toBeHidden();
  await expect(page.locator('#fLayer [data-a="pig"]')).toBeVisible();
  expect((await farmNow(page)).away).toEqual([]);
  await page.locator('#fSend').click();
  await page.locator('#fAskYes').click();
  await expect(page.locator('#fLayer [data-a="pig"]')).toHaveCount(0);
  await expect(page.locator('#fSend')).toBeHidden();
  await expect(page.locator('#fPaint')).toBeHidden();
  const f = await farmNow(page);
  expect(f.away).toEqual(['pig']);
  expect(f.animals).toContain('pig');   // still his
  await page.locator('#fHomeBtn').click();
  await page.locator('#fTiles [data-k="pig"]').click();
  await expect(page.locator('#fLayer [data-a="pig"]')).toBeVisible();
  expect((await farmNow(page)).away).toEqual([]);
});

test('the paintbrush still opens the shop on the selected animal', async ({ page }) => {
  await farmAt(page);
  await page.locator('#fLayer [data-a="horse"]').click();
  await page.locator('#fPaint').click();
  await expect(page.locator('#fShop')).toBeVisible();
  await expect(page.locator('#fShopTabs [data-tab="horse"]')).toHaveClass(/on/);
});

test('a save with an animal already at home loads as before', async ({ page }) => {
  const save = JSON.stringify(Object.assign({}, SAVE, { away: ['horse'] }));
  await openWith(page, withFarm(50, save));
  await openFarm(page);
  await openBarnyard(page);
  await expect(page.locator('#fLayer [data-a="horse"]')).toHaveCount(0);
  await expect(page.locator('#fLayer [data-a="pig"]')).toBeVisible();
  await expect(page.locator('#fHomeBtn')).toBeVisible();
  expect((await page.evaluate(() => localStorage.getItem('ww_p_p1_ww_farm')))).toBe(save);
});

for (const [w, h] of SIZES) {
  test('the bar fits with an animal selected at ' + w + 'x' + h, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await farmAt(page, Object.assign({}, SAVE, { away: ['mud'], items: ['mud'] }));   // something at home: the barn button shows too
    await page.locator('#fLayer [data-a="pig"]').click();
    await expect(page.locator('#fSend')).toBeVisible();
    const bar = await page.locator('.fbar2').boundingBox(), scene = await page.locator('#fScene').boundingBox();
    expect(overlap(bar, scene), 'bar over the farm').toBe(false);
    const btns = await page.locator('.fbar2 button:visible').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, id: e.id }; }));
    expect(btns.map((b) => b.id)).toEqual(['fHomeBtn', 'fSend', 'fFeed', 'fPaint', 'fHammer']);
    btns.forEach((b) => {
      expect(b.x, b.id).toBeGreaterThanOrEqual(0); expect(b.x + b.width, b.id).toBeLessThanOrEqual(w);
      expect(b.y + b.height, b.id).toBeLessThanOrEqual(h); expect(b.height, b.id).toBeGreaterThanOrEqual(48); expect(b.width, b.id).toBeGreaterThanOrEqual(48);
    });
    for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) expect(overlap(btns[i], btns[j]), btns[i].id + ' / ' + btns[j].id).toBe(false);
    // the zoom buttons stay clear of the bar and of the selected animal
    const zoom = await page.locator('.fzoom').boundingBox();
    expect(overlap(zoom, bar)).toBe(false);
    await nothingOver(page, 'pig');
    await page.screenshot({ path: path.join(SHOTS, 'selected-' + w + 'x' + h + '.png') });
  });
}
