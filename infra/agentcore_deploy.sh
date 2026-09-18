#!/usr/bin/env bash
# TeaVerse 백엔드를 AgentCore Runtime(직접 코드 배포, CodeZip)으로 배포.
# AgentCore 실행 역할 재사용 + Cognito JWT 인바운드 인증.
#
# 실행 역할은 config/project.env 의 AGENTCORE_ROLE_ARN 또는 AGENTCORE_ROLE_NAME 로 지정한다.
# (Bedrock InvokeModel + 로그 권한 필요. 계정에 맞는 역할을 준비하세요.)
set -euo pipefail
source "$(dirname "$0")/_load_env.sh"

REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
RUNTIME_NAME="${AGENTCORE_RUNTIME_NAME:-teaverse_backend}"

# 실행 역할: ARN 직접 지정 우선, 없으면 이름으로 조합
if [ -n "${AGENTCORE_ROLE_ARN:-}" ]; then
  ROLE_ARN="${AGENTCORE_ROLE_ARN}"
else
  ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${AGENTCORE_ROLE_NAME:?config/project.env 에 AGENTCORE_ROLE_ARN 또는 AGENTCORE_ROLE_NAME 을 지정하세요}"
fi

CODE_BUCKET="${S3_BUCKET:-teaverse-web-${ACCOUNT_ID}-${REGION}}"
CODE_KEY="runtime/teaverse_backend.zip"

POOL_ID="${COGNITO_USER_POOL_ID:?config/project.env 의 COGNITO_USER_POOL_ID 필요 (cognito_setup.sh 먼저 실행)}"
CLIENT_ID="${COGNITO_CLIENT_ID:?config/project.env 의 COGNITO_CLIENT_ID 필요}"
DISCOVERY="https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}/.well-known/openid-configuration"

SRC="$(cd "$(dirname "$0")/../backend/agentcore" && pwd)"
DATA="$(cd "$(dirname "$0")/../data" && pwd)"
BUILD=/tmp/teaverse-agentcore
ZIP=/tmp/teaverse-agentcore.zip

echo "[agentcore] 패키지 빌드"
rm -rf "$BUILD" "$ZIP"; mkdir -p "$BUILD"
cp "$SRC/agent.py" "$BUILD/agent.py"
cp "$SRC/requirements.txt" "$BUILD/requirements.txt"
mkdir -p "$BUILD/data"
cp "$DATA"/*.json "$BUILD/data/"
# 의존성 번들: AgentCore는 ARM64 Linux. boto3는 런타임에 없으므로 zip에 포함한다.
echo "[agentcore] 의존성(boto3) 번들 (aarch64)"
pip install --target "$BUILD" \
  --platform manylinux2014_aarch64 --implementation cp --python-version 3.13 \
  --only-binary=:all: --upgrade boto3 >/dev/null
(cd "$BUILD" && zip -qr "$ZIP" . -x '*__pycache__*' -x '*.pyc')
echo "[agentcore] zip: $(du -h "$ZIP" | cut -f1)"

echo "[agentcore] S3 업로드 s3://${CODE_BUCKET}/${CODE_KEY}"
aws s3 cp "$ZIP" "s3://${CODE_BUCKET}/${CODE_KEY}" --region "$REGION"

ARTIFACT="{\"codeConfiguration\":{\"code\":{\"s3\":{\"bucket\":\"${CODE_BUCKET}\",\"prefix\":\"${CODE_KEY}\"}},\"runtime\":\"PYTHON_3_13\",\"entryPoint\":[\"agent.py\"]}}"
AUTHZ="{\"customJWTAuthorizer\":{\"discoveryUrl\":\"${DISCOVERY}\",\"allowedClients\":[\"${CLIENT_ID}\"]}}"
ENVV="{\"BEDROCK_REGION\":\"${REGION}\",\"TEA_MODEL_HAIKU\":\"us.anthropic.claude-haiku-4-5-20251001-v1:0\",\"TEA_MODEL_SONNET\":\"us.anthropic.claude-sonnet-4-6\"}"

# 기존 런타임 있으면 업데이트, 없으면 생성
EXIST_ID="$(aws bedrock-agentcore-control list-agent-runtimes --region "$REGION" \
  --query "agentRuntimes[?agentRuntimeName=='${RUNTIME_NAME}'].agentRuntimeId | [0]" --output text)"

if [ "$EXIST_ID" != "None" ] && [ -n "$EXIST_ID" ]; then
  echo "[agentcore] 기존 런타임 업데이트: $EXIST_ID"
  aws bedrock-agentcore-control update-agent-runtime --region "$REGION" \
    --agent-runtime-id "$EXIST_ID" \
    --role-arn "$ROLE_ARN" \
    --network-configuration '{"networkMode":"PUBLIC"}' \
    --agent-runtime-artifact "$ARTIFACT" \
    --authorizer-configuration "$AUTHZ" \
    --environment-variables "$ENVV" >/dev/null
  RUNTIME_ID="$EXIST_ID"
else
  echo "[agentcore] 런타임 생성"
  RUNTIME_ID="$(aws bedrock-agentcore-control create-agent-runtime --region "$REGION" \
    --agent-runtime-name "$RUNTIME_NAME" \
    --role-arn "$ROLE_ARN" \
    --network-configuration '{"networkMode":"PUBLIC"}' \
    --agent-runtime-artifact "$ARTIFACT" \
    --authorizer-configuration "$AUTHZ" \
    --environment-variables "$ENVV" \
    --query agentRuntimeId --output text)"
fi

echo "[agentcore] 런타임 ID: $RUNTIME_ID · READY 대기..."
for i in $(seq 1 40); do
  ST="$(aws bedrock-agentcore-control get-agent-runtime --region "$REGION" --agent-runtime-id "$RUNTIME_ID" --query status --output text)"
  echo "  status=$ST"
  [ "$ST" = "READY" ] && break
  [ "$ST" = "CREATE_FAILED" ] || [ "$ST" = "UPDATE_FAILED" ] && { echo "배포 실패"; exit 1; }
  sleep 10
done

ARN="$(aws bedrock-agentcore-control get-agent-runtime --region "$REGION" --agent-runtime-id "$RUNTIME_ID" --query agentRuntimeArn --output text)"
echo "==================================================="
echo " AgentCore 배포 완료"
echo "   런타임 : $RUNTIME_NAME ($RUNTIME_ID)"
echo "   ARN    : $ARN"
echo "==================================================="
echo "$ARN" > "$(dirname "$0")/agentcore_arn.txt"
