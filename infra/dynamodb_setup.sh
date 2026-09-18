#!/usr/bin/env bash
# DynamoDB 테이블 tea_content 생성(멱등) + data/*.json 시드 적재.
# PK=category(S), SK=id(S)
set -euo pipefail
source "$(dirname "$0")/_load_env.sh"

REGION="${AWS_REGION:-us-east-1}"
TABLE="${TEA_DDB_TABLE:-tea_content}"

echo "[ddb] 리전=$REGION 테이블=$TABLE"

if aws dynamodb describe-table --table-name "$TABLE" --region "$REGION" >/dev/null 2>&1; then
  echo "[ddb] 기존 테이블 재사용"
else
  echo "[ddb] 테이블 생성"
  aws dynamodb create-table \
    --table-name "$TABLE" --region "$REGION" \
    --attribute-definitions AttributeName=category,AttributeType=S AttributeName=id,AttributeType=S \
    --key-schema AttributeName=category,KeyType=HASH AttributeName=id,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST >/dev/null
  echo "[ddb] 생성 대기..."
  aws dynamodb wait table-exists --table-name "$TABLE" --region "$REGION"
fi

echo "[ddb] 시드 적재"
python3 "$(dirname "$0")/seed_dynamodb.py"
echo "[ddb] 완료"
