// My Farm shop: picture tabs by animal and place, a preview before every purchase, locked and too-dear things can't be bought,
// and saved farms load as before.
const { test, expect } = require('@playwright/test');
const { storage, openWith, withFarm, farmNow, openFarm, openShop, openBarnyard } = require('./helpers');

const PIG_ONLY = { v: 4, spent: 0, animals: ['pig'], looks: {}, items: [], away: [], pos: {}, areas: ['barnyard'] };
const HAT = 'M-10 2 L0 -24 L10 2 Z';   // the hat's outline in the animal pictures

test('items are grouped: animal tabs then place tabs; rows by what they change or who they are for', async ({ page }) => {
  await openWith(page, withFarm(50, PIG_ONLY));
  await openFarm(page);
  await openShop(page);
  const tabs = await page.locator('#fShopTabs [data-tab]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tab')));
  expect(tabs).toEqual(['pig', 'horse', 'chicken', 'cow', 'sheep', 'duck', 'goat', 'barnyard', 'shed', 'house']);
  await expect(page.locator('#fShopTabs [data-tab="pig"]')).toHaveClass(/on/);   // opens on the first animal on the farm
  await expect(page.locator('#fShopTabs [data-tab="horse"]')).toHaveClass(/locked/);
  await expect(page.locator('#fShopTabs [data-tab="shed"]')).toHaveClass(/locked/);
  await expect(page.locator('#fShopTabs [data-tab="barnyard"]')).not.toHaveClass(/locked/);
  // every tab has a picture
  expect(await page.locator('#fShopTabs [data-tab] svg').count()).toBeGreaterThanOrEqual(10);
  // Pig: a row for each thing an outfit changes
  await expect(page.locator('#fShopBody .fsrow-ic small')).toHaveText(['Hats', 'Glasses', 'Clothes', 'Colors', 'Sparkle']);
  const hats = await page.locator('#fShopBody .fsrow').first().locator('[data-e]').evaluateAll((els) => els.map((e) => e.getAttribute('data-e')));
  expect(hats).toEqual(['look:bow:pig', 'look:hat:pig', 'look:tophat:pig', 'look:crown:pig']);
  // Horse has hair too
  await page.locator('#fShopTabs [data-tab="horse"]').click();
  await expect(page.locator('#fShopBody .fsrow-ic small').first()).toHaveText('Hair');
  // Barnyard: a row per animal with its things
  await page.locator('#fShopTabs [data-tab="barnyard"]').click();
  await expect(page.locator('#fShopBody .fsrow-ic small')).toHaveText(['Pig', 'Horse', 'Chicken', 'Cow', 'Sheep', 'Duck', 'Goat']);
  const pigRow = await page.locator('#fShopBody .fsrow').first().locator('[data-e]').evaluateAll((els) => els.map((e) => e.getAttribute('data-e')));
  expect(pigRow).toEqual(['item:mud:', 'item:puddle:', 'item:slide:']);
  await page.locator('#fShopTabs [data-tab="shed"]').click();
  await expect(page.locator('#fShopBody [data-e]')).toHaveCount(3);
  await expect(page.locator('#fShopBody .fsh-lock')).toContainText('Unlock the Tractor Shed first');
  await page.locator('#fShopTabs [data-tab="house"]').click();
  await expect(page.locator('#fShopBody [data-e]')).toHaveCount(3);
});

test('the preview shows the animal wearing it, or the thing in its place, with a label and price', async ({ page }) => {
  await openWith(page, withFarm(50, PIG_ONLY));
  await openFarm(page);
  await openShop(page, 'pig');
  await page.locator('[data-e="look:hat:pig"]').click();
  await expect(page.locator('#fPv')).toBeVisible();
  await expect(page.locator('#fPvT')).toHaveText('Hat for Pig');
  await expect(page.locator('#fPvS')).toBeHidden();
  await expect(page.locator('#fPvN')).toHaveText('4');
  expect(await page.locator('#fPvPic').innerHTML()).toContain(HAT);   // the pig is wearing the hat
  await page.locator('#fPvBack').click();
  await expect(page.locator('#fPv')).toBeHidden();
  await page.locator('#fShopTabs [data-tab="barnyard"]').click();
  await page.locator('[data-e="item:mud:"]').click();
  await expect(page.locator('#fPvT')).toHaveText('Mud pit');
  await expect(page.locator('#fPvS')).toHaveText('Goes in the Barnyard');
  await expect(page.locator('#fPvN')).toHaveText('6');
  await page.locator('#fPvBack').click();
  await page.locator('#fShopTabs [data-tab="shed"]').click();
  await page.locator('[data-e="veh:car:"]').click();
  await expect(page.locator('#fPvS')).toHaveText('Goes in the Tractor Shed');
  await page.locator('#fPvBack').click();
  await page.locator('#fShopTabs [data-tab="house"]').click();
  await page.locator('[data-e="extra:flag:"]').click();
  await expect(page.locator('#fPvS')).toHaveText('Goes in the Farmhouse and Garden');
  await expect(page.locator('#fPvBuy')).toBeVisible();
});

test('buying needs the preview\'s Buy: a tile tap or Back buys nothing', async ({ page }) => {
  await openWith(page, withFarm(50, PIG_ONLY));
  await openFarm(page);
  const before = (await storage(page)).ww_p_p1_ww_farm;
  await openShop(page, 'pig');
  await page.locator('[data-e="look:hat:pig"]').click();
  await page.locator('#fPvBack').click();
  expect((await storage(page)).ww_p_p1_ww_farm).toBe(before);
  await page.locator('[data-e="look:hat:pig"]').click();
  await expect(page.locator('#fPvBuy')).toBeEnabled();
  await page.locator('#fPvBuy').click();
  await expect(page.locator('#fPv')).toBeHidden();
  const f = await farmNow(page);
  expect(f.spent).toBe(4);
  expect(f.looks.pig.own).toEqual(['hat']);
  expect(f.looks.pig.wear.head).toBe('hat');
  await expect(page.locator('[data-e="look:hat:pig"]')).toHaveClass(/own/);
  // the star count went down by the price, nothing else
  await expect(page.locator('#starN')).toHaveText('46');
  // a Barnyard item bought from the map is saved and appears in the Barnyard
  await page.locator('#fShopTabs [data-tab="barnyard"]').click();
  await page.locator('[data-e="item:mud:"]').click();
  await page.locator('#fPvBuy').click();
  expect((await farmNow(page)).items).toEqual(['mud']);
  await page.locator('#fShop .fx-close').click();
  await openBarnyard(page);
  await expect(page.locator('#fLayer [data-i="mud"]')).toBeVisible();
});

test('the Barnyard hammer and paintbrush open the shop; buying there still goes through the preview', async ({ page }) => {
  await openWith(page, withFarm(50, PIG_ONLY));
  await openFarm(page);
  await openBarnyard(page);
  await page.locator('#fHammer').click();
  await expect(page.locator('#fShop')).toBeVisible();
  await expect(page.locator('#fShopTabs [data-tab="barnyard"]')).toHaveClass(/on/);
  await page.locator('[data-e="item:puddle:"]').click();
  await page.locator('#fPvBuy').click();
  await expect(page.locator('#fShop')).toBeHidden();
  await expect(page.locator('#fLayer [data-i="puddle"]')).toBeVisible();
  await page.locator('#fHammer').click();   // build mode off
  await page.locator('#fLayer [data-a="pig"]').click();
  await page.locator('#fPaint').click();
  await expect(page.locator('#fShopTabs [data-tab="pig"]')).toHaveClass(/on/);
  await page.locator('[data-e="look:bow:pig"]').click();
  await page.locator('#fPvBuy').click();
  expect(await page.locator('#fLayer [data-a="pig"]').innerHTML()).not.toBe('');
  expect((await farmNow(page)).looks.pig.wear.head).toBe('bow');
  // an owned outfit still switches off and on with one tap, for free
  await page.locator('[data-e="look:bow:pig"]').click();
  await expect(page.locator('#fPv')).toBeHidden();
  const f = await farmNow(page);
  expect(f.looks.pig.wear.head).toBeUndefined();
  expect(f.spent).toBe(4 + 2);
});

test('locked things can be previewed but not bought', async ({ page }) => {
  await openWith(page, withFarm(200, PIG_ONLY));
  await openFarm(page);
  const before = (await storage(page)).ww_p_p1_ww_farm;
  await openShop(page, 'horse');
  await expect(page.locator('#fShopBody .fsh-lock')).toContainText('Unlock the Horse first');
  const tile = page.locator('[data-e="look:braid:horse"]');
  await expect(tile).toHaveClass(/locked/);
  await expect(tile.locator('.fst-lock svg')).toHaveCount(1);
  await expect(tile.locator('.fst-need svg')).toHaveCount(1);
  await tile.click();
  await expect(page.locator('#fPvT')).toHaveText('Braid for Horse');
  await expect(page.locator('#fPvNote')).toContainText('Unlock the Horse first');
  await expect(page.locator('#fPvBuy')).toBeDisabled();
  await page.locator('#fPvBuy').click({ force: true });
  await page.locator('#fPvBuy').evaluate((b) => b.click());
  await page.locator('#fPvBack').click();
  // a Barnyard item for an animal not on the farm, and a place still locked
  await page.locator('#fShopTabs [data-tab="barnyard"]').click();
  await page.locator('[data-e="item:hay:"]').click();
  await expect(page.locator('#fPvNote')).toContainText('Unlock the Horse first');
  await expect(page.locator('#fPvBuy')).toBeDisabled();
  await page.locator('#fPvBack').click();
  await page.locator('[data-e="item:pond:"]').click();   // the pond is for the duck, the horse or the pig: the pig is here
  await expect(page.locator('#fPvBuy')).toBeEnabled();
  await page.locator('#fPvBack').click();
  await page.locator('#fShopTabs [data-tab="house"]').click();
  await page.locator('[data-e="extra:swing:"]').click();
  await expect(page.locator('#fPvNote')).toContainText('Unlock the Farmhouse and Garden first');
  await expect(page.locator('#fPvBuy')).toBeDisabled();
  await page.locator('#fPvBuy').evaluate((b) => b.click());
  expect((await storage(page)).ww_p_p1_ww_farm).toBe(before);
});

test('too few stars: preview allowed, Buy disabled, shows how many more are needed', async ({ page }) => {
  await openWith(page, withFarm(3, PIG_ONLY));
  await openFarm(page);
  await openShop(page, 'pig');
  await expect(page.locator('[data-e="look:crown:pig"]')).toHaveClass(/short/);
  await page.locator('[data-e="look:crown:pig"]').click();
  await expect(page.locator('#fPvNote')).toContainText('Need 7 more stars');
  await expect(page.locator('#fPvBuy')).toBeDisabled();
  await page.locator('#fPvBuy').evaluate((b) => b.click());
  expect((await farmNow(page)).spent).toBe(0);
  await page.locator('#fPvBack').click();
  await page.locator('[data-e="look:bow:pig"]').click();   // 2 stars: affordable
  await expect(page.locator('#fPvNote')).toBeHidden();
  await expect(page.locator('#fPvBuy')).toBeEnabled();
  await page.locator('#fPvBack').click();
  await page.locator('[data-e="look:hat:pig"]').click();   // 4 stars, has 3
  await expect(page.locator('#fPvNote')).toContainText('Need 1 more star');
});

test('an outfit bought earlier for an animal not on the farm stays owned and is worn when it arrives', async ({ page }) => {
  const save = Object.assign({}, PIG_ONLY, { looks: { horse: { own: ['hat'], wear: { head: 'hat' } } } });
  await openWith(page, withFarm(15, save));   // 15 stars: a second gift is waiting
  await openFarm(page);
  await openShop(page, 'horse');
  const tile = page.locator('[data-e="look:hat:horse"]');
  await expect(tile).toHaveClass(/own/);
  await expect(tile).not.toHaveClass(/locked/);
  await tile.click();
  await expect(page.locator('#fPvNote')).toContainText('Yours!');
  await expect(page.locator('#fPvBuy')).toBeHidden();
  await page.locator('#fPvBack').click();
  await page.locator('#fShop .fx-close').click();
  await openBarnyard(page);
  await page.locator('#fLayer .fgift').click({ force: true });   // it bounces all the time
  await page.locator('#fTiles [data-k="horse"]').click();
  await expect(page.locator('#fLayer [data-a="horse"]')).toBeVisible();
  expect(await page.locator('#fLayer [data-a="horse"]').innerHTML()).toContain(HAT);
  expect((await farmNow(page)).looks.horse).toEqual({ own: ['hat'], wear: { head: 'hat' } });
});

test('old saved farms load as before and are not rewritten by opening the shop', async ({ page }) => {
  // the first save format: decor on/off per animal
  const v1 = JSON.stringify({ spent: 5, animals: ['pig', 'chicken'], decor: { pig: { hat: true, bow: false }, chicken: { bow: true, tail: false } }, items: ['mud'] });
  await openWith(page, withFarm(40, v1));
  await openFarm(page);
  await openShop(page, 'pig');
  await expect(page.locator('[data-e="look:hat:pig"]')).toHaveClass(/on/);
  await expect(page.locator('[data-e="look:bow:pig"]')).toHaveClass(/own/);
  await expect(page.locator('[data-e="look:bow:pig"]')).not.toHaveClass(/on/);
  await page.locator('#fShopTabs [data-tab="chicken"]').click();
  await expect(page.locator('[data-e="look:bowtie:chicken"]')).toHaveClass(/on/);   // the old chicken "bow" is the bow tie
  await expect(page.locator('[data-e="look:rainbow:chicken"]')).toHaveClass(/own/);
  await page.locator('#fShopTabs [data-tab="barnyard"]').click();
  await expect(page.locator('[data-e="item:mud:"]')).toHaveClass(/own/);
  expect((await storage(page)).ww_p_p1_ww_farm).toBe(v1);
  await expect(page.locator('#starN')).toHaveText('35');
});

test('a v4 save with areas, the shed, the house and things sent home loads as before', async ({ page }) => {
  const v4 = JSON.stringify({ v: 4, spent: 30, animals: ['pig', 'horse'], looks: { pig: { own: ['crown'], wear: { head: 'crown' } } }, items: ['mud', 'hay'], away: ['hay'],
    pos: { mud: [70, 6] }, areas: ['barnyard', 'shed', 'house'], shed: { own: ['tractor', 'car'], sel: 'car', look: {} }, house: { wall: 1, door: 2, roof: 0, own: ['flag'], on: { flag: true } },
    garden: { plots: [{ v: 'carrot', t: 0 }, { v: 'tomato', t: 0 }, { v: 'pumpkin', t: 0 }, { v: 'corn', t: 0 }], picked: 3 } });
  await openWith(page, withFarm(120, v4));
  await openFarm(page);
  await expect(page.locator('#fMap [data-area="shed"]')).not.toHaveClass(/locked/);
  await openShop(page, 'shed');
  await expect(page.locator('[data-e="veh:car:"]')).toHaveClass(/own/);
  await expect(page.locator('[data-e="veh:pickup:"]')).not.toHaveClass(/locked/);
  await page.locator('#fShopTabs [data-tab="house"]').click();
  await expect(page.locator('[data-e="extra:flag:"]')).toHaveClass(/own/);
  await page.locator('#fShopTabs [data-tab="barnyard"]').click();
  await expect(page.locator('[data-e="item:hay:"]')).toHaveClass(/own/);
  expect((await storage(page)).ww_p_p1_ww_farm).toBe(v4);
  await page.locator('#fShop .fx-close').click();
  await openBarnyard(page);
  await expect(page.locator('#fLayer [data-i="mud"]')).toBeVisible();
  await expect(page.locator('#fLayer [data-i="hay"]')).toHaveCount(0);   // still at home
  await expect(page.locator('#fHomeBtn')).toBeVisible();
});

test('in the Tractor Shed and the Farmhouse, a tile opens the preview instead of buying', async ({ page }) => {
  const save = Object.assign({}, PIG_ONLY, { areas: ['barnyard', 'shed', 'house'] });
  await openWith(page, withFarm(100, save));
  await openFarm(page);
  await page.locator('#fMap [data-area="shed"]').click();
  await page.locator('#fTools [data-v="car"]').click();
  await expect(page.locator('#fPv')).toBeVisible();
  await expect(page.locator('#fPvS')).toHaveText('Goes in the Tractor Shed');
  expect((await farmNow(page)).shed).toBeUndefined();   // nothing bought or saved yet
  await page.locator('#fPvBuy').click();
  const f = await farmNow(page);
  expect(f.shed.own).toEqual(['tractor', 'car']);
  expect(f.spent).toBe(4);
  await expect(page.locator('#fTools [data-v="car"]')).toHaveClass(/on/);
});
