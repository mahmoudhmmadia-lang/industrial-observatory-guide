import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildHtml, ROOT } from './build-html.mjs';

const pages = buildHtml();
test('every local link and fragment resolves in the Arabic guide', () => {
  for (const [name, html] of Object.entries(pages)) {
    const built = fs.readFileSync(path.join(ROOT, 'site/ar', name), 'utf8');
    for (const match of built.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const href = match[1].replaceAll('&amp;', '&');
      if (/^(https?:|data:|mailto:)/.test(href)) continue;
      const [url, fragment] = href.split('#');
      const dest = url ? path.resolve(ROOT, 'site/ar', url.split('?')[0]) : path.resolve(ROOT, 'site/ar', name);
      assert.ok(fs.existsSync(dest), `${name}: missing ${href}`);
      if (fragment && dest.endsWith('.html')) {
        assert.ok(fs.readFileSync(dest, 'utf8').includes(`id="${fragment}"`), `${name}: missing anchor ${href}`);
      }
    }
    assert.ok(html.includes('industrial-observatory-guide-progress'));
  }
});

test('clean shell is rendered and no untranslated language route is offered', () => {
  assert.equal(Object.keys(pages).length, 11);
  for (const name of Object.keys(pages)) {
    const html = fs.readFileSync(path.join(ROOT, 'site/ar', name), 'utf8');
    assert.doesNotMatch(html, /class="(?:draft-notice|ministry-banner)"/);
    assert.match(html, /dir="rtl"/);
    assert.doesNotMatch(html, /\.\.\/en\//);
    if (['c1.html', 'c2.html', 'c3.html', 'c4.html', 'c5.html', 'c6.html', 'c7.html', 'c8.html', 'quick.html', 'q1.html'].includes(name)) {

      assert.doesNotMatch(html.split('<script id="guide-data"')[0], /حالة الفصل: لم يبدأ/);
        } else if (name !== 'index.html') assert.match(html, /حالة الفصل: لم يبدأ/);
    const quick = ['quick.html', 'q1.html'].includes(name);
    assert.ok(html.includes(`class="quick-guide-link" href="${quick ? 'index.html' : 'q1.html'}"`));
    assert.ok(html.includes(`<span>${quick ? 'الدليل التفصيلي' : 'الدليل السريع'}</span>`));
    assert.match(html, /class="brand-lockup" dir="ltr"/);
    assert.match(html, /class="guide-footer"/);
    assert.match(html, /<strong>وزارة الاقتصاد والصناعة<\/strong>/);
    assert.match(html, /assets\/rightcode-logo.png/);
  }
});

test('published pages never name the environment the screenshots come from', () => {
  for (const name of Object.keys(pages)) {
    const html = fs.readFileSync(path.join(ROOT, 'site/ar', name), 'utf8');
    assert.doesNotMatch(html, /mei-?\d|المؤسسة المرجعية/i, `${name} names the screenshot source`);
  }
});
