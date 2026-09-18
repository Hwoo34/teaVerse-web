#!/usr/bin/env bash
# 로컬 E2E 통합 테스트. 프론트 프록시(5173) 경유로 브라우저와 동일 경로를 검증.
# 컨테이너 안에서 실행 가정. Cognito 실인증 사용.
set -uo pipefail
# config/project.env 로드 (있으면)
_CFG="$(dirname "$0")/../config/project.env"; [ -f "$_CFG" ] && { set -a; source "$_CFG"; set +a; }

BASE="${SITE_URL:-http://localhost:5173}"   # 기본은 로컬 프록시
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
CLIENT_ID="${COGNITO_CLIENT_ID:?config/project.env 의 COGNITO_CLIENT_ID 필요}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"; ADMIN_PASSWORD="${ADMIN_PASSWORD:?}"
USER1_USERNAME="${USER1_USERNAME:-user01}"; USER1_PASSWORD="${USER1_PASSWORD:?}"

pass=0; fail=0
check() { # check "이름" "조건(0=성공)" 
  if [ "$2" -eq 0 ]; then echo "  ✅ $1"; pass=$((pass+1)); else echo "  ❌ $1"; fail=$((fail+1)); fi
}

token() {
  aws cognito-idp initiate-auth --client-id "$CLIENT_ID" --region "$REGION" \
    --auth-flow USER_PASSWORD_AUTH \
    --auth-parameters USERNAME="$1",PASSWORD="$2" \
    --query "AuthenticationResult.IdToken" --output text 2>/dev/null
}

echo "== 로그인(JWT 발급) =="
ADMIN=$(token "$ADMIN_USERNAME" "$ADMIN_PASSWORD")
USER=$(token "$USER1_USERNAME" "$USER1_PASSWORD")
[ -n "$ADMIN" ] && [ "$ADMIN" != "None" ]; check "admin 로그인" $?
[ -n "$USER" ] && [ "$USER" != "None" ]; check "user01 로그인" $?

echo "== 정보 페이지(비로그인 접근 가능) =="
for c in tea-knowledge exhibitions products artists; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/content/$c")
  [ "$code" = "200" ]; check "content/$c 200" $?
done

echo "== 정적 시드 데이터 로드 =="
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/data/tea.json")
[ "$code" = "200" ]; check "data/tea.json 200" $?

echo "== 챗봇: 비로그인(401) =="
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/chat" -H "Content-Type: application/json" -d '{"message":"녹차"}')
[ "$code" = "401" ]; check "무인증 챗봇 401" $?

echo "== 챗봇: 차 질문(DB 답변) =="
r=$(curl -s -X POST "$BASE/api/chat" -H "Authorization: Bearer $USER" -H "Content-Type: application/json" -d '{"message":"철관음 특징 알려줘"}')
echo "$r" | grep -q '"refused": *false' && echo "$r" | grep -q '"category": *"tea-knowledge"'; check "차질문 → tea-knowledge 답변" $?

echo "== 챗봇: 가드레일(무관 질문 거절) =="
r=$(curl -s -X POST "$BASE/api/chat" -H "Authorization: Bearer $USER" -H "Content-Type: application/json" -d '{"message":"오늘 서울 날씨 어때?"}')
echo "$r" | grep -q '"refused": *true'; check "무관 질문 거절(refused=true)" $?

echo "== 권한: 일반 사용자 수집 명령 거절 =="
r=$(curl -s -X POST "$BASE/api/chat" -H "Authorization: Bearer $USER" -H "Content-Type: application/json" -d '{"message":"상품 데이터 업데이트해줘"}')
echo "$r" | grep -q '"allowed": *false'; check "user 수집명령 거절" $?

echo "== 권한: 관리자 수집 명령 허용 =="
r=$(curl -s -X POST "$BASE/api/chat" -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" -d '{"message":"작가 데이터 업데이트해줘"}')
echo "$r" | grep -q '"allowed": *true'; check "admin 수집명령 허용" $?

echo "== 권한: admin 전용 엔드포인트 user 접근 403 =="
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/ingest" -H "Authorization: Bearer $USER" -H "Content-Type: application/json" -d '{"category":"products"}')
[ "$code" = "403" ]; check "user → /admin/ingest 403" $?

echo ""
echo "==================================="
echo " 결과: 통과 $pass / 실패 $fail"
echo "==================================="
[ "$fail" -eq 0 ]
