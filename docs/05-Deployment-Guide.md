# 배포 가이드 — TeaVerse

> 프론트엔드 S3 정적 호스팅은 **배포 완료**되었다(아래 결과 참고).
> 배포 절차는 `infra/deploy_s3.sh`로 수행했다(버킷 생성 → 퍼블릭 액세스 해제 → 버킷 정책 → 정적 호스팅 → 업로드).

---

## ✅ 배포 결과 (프론트엔드)

| 항목 | 값 |
|------|-----|
| 라이브 URL | `http://<S3_BUCKET>.s3-website-<REGION>.amazonaws.com` (배포 후 `config/project.env`의 `SITE_URL`) |
| 버킷 | `teaverse-web-<ACCOUNT_ID>-<REGION>` (또는 `S3_BUCKET`) |
| 리전 | `<AWS_REGION>` |
| 호스팅 | S3 정적 웹사이트 (Index/Error = `index.html`) |
| 접근 | 퍼블릭 읽기(정적 자산만), 쓰기 비공개 |

**동작 상태**
- ✅ 정보 페이지(홈/차/전시/상품/작가): 정상 (데이터는 정적 `/data`)
- ✅ 로그인: 정상 (Cognito를 브라우저에서 직접 호출)
- ✅ 챗봇 대화: **정상 동작** — 배포된 AgentCore Runtime `teaverse_backend`를 브라우저가
  직접 호출(Cognito AccessToken Bearer). 차 QA(DB 출처)·가드레일·권한 분리 모두 배포 사이트에서 확인됨.

### 백엔드 배포 결과 (AgentCore Runtime)
| 항목 | 값 |
|------|-----|
| 런타임 | `<AGENTCORE_RUNTIME_NAME>` (ARN은 `config/project.env`의 `AGENTCORE_RUNTIME_ARN`) |
| 방식 | 직접 코드 배포(CodeZip, S3) · Python 3.13 · entryPoint `agent.py` |
| 실행 역할 | `config/project.env`의 `AGENTCORE_ROLE_ARN`/`AGENTCORE_ROLE_NAME` (Bedrock InvokeModel + 로그 권한) |
| 인바운드 인증 | Cognito customJWTAuthorizer (discoveryUrl + allowedClients) |
| 데이터 | 번들 seed JSON(런타임 역할에 DynamoDB 권한 없음) |
| 배포 스크립트 | `infra/agentcore_deploy.sh` |

> Lambda 경로는 `student` 계정의 `iam:PassRole` 거부로 불가했고, 기존 실행 역할을
> 재사용할 수 있는 **AgentCore Runtime**으로 배포했다. 관리자 판별은 프론트가 payload에
> IdToken을 실어 보내고 컨테이너가 그룹을 읽는 방식으로 구현했다.

**알려진 특성**: 딥링크(예: `/tea` 직접 접근)는 S3가 HTTP 404를 반환하지만,
ErrorDocument가 `index.html`이라 브라우저에서는 React Router가 정상 렌더한다.
상태 코드까지 200으로 만들려면 CloudFront + 커스텀 에러 응답(404→200, /index.html)을 앞단에 둔다.

---

## 0. 사전 상태 (완료됨)
- 프론트 빌드 산출물: `frontend/dist/` (`npm run build`)
- Cognito: User Pool `<COGNITO_USER_POOL_ID>`, Client `<COGNITO_CLIENT_ID>` (config/project.env)
  - 계정: admin(admin그룹) / user01 / user02
- 로컬 E2E 13/13 통과 (docs/04-Local-Test-Report.md)
- 모델: Haiku 4.5(기본) / Sonnet 4.6(상한) — Opus 이상 미사용

---

## 1. 프론트엔드 S3 정적 호스팅 (aws-mcp로 수행)

### 1-1. 빌드 (API 엔드포인트 주입)
배포 후 백엔드(AgentCore Runtime/Function URL 등)의 실제 주소가 정해지면,
그 값으로 다시 빌드한다.
```bash
cd frontend
# 실제 백엔드 주소로 교체 (예시)
echo "VITE_API_BASE=https://<api-endpoint>" >> .env.production.local
echo "VITE_COGNITO_REGION=us-east-1" >> .env.production.local
echo "VITE_COGNITO_USER_POOL_ID=<COGNITO_USER_POOL_ID>" >> .env.production.local
echo "VITE_COGNITO_CLIENT_ID=<COGNITO_CLIENT_ID>" >> .env.production.local
npm run build   # → frontend/dist/
```
> 백엔드가 다른 도메인이면 서버 측 CORS에 배포 도메인을 추가해야 한다.

### 1-2. S3 배포 단계 (aws-mcp)
버킷명 예: `teaverse-web-<ACCOUNT_ID>-<REGION>`
1. **버킷 생성** (us-east-1)
2. **퍼블릭 액세스 차단 해제** (4개 옵션 모두 false)
3. **버킷 정책** — 공개 읽기(`s3:GetObject`, `Resource: arn:aws:s3:::<bucket>/*`)
4. **정적 웹사이트 호스팅** 활성화 (IndexDocument=index.html, ErrorDocument=index.html for SPA)
5. **`frontend/dist/` 업로드**

접속 URL: `http://<bucket>.s3-website-us-east-1.amazonaws.com`

> CLI 참고 구현: `BUCKET=... ./infra/deploy_s3.sh`
> (버킷 정책은 `infra/deploy_s3.sh`가 생성하는 JSON 참고)

---

## 2. 백엔드(에이전트) 배포 — AgentCore

로컬 `backend/app`의 에이전트 로직은 그대로 재사용하고, 실행 어댑터만 교체한다.

### 2-1. 데이터스토어 전환 (로컬 JSON → DynamoDB)
- 테이블 `tea_content` 생성: PK=`category`(S), SK=`id`(S)
- 시드 적재: `data/*.json`을 `category`별로 `put_item`
- 환경변수: `TEA_DATA_BACKEND=dynamodb`, `TEA_DDB_TABLE=tea_content`

### 2-2. 에이전트 런타임
- Orchestrator/카테고리 QA/수집 에이전트를 AgentCore Runtime에 배포.
- Runtime 실행 역할에 `bedrock:InvokeModel`(Converse), DynamoDB 읽기/쓰기, (웹검색용) 아웃바운드 권한 부여.
- 에이전트 간 호출은 **Gateway**로 연결(로컬의 in-process 함수 호출 대체).
- 모델 ID는 `backend/app/config.py`의 상수 사용(**Sonnet 4.6 이하 유지**).

### 2-3. 인증 연동
- 챗봇 API에 Cognito authorizer 적용(IdToken 검증).
- `cognito:groups`의 `admin`으로 수집 명령 권한 판별(현재 코드 그대로).

### 2-4. 수집 스케줄 (24시간)
- EventBridge 규칙: `rate(24 hours)` → 수집 에이전트(`ingest_all`) 트리거.
- 관리자 온디맨드: 챗봇의 admin 명령 → Gateway → 수집 에이전트(현재 로직).

---

## 3. 배포 후 검증 체크리스트
- [ ] S3 URL 접속 시 홈/차정보/전시/상품/작가 페이지 렌더(비로그인).
- [ ] 플로팅 챗봇 표시, 비로그인 시 로그인 유도.
- [ ] user01 로그인 → 차 질문 응답(+출처).
- [ ] 차 무관 질문 거절(가드레일).
- [ ] admin 로그인 → 수집 명령 동작 / user는 거절.
- [ ] 사용 모델이 Haiku 4.5 / Sonnet 4.6 범위인지 확인(Opus 미사용).

## 4. 정리(teardown)
- Cognito: `./infra/cognito_teardown.sh`
- S3: 객체 삭제 후 버킷 삭제
- DynamoDB/EventBridge/AgentCore Runtime: 각 서비스에서 삭제

## 5. 비용/보안 주의
- 수집 주기 24h 제한, 경량 모델 우선으로 비용 관리.
- 자격증명/비밀은 저장소·버킷에 노출 금지(.gitignore 확인 완료).
- 버킷은 정적 자산 공개 읽기만 허용, 쓰기는 비공개.
