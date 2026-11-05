// Delivery gate. Run against `npm run preview` (port 4173):
//   NODE_PATH=$(npm root -g) node tests/smoke.cjs path/to/local/ai-menu.js
const { chromium } = require('playwright');
const ok = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('ok', m); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  for (const vw of [1440, 390]) {
    const ctx = await b.newContext({ viewport: { width: vw, height: vw > 500 ? 900 : 844 } });
    if (process.argv[2]) await ctx.route('https://appofapp-gh.vercel.app/ai-menu.js', (r) => r.fulfill({ path: process.argv[2], contentType: 'text/javascript' }));
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    for (const path of ['/', '/lab', '/atlas', '/test', '/method']) {
      await p.goto('http://localhost:4173/#' + path);
      await p.waitForTimeout(2500);
      const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      ok(m.sw <= m.cw, `${vw} ${path}: no horizontal scroll`);
      ok(await p.locator('ai-menu .logo').isVisible(), `${vw} ${path}: A&I logo button in the top bar`);
      ok(!(await p.locator('header >> text=העתקת קישור').first().isVisible().catch(() => false)), `${vw} ${path}: no loose development buttons`);
      ok((await p.evaluate(() => document.documentElement.dir)) === 'rtl', `${vw} ${path}: rtl`);
    }
    await p.goto('http://localhost:4173/#/lab?case=24&code=grid');
    await p.waitForTimeout(3000);
    ok((await p.textContent('.verdict')).includes('לא משחזר'), `${vw}: grid does not reproduce Ville Radieuse`);
    ok(errs.length === 0, `${vw}: no page errors ${errs.join(' | ')}`);
    await ctx.close();
  }
  await b.close();
})();
