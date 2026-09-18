# TeaVerse — 프로젝트 결과 리포트 (공개판)

> **과정**: *Building Agentic AI with Amazon Bedrock AgentCore* — 마지막 자유 주제 실습 제출 프로젝트
> **주제**: 차(茶) 정보 제공 WEB 기반 AI Agent 서비스
> 이 문서는 공개 저장소용으로 개인정보·실제 리소스 식별자·자격증명을 제외한 버전입니다.
> (실제 배포 값은 `config/project.env`에서 관리하며 커밋되지 않습니다.)
>
> ⚠️ **교육용 프로젝트**: 학습·데모 목적으로 제작되었으며, 챗봇 답변 및 시드 데이터(차·전시·상품·작가 정보)는
> AI 생성·샘플 데이터를 포함하여 **정확성을 보증하지 않습니다.** 실제 정보로 활용하지 마세요.

---

## 1. 사이트 개요 및 아키텍처

**TeaVerse**는 전통차·중국차·한국차·꽃차 등 다양한 차 정보와 전시, 차 도구 상품, 작가 정보를
카테고리별로 제공하고, 어느 페이지에서든 이용 가능한 **플로팅 AI 챗봇**으로 사용자 질문에
**DB/웹 근거와 출처**를 곁들여 답변하는 웹 서비스다. 차와 무관한 질문은 가드레일로 거절하며,
로그인(JWT) 사용자만 챗봇을 이용할 수 있다.

### 제공 기능
- **차 정보** — 전통/중국/한국/꽃차 분류·검색
- **전시** — 축제·전시·박람회 타임라인
- **상품** — 다구·다기·자사호 + 리뷰·대중 선호도(감성분석)
- **작가** — 급부상 작가 및 작품
- **AI 챗봇** — 출처 기반 답변 · 주제 가드레일

### 사용자 · 권한
| 역할 | 권한 |
|------|------|
| 게스트 | 정보 페이지 열람 |
| 일반 사용자 | + 챗봇 질의응답 |
| 관리자 | + 데이터 수집·업데이트 명령 |

> Amazon Cognito User Pool + `admin` 그룹, JWT 인증. 계정 값은 `config/project.env`에서 관리.

### 기술 스택
`React 19` · `TypeScript` · `Vite` · 커스텀 디자인 시스템 · `framer-motion` ·
`Amazon S3(정적 호스팅)` · `Bedrock AgentCore Runtime` · `Amazon Bedrock(Claude Haiku/Sonnet)` ·
`Amazon DynamoDB` · `Amazon Cognito` · `Python 3.13`

| 레이어 | 구성 |
|--------|------|
| 프론트엔드 | React+TS(Vite) SPA, 커스텀 "모던 티 하우스" 디자인 + 애니메이션 → S3 정적 웹 호스팅 |
| 백엔드(에이전트) | Bedrock AgentCore Runtime(Python), Orchestrator + 카테고리 QA + 수집, Cognito JWT 인바운드 인증 |
| 데이터 | DynamoDB `tea_content` / 번들 시드 JSON, 웹 검색(출처 URL) |
| 모델 | Claude Haiku 4.5(기본) · Sonnet 4.6(상한) — **Opus 이상 미사용(비용 제약)** |
| 인증 | Cognito User Pool(USER_SRP_AUTH), `admin` 그룹으로 권한 분리 |

### 아키텍처

![TeaVerse 아키텍처](assets/architecture.svg)

프론트엔드는 S3 정적 호스팅, 챗봇은 브라우저가 Cognito JWT로 AgentCore Runtime을 직접 호출한다.
Orchestrator가 **① 관리자 수집 명령 판별 → ② 가드레일(차 관련 분류) → ③ 카테고리 QA(데이터 조회,
부족 시 웹 검색) → ④ 출처와 함께 응답 합성** 순으로 처리한다.

```
사용자 질문 → JWT 인증 → 가드레일 분류 → 카테고리 QA → DB/웹 근거+출처 → 답변
```

---

## 2. 제작된 웹페이지 · 동작

### 주요 화면
- **홈** — 히어로·통계·카테고리 카드·챗봇 하이라이트
- **차 정보** — 카드/필터/우림법/출처
- **상품** — 가격·평점·감성분석 바
- **전시** — 날짜 타임라인
- **작가** — 급부상 배지·작품
- **로그인** — Cognito(글래스 카드)

### 사용자별 챗봇 · 에이전트 동작
| 구분 | 입력 | 에이전트 처리 | 결과 |
|------|------|----------------|------|
| 게스트 | 챗봇 열기 | JWT 없음 → 게이팅 | 로그인 유도 |
| 일반 | 차 질문 | 가드레일 통과 → 카테고리 QA → DB/웹 | 출처 포함 답변 |
| 일반 | 비(非)차 질문 | 가드레일 차단 | 거절 |
| 일반 | 수집 명령 | 관리자 아님 판별 | 권한 거절 |
| 관리자 | 수집 명령 | `admin` 그룹 확인 → 수집 에이전트 | 수집·갱신 실행 |

> 데모 스크린샷은 로컬에서 `scripts/report_*.mjs`로 재현할 수 있다(개인 배포 URL·캡처는 공개본에서 제외).

### 배포
- 프론트: `infra/deploy_s3.sh` (버킷 생성 → 퍼블릭 액세스 해제 → 버킷 정책 → 정적 호스팅 → 업로드)
- 데이터: `infra/dynamodb_setup.sh` (테이블 생성 + 시드 적재)
- 백엔드: `infra/agentcore_deploy.sh` (CodeZip → S3 → AgentCore Runtime + Cognito JWT authorizer)
- 계정 번호는 `aws sts get-caller-identity`로 자동 조회되어 **특정 AWS 계정에 종속되지 않음**.

---

## 3. 문제점 및 개선사항

### 개발 중 마주친 문제와 해결
| 문제 | 원인 | 해결 |
|------|------|------|
| 배포 후 흰 화면 | `cognito-identity-js`의 buffer가 브라우저에 없는 `global` 참조 | Vite `define:{global:'globalThis'}` 폴리필 |
| 로그인 실패 | App Client에 SRP 인증 미활성 | `ALLOW_USER_SRP_AUTH` 추가 |
| Lambda 백엔드 배포 불가 | 실습 계정의 `iam:CreateRole`·`PassRole` 거부 | 기존 실행 역할을 쓰는 **AgentCore Runtime**으로 전환(PassRole 허용) |
| 런타임 초기화 실패 | 런타임에 `boto3` 미포함 | 의존성을 ARM64 휠로 zip 번들 |
| 관리자 판별 안 됨 | JWT authorizer가 사용자 클레임을 컨테이너에 미전달 | payload에 IdToken 전달 → 그룹 판별(authorizer 1차 검증) |
| DynamoDB 직렬화 오류 | DDB가 숫자를 `Decimal`로 반환 | `Decimal → int/float` 정규화 |

### 현재 한계
- **SPA 딥링크**: S3 정적 호스팅은 하위 경로 직접 접근 시 HTTP 404(브라우저 렌더는 정상) → CloudFront 리라이트 필요.
- **수집 반영**: 런타임 역할에 DynamoDB 쓰기 권한이 없으면 배포본은 즉시 미반영(로컬은 upsert).
- **웹 검색**: DuckDuckGo 스크래핑 기반이라 간헐적으로 결과가 빌 수 있음.
- **콜드 스타트**: 런타임 최초 호출 시 수 초 지연.
- **관리자 판별**: 컨테이너에서 IdToken 서명 재검증까지 하면 더 엄격.

### 개선 방향 (Roadmap)
- **단기** — CloudFront + HTTPS + 딥링크 리라이트·캐싱, 런타임 역할에 DynamoDB 쓰기 부여
- **중기** — EventBridge 24h 자동 수집 스케줄, Bedrock Guardrails 정식 적용 + 응답 스트리밍, AgentCore Memory로 대화 세션 기억

### 완료 현황
| 항목 | 상태 |
|------|------|
| 프론트엔드 5개 페이지 + 챗봇 UI + 배포 수준 디자인 | ✅ 완료 · S3 배포 |
| Cognito 인증 · 계정 · admin 권한 분리 | ✅ 완료 |
| 에이전트(가드레일·QA·수집) + 출처·웹검색 | ✅ 완료 |
| DynamoDB 데이터스토어 | ✅ 완료 |
| 백엔드 AgentCore Runtime 배포 (Cognito JWT) | ✅ 완료 |
| 배포 사이트 챗봇 E2E — QA/가드레일/권한 | ✅ 완료 |

---

*본 프로젝트는 **Building Agentic AI with Amazon Bedrock AgentCore** 과정의 자유 주제 실습 제출물이다.*
