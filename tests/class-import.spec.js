// Class view reads progress files from anywhere: feed it broken, huge, wrongly typed and script-carrying files.
// Nothing may run, nothing may break, bad files are refused with a plain message, and good ones still work afterwards.
const { test, expect } = require('@playwright/test');
const { openWith, tapStart, grownUps, WATSON } = require('./helpers');

function kid(over, prog) {
  return Object.assign({ id: 'abcd1234-p1', name: 'Ana', face: 2,
    progress: Object.assign({ letters: { A: 3, b: 2 }, stars: 12, tracked: true, since: '2026-10-01', days: ['2026-10-01', '2026-10-02'],
      quiz: { up: { stars: 2, best: 40, n: 3 } }, names: [{ n: 'ANA', l: 2 }] }, prog || {}) }, over || {});
}
function file(children, over) { return JSON.stringify(Object.assign({ app: 'watsons-writing-progress', format: 1, exported: '2026-11-01T10:00:00.000Z', children }, over || {})); }
const f = (name, text) => ({ name, mimeType: 'application/json', buffer: Buffer.isBuffer(text) ? text : Buffer.from(text, 'utf8') });

async function classView(page) {
  const seen = { errors: [], dialogs: [] };
  page.on('pageerror', (e) => seen.errors.push(String(e)));
  page.on('dialog', (d) => { seen.dialogs.push(d.message()); d.dismiss(); });
  await openWith(page, WATSON);
  await tapStart(page);
  await grownUps(page);
  await page.locator('#gClassBtn').click();
  await expect(page.locator('#gClass')).toBeVisible();
  return seen;
}
async function load(page, files) { await page.locator('#gClassFile').setInputFiles(files); await expect(page.locator('#gClassMsg p').first()).toBeVisible(); }
async function clean(page, seen) {
  expect(seen.errors).toEqual([]);
  expect(seen.dialogs).toEqual([]);
  expect(await page.evaluate(() => window.__pwn)).toBeUndefined();
  expect(await page.evaluate(() => ({}).polluted === undefined && Object.prototype.polluted === undefined && [].polluted === undefined)).toBe(true);
  expect(await page.locator('#gClassList img, #gClassList script, #gClassMsg img, #gClassMsg script, #gClassList iframe').count()).toBe(0);
  const saved = await page.evaluate(() => localStorage.getItem('ww_class'));
  if (saved) { const d = JSON.parse(saved); expect(Array.isArray(d.kids)).toBe(true); }
}

const BAD = {
  'not JSON': '{oops',
  'empty file': '',
  'just null': 'null',
  'an array': '[1,2,3]',
  'a string': '"hello"',
  'wrong app': file([kid()], { app: 'something-else' }),
  'wrong format': file([kid()], { format: 2 }),
  'no children': file([]),
  'children not a list': file({ 0: kid() }),
  'too many children (9)': file(Array.from({ length: 9 }, (_, i) => kid({ id: 'abcd1234-p' + i }))),
  'exported in the future': file([kid()], { exported: '2099-01-01T00:00:00.000Z' }),
  'exported not a date': file([kid()], { exported: 'yesterday' }),
  'id with capitals and symbols': file([kid({ id: 'ABC/../x' })]),
  'id too long': file([kid({ id: 'a'.repeat(41) })]),
  'name is a number': file([kid({ name: 12345 })]),
  'name is empty': file([kid({ name: '   ' })]),
  'stars as text': file([kid({}, { stars: '100' })]),
  'letters as a list': file([kid({}, { letters: ['A', 'B'] })]),
  'tracked as text': file([kid({}, { tracked: 'yes' })]),
  'days as text': file([kid({}, { days: '2026-10-01' })]),
  'quiz missing': file([kid({}, { quiz: undefined })]),
  'progress missing': file([{ id: 'abcd1234-p1', name: 'Ana', face: 1 }]),
  'deeply nested': '['.repeat(90000) + ']'.repeat(90000),
};

test('broken, wrong and wrongly typed files are all refused, and nothing breaks', async ({ page }) => {
  const seen = await classView(page);
  const names = Object.keys(BAD);
  await load(page, names.map((n, i) => f('bad-' + i + '.json', BAD[n])));
  const msgs = await page.locator('#gClassMsg p').allTextContents();
  expect(msgs.length).toBe(names.length);
  msgs.forEach((m, i) => expect(m, names[i]).toBe("This file doesn't look right: bad-" + i + '.json. Nothing was changed.'));
  await expect(page.locator('#gClassList .gkid')).toHaveCount(0);
  await clean(page, seen);
});

test('binary junk and a picture renamed .json are refused', async ({ page }) => {
  const seen = await classView(page);
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4650000000049454e44ae426082', 'hex');
  const junk = Buffer.alloc(5000); for (let i = 0; i < junk.length; i++) junk[i] = (i * 73 + 11) % 256;
  await load(page, [f('picture.json', png), f('junk.json', junk)]);
  await expect(page.locator('#gClassMsg p.gbad')).toHaveCount(2);
  await clean(page, seen);
});

test('an oversized file (over 200 KB) is refused without being read', async ({ page }) => {
  const seen = await classView(page);
  const big = file([kid()]).replace('{', '{' + ' '.repeat(210 * 1024));   // valid JSON, just too big
  await load(page, [f('big.json', big)]);
  await expect(page.locator('#gClassMsg p')).toHaveText(["This file doesn't look right: big.json. Nothing was changed."]);
  await expect(page.locator('#gClassList .gkid')).toHaveCount(0);
  await clean(page, seen);
});

test('names that look like code are shown as plain text and never run', async ({ page }) => {
  const seen = await classView(page);
  const evil = [
    kid({ id: 'abcd1234-p1', name: '<img src=x onerror="window.__pwn=1">' }, { names: [{ n: '<script>window.__pwn=1</script>', l: 1 }] }),
    kid({ id: 'abcd1234-p2', name: '<script>window.__pwn=1</script>' }),
    kid({ id: 'abcd1234-p3', name: '"><svg onload=window.__pwn=1>' }),
    kid({ id: 'abcd1234-p4', name: 'Ana‮​evil\u0000' }),   // direction-override, zero-width and control characters
  ];
  await load(page, [f('<b>x</b>"onmouseover="window.__pwn=1.json', file(evil))]);
  await expect(page.locator('#gClassList .gkid')).toHaveCount(4);
  const shown = await page.locator('#gClassList .gkid b').evaluateAll((els) => els.map((e) => e.firstChild.textContent));
  expect(shown.sort()).toEqual(['"><svg onloa', '<img src=x o', '<script>wind', 'Anaevil']);   // as text, cut to 12 letters (the list is sorted by name)
  // the report of one of them: still text
  await page.locator('#gClassList .gkid', { hasText: '<img src=x o' }).locator('.gcopen').click();
  await expect(page.locator('#gRep')).toBeVisible();
  await expect(page.locator('#gRepBox')).toContainText('<img src=x o');
  expect(await page.locator('#gRepBox img, #gRepBox script, #printRep img, #printRep script').count()).toBe(0);
  await page.waitForTimeout(300);
  await clean(page, seen);
});

test('prototype tricks (__proto__, constructor) change nothing', async ({ page }) => {
  const seen = await classView(page);
  const txt = file([kid()]).replace('"children"', '"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted":"yes"}},"children"')
    .replace('"letters":{', '"letters":{"__proto__":{"polluted":"yes"},')
    .replace('"quiz":{', '"quiz":{"__proto__":{"up":{"stars":3}},"constructor":{"prototype":{"polluted":"yes"}},');
  await load(page, [f('proto.json', txt)]);
  await expect(page.locator('#gClassList .gkid')).toHaveCount(1);
  await clean(page, seen);
});

test('huge and odd numbers are clamped; a good file still imports after bad ones', async ({ page }) => {
  const seen = await classView(page);
  const wild = kid({ face: 1e9 }, { stars: 1e308, letters: { A: 99, B: -5, C: 2.7, '1': 'x' }, quiz: { up: { stars: 50, best: 1e9, n: -1 } }, days: Array(5000).fill('2026-10-01') });
  await load(page, [f('a.json', '{oops'), f('b.json', file([wild])), f('c.json', '')]);
  await expect(page.locator('#gClassList .gkid')).toHaveCount(1);
  const k = JSON.parse(await page.evaluate(() => localStorage.getItem('ww_class'))).kids[0];
  expect(k.progress.stars).toBe(1000000);
  expect(k.progress.letters).toEqual({ A: 3, C: 2 });
  expect(k.progress.quiz.up).toEqual({ stars: 3, best: 50, n: 0 });
  expect(k.progress.days).toEqual(['2026-10-01']);
  expect(k.face).toBe(11);
  await page.locator('#gClassList .gcopen').first().click();
  await expect(page.locator('#gRepBox')).toContainText('Ana');
  await clean(page, seen);
});

test('a damaged saved class list (ww_class) is cleaned when read, never trusted', async ({ page }) => {
  const seen = { errors: [] };
  page.on('pageerror', (e) => seen.errors.push(String(e)));
  await openWith(page, Object.assign({}, WATSON, { ww_class: JSON.stringify({ v: 1, kids: [
    { id: 'abcd1234-p1', exported: '2026-11-01T10:00:00.000Z', name: '<img src=x onerror=window.__pwn=1>', face: 0, progress: kid().progress },
    { id: 'BAD ID', exported: '2026-11-01T10:00:00.000Z', name: 'X', face: 0, progress: kid().progress },
    'junk', null, 42] }) }));
  await tapStart(page);
  await grownUps(page);
  await page.locator('#gClassBtn').click();
  await expect(page.locator('#gClassList .gkid')).toHaveCount(1);
  expect(await page.locator('#gClassList img').count()).toBe(0);
  expect(await page.evaluate(() => window.__pwn)).toBeUndefined();
  expect(seen.errors).toEqual([]);
});
