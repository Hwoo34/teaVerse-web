#!/usr/bin/env bash
# 개발 컨테이너 안에서 명령을 실행하는 헬퍼.
# 사용법: ./docker/dexec.sh "aws s3 ls"
#         ./docker/dexec.sh            # 대화형 셸 진입
set -euo pipefail
CONTAINER="tea-ai-dev"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "[dexec] 컨테이너가 실행 중이 아닙니다. 기동합니다..."
  (cd "$(dirname "$0")" && docker compose up -d)
fi

if [ "$#" -eq 0 ]; then
  docker exec -it "${CONTAINER}" bash -l
else
  docker exec "${CONTAINER}" bash -lc "$*"
fi
