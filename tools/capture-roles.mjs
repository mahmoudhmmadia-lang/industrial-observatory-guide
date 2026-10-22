// Read-only capture of the already authenticated reference browser; no session is saved.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../../kayanos-guide/tools/package.json', import.meta.url))('playwright-core');
const root = path.resolve(import.meta.dirname, '..');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9337');
try {
  const page = browser.contexts()[0].pages()[0];
  if (!page.url().startsWith('https://mei-4.kayanos.app/tasks/assignments/plans/')) throw new Error('Open the authorized reference plan first.');
  const section = page.locator('button[aria-controls="plan-setup-candidates-body"]').locator('../..');
  if (await page.locator('button[aria-controls="plan-setup-candidates-body"]').getAttribute('aria-expanded') !== 'true') {
    await page.locator('button[aria-controls="plan-setup-candidates-body"]').click();
  }
  await section.scrollIntoViewIfNeeded();
  await section.evaluate(el => { el.dataset.guideCapture = 'candidates'; el.style.position = 'relative'; });
  const marks = ['حقل في السجل', 'فريق المسح · وحدة', 'باحث ميداني - RES'];
  for (const [i, label] of marks.entries()) {
    await section.getByText(label, { exact: true }).evaluate((el, n) => {
      const host = el.closest('button') || el;
      const panel = document.querySelector('[data-guide-capture="candidates"]');
      const box = panel.getBoundingClientRect(), target = host.getBoundingClientRect();
      const marker = document.createElement('span');
      marker.dataset.guideMark = String(n);
      marker.textContent = String(n);
      Object.assign(marker.style, { position: 'absolute', top: `${target.top - box.top + 2}px`, left: `${Math.max(2, target.left - box.left - 28)}px`, width: '25px', height: '25px', borderRadius: '50%', background: '#12a368', color: 'white', border: '2px solid white', font: 'bold 15px/21px Arial', textAlign: 'center', zIndex: '100', pointerEvents: 'none' });
      panel.append(marker);
    }, i + 1);
  }
  const image = 'assets/screens/roles-candidates-ar.png';
  await section.screenshot({ path: path.join(root, image), style: '.courtyard-topbar, .sticky.bottom-3 { visibility: hidden !important; }' });
  await page.locator('[data-guide-mark]').evaluateAll(nodes => nodes.forEach(node => node.remove()));
  fs.writeFileSync(path.join(root, 'review/roles-screenshot-manifest.json'), JSON.stringify({ source: page.url(), capturedAt: new Date().toISOString(), language: 'ar', scope: 'Read-only existing configuration; not the fictional example', image, marks: marks.map((label, i) => ({ n: i + 1, label })), modifications: 'Number markers added to the DOM before capture; no application values changed.' }, null, 2));
  console.log('Captured candidate configuration with three numbered controls.');
} finally { await browser.close(); }
