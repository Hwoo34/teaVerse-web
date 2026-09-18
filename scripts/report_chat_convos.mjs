// 로컬(완전 동작) 환경에서 사용자별 챗봇 대화를 실제로 수행하고 캡처.
// user01: 차 QA + 가드레일 거절 / admin: 데이터 수집 명령
import pw from '/tmp/node_modules/playwright/index.js';
const { chromium } = pw;
const BASE = process.env.SITE_URL || 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '/tmp/report';
const ADMIN_U = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_P = process.env.ADMIN_PASSWORD || '';
const USER_U = process.env.USER1_USERNAME || 'user01';
const USER_P = process.env.USER1_PASSWORD || '';

const b = await chromium.launch({ args: ['--no-sandbox'] });

async function session(user, pass) {
  const p = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }).then((c) => c.newPage());
  await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  const ins = p.locator('input');
  await ins.nth(0).fill(user);
  await ins.nth(1).fill(pass);
  await p.getByText('로그인', { exact: true }).last().click();
  await p.waitForTimeout(3500);
  await p.locator('.fab').click({ force: true });
  await p.waitForTimeout(1000);
  return p;
}

async function ask(p, text, waitMs = 9000) {
  const input = p.locator('.chat-input input');
  await input.fill(text);
  await p.locator('.chat-input button').click();
  await p.waitForTimeout(waitMs);
}

// 1) 일반 사용자 user01: 차 QA
const u = await session(USER_U, USER_P);
await ask(u, '철관음은 어떤 차야?');
await u.screenshot({ path: `${OUT}/convo-user-qa.png` });
console.log('convo-user-qa');
// 2) 가드레일: 무관 질문
await ask(u, '오늘 서울 날씨 알려줘', 6000);
await u.screenshot({ path: `${OUT}/convo-user-guardrail.png` });
console.log('convo-user-guardrail');

// 3) 관리자 admin: 데이터 수집 명령
const a = await session(ADMIN_U, ADMIN_P);
await ask(a, '전시 데이터 업데이트해줘', 12000);
await a.screenshot({ path: `${OUT}/convo-admin-ingest.png` });
console.log('convo-admin-ingest');

await b.close();
console.log('done');
