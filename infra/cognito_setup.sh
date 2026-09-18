#!/usr/bin/env bash
# TeaVerse Cognito 설정 스크립트.
# User Pool + App Client(USER_PASSWORD_AUTH) + admin 그룹 + 사용자 3명 생성.
# 멱등적으로 동작하도록 기존 리소스를 이름으로 조회 후 재사용한다.
#
# 사용:
#   ./infra/cognito_setup.sh
# 출력:
#   infra/cognito_output.env  (POOL_ID, CLIENT_ID) — gitignore 대상
set -euo pipefail
source "$(dirname "$0")/_load_env.sh"

REGION="${AWS_REGION:-us-east-1}"
POOL_NAME="teaverse-user-pool"
CLIENT_NAME="teaverse-web-client"
OUT_FILE="$(dirname "$0")/cognito_output.env"

# 데모 계정 (config/project.env). 미설정 시 안전한 기본값(공개 시 반드시 변경).
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-ChangeMe-Admin@1}"
USER1_USERNAME="${USER1_USERNAME:-user01}"
USER1_PASSWORD="${USER1_PASSWORD:-ChangeMe-User01@1}"
USER2_USERNAME="${USER2_USERNAME:-user02}"
USER2_PASSWORD="${USER2_PASSWORD:-ChangeMe-User02@1}"

echo "[cognito] 리전: $REGION"

# ── User Pool 생성/조회 ─────────────────────────────────
POOL_ID=$(aws cognito-idp list-user-pools --max-results 60 --region "$REGION" \
  --query "UserPools[?Name=='$POOL_NAME'].Id | [0]" --output text)

if [ "$POOL_ID" = "None" ] || [ -z "$POOL_ID" ]; then
  echo "[cognito] User Pool 생성: $POOL_NAME"
  POOL_ID=$(aws cognito-idp create-user-pool \
    --pool-name "$POOL_NAME" \
    --region "$REGION" \
    --policies '{"PasswordPolicy":{"MinimumLength":8,"RequireUppercase":false,"RequireLowercase":true,"RequireNumbers":false,"RequireSymbols":true}}' \
    --username-attributes '[]' \
    --auto-verified-attributes '[]' \
    --query 'UserPool.Id' --output text)
else
  echo "[cognito] 기존 User Pool 재사용: $POOL_ID"
fi

# ── App Client 생성/조회 (USER_PASSWORD_AUTH 활성화) ────
CLIENT_ID=$(aws cognito-idp list-user-pool-clients --user-pool-id "$POOL_ID" --region "$REGION" \
  --query "UserPoolClients[?ClientName=='$CLIENT_NAME'].ClientId | [0]" --output text)

if [ "$CLIENT_ID" = "None" ] || [ -z "$CLIENT_ID" ]; then
  echo "[cognito] App Client 생성: $CLIENT_NAME"
  CLIENT_ID=$(aws cognito-idp create-user-pool-client \
    --user-pool-id "$POOL_ID" \
    --client-name "$CLIENT_NAME" \
    --region "$REGION" \
    --no-generate-secret \
    --explicit-auth-flows "ALLOW_USER_SRP_AUTH" "ALLOW_USER_PASSWORD_AUTH" "ALLOW_REFRESH_TOKEN_AUTH" \
    --query 'UserPoolClient.ClientId' --output text)
else
  echo "[cognito] 기존 App Client 재사용: $CLIENT_ID"
fi

# ── admin 그룹 ──────────────────────────────────────────
if ! aws cognito-idp get-group --user-pool-id "$POOL_ID" --group-name admin --region "$REGION" >/dev/null 2>&1; then
  echo "[cognito] admin 그룹 생성"
  aws cognito-idp create-group --user-pool-id "$POOL_ID" --group-name admin \
    --description "관리자 그룹(데이터 수집/업데이트 권한)" --region "$REGION" >/dev/null
fi

# ── 사용자 생성 헬퍼 ────────────────────────────────────
create_user() {
  local username="$1"; local password="$2"; local is_admin="$3"
  if aws cognito-idp admin-get-user --user-pool-id "$POOL_ID" --username "$username" --region "$REGION" >/dev/null 2>&1; then
    echo "[cognito] 사용자 존재: $username (비밀번호 재설정)"
  else
    echo "[cognito] 사용자 생성: $username"
    aws cognito-idp admin-create-user \
      --user-pool-id "$POOL_ID" --username "$username" \
      --message-action SUPPRESS \
      --region "$REGION" >/dev/null
  fi
  # 영구 비밀번호 설정(강제 변경 없이 바로 로그인 가능)
  aws cognito-idp admin-set-user-password \
    --user-pool-id "$POOL_ID" --username "$username" \
    --password "$password" --permanent --region "$REGION" >/dev/null

  if [ "$is_admin" = "yes" ]; then
    aws cognito-idp admin-add-user-to-group \
      --user-pool-id "$POOL_ID" --username "$username" \
      --group-name admin --region "$REGION" >/dev/null
    echo "[cognito]   → admin 그룹에 추가됨"
  fi
}

create_user "$ADMIN_USERNAME" "$ADMIN_PASSWORD" "yes"
create_user "$USER1_USERNAME" "$USER1_PASSWORD" "no"
create_user "$USER2_USERNAME" "$USER2_PASSWORD" "no"

# ── 결과 출력 ───────────────────────────────────────────
cat > "$OUT_FILE" <<EOF
# TeaVerse Cognito 출력 (자동 생성, 커밋 금지)
COGNITO_REGION=$REGION
COGNITO_USER_POOL_ID=$POOL_ID
COGNITO_CLIENT_ID=$CLIENT_ID
EOF

echo ""
echo "==================================================="
echo " Cognito 설정 완료"
echo "   USER_POOL_ID : $POOL_ID"
echo "   CLIENT_ID    : $CLIENT_ID"
echo "   출력 파일     : $OUT_FILE"
echo "==================================================="
