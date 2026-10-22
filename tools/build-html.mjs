import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDocument } from './latex-parse.mjs';
import { renderSite, UI } from './html-render.mjs';

const quickLink = (page) => `<a class="quick-guide-link${page === 'q1.html' ? ' is-current' : ''}" href="q1.html"${page === 'q1.html' ? ' aria-current="page"' : ''} title="الدليل السريع"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg><span>الدليل السريع</span></a>`;
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function buildHtml() {
  const site = path.join(ROOT, 'site');
  fs.mkdirSync(path.join(site, 'ar'), { recursive: true });
  fs.mkdirSync(path.join(site, 'assets/screens'), { recursive: true });
  for (const name of ['guide.css', 'guide.js', 'kayanos-mark.svg', 'favicon.svg']) {
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
    const status = {
      'c1.html': '<strong>الفصل الأول · معتمد.</strong> يشرح الفكرة ورحلة المثال قبل إعدادها داخل النظام.',
      'c2.html': '<strong>الفصل الثاني · معتمد.</strong> شخصيات العمل في المسح، ومسار المراجعة، ونقطة البداية لكل شخص، مع تطبيق على المثال.',
      'c3.html': '<strong>الفصل الثالث · معتمد.</strong> ملف المنشأة وسجلاتها وحالتاها وربطها بفريق المسح.',
      'c4.html': '<strong>الفصل الرابع · معتمد.</strong> بناء نموذج «بيانات التشغيل» وقواعده وربطه بالسجل، ثم جمعه في حزمة.',
      'c5.html': '<strong>الفصل الخامس · معتمد.</strong> إعداد خطة «متابعة تشغيل الأفق» ومعاينتها وإطلاق جولة أيلول 2026.',
      'c6.html': '<strong>الفصل السادس · معتمد.</strong> فتح التكليف وتعبئة الوحدتين وتصحيح رسائل التحقق والإرسال.',
      'c7.html': '<strong>الفصل السابع · معتمد.</strong> ضبط خطوة الموافقة، وتقييم الإجابات، وإعادة «سبب التوقف» للتصحيح، والتوقيع حتى الاعتماد.',
      'c8.html': '<strong>الفصل الثامن · معتمد.</strong> قراءة تقدم الخطة، وإعادة التوزيع، وسجل الجولة، ولوحة مؤشرات من الخطة، وإغلاق الجولة.',
      'quick.html': '<strong>الدليل السريع · معتمد.</strong> الدورة كاملة في صفحة واحدة، مع روابط إلى الفصول التفصيلية.',
      'q1.html': '<strong>الدليل السريع · معتمد.</strong> الدورة كاملة في صفحة واحدة، مع روابط إلى الفصول التفصيلية.',
      'index.html': '<strong>الدليل مكتمل ومعتمد.</strong> الفصول الثمانية والدليل السريع معتمدة، وقد طُبق مثال مصنع الأفق فعلياً من البداية إلى النهاية.',
    }[name] ?? '<strong>مخطط فصل لم يبدأ بعد.</strong> هذه الصفحة تحدد موضوعات الفصل، وليست شرحاً لإجراءاته.';
    const notice = `<aside class="draft-notice">${status}</aside>`;
    // Arabic is the only authored language. Fail visibly if the shared shell changes.
    if (!source.includes('class="lang-btn"')) throw new Error('Shared language-switch markup changed');
    const html = source.replace(/<a class="lang-btn"[^>]*>[\s\S]*?<\/a>/, '')
      .replace(/<link rel="alternate" hreflang="en"[^>]*>/, '')
      .replace('</head>', '<link rel="stylesheet" href="../assets/observatory.css"></head>')
      .replace('</header>', `</header>${notice}`)
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
