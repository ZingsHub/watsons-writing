// Security: response headers, the Content-Security-Policy (the app runs with no violations, and an injected script is blocked),
// no requests to other sites, a read-only server, and the app working offline through the service worker.
const { test, expect } = require('@playwright/test');
const { openWith, tapStart, grownUps, withFarm, openShop, openBarnyard } = require('./helpers');

const HEADERS = ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'x-frame-options', 'strict-transport-security'];
const SAVE = { v: 4, spent: 0, animals: ['pig'], looks: {}, items: [], away: [], pos: {}, areas: ['barnyard', 'shed', 'house'],
  garden: { plots: ['carrot', 'tomato', 'pumpkin', 'corn'].map((v) => ({ v, t: 0 })), picked: 2 } };

// CSP violations, page errors, and every request to another site
async function watch(page) {
  const seen = { violations: [], errors: [], outside: [] };
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + (e.blockedURI || '')));
  });
  page.on('pageerror', (e) => seen.errors.push(String(e)));
  page.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) seen.violations.push(m.text()); });
  page.on('request', (r) => { const u = new URL(r.url()); if (!['localhost:3077'].includes(u.host) && !/^(data|blob):/.test(r.url())) seen.outside.push(r.url()); });
  return seen;
}
// an inline script added after load: CSP must block it. That one expected report is then set aside.
async function injected(page, seen) {
  const ran = await page.evaluate(() => new Promise((ok) => { const s = document.createElement('script'); s.textContent = 'window.__inj = 1'; document.body.appendChild(s); setTimeout(() => ok(window.__inj === 1), 100); }));
  await page.waitForTimeout(100);
  expect(seen.violations.length + (await page.evaluate(() => window.__csp.length))).toBeGreaterThan(0);   // it was reported
  seen.violations.length = 0; await page.evaluate(() => { window.__csp = []; });
  return ran;
}

test('security headers on the page, files, errors and security.txt', async ({ request }) => {
  for (const url of ['/', '/sw.js', '/audio/manifest.json', '/audio/001.mp3', '/fonts/nunito-latin.woff2', '/nope', '/healthz', '/.well-known/security.txt']) {
    const r = await request.get(url);
    const h = r.headers();
    for (const k of HEADERS) expect(h[k], url + ' ' + k).toBeTruthy();
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBe('no-referrer');
    expect(h['x-frame-options']).toBe('DENY');
  }
  const csp = (await request.get('/')).headers()['content-security-policy'];
  expect(csp).toContain("default-src 'self'");
  expect(csp).toMatch(/script-src 'self' 'sha256-[A-Za-z0-9+/=]+'$|script-src 'self' 'sha256-[A-Za-z0-9+/=]+';/);
  expect(csp).not.toContain("'unsafe-eval'");
  expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).not.toMatch(/https?:\/\//);   // no other site allowed to load anything
  const st = await request.get('/.well-known/security.txt');
  expect(st.status()).toBe(200);
  expect(st.headers()['content-type']).toContain('text/plain');
  expect(await st.text()).toMatch(/^Contact: /m);
  expect(await st.text()).toMatch(/^Expires: /m);
});

test('the server is read-only: no other methods, no files outside public/', async ({ request }) => {
  for (const m of ['post', 'put', 'delete', 'patch']) {
    const r = await request[m]('/', { data: 'x=1' });
    expect(r.status(), m).toBe(405);
  }
  const r = await request.fetch('/', { method: 'OPTIONS' }); expect(r.status()).toBe(405);
  for (const p of ['/../server.js', '/%2e%2e/server.js', '/..%2fserver.js', '/..%5cserver.js', '/%2e%2e%2fpackage.json', '/public/../server.js']) {
    const g = await request.get(p);
    expect(g.status(), p).not.toBe(200);
    expect(await g.text(), p).not.toContain('createServer');
  }
});

test('the whole app runs under the CSP with no violations, and talks to no other site', async ({ page }) => {
  test.setTimeout(90000);
  const seen = await watch(page);
  await openWith(page, withFarm(80, SAVE));
  expect(await injected(page, seen)).toBe(false);   // CSP is on
  await tapStart(page);
  // Learn to write: a letter, with her voice
  await page.locator('#wMenu [data-m="learn"]').click();
  await page.locator('#wGrid [data-c="A"]').click();
  await page.waitForTimeout(1500);
  await page.locator('#topBack').click(); await page.locator('#topBack').click();
  // Writing Quiz
  await page.locator('#wMenu [data-m="quiz"]').click();
  await page.locator('#wQuizSets [data-s="up"]').click();
  await page.waitForTimeout(800);
  await page.locator('#topBack').click(); await page.locator('#topBack').click();
  // Free writing: draw, a stamp, save the picture
  await page.locator('#wMenu [data-m="free"]').click();
  const c = await page.locator('#dcv').boundingBox();
  await page.mouse.move(c.x + 50, c.y + 50); await page.mouse.down(); await page.mouse.move(c.x + 150, c.y + 120, { steps: 5 }); await page.mouse.up();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#dSave').click()]);
  expect(dl.suggestedFilename()).toMatch(/\.png$/);
  await page.locator('#topBack').click();
  // Write my name
  await page.locator('#wMenu [data-m="name"]').click();
  await page.locator('#nInput').fill('Al');
  await page.locator('#nGo').click();
  await page.locator('#nLvls button').first().click();
  await page.waitForTimeout(800);
  await page.locator('#topBack').click(); await page.locator('#topBack').click();
  await expect(page.locator('#wMenu')).toBeVisible();
  // My Farm: map, shop and preview, Barnyard with feeding, garden
  await page.locator('#wMenu [data-m="farm"]').click();
  await openShop(page, 'pig');
  await page.locator('[data-e="look:hat:pig"]').click();
  await page.locator('#fPvBuy').click();
  await page.locator('#fShop .fx-close').click();
  await openBarnyard(page);
  await page.locator('#fLayer [data-a="pig"]').click();
  await page.locator('#fFeed').click();
  await page.waitForTimeout(1200);
  await page.locator('#topBack').click();
  await page.locator('#fMap [data-area="house"]').click();
  await page.locator('#fPlots [data-p="0"]').click();
  await page.locator('#topBack').click(); await page.locator('#topBack').click();
  // Grown-ups: report, share a file, Class view, Privacy
  await grownUps(page);
  await page.locator('#gRepBtn').click();
  const kid = page.locator('#gRepKids .pkid'); if (await kid.count()) await kid.first().click();
  await expect(page.locator('#gRepBox')).toContainText('Watson');
  await page.locator('#topBack').click(); await page.locator('#topBack').click().catch(() => {});
  await expect(page.locator('#gHome')).toBeVisible();
  await page.locator('#gShareBtn').click();
  await Promise.all([page.waitForEvent('download'), page.locator('#gShareKids .pkid').first().click()]);
  await page.locator('#topBack').click();
  await page.locator('#gClassBtn').click();
  await page.locator('#topBack').click();
  await page.locator('#gPrivBtn').click();
  await expect(page.locator('#gPriv')).toBeVisible();
  await page.waitForTimeout(500);
  expect(seen.errors).toEqual([]);
  expect(seen.violations).toEqual([]);
  expect(await page.evaluate(() => window.__csp)).toEqual([]);
  expect(seen.outside).toEqual([]);
});

test('the Google Form is the only outside link: new tab, no referrer', async ({ page }) => {
  await openWith(page, {});
  const links = await page.locator('a[href^="http"]').evaluateAll((els) => els.map((a) => ({ href: a.href, target: a.target, rel: a.rel })));
  expect(links).toEqual([{ href: 'https://forms.gle/wcdwUucaTzTa3EdS9', target: '_blank', rel: 'noopener noreferrer' }]);
});

test('iPhone: saving a drawing opens a tab with the picture, allowed by the CSP', async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ baseURL, serviceWorkers: 'block', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', viewport: { width: 400, height: 780 } });
  const page = await ctx.newPage();
  const seen = await watch(page);
  await openWith(page, {});
  await page.locator('#pFName').fill('Al'); await page.locator('#pFStart').click();
  await page.locator('#wMenu [data-m="free"]').click();
  const c = await page.locator('#dcv').boundingBox();
  await page.mouse.move(c.x + 40, c.y + 40); await page.mouse.down(); await page.mouse.move(c.x + 140, c.y + 90, { steps: 5 }); await page.mouse.up();
  const [tab] = await Promise.all([ctx.waitForEvent('page'), page.locator('#dSave').click()]);
  await tab.waitForLoadState();
  await expect(tab.locator('img')).toHaveCount(1);
  expect(await tab.locator('img').evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
  expect(seen.violations).toEqual([]);
  await ctx.close();
});

test.describe('offline', () => {
  test.use({ serviceWorkers: 'allow' });
  test('after one visit the app works offline: page, fonts, her voice, the farm; the CSP still applies', async ({ page, context }) => {
    test.setTimeout(90000);
    const seen = await watch(page);
    await openWith(page, withFarm(50, SAVE));
    await page.evaluate(() => navigator.serviceWorker.ready);
    // the service worker saves every clip on install
    await expect.poll(() => page.evaluate(async () => (await caches.keys()).length && !!(await caches.match('/audio/001.mp3'))), { timeout: 30000 }).toBe(true);
    await page.reload();   // now under the service worker
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('#startBtn')).toBeVisible();
    expect(await injected(page, seen)).toBe(false);   // the saved page keeps its CSP
    await tapStart(page);
    await page.locator('#wMenu [data-m="learn"]').click();
    await page.locator('#wGrid [data-c="B"]').click();
    const clip = await page.evaluate(async () => { const r = await fetch('/audio/012.mp3'); return r.ok && (await r.arrayBuffer()).byteLength > 1000; });
    expect(clip).toBe(true);
    expect(await page.evaluate(() => document.fonts.check('700 20px Fredoka'))).toBe(true);
    await page.locator('#topBack').click(); await page.locator('#topBack').click();
    await page.locator('#wMenu [data-m="farm"]').click();
    await expect(page.locator('#fMap .fmarea').first()).toBeVisible();
    await openBarnyard(page);
    await expect(page.locator('#fLayer [data-a="pig"]')).toBeVisible();
    await context.setOffline(false);
    expect(seen.errors).toEqual([]);
    expect(seen.violations).toEqual([]);
    expect(await page.evaluate(() => window.__csp)).toEqual([]);
  });
});

test('Privacy page: reachable from Grown-ups, says what it should, Back returns, and it stays quiet', async ({ page }) => {
  // count what actually plays: her clips (Web Audio or an audio element) and the device voice
  await page.addInitScript(() => {
    window.__tts = []; window.__play = 0;
    try { const s = speechSynthesis, f = s.speak.bind(s); s.speak = (u) => { window.__tts.push(u.text); return f(u); }; } catch (e) {}
    const P = (window.BaseAudioContext || window.AudioContext).prototype, b = P.createBufferSource; P.createBufferSource = function () { window.__play++; return b.apply(this, arguments); };
    const pl = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { if (this.src && !/^data:/.test(this.src)) window.__play++; return pl.apply(this, arguments); };
  });
  await openWith(page, {});
  await page.locator('#pFName').fill('Maya'); await page.locator('#pFStart').click();
  await grownUps(page);
  await page.locator('#gPrivBtn').click();
  const p = page.locator('#gPriv');
  await expect(p).toBeVisible();
  await expect(page.locator('#prompt')).toHaveText('Privacy');
  for (const t of ['No accounts', 'No ads, no analytics, no trackers', 'Progress stays on this device', 'Google Form', 'outside service', 'CONTACT EMAIL'])
    await expect(p).toContainText(t);
  const n = await page.evaluate(() => window.__play);
  await page.waitForTimeout(12000);   // longer than the 10 s idle reminder: nothing is said here
  expect(await page.evaluate(() => window.__play)).toBe(n);
  expect(await page.evaluate(() => window.__tts)).toEqual([]);
  await page.locator('#topBack').click();
  await expect(page.locator('#gHome')).toBeVisible();
});
