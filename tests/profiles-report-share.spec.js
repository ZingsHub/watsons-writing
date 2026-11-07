// Existing features around profiles still work: Grown-ups add / edit / switch, the progress report,
// sharing a progress file, and Class view importing it.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { storage, openWith, tapStart, grownUps, addChild, WATSON } = require('./helpers');

test('Grown-ups: add a child, duplicate names refused, edit a name, switch with the corner face', async ({ page }) => {
  await openWith(page, WATSON);
  await tapStart(page);
  await grownUps(page);
  await addChild(page, 'Leo', 4);
  await expect(page.locator('#gKids .gkid')).toHaveCount(2);
  await page.locator('#gAdd').click();
  await page.locator('#gEName').fill('leo');
  await page.locator('#gESave').click();
  await expect(page.locator('#gEMsg')).toHaveText('There is already a child called leo.');
  await page.locator('#gECancel').click();
  await page.locator('#gKids [data-act="edit"]').nth(1).click();
  await page.locator('#gEName').fill('Leonardo');
  await page.locator('#gESave').click();
  const idx = JSON.parse((await storage(page)).ww_profiles);
  expect(idx.list.map((p) => p.name)).toEqual(['Watson', 'Leonardo']);
  expect(idx.list[1].face).toBe(4);
  expect((await storage(page)).ww_p_p1_ty_stars).toBe('42');   // Watson's progress untouched
  await page.reload();
  await expect(page.locator('#pPick')).toBeVisible();
  await page.locator('#pFaces .pkid', { hasText: 'Watson' }).click();
  await page.locator('#pMe').click();
  await expect(page.locator('#pPick')).toBeVisible();
  await page.locator('#pFaces .pkid', { hasText: 'Leonardo' }).click();
  await expect(page.locator('#pMe')).toHaveAttribute('aria-label', /^Leonardo is playing/);
});

test('Progress report shows the child\'s page', async ({ page }) => {
  await openWith(page, WATSON);
  await tapStart(page);
  await grownUps(page);
  await page.locator('#gRepBtn').click();
  const kid = page.locator('#gRepKids .pkid');
  if (await kid.count()) await kid.first().click();
  await expect(page.locator('#gRep')).toBeVisible();
  await expect(page.locator('#gRepBox')).toContainText('Watson');
  await expect(page.locator('#printRep')).toContainText('Watson');
});

test('Share progress file, then Class view imports it', async ({ page }, info) => {
  await openWith(page, WATSON);
  await tapStart(page);
  await grownUps(page);
  await page.locator('#gShareBtn').click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#gShareKids .pkid').first().click()]);
  expect(dl.suggestedFilename()).toMatch(/^Watson-Writing-Watson-\d{4}-\d\d-\d\d\.json$/);
  const file = info.outputPath(dl.suggestedFilename());
  await dl.saveAs(file);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  expect(data).toMatchObject({ app: 'watsons-writing-progress', format: 1 });
  expect(data.children).toHaveLength(1);
  expect(data.children[0].name).toBe('Watson');
  // back to Grown-ups, then Class view
  await page.reload();
  await tapStart(page);
  await grownUps(page);
  await page.locator('#gClassBtn').click();
  await page.locator('#gClassFile').setInputFiles(file);
  await expect(page.locator('#gClassList')).toContainText('Watson');
  expect(JSON.parse((await storage(page)).ww_class).kids.length).toBe(1);
});

test('a child made on the first-run screen can be shared and shown in Class view', async ({ page }, info) => {
  await openWith(page, {});
  await page.locator('#pFName').fill('Maya');
  await page.locator('#pFStart').click();
  await grownUps(page);
  await page.locator('#gShareBtn').click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#gShareKids .pkid').first().click()]);
  expect(dl.suggestedFilename()).toMatch(/^Watson-Writing-Maya-/);
  const file = info.outputPath('maya.json');
  await dl.saveAs(file);
  await page.reload();
  await tapStart(page);
  await grownUps(page);
  await page.locator('#gClassBtn').click();
  await page.locator('#gClassFile').setInputFiles(file);
  await expect(page.locator('#gClassList')).toContainText('Maya');
});
