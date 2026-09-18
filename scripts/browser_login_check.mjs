// 로그인 페이지에서 user01로 실제 로그인 시도 후 상태 확인.
import pw from '/tmp/node_modules/playwright/index.js';
const { chromium } = pw;

const BASE = process.env.SITE_URL || 'http://localhost:5173';
const USER_U = process.env.USER1_USERNAME || 'user01';
const USER_P = process.env.USER1_PASSWORD || '';

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

// 아이디/비번 입력
const inputs = page.locator('input');
await inputs.nth(0).fill(USER_U);
await inputs.nth(1).fill(USER_P);
// 로그인 버튼 클릭
await page.getByText('로그인', { exact: true }).last().click();
await page.waitForTimeout(4000);

const bodyText = await page.evaluate(() => document.body.innerText);
const loggedIn = bodyText.includes('로그인되어') || bodyText.includes('user01');
console.log('=== 로그인 후 body 일부 ===');
console.log(bodyText.slice(0, 300));
console.log('=== pageerror ===', logs.length ? logs.join('\n') : '(없음)');
console.log('=== 로그인 성공 추정:', loggedIn);

await browser.close();
