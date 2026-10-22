import assert from 'node:assert/strict';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { buildHtml, ROOT } from './build-html.mjs';
import { createServer } from './serve-html.mjs';

buildHtml();
const server = createServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/ar/`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
try {
  for (const width of [1440, 768, 390, 320]) for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce' });
    page.on('pageerror', error => errors.push(error.message));
    for (const route of ['index.html', 'c1.html', 'q1.html']) {
      await page.goto(base + route);
      assert.equal(await page.locator('.ministry-banner, .draft-notice').count(), 0);
      assert.equal(await page.locator('.guide-footer strong').innerText(), 'وزارة الاقتصاد والصناعة');
      assert.ok(await page.locator('.guide-footer strong').isVisible());
      await page.locator('.footer-ministry img').evaluate(img => img.decode());
      assert.ok(await page.locator('.footer-ministry img').evaluate(img => img.naturalWidth > 0));
      const footer = page.locator('.guide-footer');
      const check = async () => {
        const box = await footer.boundingBox();
        assert.equal(Math.round(box.y + box.height), 900);
        assert.equal(box.height, width <= 680 ? 72 : 64);
        assert.equal(Math.round((await page.locator('.topbar').boundingBox()).y), 0);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.ok(await footer.evaluate(el => [...el.querySelectorAll('img, strong, .footer-rights p')].every(child => {
          const r = child.getBoundingClientRect(), f = el.getBoundingClientRect();
          return r.top >= f.top && r.bottom <= f.bottom && r.left >= 0 && r.right <= innerWidth;
        })));
      };
      await check();
      if (route === 'index.html' && width !== 320) {
        await page.screenshot({ path: path.join(ROOT, `review/screenshots/clean-header-${width}-${theme}.png`) });
      }
      await page.mouse.wheel(0, 1200);
      await page.waitForFunction(() => scrollY > 0);
      await check();
      if (route !== 'index.html') {
        await page.goto(base + route + '#' + route.replace('.html', '') + '-s1');
        await page.locator('[data-step-next]').click();
        assert.ok(page.url().includes('-s2'));
        await check();
        const stepper = await page.locator('.stepper').boundingBox();
        assert.ok(stepper.y + stepper.height < (await footer.boundingBox()).y);
      }
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await check();
      if (route === 'q1.html' && width !== 320) {
        await page.screenshot({ path: path.join(ROOT, `review/screenshots/sticky-footer-${width}-${theme}.png`) });
        await page.locator('.quick-guide-link').click();
        await page.waitForURL('**/index.html');
        await check();
      }
    }
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log('Passed 24 page/viewport/theme combinations: compact pinned footer, scroll, navbar, step navigation, guide switching, and no overlap/overflow.');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
