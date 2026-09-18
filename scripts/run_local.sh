#!/usr/bin/env bash
# 로컬 개발 실행 헬퍼 (개발 컨테이너 tea-ai-dev 내부에서 실행되는 것을 가정).
# 백엔드(FastAPI:8000)와 프론트(Vite:5173)를 함께 띄운다.
#
# 호스트에서:  docker exec -it tea-ai-dev bash -lc '/workspace/scripts/run_local.sh'
# 접속:        http://localhost:5173
set -euo pipefail

# 중앙 설정 로드 (있으면)
[ -f /workspace/config/project.env ] && { set -a; source /workspace/config/project.env; set +a; }
export AWS_DEFAULT_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"

# Cognito 설정이 있으면 실제 인증 모드로 백엔드 구동
if [ -f /workspace/infra/cognito_output.env ]; then
  # shellcheck disable=SC1091
  set -a; source /workspace/infra/cognito_output.env; set +a
  echo "[run] Cognito 실제 인증 모드 (POOL=$COGNITO_USER_POOL_ID)"
else
  echo "[run] 목(mock) 인증 모드 (Cognito 미설정)"
fi

echo "[run] 백엔드 시작 (:8000)"
cd /workspace/backend
. .venv/bin/activate
uvicorn app.local_server:app --host 0.0.0.0 --port 8000 &
BACK_PID=$!

echo "[run] 프론트 시작 (:5173)"
cd /workspace/frontend
npm run dev &
FRONT_PID=$!

trap 'kill $BACK_PID $FRONT_PID 2>/dev/null' INT TERM
wait
