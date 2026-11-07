// Shared steps for the Playwright tests.
const { expect } = require('@playwright/test');

// every localStorage key and value on the page
async function storage(page) {
  return page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
}

// open the app with these saved keys already on the device (an empty object = a brand-new device)
async function openWith(page, saved) {
  await page.goto('/');
  if (saved && Object.keys(saved).length) {
    await page.evaluate((s) => { localStorage.clear(); for (const k in s) localStorage.setItem(k, s[k]); }, saved);
    await page.reload();
  }
}

async function tapStart(page) {
  await page.locator('#startBtn').click();
  await expect(page.locator('#wMenu')).toBeVisible();
}

// finish the first-run screen
async function firstRun(page, name, face) {
  await expect(page.locator('#pFirst')).toBeVisible();
  if (face !== undefined) await page.locator('#pFFaces .gface').nth(face).click();
  await page.locator('#pFName').fill(name);
  await page.locator('#pFStart').click();
  await expect(page.locator('#wMenu')).toBeVisible();
}

// Grown-ups: answer the math problem
async function grownUps(page) {
  await page.locator('#gBtn').click();
  const q = (await page.locator('#gQ').textContent()).replace('= ?', '').trim();
  const m = /^(\d+)\s*([+×])\s*(\d+)$/.exec(q);
  const ans = String(m[2] === '+' ? +m[1] + +m[3] : +m[1] * +m[3]);
  for (const d of ans) await page.locator('#gPad [data-k="' + d + '"]').click();
  await page.locator('#gPad [data-k="ok"]').click();
  await expect(page.locator('#gHome')).toBeVisible();
}

async function addChild(page, name, face) {
  await page.locator('#gAdd').click();
  await page.locator('#gEName').fill(name);
  if (face !== undefined) await page.locator('#gFaces .gface').nth(face).click();
  await page.locator('#gESave').click();
  await expect(page.locator('#gHome')).toBeVisible();
}

// a device that already has Watson's profile and progress (as saved by ww-v26)
const WATSON = {
  ww_profiles: JSON.stringify({ v: 1, cur: 'p1', list: [{ id: 'p1', name: 'Watson', face: 0 }] }),
  ww_p_p1_meta: JSON.stringify({ name: 'Watson', face: 0 }),
  ww_p_p1_ty_stars: '42',
  ww_p_p1_ty_write: JSON.stringify({ A: 3, B: 2 }),
  ww_p_p1_ww_reward: JSON.stringify({ quiz: {}, names: {}, day: '2026-11-01', bonus: {} }),
  ww_p_p1_ww_farm: JSON.stringify({ v: 4, animals: ['pig'], items: [], away: [] }),
  ww_backup_premigrate: JSON.stringify({ at: '2026-10-01T00:00:00.000Z', data: { ty_stars: '30' } }),
};

module.exports = { storage, openWith, tapStart, firstRun, grownUps, addChild, WATSON };
