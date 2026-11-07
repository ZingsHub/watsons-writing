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

// one child (Watson) with this many lifetime stars and this saved farm (an object, or a string saved exactly as given)
function withFarm(stars, farm) {
  const s = Object.assign({}, WATSON, { ww_p_p1_ty_stars: String(stars) });
  delete s.ww_p_p1_ww_farm;
  if (farm !== undefined) s.ww_p_p1_ww_farm = typeof farm === 'string' ? farm : JSON.stringify(farm);
  return s;
}
// Watson's saved farm right now
async function farmNow(page) { return JSON.parse((await storage(page)).ww_p_p1_ww_farm || 'null'); }

async function openFarm(page) {
  await tapStart(page);
  await page.locator('#wMenu [data-m="farm"]').click();
  await expect(page.locator('#fMap .fmarea').first()).toBeVisible();
}
async function openShop(page, tab) {
  await page.locator('#fShopMap').click();
  await expect(page.locator('#fShop')).toBeVisible();
  if (tab) await page.locator('#fShopTabs [data-tab="' + tab + '"]').click();
}
// the Barnyard from the map (waits for the short zoom)
async function openBarnyard(page) {
  await page.locator('#fMap [data-area="barnyard"]').click();
  await expect(page.locator('#fScene')).toBeVisible();
}

// build mode: a real tap on a bit of the item that nothing else covers (animals walk about, and may stand on it)
async function tapItem(page, k) {
  const pt = await page.locator('#fLayer [data-i="' + k + '"] .fi-in').evaluate((el, k) => {
    const r = el.getBoundingClientRect();
    for (const fy of [0.6, 0.5, 0.7, 0.8, 0.4, 0.3]) for (const fx of [0.5, 0.35, 0.65, 0.2, 0.8]) {
      const x = r.left + r.width * fx, y = r.top + r.height * fy, hit = document.elementFromPoint(x, y), fi = hit && hit.closest('.fi');
      if (fi && fi.getAttribute('data-i') === k) return [x, y];
    }
    return [r.left + r.width / 2, r.top + r.height * 0.7];
  }, k);
  await page.mouse.click(pt[0], pt[1]);
}

module.exports = { storage, openWith, tapStart, firstRun, grownUps, addChild, WATSON, withFarm, farmNow, openFarm, openShop, openBarnyard, tapItem };
