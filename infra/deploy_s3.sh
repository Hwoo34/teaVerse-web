#!/usr/bin/env bash
# 프론트엔드 S3 정적 웹사이트 배포 스크립트 (참고/대안용).
#
# 주의: 사용자는 이 배포를 aws-mcp 도구로 수행할 예정이다. 이 스크립트는
#       동일 절차를 AWS CLI로 재현한 참고 구현이다. 실행 시 실제 AWS 리소스가
#       생성/변경되므로 신중히 사용할 것.
#
# 절차: 버킷 생성 → 퍼블릭 액세스 차단 해제 → 버킷 정책(공개 읽기) → 정적 웹 호스팅
#
# 사용:
#   ./infra/deploy_s3.sh            # 버킷명은 config/project.env(S3_BUCKET) 또는 자동 생성
set -euo pipefail

source "$(dirname "$0")/_load_env.sh"
REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="${BUCKET:-${S3_BUCKET:-teaverse-web-${ACCOUNT_ID}-${REGION}}}"
DIST_DIR="$(dirname "$0")/../frontend/dist"

echo "[deploy] 리전=$REGION 계정=$ACCOUNT_ID 버킷=$BUCKET"

if [ ! -d "$DIST_DIR" ]; then
  echo "[deploy] ERROR: 빌드 산출물이 없습니다. 먼저 'cd frontend && npm run build' 실행."
  exit 1
fi

# 1) 버킷 생성 (us-east-1은 LocationConstraint 없이)
if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "[deploy] 기존 버킷 재사용: $BUCKET"
else
  echo "[deploy] 버킷 생성: $BUCKET"
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION"
  else
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION"
  fi
fi

# 2) 퍼블릭 액세스 차단 해제 (정적 웹 호스팅용)
echo "[deploy] 퍼블릭 액세스 차단 해제"
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration \
  "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

# 3) 버킷 정책 (공개 읽기)
echo "[deploy] 버킷 정책(공개 읽기) 적용"
cat > /tmp/teaverse-bucket-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadForStaticSite",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${BUCKET}/*"
    }
  ]
}
EOF
aws s3api put-bucket-policy --bucket "$BUCKET" --policy file:///tmp/teaverse-bucket-policy.json

# 4) 정적 웹사이트 호스팅 활성화 (SPA: 에러도 index.html로)
echo "[deploy] 정적 웹 호스팅 활성화"
aws s3api put-bucket-website --bucket "$BUCKET" \
  --website-configuration '{"IndexDocument":{"Suffix":"index.html"},"ErrorDocument":{"Key":"index.html"}}'

# 5) 산출물 업로드
echo "[deploy] dist 업로드"
aws s3 sync "$DIST_DIR" "s3://${BUCKET}/" --delete

URL="http://${BUCKET}.s3-website-${REGION}.amazonaws.com"
echo ""
echo "==================================================="
echo " 배포 완료"
echo "   버킷 : $BUCKET"
echo "   URL  : $URL"
echo "==================================================="
