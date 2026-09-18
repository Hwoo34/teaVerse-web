#!/usr/bin/env bash
# TeaVerse 백엔드 Lambda 배포 (IAM 역할 + 함수 + Function URL).
# 멱등적으로 동작. 패키지 zip은 build_lambda.sh가 만든 /tmp/teaverse-lambda.zip 사용.
set -euo pipefail
source "$(dirname "$0")/_load_env.sh"

REGION="${AWS_REGION:-us-east-1}"
FUNC="teaverse-backend"
ROLE="teaverse-lambda-role"
ZIP="${LAMBDA_ZIP:-/tmp/teaverse-lambda.zip}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

COGNITO_USER_POOL_ID="${COGNITO_USER_POOL_ID:-}"
COGNITO_CLIENT_ID="${COGNITO_CLIENT_ID:-}"

echo "[lambda] 계정=$ACCOUNT_ID 리전=$REGION 함수=$FUNC"

# ── IAM 역할 ────────────────────────────────────────────
if aws iam get-role --role-name "$ROLE" >/dev/null 2>&1; then
  echo "[lambda] 기존 역할 재사용"
else
  echo "[lambda] IAM 역할 생성"
  aws iam create-role --role-name "$ROLE" \
    --assume-role-policy-document '{
      "Version":"2012-10-17",
      "Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]
    }' >/dev/null
  aws iam attach-role-policy --role-name "$ROLE" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole >/dev/null
fi

# 인라인 정책: Bedrock invoke + DynamoDB
aws iam put-role-policy --role-name "$ROLE" --policy-name teaverse-inline \
  --policy-document "{
    \"Version\":\"2012-10-17\",
    \"Statement\":[
      {\"Effect\":\"Allow\",\"Action\":[\"bedrock:InvokeModel\",\"bedrock:Converse\"],\"Resource\":\"*\"},
      {\"Effect\":\"Allow\",\"Action\":[\"dynamodb:Query\",\"dynamodb:GetItem\",\"dynamodb:PutItem\",\"dynamodb:BatchWriteItem\",\"dynamodb:Scan\"],\"Resource\":\"arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/tea_content\"}
    ]
  }" >/dev/null

ROLE_ARN="$(aws iam get-role --role-name "$ROLE" --query Role.Arn --output text)"
echo "[lambda] 역할 ARN: $ROLE_ARN"

ENV_VARS="Variables={AWS_LWA_ok=1,COGNITO_USER_POOL_ID=${COGNITO_USER_POOL_ID},COGNITO_CLIENT_ID=${COGNITO_CLIENT_ID},TEA_DATA_BACKEND=dynamodb,TEA_DDB_TABLE=tea_content}"

# ── Lambda 함수 ─────────────────────────────────────────
if aws lambda get-function --function-name "$FUNC" --region "$REGION" >/dev/null 2>&1; then
  echo "[lambda] 코드 업데이트"
  aws lambda update-function-code --function-name "$FUNC" --region "$REGION" \
    --zip-file "fileb://${ZIP}" >/dev/null
  aws lambda wait function-updated --function-name "$FUNC" --region "$REGION"
  aws lambda update-function-configuration --function-name "$FUNC" --region "$REGION" \
    --timeout 60 --memory-size 512 \
    --environment "$ENV_VARS" >/dev/null
else
  echo "[lambda] 함수 생성 (역할 전파 대기 10s)"
  sleep 10
  aws lambda create-function --function-name "$FUNC" --region "$REGION" \
    --runtime python3.11 --handler lambda_handler.handler \
    --role "$ROLE_ARN" --timeout 60 --memory-size 512 \
    --zip-file "fileb://${ZIP}" \
    --environment "$ENV_VARS" >/dev/null
  aws lambda wait function-active --function-name "$FUNC" --region "$REGION"
fi

# ── Function URL ────────────────────────────────────────
if aws lambda get-function-url-config --function-name "$FUNC" --region "$REGION" >/dev/null 2>&1; then
  echo "[lambda] 기존 Function URL 재사용"
else
  echo "[lambda] Function URL 생성"
  aws lambda create-function-url-config --function-name "$FUNC" --region "$REGION" \
    --auth-type NONE \
    --cors '{"AllowOrigins":["*"],"AllowMethods":["*"],"AllowHeaders":["*"]}' >/dev/null
  # 퍼블릭 호출 권한
  aws lambda add-permission --function-name "$FUNC" --region "$REGION" \
    --statement-id FunctionURLPublic --action lambda:InvokeFunctionUrl \
    --principal "*" --function-url-auth-type NONE >/dev/null 2>&1 || true
fi

FURL="$(aws lambda get-function-url-config --function-name "$FUNC" --region "$REGION" --query FunctionUrl --output text)"
echo "==================================================="
echo " Lambda 배포 완료"
echo "   함수 : $FUNC"
echo "   URL  : $FURL"
echo "==================================================="
echo "$FURL" > "$(dirname "$0")/lambda_url.txt"
