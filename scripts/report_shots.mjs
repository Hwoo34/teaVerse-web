// 배포 사이트(S3) 기준 리포트용 스크린샷 캡처.
// 정보 페이지 + 로그인 + 챗봇(게스트/로그인) 상태를 캡처한다.
import pw from '/tmp/node_modules/playwright/index.js';
const { chromium } = pw;

const BASE = process.env.SITE || process.env.SITE_URL || 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '/tmp/report';
const USER_U = process.env.USER1_USERNAME || 'user01';
const USER_P = process.env.USER1_PASSWORD || '';
import { mkdirSync } from 'node:fs';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const log = (m) => console.log(m);

async function shot(name) {
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  log(`shot ${name}`);
}

// 정보 페이지들
for (const [name, path] of [
  ['home', '/'],
  ['tea', '/tea'],
  ['exhibitions', '/exhibitions'],
  ['products', '/products'],
  ['artists', '/artists'],
  ['login', '/login'],
]) {
  await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 }).catch((e) => log(`goto ${name} ${e.message}`));
  await shot(name);
}

// 챗봇 게스트 상태 (홈에서 fab 클릭)
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.click('.fab');
await shot('chat-guest');

// 로그인 (user01) — 배포 사이트에서 Cognito 직접 인증
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
const inputs = page.locator('input');
await inputs.nth(0).fill(USER_U);
await inputs.nth(1).fill(USER_P);
await page.getByText('로그인', { exact: true }).last().click();
await page.waitForTimeout(4000);
await shot('logged-in-home');

// 로그인 후 챗봇 열기 + 질문 전송(백엔드 미배포 → 안내 표시)
await page.click('.fab');
await page.waitForTimeout(1000);
await shot('chat-loggedin');
const chatInput = page.locator('.chat-input input');
if (await chatInput.count()) {
  await chatInput.fill('철관음은 어떤 차야?');
  await page.locator('.chat-input button').click();
  await page.waitForTimeout(6000);
  await shot('chat-sent');
}

await browser.close();
log('done');
