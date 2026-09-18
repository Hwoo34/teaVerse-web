"""Orchestrator(챗봇) 에이전트.

사용자와 상호작용하는 최상위 에이전트.
1) 가드레일: 차 관련 질문인지 판별(무관하면 정중히 거절)
2) 관리자 명령 판별: admin이 데이터 수집·업데이트를 요청하면 ingestion 라우팅
3) 카테고리 분류 후 해당 카테고리 QA 에이전트 호출(로컬은 함수 호출 = Gateway 모킹)
4) 응답 + 출처 합성
"""
from __future__ import annotations

import re

from .. import config
from ..bedrock_client import converse, converse_json
from . import category_qa, ingestion

CATEGORIES = list(config.CATEGORIES.keys())

_GUARD_SYSTEM = """당신은 차(茶) 전문 서비스의 요청 분류기입니다.
사용자 메시지가 '차와 관련된 정보 요청'인지 판별하고, 관련되면 카테고리를 고르세요.
차 관련 주제: 차 종류/우리는법/효능, 차 전시·행사, 차 도구(다구·다기·자사호) 상품, 차 도구 작가.
아래 JSON만 출력하세요(설명 금지):
{"tea_related": true|false, "category": "tea-knowledge|exhibitions|products|artists|null", "reason": "간단 사유"}
분류 규칙:
- 차 도구 상품/구매/리뷰 -> products
- 전시/축제/박람회 -> exhibitions
- 작가/도예가 -> artists
- 그 외 차 지식 -> tea-knowledge
- 차와 무관(날씨, 코딩, 정치 등) -> tea_related=false, category=null"""

_REFUSAL = (
    "죄송합니다. 저는 차(茶)에 관한 정보만 도와드릴 수 있어요. "
    "차 종류, 우리는 법, 전시, 차 도구 상품, 작가 등 차와 관련된 질문을 해주세요."
)

# 관리자 수집 명령 감지용 키워드
_INGEST_KEYWORDS = ("업데이트", "수집", "갱신", "최신화", "ingest", "update", "refresh")


def _detect_admin_ingest(message: str) -> str | None:
    """관리자 수집 명령이면 대상 카테고리('all' 포함) 반환, 아니면 None."""
    if not any(k in message.lower() for k in _INGEST_KEYWORDS):
        return None
    m = message.lower()
    if "전체" in message or "all" in m or "모든" in message:
        return "all"
    if any(w in message for w in ("상품", "다구", "다기", "자사호")) or "product" in m:
        return "products"
    if any(w in message for w in ("전시", "축제", "박람회")) or "exhibi" in m:
        return "exhibitions"
    if "작가" in message or "artist" in m:
        return "artists"
    if any(w in message for w in ("차 ", "차정보", "차 정보", "차종류")) or "tea" in m:
        return "tea-knowledge"
    return "all"


def handle(message: str, is_admin: bool) -> dict:
    """챗봇 메인 핸들러.

    반환: {reply, sources[], category, refused, adminAction}
    """
    # 1) 관리자 수집 명령 처리
    ingest_target = _detect_admin_ingest(message)
    if ingest_target is not None:
        if not is_admin:
            return {
                "reply": "데이터 수집·업데이트는 관리자만 실행할 수 있습니다. 일반 사용자 권한으로는 요청할 수 없어요.",
                "sources": [],
                "category": None,
                "refused": False,
                "adminAction": {"requested": ingest_target, "allowed": False},
            }
        # 관리자: 수집 실행
        if ingest_target == "all":
            result = ingestion.ingest_all()
            total = sum(v.get("updated", 0) for v in result.values())
        else:
            result = ingestion.ingest_category(ingest_target)
            total = result.get("updated", 0)
        return {
            "reply": f"'{ingest_target}' 데이터 수집·업데이트를 실행했습니다. 갱신 {total}건.",
            "sources": [],
            "category": ingest_target if ingest_target != "all" else None,
            "refused": False,
            "adminAction": {"requested": ingest_target, "allowed": True, "result": result},
        }

    # 2) 가드레일 + 카테고리 분류
    cls = converse_json(_GUARD_SYSTEM, message, model_id=config.MODEL_HAIKU, max_tokens=200)
    tea_related = bool(cls.get("tea_related"))
    category = cls.get("category")

    if not tea_related or category not in CATEGORIES:
        return {
            "reply": _REFUSAL,
            "sources": [],
            "category": None,
            "refused": True,
            "adminAction": None,
        }

    # 3) 카테고리 QA 에이전트 호출 (Gateway 모킹)
    qa = category_qa.answer(category, message)
    return {
        "reply": qa["reply"],
        "sources": qa["sources"],
        "category": category,
        "refused": False,
        "adminAction": None,
    }
