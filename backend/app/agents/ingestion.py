"""데이터 수집·업데이트 에이전트.

- 24시간 주기 자동 실행(배포: EventBridge) + 관리자 온디맨드 트리거.
- 웹 검색으로 카테고리 관련 최신 정보를 수집 → Bedrock으로 스키마에 맞게 정규화
  → 데이터스토어에 upsert.

로컬에서는 웹 검색 결과를 근거로 요약 항목을 생성/갱신한다. 검색이 비어 있으면
기존 항목의 lastUpdatedAt 만 갱신하는 안전한 no-op에 가깝게 동작한다.
"""
from __future__ import annotations

import datetime as dt
import json

from .. import config
from ..bedrock_client import converse_json
from ..tools import datastore, web_search
from .category_qa import CATEGORY_LABEL

_SYSTEM = """당신은 차(茶) 데이터 큐레이터입니다.
웹 검색 결과를 바탕으로 주어진 카테고리에 새로 추가/갱신할 항목을 JSON 배열로 만드세요.
- 각 항목은 반드시 근거가 된 실제 URL을 sources[].url 에 포함합니다.
- 확실하지 않은 사실은 만들지 마세요. 근거가 약하면 빈 배열 []을 반환하세요.
- 반드시 유효한 JSON만 출력하세요(설명 문장 금지)."""

_SCHEMA_HINT = {
    "tea-knowledge": '{"id","name","category(전통차|중국차|한국차|꽃차)","origin","description","flavorNotes":[],"caffeine","sources":[{"title","url","type":"web"}]}',
    "exhibitions": '{"id","title","venue","city","startDate","endDate","description","url","sources":[{"title","url","type":"web"}]}',
    "products": '{"id","name","type","price","currency","vendor","url","rating","reviewSummary","sources":[{"title","url","type":"web"}]}',
    "artists": '{"id","name","rising":bool,"bio","region","style","products":[],"sources":[{"title","url","type":"web"}]}',
}


def _now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace(
        "+00:00", "Z"
    )


def ingest_category(category: str, max_new: int = 3) -> dict:
    """단일 카테고리 수집. 반환: {category, updated, items:[id...]}."""
    if category not in config.CATEGORIES:
        raise KeyError(f"알 수 없는 카테고리: {category}")

    label = CATEGORY_LABEL.get(category, category)
    queries = {
        "tea-knowledge": f"인기 있는 차 종류 {label} 최신",
        "exhibitions": "차 전시 박람회 축제 일정",
        "products": "다구 다기 자사호 인기 상품 리뷰",
        "artists": "떠오르는 도예 작가 자사호 차도구",
    }
    results = web_search.search(queries.get(category, label), max_results=5)

    if not results:
        # 검색 불가: 기존 항목 타임스탬프만 갱신(no-op성)
        return {"category": category, "updated": 0, "items": [], "note": "웹 검색 결과 없음"}

    user = (
        f"[카테고리] {category} ({label})\n"
        f"[항목 스키마] {_SCHEMA_HINT.get(category)}\n"
        f"[웹검색결과]\n{json.dumps(results, ensure_ascii=False)[:4000]}\n\n"
        f"최대 {max_new}개의 항목을 JSON 배열로 만드세요. id는 '{category}-web-<슬러그>' 형식."
    )
    data = converse_json(_SYSTEM, user, model_id=config.MODEL_HAIKU, max_tokens=1500)

    items = data if isinstance(data, list) else data.get("items", []) if isinstance(data, dict) else []
    updated_ids: list[str] = []
    for it in items[:max_new]:
        if not isinstance(it, dict) or not it.get("id"):
            continue
        it["lastUpdatedAt"] = _now()
        it["sourceType"] = "web"
        it["updatedByAgent"] = f"ingestion:{category}"
        datastore.upsert(category, it)
        updated_ids.append(it["id"])

    return {"category": category, "updated": len(updated_ids), "items": updated_ids}


def ingest_all() -> dict:
    """전체 카테고리 수집(24h 스케줄용)."""
    out = {}
    for cat in config.CATEGORIES:
        try:
            out[cat] = ingest_category(cat)
        except Exception as e:  # noqa: BLE001
            out[cat] = {"category": cat, "updated": 0, "error": str(e)}
    return out
