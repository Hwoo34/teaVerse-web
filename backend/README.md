# backend/ — TeaVerse 에이전트 백엔드

로컬 개발용 FastAPI 서버 + Bedrock 기반 멀티 에이전트.

## 구조
```
app/
├─ config.py          # 중앙 설정 (모델 정책: Sonnet 4.6 이하만)
├─ bedrock_client.py  # Bedrock Converse 래퍼 (모델 제약 강제)
├─ auth.py            # JWT 검증 (Cognito / 목 모드)
├─ local_server.py    # FastAPI 앱 (엔드포인트)
├─ agents/
│  ├─ orchestrator.py # 챗봇: 가드레일 + 분류 + admin 라우팅
│  ├─ category_qa.py  # 카테고리 QA (DB→웹검색→합성)
│  └─ ingestion.py    # 수집·업데이트 에이전트
└─ tools/
   ├─ datastore.py    # 로컬 JSON / DynamoDB 추상화
   └─ web_search.py   # DuckDuckGo 검색(출처 URL)
scripts/mock_token.py # 로컬 테스트용 목 JWT 생성
```

## 모델 제약 (필수)
`app/config.py`에서만 모델 ID를 정의한다. **Sonnet 4.6 이하만** 허용:
- `MODEL_HAIKU` = `us.anthropic.claude-haiku-4-5-20251001-v1:0` (기본)
- `MODEL_SONNET` = `us.anthropic.claude-sonnet-4-6` (상한)
`assert_model_allowed()`가 opus/sonnet-5 등 상한 초과 모델 호출을 차단한다.

## 로컬 실행
```bash
cd backend
uv venv .venv && . .venv/bin/activate
uv pip install -e .
export AWS_DEFAULT_REGION=us-east-1   # Bedrock 호출용 (자격증명은 환경/컨테이너)
uvicorn app.local_server:app --host 0.0.0.0 --port 8000 --reload
```

## 엔드포인트
| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| GET | `/api/health` | - | 상태/모델/모드 |
| GET | `/api/content/{category}` | - | 카테고리 데이터 |
| POST | `/api/chat` | JWT | 챗봇 대화 |
| POST | `/api/admin/ingest` | JWT+admin | 수집 트리거 |

## 인증 모드
- Cognito 설정(`COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`) 있으면 실제 JWT 검증.
- 없으면 목 모드: `scripts/mock_token.py admin|user01|user02` 로 토큰 생성.
