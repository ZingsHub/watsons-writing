// First run on a new device: "Who is learning today?" instead of a default Watson.
const { test, expect } = require('@playwright/test');
const { storage, openWith, tapStart, firstRun, grownUps, addChild, WATSON } = require('./helpers');

test('a brand-new device shows the first-run screen and no Watson', async ({ page }) => {
  await openWith(page, {});
  await expect(page.locator('#pFirst')).toBeVisible();
  await expect(page.locator('#pFirst h2')).toHaveText('Who is learning today?');
  await expect(page.locator('label[for="pFName"]')).toHaveText("Student's first name");
  await expect(page.locator('.pfnote')).toHaveText('First name only. Nothing leaves this device.');
  await expect(page.locator('#pFFaces .gface')).toHaveCount(12);
  await expect(page.locator('#pFName')).toHaveAttribute('maxlength', '20');
  await expect(page.locator('#startBtn')).toBeHidden();
  await expect(page.locator('#pPick')).toBeHidden();
  const s = await storage(page);
  expect(s.ww_profiles).toBeUndefined();
  expect(JSON.stringify(s)).not.toContain('Watson');
});

test('an empty name is rejected gently', async ({ page }) => {
  await openWith(page, {});
  await page.locator('#pFStart').click();
  await expect(page.locator('#pFMsg')).toHaveText('Please type a first name.');
  await page.locator('#pFName').fill('    ');
  await page.locator('#pFName').press('Enter');
  await expect(page.locator('#pFMsg')).toHaveText('Please type a first name.');
  await expect(page.locator('#pFirst')).toBeVisible();
  expect((await storage(page)).ww_profiles).toBeUndefined();
  // typing clears the message
  await page.locator('#pFName').type('A');
  await expect(page.locator('#pFMsg')).toHaveText('');
});

test('a name longer than 20 letters cannot be typed', async ({ page }) => {
  await openWith(page, {});
  await page.locator('#pFName').type('Abcdefghijklmnopqrstuvwxyz');
  await expect(page.locator('#pFName')).toHaveValue('Abcdefghijklmnopqrst');
});

test('the name and face are saved and the menu opens', async ({ page }) => {
  await openWith(page, {});
  await firstRun(page, '  Maya  ', 3);
  await expect(page.locator('#gate')).toBeHidden();
  const s = await storage(page);
  const idx = JSON.parse(s.ww_profiles);
  expect(idx.list).toHaveLength(1);
  expect(idx.list[0]).toMatchObject({ name: 'Maya', face: 3 });
  expect(idx.cur).toBe(idx.list[0].id);
  expect(JSON.parse(s['ww_p_' + idx.cur + '_meta'])).toEqual({ name: 'Maya', face: 3 });
  expect(s['ww_p_' + idx.cur + '_ww_reward']).toBeTruthy();
  await expect(page.locator('#pMe')).toHaveAttribute('aria-label', /^Maya is playing/);
});

test('a name with symbols only is rejected, and text is never treated as HTML', async ({ page }) => {
  await openWith(page, {});
  await page.locator('#pFName').fill('<<>>');
  await page.locator('#pFStart').click();
  await expect(page.locator('#pFMsg')).toHaveText('Please type a first name.');
  await page.locator('#pFName').fill('<b>Al</b>');
  await page.locator('#pFStart').click();
  await expect(page.locator('#wMenu')).toBeVisible();
  const idx = JSON.parse((await storage(page)).ww_profiles);
  expect(idx.list[0].name).toBe('bAl/b');
});

test('reload with one profile goes straight to that child, no "Who\'s playing?"', async ({ page }) => {
  await openWith(page, {});
  await firstRun(page, 'Maya');
  await page.reload();
  await expect(page.locator('#pFirst')).toBeHidden();
  await expect(page.locator('#pPick')).toBeHidden();
  await tapStart(page);
  await expect(page.locator('#pMe')).toHaveAttribute('aria-label', /^Maya is playing/);
});

test('adding a second student in Grown-ups makes reload show "Who\'s playing?"', async ({ page }) => {
  await openWith(page, {});
  await firstRun(page, 'Maya');
  await grownUps(page);
  await addChild(page, 'Leo', 5);
  await page.reload();
  await expect(page.locator('#pFirst')).toBeHidden();
  await expect(page.locator('#pPick')).toBeVisible();
  await expect(page.locator('#pFaces .pkid')).toHaveCount(2);
  await expect(page.locator('#pFaces .pkn')).toHaveText(['Maya', 'Leo']);
  await page.locator('#pFaces .pkid', { hasText: 'Leo' }).click();
  await expect(page.locator('#wMenu')).toBeVisible();
  await expect(page.locator('#pMe')).toHaveAttribute('aria-label', /^Leo is playing/);
});

test('a device with an existing Watson profile skips first-run and nothing changes', async ({ page }) => {
  await openWith(page, WATSON);
  await expect(page.locator('#pFirst')).toBeHidden();
  await expect(page.locator('#startBtn')).toBeVisible();
  const s = await storage(page);
  for (const k in WATSON) expect(s[k], k).toBe(WATSON[k]);
  await tapStart(page);
  await expect(page.locator('#pMe')).toHaveAttribute('aria-label', /^Watson is playing/);
  const after = await storage(page);
  for (const k of ['ww_profiles', 'ww_p_p1_meta', 'ww_p_p1_ty_stars', 'ww_p_p1_ty_write', 'ww_backup_premigrate']) expect(after[k], k).toBe(WATSON[k]);
});

test('a device with progress from before profiles still becomes Watson\'s, as before', async ({ page }) => {
  await openWith(page, { ty_stars: '7', ty_write: JSON.stringify({ A: 2 }) });
  await expect(page.locator('#pFirst')).toBeHidden();
  const s = await storage(page);
  const idx = JSON.parse(s.ww_profiles);
  expect(idx.list).toEqual([{ id: 'p1', name: 'Watson', face: 0 }]);
  expect(s.ww_p_p1_ty_stars).toBe('7');
  expect(JSON.parse(s.ww_backup_premigrate).data.ty_stars).toBe('7');
});

// unchanged from before: a missing list goes the old way (Watson), and the other child's saved keys stay
test('a device with only a child\'s name tag left is not asked again and keeps that child\'s keys', async ({ page }) => {
  await openWith(page, { ww_p_pabc_meta: JSON.stringify({ name: 'Ana', face: 2 }), ww_p_pabc_ty_stars: '5' });
  await expect(page.locator('#pFirst')).toBeHidden();
  const s = await storage(page);
  expect(s.ww_p_pabc_ty_stars).toBe('5');
  expect(s.ww_p_pabc_meta).toBe(JSON.stringify({ name: 'Ana', face: 2 }));
});

test('the first-run screen calls no other website', async ({ page }) => {
  const outside = [];
  page.on('request', (r) => { if (!r.url().startsWith('http://localhost:3077')) outside.push(r.url()); });
  await openWith(page, {});
  await firstRun(page, 'Maya');
  expect(outside).toEqual([]);
});

// (opening the app itself offline is the service worker's job, unchanged here)
test('the first-run screen works with no internet once open', async ({ page, context }) => {
  await openWith(page, {});
  await context.setOffline(true);
  await firstRun(page, 'Maya');
  expect(JSON.parse((await storage(page)).ww_profiles).list[0].name).toBe('Maya');
  await context.setOffline(false);
});
