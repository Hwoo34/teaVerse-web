# 아키텍처 설계 — 차(茶) 정보 AI Agent 서비스 (TeaVerse)

> 문서 버전: v1.0
> 작성일: 2026-09-18
> 리전: `<AWS_REGION>` / 계정: `<ACCOUNT_ID>` (계정 번호는 배포 시 자동 조회)

---

## 1. 상위 아키텍처 (High-Level)

```
                          ┌────────────────────────────────────────────┐
                          │                브라우저 (SPA)                │
                          │   React + 커스텀 디자인시스템 (Vite 빌드)    │
                          │  - 정보 페이지(홈/차/전시/상품/작가)          │
                          │  - 플로팅 챗봇 위젯                          │
                          └───────────────┬───────────────┬─────────────┘
                                          │(정적 자산)    │(REST/JWT)
                                          ▼               ▼
                           ┌──────────────────┐   ┌───────────────────────────┐
                           │ S3 정적 웹 호스팅 │   │  Cognito User Pool (JWT)  │
                           │ (최종 배포 대상)  │   │  admin / user01 / user02  │
                           └──────────────────┘   └─────────────┬─────────────┘
                                                                 │ JWT 검증
                                                                 ▼
                        ┌────────────────────────────────────────────────────────┐
                        │        챗봇 API (로컬: FastAPI / 클라우드: AgentCore     │
                        │        Runtime + Cognito authorizer)                    │
                        │  ┌──────────────────────────────────────────────────┐  │
                        │  │  Orchestrator(챗봇) 에이전트                       │  │
                        │  │  - 가드레일(주제 판별)                             │  │
                        │  │  - JWT 클레임으로 admin 권한 판별                  │  │
                        │  │  - Gateway 통해 카테고리 에이전트 호출             │  │
                        │  └──────────────┬──────────────────┬────────────────┘  │
                        └─────────────────│──────────────────│───────────────────┘
                                          │ (Gateway/tool 호출)
        ┌─────────────────────────────────┼──────────────────┼─────────────────────────┐
        ▼                 ▼                ▼                  ▼                          ▼
 ┌────────────┐   ┌────────────┐   ┌────────────┐    ┌────────────┐          ┌──────────────────┐
 │ tea-know   │   │ exhibitions│   │ products   │    │ artists    │          │ 수집·업데이트     │
 │ QA agent   │   │ QA agent   │   │ QA agent   │    │ QA agent   │          │ agent (카테고리별)│
 └─────┬──────┘   └─────┬──────┘   └─────┬──────┘    └─────┬──────┘          └────────┬─────────┘
       │                │                │                 │                          │
       └────────────────┴────────┬───────┴─────────────────┘                          │(24h/EventBridge
                                  ▼                                                    │ + admin 온디맨드)
                     ┌───────────────────────────┐                                     ▼
                     │   데이터 스토어             │◀────────────────────────  웹 검색 도구
                     │  - DynamoDB (구조화 데이터) │                            (출처 URL 포함)
                     │  - S3 (원문/이미지/스냅샷)  │
                     │  - (옵션) AgentCore KB      │
                     └───────────────────────────┘
```

---

## 2. 컴포넌트

### 2.1 프론트엔드
- **React 19 + TypeScript + Vite**. UI는 **커스텀 디자인 시스템**("모던 티 하우스")으로 구현.
  - `src/styles/theme.css`: 말차 그린 팔레트 + 세리프/산세리프 폰트 + 디자인 토큰(CSS 변수).
  - **framer-motion**: 스크롤 리빌·페이지 전환·플로팅 찻잎·챗봇 등장 등 애니메이션.
  - **SVG 아트 에셋**(`public/assets/`): 히어로 차밭 배경, 찻잎, 카테고리별 일러스트.
  - 초기 Cloudscape 골격에서 전환 → 번들 경량화(JS 1,182KB→514KB, CSS 1,137KB→20KB).
- 라우팅: `react-router-dom`. 페이지: 홈/차정보/전시/상품/작가/로그인. 커스텀 `Layout`(글래스 네비/푸터).
- 챗봇: 전역 플로팅 위젯(글래스모피즘). 로그인 상태(JWT)에 따라 활성/비활성.
- 인증: Cognito(`amazon-cognito-identity-js`, SRP). Vite `define: { global: 'globalThis' }`로
  buffer 의존성 브라우저 호환 처리. 토큰은 메모리 보관.
- 빌드 산출물(`dist/`)을 최종적으로 S3 정적 호스팅에 업로드.

### 2.2 인증 (Cognito)
- User Pool 1개 + App Client(Public, SRP/USER_PASSWORD).
- 그룹: `admin`. `admin` 사용자만 이 그룹에 소속.
- JWT의 `cognito:groups` 클레임으로 관리자 권한 판별.
- 챗봇 API는 `Authorization: Bearer <IdToken>` 검증(JWK 캐싱).

### 2.3 백엔드 에이전트 (Bedrock AgentCore)
- **Orchestrator(챗봇) 에이전트**: 사용자 입력 수신 → 가드레일 → 의도/카테고리 분류 → Gateway로 카테고리 QA 에이전트 호출 → 응답 합성(+출처). admin이면 수집 명령 라우팅.
- **카테고리 QA 에이전트** (tea-knowledge / exhibitions / products / artists): 데이터 스토어 조회 + 없으면 웹 검색(출처). tool 역할.
- **수집·업데이트 에이전트** (카테고리별): 웹 검색 → 정규화 → 데이터 스토어 upsert. EventBridge 24h 스케줄 + admin 온디맨드 트리거.
- **에이전트 프레임워크**: Strands Agents(파이썬) 사용, AgentCore Runtime에 배포. 에이전트 간 호출은 **Gateway** 추상화.

### 2.4 모델 정책 (비용 제약 — 필수)
| 용도 | 모델 ID | 비고 |
|------|---------|------|
| 분류/가드레일/경량 QA/수집 요약 | `us.anthropic.claude-haiku-4-5-20251001-v1:0` | 기본 |
| 복잡한 오케스트레이션/추론 | `us.anthropic.claude-sonnet-4-6` | **상한** |

- **Opus 이상 및 Sonnet 5 등 상한 초과 모델 사용 금지.**
- 모델 ID는 코드에 하드코딩하지 않고 **중앙 설정**(`backend/config.py` / 환경변수 `TEA_MODEL_*`)에서 관리하여 제약 위반을 방지.

### 2.5 데이터 스토어
- **DynamoDB**: 구조화 데이터(차/전시/상품/작가). 단일 테이블 또는 카테고리별 테이블.
  - 제안: 단일 테이블 `tea_content` — `PK=category`, `SK=id`, 속성은 도메인별. GSI로 검색 지원.
- **S3**: 이미지, 수집 원문/스냅샷(JSON), 프론트 정적 자산.
- **(옵션) AgentCore Knowledge Base**: 장문 텍스트 RAG가 필요할 때. 1차는 DynamoDB 조회 중심.

### 2.6 가드레일
- 1차 방어: Orchestrator 시스템 프롬프트 + 경량 분류(차 관련 여부 Y/N).
- 2차(클라우드): Amazon Bedrock Guardrails로 주제 제한/유해 차단.
- 프롬프트 인젝션: 외부 검색 결과/DB 텍스트는 데이터로 취급, 지시문으로 해석 금지.

---

## 3. 로컬 vs 클라우드 매핑

| 관심사 | 로컬(개발/테스트) | 클라우드(배포) |
|--------|-------------------|----------------|
| 프론트 | Vite dev server (5173) | S3 정적 호스팅 |
| 챗봇 API | FastAPI (8000), Bedrock 직접 호출 | AgentCore Runtime + Cognito authorizer |
| 에이전트 간 호출 | in-process 함수/로컬 라우터 (Gateway 모킹) | AgentCore Gateway |
| 데이터 | 로컬 JSON seed + (옵션) DynamoDB Local | DynamoDB + S3 (+KB) |
| 인증 | 실제 Cognito(권장) 또는 목 JWT | 실제 Cognito |
| 스케줄 | 수동 트리거 스크립트 | EventBridge 24h rule |
| 웹 검색 | 검색 도구(HTTP) | 동일 도구 (AgentCore Browser/검색) |

> 핵심: 에이전트 로직·모델 호출 코드는 **동일**, 배포 어댑터만 교체.

---

## 4. API 초안 (챗봇)

```
POST /api/chat
  Header: Authorization: Bearer <Cognito IdToken>
  Body: { "message": string, "sessionId": string }
  Resp: {
    "reply": string,
    "sources": [{ "title": string, "url": string, "type": "db"|"web" }],
    "category": string|null,
    "refused": boolean,          // 가드레일 거절 여부
    "adminAction": object|null   // 관리자 수집 명령 실행 결과
  }

POST /api/admin/ingest    (admin 그룹만)
  Body: { "category": "tea-knowledge"|"exhibitions"|"products"|"artists"|"all" }
  Resp: { "status": "started"|"done", "updated": number }
```

정보 페이지 데이터는 정적 JSON(로컬) 또는 별도 읽기 API(`GET /api/content/{category}`)로 제공.

---

## 5. 리포지토리 구조 (계획)

```
my-web-ai-agent-service/
├─ docs/                     # PRD, 아키텍처, 구현계획, 배포가이드
├─ docker/                   # 개발 컨테이너
├─ frontend/                 # React + 커스텀 디자인시스템 + framer-motion (Vite)
│  ├─ public/assets/         # SVG 아트(히어로, 찻잎, 카테고리 일러스트)
│  ├─ src/pages/             # Home, TeaKnowledge, Exhibitions, Products, Artists, Login (+ CSS)
│  ├─ src/components/        # Layout, ChatWidget, Reveal(애니메이션 헬퍼)
│  ├─ src/styles/theme.css   # 디자인 토큰/유틸리티
│  └─ src/api.ts, config.ts  # API 클라이언트 / 런타임 설정
├─ backend/                  # 에이전트 + 로컬 API
│  └─ app/                   # config, bedrock_client, auth, local_server, agents/, tools/
├─ data/                     # 수집된/seed JSON
├─ infra/                    # 배포 스크립트 (cognito_setup, deploy_s3)
└─ scripts/                  # run_local, e2e_test, browser_* (헤드리스 검증)
```

---

## 6. 배포 개요 (배포 마일스톤에서 실행)
1. 프론트 `npm run build` → `frontend/dist/`.
2. S3 버킷 생성 → 퍼블릭 액세스 차단 해제 → 버킷 정책(정적 읽기) → 정적 웹 호스팅 활성화 (aws-mcp).
3. Cognito User Pool/Client/사용자·그룹 생성.
4. 에이전트 AgentCore Runtime 배포 + Gateway 구성 + DynamoDB/S3 연결.
5. EventBridge 24h 수집 스케줄 등록.

> 배포는 사용자 승인 후 별도 진행. 그 전까지 로컬에서 완전 동작 검증.
