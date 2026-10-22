import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildHtml, ROOT } from './build-html.mjs';
import { createServer } from './serve-html.mjs';

let chromium;
try { ({ chromium } = await import('playwright-core')); }
catch { ({ chromium } = createRequire(new URL('../../kayanos-guide/tools/package.json', import.meta.url))('playwright-core')); }
const pages = buildHtml();
const server = createServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/ar/`;
let browser;
const errors = [], checks = [];
const shots = path.join(ROOT, 'review/screenshots');
fs.mkdirSync(shots, { recursive: true });
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  for (const width of [1440, 390]) for (const theme of ['dark', 'light']) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    for (const name of Object.keys(pages)) {
      await page.goto(base + name);
      await page.evaluate(() => document.fonts.ready);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: overflow at ${width}`);
      assert.ok(await page.locator('.draft-notice').isVisible());
      assert.equal(await page.locator('[data-lang-switch]').count(), 0);
      checks.push({ page: name, width, theme });
    }
    await page.goto(base);
    await page.locator('.path-link').first().click();
    await page.waitForURL('**/c1.html');
    await page.evaluate(() => localStorage.setItem('kos-guide-progress', '{"preserve":true}'));
    const done = page.locator('[data-done]').first();
    await done.click();
    assert.equal(await done.getAttribute('aria-pressed'), 'true');
    await page.reload();
    assert.equal(await page.locator('[data-done]').first().getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => localStorage.getItem('kos-guide-progress')), '{"preserve":true}');
    await page.locator('label').filter({ has: page.locator('[data-check]') }).first().click();
    await page.reload();
    assert.ok(await page.locator('[data-check]').first().isChecked());
    await page.locator('#c1-s4').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('#c1-s4 .dg-node').count(), 5);
    const sectionShotStyle = '.topbar, .stepper, .read-progress { visibility: hidden !important; }';
    await page.locator('#c1-s4').screenshot({ path: path.join(shots, `journey-${width}-${theme}.png`), style: sectionShotStyle });
    await page.locator('#c1-s6').screenshot({ path: path.join(shots, `exercise-${width}-${theme}.png`), style: sectionShotStyle });
    const before = await page.locator('html').getAttribute('data-theme');
    await page.locator('[data-theme-toggle]').click();
    assert.notEqual(await page.locator('html').getAttribute('data-theme'), before);
    await page.reload();
    assert.notEqual(await page.locator('html').getAttribute('data-theme'), before);
    await page.locator('[data-theme-toggle]').click();
    await page.locator('[data-open-search]').first().click();
    await page.locator('.palette input').fill('التكليف');
    await page.locator('.palette-list a').first().waitFor();
    assert.ok(await page.locator('.palette-list a').count() > 0);
    await page.locator('.palette-list a').first().click();
    assert.ok(!(await page.locator('.palette').isVisible()));
    await page.goto(base + 'c1.html#c1-s1');
    await page.locator('[data-step-next]').click();
    assert.ok(page.url().includes('#c1-s2'));
    if (width === 390) {
      await page.locator('[data-open-toc]').click();
      const chapter = page.locator('.toc-ch-link[href="c2.html"]');
      await chapter.click();
      await page.waitForURL('**/c2.html');
    }
    await page.goto(base);
    await page.locator('[data-continue]').click();
    assert.ok(!page.url().endsWith('/ar/'));
    await page.goto(base);
    await page.locator('[data-reset]').click();
    await page.locator('.reset-dialog button[value="reset"]').click();
    await page.locator('.reset-dialog').waitFor({ state: 'hidden' });
    assert.ok(await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('industrial-observatory-guide-progress') || '{}');
      return !Object.keys(state.done || {}).length;
    }));
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(shots, `home-${width}-${theme}.png`), fullPage: true });
    await page.goto(base + 'c1.html');
    await page.screenshot({ path: path.join(shots, `chapter-${width}-${theme}.png`), fullPage: true });
    await page.goto(base + 'c2.html');
    assert.equal(await page.locator('.step').count(), 6);
    const roleCheck = page.locator('#c2-s6 label').filter({ has: page.locator('[data-check]') }).first();
    await roleCheck.click();
    await page.reload();
    assert.ok(await page.locator('#c2-s6 [data-check]').first().isChecked());
    const zooms = page.locator('.step [data-zoom]');
    assert.equal(await zooms.count(), 4);
    for (let i = 0; i < 4; i++) {
      const shot = zooms.nth(i);
      await shot.scrollIntoViewIfNeeded();
      await shot.locator('img').evaluate(img => img.decode());
      assert.ok(await shot.locator('img').evaluate(img => img.naturalWidth > 0));
      await shot.click();
      assert.ok(await page.locator('.lightbox').isVisible());
      await page.keyboard.press('Escape');
      assert.ok(await page.locator('.lightbox').isHidden());
    }
    for (const [id, label] of [['c2-s2', 'approval-path'], ['c2-s3', 'starting-points'], ['c2-s5', 'candidates']]) {
      await page.locator('#' + id).screenshot({ path: path.join(shots, `roles-${label}-${width}-${theme}.png`), style: sectionShotStyle });
    }
    await page.goto(base + 'c2.html#c2-s1');
    await page.screenshot({ path: path.join(shots, `roles-chapter-${width}-${theme}.png`), fullPage: true });
    await context.close();
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(ROOT, 'review/browser-verification.json'), JSON.stringify({ checkedAt: new Date().toISOString(), checks, interactions: ['chapter cards', 'next step', 'mobile menu', 'search and result selection', 'reading progress persistence and isolation', 'resume', 'reset', 'theme persistence', 'chapter 1 and 2 checklist persistence', 'chapter 2 screenshot zoom and Escape for all four images'], errors }, null, 2));
  console.log(`Passed ${checks.length} page checks and reader interactions in four viewport/theme combinations.`);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
