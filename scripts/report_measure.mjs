// print 미디어에서 각 .page의 실제 높이를 측정해 A4(297mm) 초과 여부 확인.
import pw from '/tmp/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch({ args: ['--no-sandbox'] });
const p = await b.newPage();
await p.emulateMedia({ media: 'print' });
await p.goto('file:///workspace/docs/report/TeaVerse-Report.html', { waitUntil: 'networkidle' });
await p.waitForTimeout(1000);
const info = await p.evaluate(() => {
  const A4 = 297 / 25.4 * 96; // px
  return [...document.querySelectorAll('.page')].map((el, i) => ({
    page: i + 1,
    heightPx: Math.round(el.scrollHeight),
    a4Px: Math.round(A4),
    over: el.scrollHeight > A4,
  }));
});
console.log(JSON.stringify(info, null, 1));
await b.close();
