import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDocument } from './latex-parse.mjs';
import { renderSite, UI } from './html-render.mjs';

const quickLink = (page) => {
  const quick = page === 'q1.html' || page === 'quick.html';
  const label = quick ? 'الدليل التفصيلي' : 'الدليل السريع';
  const glyph = quick ? 'M4 4h6a2 2 0 0 1 2 2v15a4 4 0 0 0-4-2H4z M20 4h-6a2 2 0 0 0-2 2v15a4 4 0 0 1 4-2h4z' : 'M13 2 4 14h7l-1 8 9-12h-7z';
  return `<a class="quick-guide-link" href="${quick ? 'index.html' : 'q1.html'}" title="${label}"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${glyph}"/></svg><span>${label}</span></a>`;
};
const footer = `<footer class="guide-footer"><div class="guide-footer-in"><div class="footer-ministry"><img src="../assets/ministry-logo.png" alt="شعار وزارة الاقتصاد والصناعة" width="760" height="230"><strong>وزارة الاقتصاد والصناعة</strong></div><div class="footer-rights"><div class="rightcode-logo"><img src="../assets/rightcode-logo.png" alt="Right Code" width="2528" height="518"></div><p>جميع الحقوق محفوظة لشركة <bdi dir="ltr">Right Code</bdi> © ${new Date().getFullYear()}</p></div></div></footer>`;
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function buildHtml() {
  const site = path.join(ROOT, 'site');
  fs.mkdirSync(path.join(site, 'ar'), { recursive: true });
  fs.mkdirSync(path.join(site, 'assets/screens'), { recursive: true });
  for (const name of ['guide.css', 'guide.js', 'kayanos-mark.svg', 'favicon.svg', 'ministry-logo.png', 'rightcode-logo.png']) {
    fs.copyFileSync(path.join(ROOT, 'web', name), path.join(site, 'assets', name));
  }
  fs.copyFileSync(path.join(ROOT, 'web/observatory.css'), path.join(site, 'assets/observatory.css'));
  const doc = loadDocument(ROOT, { lang: 'ar' });
  const quickDoc = loadDocument(path.join(ROOT, 'quick'), { lang: 'ar' });
  const original = { ...UI.ar };
  let pages;
  try {
    Object.assign(UI.ar, {
      brand: 'دليل المرصد الصناعي',
      start: 'ابدأ بالفصل الأول',
      helpWork: 'يحفظ زر «تحديد كمنجزة» تقدّم قراءتك في هذا المتصفح فقط. اعتماد فصول الدليل أثناء التأليف يتم بمراجعة المستخدم، ولا يرتبط بهذا الزر.',
    });
    // The quick guide is a companion document (q1.html): references and search span both guides.
    const tag = (o, name) => ({ routes: o.routes, ids: o.ids, labels: o.labels, search: o.search.map(x => ({ ...x, c: x.chapter ? name : `${name} · ${x.c}` })) });
    const main = {};
    renderSite(doc, { lang: 'ar', guide: { store: 'industrial-observatory-guide-progress', out: main } });
    const quick = {};
    pages = renderSite(quickDoc, { lang: 'ar', guide: { home: 'quick.html', prefix: 'q', store: 'industrial-observatory-guide-progress-quick', parent: { href: 'index.html' }, out: quick, extra: tag(main, main.title) } });
    Object.assign(pages, renderSite(doc, { lang: 'ar', guide: { store: 'industrial-observatory-guide-progress', extra: tag(quick, quick.title) } }));
  } finally { Object.assign(UI.ar, original); }
  for (const [name, source] of Object.entries(pages)) {
    // Arabic is the only authored language. Fail visibly if the shared shell changes.
    if (!source.includes('class="lang-btn"')) throw new Error('Shared language-switch markup changed');
    const html = source.replace(/<a class="lang-btn"[^>]*>[\s\S]*?<\/a>/, '')
      .replace(/<link rel="alternate" hreflang="en"[^>]*>/, '')
      .replace('</head>', '<link rel="stylesheet" href="../assets/observatory.css"></head>')
      .replace('<dialog class="help-dialog"', `${footer}<dialog class="help-dialog"`)
      .replace(/(<button class="guide-help-link"[\s\S]*?<\/button>)/, `$1${quickLink(name)}`);
    if (!html.includes('class="quick-guide-link')) throw new Error('Quick-guide button was not placed');
    fs.writeFileSync(path.join(site, 'ar', name), html);
  }
  const copyImages = blocks => blocks.forEach(block => {
    if (block.image) fs.copyFileSync(path.join(ROOT, block.image), path.join(site, 'assets/screens', path.basename(block.image)));
    if (block.blocks) copyImages(block.blocks);
  });
  copyImages(doc.blocks);
  copyImages(quickDoc.blocks);
  fs.writeFileSync(path.join(site, 'index.html'), '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=ar/index.html"><title>دليل المرصد الصناعي</title><a href="ar/index.html">افتح دليل المرصد الصناعي</a></html>');
  return pages;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Built ${Object.keys(buildHtml()).length} Arabic pages.`);
}
