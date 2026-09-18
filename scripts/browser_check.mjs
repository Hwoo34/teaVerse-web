// 헤드리스 Chromium으로 앱을 로드하고 콘솔/페이지 에러와 렌더 결과를 캡처한다.
// 실행: node /tmp/browser_check.mjs  (playwright가 /tmp에 설치된 상태)
import pw from '/tmp/node_modules/playwright/index.js';
const { chromium } = pw;

const URL = process.env.CHECK_URL || 'http://localhost:5173/';

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();

const logs = [];
page.on('console', (msg) => logs.push(`[console.${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}\n${err.stack || ''}`));
page.on('requestfailed', (req) =>
  logs.push(`[requestfailed] ${req.url()} :: ${req.failure()?.errorText}`),
);

const resp = await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }).catch((e) => {
  logs.push(`[goto-error] ${e.message}`);
  return null;
});

// 렌더 안정화 대기
await page.waitForTimeout(2500);

const rootHtml = await page.evaluate(() => {
  const r = document.getElementById('root');
  return r ? r.innerHTML : '(#root 없음)';
});
const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 400));

console.log('=== HTTP status:', resp ? resp.status() : 'N/A');
console.log('=== #root innerHTML 길이:', rootHtml.length);
console.log('=== body 텍스트(앞부분):');
console.log(bodyText || '(빈 화면)');
console.log('=== 콘솔/에러 로그 ===');
console.log(logs.length ? logs.join('\n') : '(로그 없음)');

await browser.close();
