"""데이터스토어 도구. 로컬 JSON과 DynamoDB를 동일 인터페이스로 추상화.

배포 시 TEA_DATA_BACKEND=dynamodb 로 전환하면 같은 코드가 DynamoDB를 사용한다.
"""
from __future__ import annotations

import json
import os
import threading
from typing import Any

from .. import config

_lock = threading.Lock()
_cache: dict[str, list[dict]] = {}


# ── 로컬 JSON 구현 ───────────────────────────────────────
def _path(category: str) -> str:
    fname = config.CATEGORIES[category]
    return os.path.join(config.DATA_DIR, fname)


def _load_local(category: str) -> list[dict]:
    if category in _cache:
        return _cache[category]
    with open(_path(category), encoding="utf-8") as f:
        data = json.load(f)
    _cache[category] = data
    return data


def _save_local(category: str, items: list[dict]) -> None:
    with open(_path(category), "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    _cache[category] = items


# ── 공개 API ─────────────────────────────────────────────
def list_items(category: str) -> list[dict]:
    """카테고리 전체 항목."""
    if category not in config.CATEGORIES:
        raise KeyError(f"알 수 없는 카테고리: {category}")
    if config.DATA_BACKEND == "dynamodb":
        return _ddb_list(category)
    return list(_load_local(category))


def search(category: str, query: str, limit: int = 8) -> list[dict]:
    """단순 키워드 검색(로컬). 이름/설명/기타 텍스트 필드를 부분일치로 매칭."""
    q = query.strip().lower()
    items = list_items(category)
    if not q:
        return items[:limit]

    def score(item: dict) -> int:
        blob = json.dumps(item, ensure_ascii=False).lower()
        # 쿼리 토큰이 많이 포함될수록 점수 상승
        return sum(1 for tok in q.split() if tok and tok in blob)

    ranked = sorted(items, key=score, reverse=True)
    matched = [it for it in ranked if score(it) > 0]
    # 매칭되는 항목이 있으면 그것만 반환. 없으면 빈 리스트(→ 상위에서 웹 검색 판단).
    return matched[:limit]


def upsert(category: str, item: dict) -> None:
    """항목 업서트(id 기준)."""
    with _lock:
        if config.DATA_BACKEND == "dynamodb":
            _ddb_put(category, item)
            return
        items = list(_load_local(category))
        idx = next((i for i, x in enumerate(items) if x.get("id") == item.get("id")), None)
        if idx is None:
            items.append(item)
        else:
            items[idx] = item
        _save_local(category, items)


def clear_cache() -> None:
    _cache.clear()


# ── DynamoDB 구현 (배포용) ───────────────────────────────
def _ddb_table():
    import boto3

    return boto3.resource("dynamodb", region_name=config.AWS_REGION).Table(
        config.DYNAMODB_TABLE
    )


def _denumber(obj):
    """DynamoDB Decimal 값을 일반 int/float로 정규화(JSON 직렬화 가능하도록)."""
    from decimal import Decimal

    if isinstance(obj, list):
        return [_denumber(x) for x in obj]
    if isinstance(obj, dict):
        return {k: _denumber(v) for k, v in obj.items()}
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    return obj


def _ddb_list(category: str) -> list[dict]:
    from boto3.dynamodb.conditions import Key

    table = _ddb_table()
    items: list[dict] = []
    kwargs = {"KeyConditionExpression": Key("category").eq(category)}
    while True:
        resp = table.query(**kwargs)
        items.extend(resp.get("Items", []))
        lek = resp.get("LastEvaluatedKey")
        if not lek:
            break
        kwargs["ExclusiveStartKey"] = lek
    return _denumber(items)


def _ddb_put(category: str, item: dict[str, Any]) -> None:
    row = dict(item)
    row["category"] = category
    _ddb_table().put_item(Item=row)
