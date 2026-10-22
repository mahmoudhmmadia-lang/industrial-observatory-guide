// node annotate.mjs spec.json  — crops raw captures, blurs masked regions, draws numbered markers.
// Spec: [{ src, out, crop: {x,y,w,h}, marks: [{n,x,y}], masks: [{x,y,w,h}], quality }]; coordinates are in source pixels.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'file:///D:/stuff/right-code/taskflow/industrial-observatory-guide/tools/node_modules/playwright-core/index.mjs';

const specs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const page = await browser.newPage();
await page.setContent('<canvas id="c"></canvas>');
for (const spec of specs) {
  const data = 'data:image/png;base64,' + fs.readFileSync(path.resolve(spec.src)).toString('base64');
  const type = spec.out.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
  const out = await page.evaluate(async ({ data, spec, type }) => {
    const img = new Image(); img.src = data; await img.decode();
    const crop = spec.crop ?? { x: 0, y: 0, w: img.width, h: img.height };
    const c = document.getElementById('c'); c.width = crop.w; c.height = crop.h;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
    for (const m of spec.masks ?? []) {
      const x = m.x - crop.x, y = m.y - crop.y;
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, m.w, m.h); ctx.clip();
      ctx.filter = 'blur(10px)'; ctx.drawImage(img, m.x, m.y, m.w, m.h, x, y, m.w, m.h);
      ctx.filter = 'none'; ctx.fillStyle = 'rgba(232,227,217,1)'; ctx.fillRect(x, y, m.w, m.h); ctx.restore();
    }
    for (const mk of spec.marks ?? []) {
      const x = mk.x - crop.x, y = mk.y - crop.y, r = 13;
      ctx.beginPath(); ctx.arc(x, y, r + 2, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = '#12a368'; ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 15px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(mk.n), x, y + 1);
    }
    return c.toDataURL(type, 0.9);
  }, { data, spec, type });
  fs.writeFileSync(path.resolve(spec.out), Buffer.from(out.split(',')[1], 'base64'));
  console.log('wrote', spec.out);
}
await browser.close();
