// Sending an item home: in build mode a tap selects an item (the same ring as an animal), and the same Home button as for animals
// shows in the bar under the farm. Nothing is drawn over the item. Screenshots go to item-home-screenshots/.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { openWith, withFarm, farmNow, openFarm, openBarnyard, tapItem } = require('./helpers');

const SAVE = { v: 4, spent: 0, animals: ['pig', 'horse'], looks: {}, items: ['coop', 'trough', 'slide', 'hay'], away: [], pos: {}, areas: ['barnyard'] };
const SIZES = [[400, 780], [844, 390], [800, 1100], [1100, 800]];
const SHOTS = path.join(__dirname, '..', 'item-home-screenshots');

function overlap(a, b) { return a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5; }
async function building(page, save) {
  await openWith(page, withFarm(50, save || SAVE));
  await openFarm(page);
  await openBarnyard(page);
  await page.locator('#fHammer').click();
  await page.locator('#fShop .fx-close').click();   // the hammer opens the shop on its Barnyard tab
  await expect(page.locator('#fScene')).toHaveClass(/build/);
}
async function tapGround(page) { const b = await page.locator('#fScene').boundingBox(); await page.mouse.click(b.x + b.width * 0.75, b.y + b.height * 0.12); }
const bar = (page) => page.locator('.fbar2 button:visible').evaluateAll((els) => els.map((e) => e.id));
async function nothingOver(page, k) {
  const it = page.locator('#fLayer [data-i="' + k + '"]');
  await expect(it.locator('button, .fsend, svg + *')).toHaveCount(0);   // only its picture inside
  const ib = await it.locator('.fi-in').boundingBox();
  const btns = await page.locator('#farm button:visible').evaluateAll((els) => els.filter((e) => !e.closest('#fLayer')).map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, id: e.id || e.className }; }));
  btns.forEach((b) => expect(overlap(ib, b), 'button ' + b.id + ' over the ' + k).toBe(false));
}
async function listen(page) {
  await page.addInitScript(() => {
    window.__snd = 0;
    const P = (window.BaseAudioContext || window.AudioContext).prototype;
    ['createOscillator', 'createBufferSource'].forEach((m) => { const f = P[m]; P[m] = function () { window.__snd++; return f.apply(this, arguments); }; });
  });
}

test('no house button on items any more; selecting one shows Home in the bar and nothing over the item', async ({ page }) => {
  await building(page);
  await expect(page.locator('#fLayer .fsend')).toHaveCount(0);
  await expect(page.locator('#fSend')).toBeHidden();
  await tapItem(page, 'coop');
  await expect(page.locator('#fLayer [data-i="coop"]')).toHaveClass(/sel/);
  await expect(page.locator('#fLayer .sel')).toHaveCount(1);
  await expect(page.locator('.fbar2 #fSend')).toBeVisible();
  await expect(page.locator('#fSend')).toContainText('Home');
  expect(await bar(page)).toEqual(['fSend', 'fHammer']);   // no Feed, no paintbrush for an item
  await nothingOver(page, 'coop');
  // the ring is drawn under the item, like an animal's
  const ring = await page.locator('#fLayer [data-i="coop"]').evaluate((e) => getComputedStyle(e, '::after').backgroundColor);
  expect(ring).toBe('rgb(255, 214, 64)');
});

test('the same Home button as for animals: same place, size and style', async ({ page }) => {
  await building(page);
  await page.locator('#fLayer [data-a="pig"]').click();
  await page.waitForTimeout(1300);   // the paintbrush's glow and the pig's hop are over
  const asAnimal = await page.locator('#fSend').evaluate((e) => ({ w: e.offsetWidth, h: e.offsetHeight, cls: e.className, html: e.innerHTML, y: e.getBoundingClientRect().y }));
  await tapItem(page, 'trough');
  await expect(page.locator('#fLayer [data-i="trough"]')).toHaveClass(/sel/);
  const asItem = await page.locator('#fSend').evaluate((e) => ({ w: e.offsetWidth, h: e.offsetHeight, cls: e.className, html: e.innerHTML, y: e.getBoundingClientRect().y }));
  expect(asItem).toEqual(asAnimal);
});

test('tapping empty ground, or the item again, deselects it and hides Home', async ({ page }) => {
  await building(page);
  await tapItem(page, 'coop');
  await expect(page.locator('#fSend')).toBeVisible();
  await tapGround(page);
  await expect(page.locator('#fSend')).toBeHidden();
  await expect(page.locator('#fLayer .sel')).toHaveCount(0);
  await tapItem(page, 'coop');
  await expect(page.locator('#fSend')).toBeVisible();
  await tapItem(page, 'coop');
  await expect(page.locator('#fSend')).toBeHidden();
  await expect(page.locator('#fLayer .sel')).toHaveCount(0);
  // and leaving build mode lets a selected item go
  await tapItem(page, 'trough');
  await expect(page.locator('#fSend')).toBeVisible();
  await page.locator('#fHammer').click();
  await expect(page.locator('#fScene')).not.toHaveClass(/build/);
  await expect(page.locator('#fSend')).toBeHidden();
  await expect(page.locator('#fLayer .sel')).toHaveCount(0);
});

test('Home on an item: X keeps it, the check sends it home, and the barn brings it back free', async ({ page }) => {
  await building(page);
  await tapItem(page, 'coop');
  await page.locator('#fSend').click();
  await expect(page.locator('#fAsk')).toBeVisible();
  await expect(page.locator('#fAskYes')).toBeVisible();
  await expect(page.locator('#fAskNo')).toBeVisible();
  await expect(page.locator('#fAskPic svg').first()).toBeVisible();   // the coop, an arrow, the house
  // X: nothing changes
  await page.locator('#fAskNo').click();
  await expect(page.locator('#fAsk')).toBeHidden();
  await expect(page.locator('#fLayer [data-i="coop"]')).toBeVisible();
  let f = await farmNow(page);
  expect(f.away).toEqual([]);
  // the check: home it goes, and nothing is selected any more
  await page.locator('#fSend').click();
  await page.locator('#fAskYes').click();
  await expect(page.locator('#fLayer [data-i="coop"]')).toHaveCount(0);
  await expect(page.locator('#fSend')).toBeHidden();
  f = await farmNow(page);
  expect(f.away).toEqual(['coop']);
  expect(f.items).toContain('coop');   // still his
  expect(f.spent).toBe(0);
  // back, free, from the barn button
  await expect(page.locator('#fHomeBtn')).toBeVisible();
  await page.locator('#fHomeBtn').click();
  await page.locator('#fTiles [data-k="coop"]').click();
  await expect(page.locator('#fLayer [data-i="coop"]')).toBeVisible();
  f = await farmNow(page);
  expect(f.away).toEqual([]);
  expect(f.items).toContain('coop');
  expect(f.spent).toBe(0);
  await expect(page.locator('#fHomeBtn')).toBeHidden();
});

test('one thing selected at a time: animal to item and item to animal', async ({ page }) => {
  await building(page);
  await page.locator('#fLayer [data-a="pig"]').click();
  await expect(page.locator('#fPaint')).toBeVisible();
  await expect(page.locator('#fFeed')).toBeVisible();
  await tapItem(page, 'trough');
  await expect(page.locator('#fLayer [data-i="trough"]')).toHaveClass(/sel/);
  await expect(page.locator('#fLayer [data-a="pig"]')).not.toHaveClass(/sel/);
  await expect(page.locator('#fLayer .sel')).toHaveCount(1);
  await expect(page.locator('#fPaint')).toBeHidden();
  await expect(page.locator('#fFeed')).toBeHidden();
  await expect(page.locator('#fSend')).toBeVisible();
  await page.locator('#fLayer [data-a="horse"]').click();
  await expect(page.locator('#fLayer [data-a="horse"]')).toHaveClass(/sel/);
  await expect(page.locator('#fLayer [data-i="trough"]')).not.toHaveClass(/sel/);
  await expect(page.locator('#fLayer .sel')).toHaveCount(1);
  expect(await bar(page)).toEqual(['fSend', 'fFeed', 'fPaint', 'fHammer']);
  // Home now asks about the horse, not the trough
  await page.locator('#fSend').click();
  await page.locator('#fAskYes').click();
  const f = await farmNow(page);
  expect(f.away).toEqual(['horse']);
  expect(f.items).toContain('trough');
});

test('selecting an item makes no sound and says nothing', async ({ page }) => {
  await listen(page);
  await page.addInitScript(() => { window.__tts = 0; try { const s = speechSynthesis, f = s.speak.bind(s); s.speak = (u) => { window.__tts++; return f(u); }; } catch (e) {} });
  await building(page);
  await page.waitForTimeout(2500);   // the build line and the shop's sounds are over
  const n = await page.evaluate(() => window.__snd + window.__tts);
  await tapItem(page, 'coop');
  await tapItem(page, 'coop');
  await tapItem(page, 'slide');
  await tapGround(page);
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__snd + window.__tts)).toBe(n);
});

test('items outside build mode still cannot be selected or moved', async ({ page }) => {
  await openWith(page, withFarm(50, SAVE));
  await openFarm(page);
  await openBarnyard(page);
  const b = await page.locator('#fLayer [data-i="coop"] .fi-in').boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height * 0.7);
  await expect(page.locator('#fLayer [data-i="coop"]')).not.toHaveClass(/sel/);
  await expect(page.locator('#fSend')).toBeHidden();
});

test('old saves load unchanged, and selecting items saves nothing', async ({ page }) => {
  const s = JSON.stringify(Object.assign({}, SAVE, { away: ['slide'], pos: { coop: [70, 38] }, garden: { plots: [], picked: 2 } }));
  await building(page, s);
  await tapItem(page, 'coop');
  await tapGround(page);
  await tapItem(page, 'trough');
  await page.locator('#fSend').click();
  await page.locator('#fAskNo').click();
  expect(await page.evaluate(() => localStorage.getItem('ww_p_p1_ww_farm'))).toBe(s);
  await expect(page.locator('#fLayer [data-i="slide"]')).toHaveCount(0);   // still at home
  const old = JSON.stringify({ spent: 2, animals: ['pig'], decor: { pig: { hat: true } }, items: ['mud'] });   // the first save format
  await building(page, old);
  await tapItem(page, 'mud');
  await expect(page.locator('#fSend')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('ww_p_p1_ww_farm'))).toBe(old);
});

for (const [w, h] of SIZES) {
  test('the bar fits with an item selected at ' + w + 'x' + h, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await building(page, Object.assign({}, SAVE, { items: SAVE.items.concat('mud'), away: ['mud'] }));   // something at home: the barn button shows too
    await tapItem(page, 'coop');
    await expect(page.locator('#fSend')).toBeVisible();
    await page.waitForTimeout(400);
    const btns = await page.locator('.fbar2 button:visible').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, id: e.id }; }));
    expect(btns.map((b) => b.id)).toEqual(['fHomeBtn', 'fSend', 'fHammer']);
    btns.forEach((b) => {
      expect(b.width, b.id).toBeGreaterThanOrEqual(48); expect(b.height, b.id).toBeGreaterThanOrEqual(48);
      expect(b.x, b.id).toBeGreaterThanOrEqual(0); expect(b.x + b.width, b.id).toBeLessThanOrEqual(w); expect(b.y + b.height, b.id).toBeLessThanOrEqual(h);
    });
    for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) expect(overlap(btns[i], btns[j]), btns[i].id + ' / ' + btns[j].id).toBe(false);
    expect(overlap(await page.locator('.fbar2').boundingBox(), await page.locator('#fScene').boundingBox()), 'bar over the field').toBe(false);
    await nothingOver(page, 'coop');
    await page.screenshot({ path: path.join(SHOTS, 'item-selected-' + w + 'x' + h + '.png') });
  });
}
