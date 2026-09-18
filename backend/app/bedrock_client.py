"""Bedrock Converse 래퍼. 모델 제약(Sonnet 4.6 이하)을 강제한다."""
from __future__ import annotations

import json
import boto3

from . import config

_client = None


def _runtime():
    global _client
    if _client is None:
        _client = boto3.client("bedrock-runtime", region_name=config.AWS_REGION)
    return _client


def converse(
    system: str,
    user_text: str,
    model_id: str | None = None,
    max_tokens: int = 1024,
    temperature: float = 0.3,
) -> str:
    """단일 턴 Converse 호출. 텍스트 응답 반환.

    model_id 미지정 시 기본(HAIKU). 상한 초과 모델은 config에서 차단.
    """
    model = model_id or config.MODEL_HAIKU
    config.assert_model_allowed(model)

    resp = _runtime().converse(
        modelId=model,
        system=[{"text": system}],
        messages=[{"role": "user", "content": [{"text": user_text}]}],
        inferenceConfig={"maxTokens": max_tokens, "temperature": temperature},
    )
    parts = resp["output"]["message"]["content"]
    return "".join(p.get("text", "") for p in parts).strip()


def converse_json(
    system: str,
    user_text: str,
    model_id: str | None = None,
    max_tokens: int = 1024,
) -> dict:
    """JSON 응답을 기대하는 호출. 파싱 실패 시 {}."""
    raw = converse(system, user_text, model_id=model_id, max_tokens=max_tokens, temperature=0)
    # 코드펜스 제거
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1] if "```" in text[3:] else text
        text = text.lstrip("json").strip("`").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # 본문에서 첫 { ~ 마지막 } 추출 재시도
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                return {}
        return {}
