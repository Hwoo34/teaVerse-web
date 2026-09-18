# 로컬 통합 테스트 리포트 — TeaVerse

> 실행일: 2026-09-18
> 환경: Docker 개발 컨테이너(tea-ai-dev), 프론트 Vite(5173) + 백엔드 FastAPI(8000), Cognito 실인증

## 실행 방법
```bash
# 컨테이너 안에서 프론트+백엔드 동시 실행
docker exec -it tea-ai-dev bash -lc '/workspace/scripts/run_local.sh'
# 브라우저: http://localhost:5173
# E2E 자동 검증:
docker exec tea-ai-dev bash -lc 'cd /workspace && AWS_DEFAULT_REGION=us-east-1 bash scripts/e2e_test.sh'
```

## E2E 자동 테스트 결과 (프론트 프록시 5173 경유 = 브라우저 실제 경로)

| # | 항목 | 결과 |
|---|------|------|
| 1 | admin 로그인 (Cognito JWT 발급) | ✅ |
| 2 | user01 로그인 (Cognito JWT 발급) | ✅ |
| 3 | content/tea-knowledge 비로그인 접근 200 | ✅ |
| 4 | content/exhibitions 200 | ✅ |
| 5 | content/products 200 | ✅ |
| 6 | content/artists 200 | ✅ |
| 7 | 정적 시드 data/tea.json 200 | ✅ |
| 8 | 챗봇 무인증 호출 → 401 | ✅ |
| 9 | 차 질문 → tea-knowledge 카테고리 DB 답변 | ✅ |
| 10 | 무관 질문(날씨) → 가드레일 거절(refused=true) | ✅ |
| 11 | 일반 사용자 수집 명령 → 거절(allowed=false) | ✅ |
| 12 | 관리자 수집 명령 → 허용(allowed=true) | ✅ |
| 13 | 일반 사용자 → /api/admin/ingest 403 | ✅ |

**결과: 통과 13 / 실패 0**

## 추가 수동 검증
- DB에 없는 질문("말차 라떼 만드는 법") → 웹 검색 수행 후 **web 출처 URL**과 함께 답변.
- DB에 있는 질문("철관음") → **db 출처**(위키 등)와 함께 답변.
- admin 수집 명령 → 웹 검색 → 정규화 → 데이터스토어 upsert(신규 항목 추가) 확인.
- 모델 제약: `assert_model_allowed()`가 opus/sonnet-5 등 상한 초과 모델 호출을 차단.
  실제 사용 모델은 Haiku 4.5(기본) / Sonnet 4.6(상한).

## 브라우저 확인 포인트 (수동)
1. `http://localhost:5173` 접속 → 홈/차정보/전시/상품/작가 페이지가 비로그인으로 열람됨.
2. 우하단 🍵 플로팅 버튼 → 비로그인 시 "로그인 필요" 안내.
3. 일반 사용자(`USER1`) 로그인 후 챗봇에 "우롱차 추천해줘" → DB/웹 근거로 답변 + 출처.
4. 차와 무관한 질문 → 거절.
5. 관리자(`ADMIN`) 로그인 후 "전시 데이터 업데이트해줘" → 수집 실행 결과 표시.
   (계정 값은 `config/project.env` 참조)

## 알려진 한계 (로컬)
- 웹 검색은 DuckDuckGo HTML/lite 스크래핑 기반이라 간헐적으로 결과가 비을 수 있음(그 경우 DB 근거만 사용).
- 수집 실행 시 로컬 `data/*.json`이 변경됨(테스트 후 `git checkout data/`로 시드 복원).
- 24h 주기 스케줄은 배포(EventBridge) 단계에서 활성화. 로컬은 수동/온디맨드 트리거로 검증.
