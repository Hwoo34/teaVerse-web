// 여러 페이지를 렌더하고 스크린샷 + 콘솔에러 캡처.
import pw from '/tmp/node_modules/playwright/index.js';
const { chromium } = pw;

const routes = [
  ['home', 'http://localhost:5173/'],
  ['tea', 'http://localhost:5173/tea'],
  ['products', 'http://localhost:5173/products'],
  ['login', 'http://localhost:5173/login'],
];

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

for (const [name, url] of routes) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch((e) => errors.push(`[goto ${name}] ${e.message}`));
  await page.waitForTimeout(1800);
  const rootLen = await page.evaluate(() => document.getElementById('root')?.innerHTML.length ?? 0);
  await page.screenshot({ path: `/tmp/shot-${name}.png`, fullPage: false });
  console.log(`${name}: rootLen=${rootLen}`);
}

// 챗봇 열기 (홈에서)
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.click('.fab');
await page.waitForTimeout(900);
await page.screenshot({ path: '/tmp/shot-chat.png' });
console.log('chat panel opened');

console.log('=== errors ===', errors.length ? errors.join('\n') : '(없음)');
await browser.close();
