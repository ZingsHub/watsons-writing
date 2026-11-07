// The shop and its preview at phone and tablet sizes: nothing overlapping or off screen, and big tap targets.
// Screenshots go to shop-screenshots/ (next to public/).
const { test, expect } = require('@playwright/test');
const path = require('path');
const { openWith, withFarm, openFarm, openShop } = require('./helpers');

const SIZES = [[400, 780], [844, 390], [800, 1100], [1100, 800]];
const SHOTS = path.join(__dirname, '..', 'shop-screenshots');
const TAP = 48;   // smallest tap target, px
const SAVE = { v: 4, spent: 0, animals: ['pig'], looks: {}, items: [], away: [], pos: {}, areas: ['barnyard'] };

function overlap(a, b) { return a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5; }
async function boxes(page, sel) { return page.locator(sel).evaluateAll((els) => els.filter((e) => e.offsetParent).map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, id: e.id || e.getAttribute('data-e') || e.getAttribute('data-tab') || e.className }; })); }
function noOverlap(list, what) { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) expect(overlap(list[i], list[j]), what + ': ' + list[i].id + ' / ' + list[j].id).toBe(false); }
function inside(b, w, h, what) {
  expect(b.x, what + ' left').toBeGreaterThanOrEqual(-0.5); expect(b.y, what + ' top').toBeGreaterThanOrEqual(-0.5);
  expect(b.x + b.width, what + ' right').toBeLessThanOrEqual(w + 0.5); expect(b.y + b.height, what + ' bottom').toBeLessThanOrEqual(h + 0.5);
}
function big(list, what) { list.forEach((b) => { expect(b.width, what + ' ' + b.id + ' width').toBeGreaterThanOrEqual(TAP); expect(b.height, what + ' ' + b.id + ' height').toBeGreaterThanOrEqual(TAP); }); }

async function checkShop(page, w, h) {
  inside(await page.locator('#fShop .fshop').boundingBox(), w, h, 'shop card');
  const tabs = await boxes(page, '#fShopTabs [data-tab]'), close = await boxes(page, '#fShop .fx-close');
  tabs.forEach((b) => inside(b, w, h, 'tab ' + b.id));
  noOverlap(tabs.concat(close), 'tabs');
  big(tabs.concat(close), 'tap');
  const tiles = await boxes(page, '#fShopBody [data-e]'), icons = await boxes(page, '#fShopBody .fsrow-ic');
  noOverlap(tiles.concat(icons), 'tiles');
  big(tiles, 'tile');
  const body = await page.locator('#fShopBody').evaluate((e) => ({ sw: e.scrollWidth, cw: e.clientWidth }));
  expect(body.sw, 'no sideways scroll in the shop').toBeLessThanOrEqual(body.cw + 1);
  // the body starts below the tabs
  const bb = await page.locator('#fShopBody').boundingBox();
  tabs.forEach((b) => expect(b.y + b.height, 'tab above the list').toBeLessThanOrEqual(bb.y + 1));
}
async function checkPreview(page, w, h) {
  const card = page.locator('#fPv .fpv');
  inside(await card.boundingBox(), w, h, 'preview card');
  const fit = await card.evaluate((e) => ({ sh: e.scrollHeight, ch: e.clientHeight }));
  expect(fit.sh, 'preview fits without scrolling').toBeLessThanOrEqual(fit.ch + 1);
  const parts = await boxes(page, '#fPvT, #fPvS, #fPvPic, #fPvNote, #fPvBack, #fPvBuy');
  parts.forEach((b) => inside(b, w, h, b.id));
  noOverlap(parts, 'preview');
  big(await boxes(page, '#fPvBack, #fPvBuy'), 'preview button');
  // the drawing itself (hats and hair reach past the picture's edges) stays clear of the words and buttons
  const art = await page.locator('#fPvPic > svg').evaluate((svg) => {
    let r = null;
    svg.querySelectorAll('path, rect, circle, ellipse, polygon').forEach((e) => {
      const b = e.getBoundingClientRect(); if (!b.width && !b.height) return;
      r = r ? { l: Math.min(r.l, b.left), t: Math.min(r.t, b.top), r: Math.max(r.r, b.right), b: Math.max(r.b, b.bottom) } : { l: b.left, t: b.top, r: b.right, b: b.bottom };
    });
    return { x: r.l, y: r.t, width: r.r - r.l, height: r.b - r.t, id: 'drawing' };
  });
  inside(art, w, h, 'drawing');
  noOverlap([art].concat(parts.filter((b) => b.id !== 'fPvPic')), 'drawing');
}

for (const [w, h] of SIZES) {
  test('shop and previews fit at ' + w + 'x' + h, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await openWith(page, withFarm(5, SAVE));   // 5 stars: some things affordable, some not
    await openFarm(page);
    big(await boxes(page, '#fShopMap'), 'map shop button');
    await openShop(page, 'pig');
    await checkShop(page, w, h);
    await page.screenshot({ path: path.join(SHOTS, 'shop-' + w + 'x' + h + '.png') });
    // an animal item
    await page.locator('[data-e="look:hat:pig"]').click();
    await expect(page.locator('#fPv')).toBeVisible();
    await checkPreview(page, w, h);
    await page.screenshot({ path: path.join(SHOTS, 'preview-animal-' + w + 'x' + h + '.png') });
    await page.locator('#fPvBack').click();
    // a farm item
    await page.locator('#fShopTabs [data-tab="barnyard"]').click();
    await checkShop(page, w, h);
    await page.locator('[data-e="item:puddle:"]').click();
    await checkPreview(page, w, h);
    await page.screenshot({ path: path.join(SHOTS, 'preview-farm-' + w + 'x' + h + '.png') });
    await page.locator('#fPvBack').click();
    // a locked item: the tab, then its preview
    await page.locator('#fShopTabs [data-tab="horse"]').click();
    await checkShop(page, w, h);
    await page.screenshot({ path: path.join(SHOTS, 'locked-tab-' + w + 'x' + h + '.png') });
    await page.locator('[data-e="look:rainbow:horse"]').click();
    await checkPreview(page, w, h);
    await expect(page.locator('#fPvBuy')).toBeDisabled();
    await page.screenshot({ path: path.join(SHOTS, 'locked-preview-' + w + 'x' + h + '.png') });
  });
}
