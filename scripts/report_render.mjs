// 리포트 HTML을 렌더해 페이지별 스크린샷 + PDF 생성.
import pw from '/tmp/node_modules/playwright/index.js';
const { chromium } = pw;
const FILE = 'file:///workspace/docs/report/TeaVerse-Report.html';

const b = await chromium.launch({ args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 900, height: 1273 } });
await p.goto(FILE, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);

const pages = await p.locator('.page').all();
for (let i = 0; i < pages.length; i++) {
  await pages[i].screenshot({ path: `/tmp/report/render-p${i + 1}.png` });
  console.log(`rendered page ${i + 1}`);
}

// 제출용 PDF (A4)
await p.emulateMedia({ media: 'print' });
await p.pdf({ path: '/workspace/docs/report/TeaVerse-Report.pdf', format: 'A4', printBackground: true });
console.log('pdf saved');

await b.close();
