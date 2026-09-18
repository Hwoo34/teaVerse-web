#!/usr/bin/env bash
# TeaVerse Cognito 리소스 삭제. User Pool을 통째로 삭제한다(사용자/그룹/클라이언트 포함).
set -euo pipefail

REGION="${AWS_DEFAULT_REGION:-us-east-1}"
POOL_NAME="teaverse-user-pool"

POOL_ID=$(aws cognito-idp list-user-pools --max-results 60 --region "$REGION" \
  --query "UserPools[?Name=='$POOL_NAME'].Id | [0]" --output text)

if [ "$POOL_ID" = "None" ] || [ -z "$POOL_ID" ]; then
  echo "[cognito] 삭제할 User Pool 없음: $POOL_NAME"
  exit 0
fi

echo "[cognito] User Pool 삭제: $POOL_ID ($POOL_NAME)"
aws cognito-idp delete-user-pool --user-pool-id "$POOL_ID" --region "$REGION"
rm -f "$(dirname "$0")/cognito_output.env"
echo "[cognito] 삭제 완료."
