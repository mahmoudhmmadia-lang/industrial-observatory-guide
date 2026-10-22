import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDocument } from '../../kayanos-guide/tools/latex-parse.mjs';
import { renderSite, UI } from '../../kayanos-guide/tools/html-render.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shared = path.resolve(ROOT, '../kayanos-guide');
export function buildHtml() {
  const site = path.join(ROOT, 'site');
  fs.mkdirSync(path.join(site, 'ar'), { recursive: true });
  fs.mkdirSync(path.join(site, 'assets/screens'), { recursive: true });
  for (const name of ['guide.css', 'guide.js', 'kayanos-mark.svg', 'favicon.svg']) {
    fs.copyFileSync(path.join(shared, 'web', name), path.join(site, 'assets', name));
  }
  fs.copyFileSync(path.join(ROOT, 'web/observatory.css'), path.join(site, 'assets/observatory.css'));
  const doc = loadDocument(ROOT, { lang: 'ar' });
  const original = { ...UI.ar };
  let pages;
  try {
    Object.assign(UI.ar, {
      brand: 'دليل المرصد الصناعي',
      start: 'ابدأ بالفصل الأول',
      helpWork: 'يحفظ زر «تحديد كمنجزة» تقدّم قراءتك في هذا المتصفح فقط. اعتماد فصول الدليل أثناء التأليف يتم بمراجعة المستخدم، ولا يرتبط بهذا الزر.',
    });
    pages = renderSite(doc, { lang: 'ar', guide: { store: 'industrial-observatory-guide-progress' } });
  } finally { Object.assign(UI.ar, original); }
  for (const [name, source] of Object.entries(pages)) {
    const status = name === 'c1.html'
      ? '<strong>الفصل الأول · معتمد.</strong> يشرح الفكرة ورحلة المثال قبل إعدادها داخل النظام.'
      : name === 'c2.html'
        ? '<strong>الفصل الثاني · قيد المراجعة.</strong> شخصيات العمل في المسح، ومسار المراجعة، ونقطة البداية لكل شخص، مع تطبيق على المثال.'
        : name === 'c3.html'
        ? '<strong>الفصل الثالث · قيد المراجعة.</strong> ملف المنشأة وسجلاتها وحالتاها وربطها بفريق المسح، مع تطبيق على المثال.'
        : name === 'c4.html'
        ? '<strong>الفصل الرابع · قيد المراجعة.</strong> بناء نموذج «بيانات التشغيل» وقواعده وربطه بالسجل، ثم جمعه في حزمة.'
        : name === 'index.html'
        ? '<strong>الدليل قيد التأليف.</strong> الفصل الأول معتمد، والفصول من الثاني إلى الرابع متاحة للمراجعة. الفصول التالية مخططات لم تبدأ بعد.'
        : '<strong>مخطط فصل لم يبدأ بعد.</strong> هذه الصفحة تحدد موضوعات الفصل، وليست شرحاً لإجراءاته.';
    const notice = `<aside class="draft-notice">${status}</aside>`;
    // Arabic is the only authored language. Fail visibly if the shared shell changes.
    if (!source.includes('class="lang-btn"')) throw new Error('Shared language-switch markup changed');
    const html = source.replace(/<a class="lang-btn"[^>]*>[\s\S]*?<\/a>/, '')
      .replace(/<link rel="alternate" hreflang="en"[^>]*>/, '')
      .replace('</head>', '<link rel="stylesheet" href="../assets/observatory.css"></head>')
      .replace('</header>', `</header>${notice}`);
    fs.writeFileSync(path.join(site, 'ar', name), html);
  }
  const copyImages = blocks => blocks.forEach(block => {
    if (block.image) fs.copyFileSync(path.join(ROOT, block.image), path.join(site, 'assets/screens', path.basename(block.image)));
    if (block.blocks) copyImages(block.blocks);
  });
  copyImages(doc.blocks);
  fs.writeFileSync(path.join(site, 'index.html'), '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=ar/index.html"><title>دليل المرصد الصناعي</title><a href="ar/index.html">افتح دليل المرصد الصناعي</a></html>');
  return pages;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Built ${Object.keys(buildHtml()).length} Arabic pages.`);
}
