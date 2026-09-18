#!/usr/bin/env bash
# 공통 설정 로더. 각 스크립트 상단에서 source 한다.
#   source "$(dirname "$0")/_load_env.sh"
# config/project.env 가 있으면 로드하고, 없으면 example 안내 후 계속(환경변수/기본값 사용).
_ENV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../config" && pwd)"
if [ -f "${_ENV_DIR}/project.env" ]; then
  set -a
  # shellcheck disable=SC1090
  source "${_ENV_DIR}/project.env"
  set +a
else
  echo "[config] config/project.env 없음 — 환경변수/기본값을 사용합니다. (예시: config/project.env.example)" >&2
fi

# 리전 통일
export AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
export AWS_DEFAULT_REGION="${AWS_REGION}"

# config/project.env 값을 스크립트가 기대하는 이름으로도 노출
export COGNITO_USER_POOL_ID="${COGNITO_USER_POOL_ID:-}"
export COGNITO_CLIENT_ID="${COGNITO_CLIENT_ID:-}"
export AGENTCORE_RUNTIME_ARN="${AGENTCORE_RUNTIME_ARN:-}"
