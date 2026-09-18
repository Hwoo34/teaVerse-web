#!/usr/bin/env bash
# TeaVerse 백엔드 Lambda 배포 패키지(zip) 빌드.
# Lambda(python3.11, x86_64)용 manylinux 휠로 의존성 설치 후 앱 코드와 함께 zip.
set -euo pipefail

BUILD=/tmp/teaverse-lambda-build
ZIP=/tmp/teaverse-lambda.zip
BACKEND="$(cd "$(dirname "$0")/../backend" && pwd)"

echo "[build] 정리"
rm -rf "$BUILD" "$ZIP"
mkdir -p "$BUILD"

echo "[build] 의존성 설치(manylinux x86_64, py3.11)"
pip install \
  --target "$BUILD" \
  --platform manylinux2014_x86_64 \
  --implementation cp --python-version 3.11 \
  --only-binary=:all: --upgrade \
  fastapi mangum "python-jose[cryptography]" httpx pydantic >/dev/null

echo "[build] 앱 코드 복사"
cp -r "$BACKEND/app" "$BUILD/app"
cp "$BACKEND/lambda_handler.py" "$BUILD/lambda_handler.py"

echo "[build] zip 생성"
(cd "$BUILD" && zip -qr "$ZIP" . -x '*.pyc' -x '*__pycache__*')
echo "[build] 완료: $ZIP ($(du -h "$ZIP" | cut -f1))"
