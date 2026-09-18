"""중앙 설정. 모델 정책(비용 제약)과 환경 설정을 한 곳에서 관리한다.

[모델 제약 — 필수]
에이전트 모델은 Claude Sonnet 4.6 이하만 사용한다. Opus 이상 / Sonnet 5 등
상한 초과 모델은 절대 사용하지 않는다. 모델 ID는 여기서만 정의하고,
다른 모듈은 이 상수를 import 해서 쓴다(하드코딩 금지).
"""
from __future__ import annotations

import os

# ── 리전 ────────────────────────────────────────────────
AWS_REGION = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")

# ── 모델 정책 (Sonnet 4.6 이하만) ─────────────────────────
# 기본: 분류/가드레일/경량 QA/수집 요약
MODEL_HAIKU = os.environ.get(
    "TEA_MODEL_HAIKU", "us.anthropic.claude-haiku-4-5-20251001-v1:0"
)
# 상한: 복잡한 오케스트레이션/추론 (이 이상 금지)
MODEL_SONNET = os.environ.get("TEA_MODEL_SONNET", "us.anthropic.claude-sonnet-4-6")

# 사용 허용 모델 화이트리스트 (방어적: 이 목록 외 모델 호출 차단)
ALLOWED_MODELS = {MODEL_HAIKU, MODEL_SONNET}

# 상한 초과 금지 키워드(모델 ID에 포함되면 거부)
FORBIDDEN_MODEL_SUBSTRINGS = ("opus", "sonnet-5", "opus-5", "sonnet-4-7", "sonnet-4-8")

# ── 데이터 ──────────────────────────────────────────────
# 로컬 시드 데이터 경로 (repo 루트의 data/)
DATA_DIR = os.environ.get(
    "TEA_DATA_DIR",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data")),
)

# 데이터 백엔드: "local"(JSON) | "dynamodb"
DATA_BACKEND = os.environ.get("TEA_DATA_BACKEND", "local")
DYNAMODB_TABLE = os.environ.get("TEA_DDB_TABLE", "tea_content")

CATEGORIES = {
    "tea-knowledge": "tea.json",
    "exhibitions": "exhibitions.json",
    "products": "products.json",
    "artists": "artists.json",
}

# ── 인증 ────────────────────────────────────────────────
# Cognito 미설정 시 목 모드(alg:none 개발용 JWT payload 파싱)
COGNITO_REGION = os.environ.get("VITE_COGNITO_REGION", AWS_REGION)
COGNITO_USER_POOL_ID = os.environ.get("COGNITO_USER_POOL_ID", "")
COGNITO_CLIENT_ID = os.environ.get("COGNITO_CLIENT_ID", "")
AUTH_MOCK = not (COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID)

# ── 웹 검색 ─────────────────────────────────────────────
WEB_SEARCH_ENABLED = os.environ.get("TEA_WEB_SEARCH", "1") == "1"


def assert_model_allowed(model_id: str) -> None:
    """모델 제약 위반 방지 가드. 상한 초과 모델이면 예외."""
    lower = model_id.lower()
    for bad in FORBIDDEN_MODEL_SUBSTRINGS:
        if bad in lower:
            raise ValueError(
                f"모델 제약 위반: '{model_id}'는 Sonnet 4.6 초과 모델이라 사용할 수 없습니다."
            )
