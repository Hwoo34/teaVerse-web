// 배포 사이트에서 실제 챗봇(AgentCore) 동작을 브라우저로 검증 + 대화 캡처.
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
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1000);
  const ins = p.locator('input');
  await ins.nth(0).fill(user);
  await ins.nth(1).fill(pass);
  await p.getByText('로그인', { exact: true }).last().click();
  await p.waitForTimeout(4000);
  await p.locator('.fab').click({ force: true });
  await p.waitForTimeout(1000);
  return { p, errs };
}

async function ask(p, text, waitMs) {
  await p.locator('.chat-input input').fill(text);
  await p.locator('.chat-input button').click();
  await p.waitForTimeout(waitMs);
  // 마지막 assistant 버블 텍스트
  return await p.evaluate(() => {
    const bs = document.querySelectorAll('.msg.assistant .bubble-text');
    return bs.length ? bs[bs.length - 1].textContent : '(없음)';
  });
}

// user01
const { p: up, errs: uerr } = await session(USER_U, USER_P);
const r1 = await ask(up, '철관음은 어떤 차야?', 12000);
console.log('USER-QA:', (r1 || '').slice(0, 80), '| err:', uerr.join(';') || 'none');
await up.screenshot({ path: `${OUT}/deployed-user-qa.png` });

// admin
const { p: ap } = await session(ADMIN_U, ADMIN_P);
const r2 = await ask(ap, '전시 데이터 업데이트해줘', 15000);
console.log('ADMIN-INGEST:', (r2 || '').slice(0, 80));
await ap.screenshot({ path: `${OUT}/deployed-admin-ingest.png` });

await b.close();
console.log('done');
