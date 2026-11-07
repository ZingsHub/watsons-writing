// The first-run screen at phone and tablet sizes: everything on screen, nothing overlapping,
// and Start still in view when the on-screen keyboard is up.
const { test, expect } = require('@playwright/test');
const { openWith } = require('./helpers');

const SIZES = [[400, 780], [844, 390], [800, 1100], [1100, 800]];
const PARTS = ['#pFirst h2', '#pFFaces', '.pflab', '#pFName', '#pFStart', '.pfnote'];
const SHOTS = process.env.WW_SHOTS || '';   // a folder for screenshots, if wanted

function overlap(a, b) { return a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5; }

for (const [w, h] of SIZES) {
  test('first-run screen fits at ' + w + 'x' + h, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await openWith(page, {});
    await expect(page.locator('#pFirst')).toBeVisible();
    // no scrolling needed and no sideways scroll
    const fit = await page.evaluate(() => { const e = document.querySelector('#pFirst'); return { sh: e.scrollHeight, ch: e.clientHeight, dw: document.documentElement.scrollWidth }; });
    expect(fit.sh).toBeLessThanOrEqual(fit.ch + 1);
    expect(fit.dw).toBeLessThanOrEqual(w);
    const boxes = [];
    for (const sel of PARTS) {
      const b = await page.locator(sel).boundingBox();
      expect(b, sel).not.toBeNull();
      expect(b.x, sel + ' left').toBeGreaterThanOrEqual(0);
      expect(b.y, sel + ' top').toBeGreaterThanOrEqual(0);
      expect(b.x + b.width, sel + ' right').toBeLessThanOrEqual(w);
      expect(b.y + b.height, sel + ' bottom').toBeLessThanOrEqual(h);
      boxes.push([sel, b]);
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i][1], boxes[j][1]), boxes[i][0] + ' / ' + boxes[j][0]).toBe(false);
    // the faces do not overlap each other
    const faces = await page.locator('#pFFaces .gface').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }));
    for (let i = 0; i < faces.length; i++) for (let j = i + 1; j < faces.length; j++) expect(overlap(faces[i], faces[j]), 'face ' + i + ' / ' + j).toBe(false);
    // the gentle message has room too
    await page.locator('#pFStart').click();
    const msg = await page.locator('#pFMsg').boundingBox();
    expect(msg.y + msg.height).toBeLessThanOrEqual(h);
    expect(overlap(msg, boxes[5][1])).toBe(false);
    if (SHOTS) await page.screenshot({ path: SHOTS + '/first-run-' + w + 'x' + h + '.png' });
  });
}

test('on the phone size the keyboard does not hide Start', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 780 });
  await openWith(page, {});
  await page.locator('#pFName').click();
  // a phone keyboard takes about 330 px; the browser makes the visible area that much shorter
  await page.setViewportSize({ width: 400, height: 450 });
  await page.waitForTimeout(500);
  const b = await page.locator('#pFStart').boundingBox();
  const vv = await page.evaluate(() => ({ top: visualViewport.offsetTop, h: visualViewport.height }));
  expect(b.y).toBeGreaterThanOrEqual(vv.top);
  expect(b.y + b.height).toBeLessThanOrEqual(vv.top + vv.h);
  const inp = await page.locator('#pFName').boundingBox();
  expect(inp.y + inp.height).toBeLessThanOrEqual(vv.top + vv.h);
  if (SHOTS) await page.screenshot({ path: SHOTS + '/first-run-keyboard.png' });
});
