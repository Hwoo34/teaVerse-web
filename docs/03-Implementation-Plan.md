# 구현 단계 계획 — TeaVerse

> 문서 버전: v1.0
> 작성일: 2026-09-18
> 원칙: **로컬에서 완전 동작 검증 → 배포는 마지막 단계에서 사용자 승인 후**. 모델은 **Sonnet 4.6 이하**만.

---

## 단계 개요

| Phase | 내용 | 산출물 | 상태 |
|-------|------|--------|------|
| 0 | 개발 환경 / 문서 | Docker, PRD, Arch, Plan | ✅ 완료 |
| 1 | 데이터 시드 | `data/*.json` (차/전시/상품/작가) | ✅ 완료 |
| 2 | 프론트엔드 골격 | React(Vite), 5개 페이지, 라우팅 | ✅ 완료 |
| 3 | 챗봇 위젯 UI | 플로팅 위젯, 로그인 게이팅 | ✅ 완료 |
| 4 | 백엔드 로컬 API | FastAPI, config, 데이터스토어 어댑터 | ✅ 완료 |
| 5 | 에이전트 로직 | Orchestrator/카테고리 QA/수집, 가드레일, 웹검색 tool | ✅ 완료 |
| 6 | 인증 | Cognito 풀/계정/그룹, JWT 검증, 프론트 로그인 | ✅ 완료 |
| 7 | 통합 테스트 | 로컬 E2E 13/13 통과 | ✅ 완료 |
| 8 | 배포 준비 | 빌드, infra 스크립트, 배포 가이드 | ✅ 완료 |
| 9 | UI/UX 리뉴얼 | 커스텀 디자인시스템, framer-motion, SVG 아트 | ✅ 완료 |
| 10 | S3 배포 | 정적 웹 호스팅 배포 | 진행 |

---

## Phase 1 — 데이터 시드
- `data/tea.json`, `data/exhibitions.json`, `data/products.json`, `data/artists.json`.
- 인터넷 검색으로 실제 정보 기반 시드 구성(전통차/중국차/한국차/꽃차, 대표 전시, 다구·다기·자사호 상품, 급부상 작가). 각 항목에 `sources[]`(출처 URL) 포함.
- 스키마는 PRD §7 준수. `lastUpdatedAt`, `sourceType` 메타 포함.
- **DoD**: 4개 파일이 유효 JSON이고 각 카테고리 최소 6~10건.

## Phase 2 — 프론트엔드 골격
- `npm create vite@latest frontend -- --template react-ts`.
- 의존성: `react-router-dom`, `framer-motion`, `amazon-cognito-identity-js`. (초기 Cloudscape는 Phase 9에서 커스텀 디자인 시스템으로 대체)
- AppLayout(사이드 네비 + 탑 네비) + 라우팅. 페이지: Home, TeaKnowledge, Exhibitions, Products, Artists, Login.
- 각 페이지가 `data/*.json`(또는 `/api/content/{category}`)을 읽어 Cards/Table로 렌더 + 검색/필터.
- **DoD**: `npm run dev`로 5개 페이지 렌더, 비로그인 접근 가능.

## Phase 3 — 챗봇 위젯 UI
- 전역 플로팅 버튼 → 패널. `AuthContext`로 로그인 여부 판별.
- 비로그인: "로그인 후 이용" 안내 + 로그인 이동.
- 로그인: 메시지 송수신, 출처 링크, 카테고리 배지, 거절 표시, admin 액션 결과 표시.
- **DoD**: 모든 페이지에서 위젯 표시, 로그인 상태에 따라 동작 분기.

## Phase 4 — 백엔드 로컬 API
- `backend/` Python(uv). `fastapi`, `uvicorn`, `boto3`, `python-jose`(JWT), `httpx`.
- `config.py`: 모델 정책(HAIKU/SONNET46), 리전, 데이터 경로, Cognito 설정(env).
- 데이터스토어 어댑터: 로컬 JSON ↔ (배포 시)DynamoDB 동일 인터페이스.
- 엔드포인트: `GET /api/content/{category}`, `POST /api/chat`, `POST /api/admin/ingest`, `GET /api/health`.
- **DoD**: `uvicorn`으로 기동, health/content 200.

## Phase 5 — 에이전트 로직
- `agents/orchestrator.py`: 가드레일(차 관련 분류, Haiku) → 카테고리 분류 → 카테고리 QA 호출 → 응답+출처 합성. admin이면 ingest 라우팅.
- `agents/category_qa.py`: 데이터스토어 조회 → 부족 시 `tools/web_search` → Bedrock으로 답변 합성(출처 포함).
- `agents/ingestion.py`: 웹검색 → 정규화 → 데이터스토어 upsert. 카테고리 인자.
- `tools/web_search.py`: HTTP 검색(로컬은 DuckDuckGo/HTML fetch 등), 결과에 URL.
- `tools/datastore.py`: content 조회/업서트.
- Bedrock 호출 래퍼는 **config의 모델만** 사용(하드코딩 금지).
- **DoD**: 로컬에서 차 질문→DB답변, DB없음→웹검색+출처, 무관질문→거절, admin ingest→업데이트 동작.

## Phase 6 — 인증 (Cognito)
- User Pool + App Client(USER_PASSWORD_AUTH) 생성 스크립트(`infra/cognito_setup.sh`).
- 그룹 `admin`, 사용자 admin/user01/user02 생성, admin은 그룹 소속. 임시비번→영구비번 설정.
- 백엔드 JWT 검증(JWK), `cognito:groups`로 admin 판별.
- 프론트 로그인(USER_PASSWORD_AUTH via `amazon-cognito-identity-js` 또는 InitiateAuth).
- **DoD**: 3계정 로그인, JWT로 챗봇 호출, admin만 ingest 허용.

> 주의: Cognito 리소스 생성은 실제 AWS에 만들어지므로 medium-risk. 스크립트로 만들되 사용자에게 고지.

## Phase 7 — 통합 테스트
- 시나리오: (a) 게스트 페이지 열람 (b) 로그인 (c) 차 QA (d) 웹검색+출처 (e) 가드레일 거절 (f) admin ingest (g) user ingest 거절.
- 프론트+백엔드 동시 구동(Docker), 수동/스크립트 검증.
- **DoD**: PRD §8 수용 기준 통과.

## Phase 8 — 배포 준비 (실행은 사용자 승인 후)
- `frontend` 빌드 → `dist/`.
- `infra/deploy_s3.md` + 스크립트: 버킷 생성 → 퍼블릭 액세스 차단 해제 → 버킷 정책 → 정적 웹 호스팅 (**aws-mcp 도구로 수행**).
- 에이전트 AgentCore Runtime 배포 가이드, EventBridge 24h 스케줄.
- **DoD**: 배포 직전 상태(빌드 산출물+스크립트+가이드) 완비. 실제 생성은 별도 승인.

---

## 리스크 & 대응
- **모델 제약 위반 방지**: 모델 ID 중앙화 + 코드 리뷰 시 grep 점검.
- **Cognito USER_PASSWORD_AUTH 비활성**: App Client 생성 시 명시적으로 활성화.
- **웹검색 도구 신뢰성**: 로컬은 간단 검색으로 시작, 실패 시 시드 데이터 fallback.
- **비용**: 수집 24h 제한, 경량 모델 우선.
- **보안**: 자격증명 커밋 금지(.gitignore 확인 완료), 버킷 정책 최소 권한.

## 커밋 전략
각 Phase 완료 시 논리적 단위로 커밋(한국어 메시지). 자격증명/`.env`/`data` 원문 스냅샷 중 민감정보 없는지 확인 후 커밋.
