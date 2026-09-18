// 배포 사이트에서 로그인 후 챗봇 패널 캡처 (FAB 펄스 애니메이션 때문에 force 클릭).
import pw from '/tmp/node_modules/playwright/index.js';
const { chromium } = pw;
const BASE = process.env.SITE || process.env.SITE_URL || 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '/tmp/report';
const USER_U = process.env.USER1_USERNAME || 'user01';
const USER_P = process.env.USER1_PASSWORD || '';

const b = await chromium.launch({ args: ['--no-sandbox'] });
const p = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }).then(c => c.newPage());

// 로그인
await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
await p.waitForTimeout(1000);
const ins = p.locator('input');
await ins.nth(0).fill(USER_U);
await ins.nth(1).fill(USER_P);
await p.getByText('로그인', { exact: true }).last().click();
await p.waitForTimeout(4000);

// 챗봇 열기 (force, 애니메이션 무시)
await p.locator('.fab').click({ force: true });
await p.waitForTimeout(1200);
await p.screenshot({ path: `${OUT}/chat-loggedin.png` });
console.log('chat-loggedin captured');

await b.close();
