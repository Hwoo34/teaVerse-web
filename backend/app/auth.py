"""JWT 인증. Cognito 설정 시 실제 서명 검증, 미설정 시 목(mock) 파싱.

- 실제 모드: Cognito JWKS로 서명 검증 + iss/aud 확인.
- 목 모드: alg:none 개발용 토큰의 payload만 파싱(로컬 개발 전용).
반환 사용자 정보: {username, is_admin}
"""
from __future__ import annotations

import base64
import json
import time
from functools import lru_cache

import httpx
from jose import jwt

from . import config


class AuthError(Exception):
    pass


def _b64json(segment: str) -> dict:
    pad = "=" * (-len(segment) % 4)
    return json.loads(base64.urlsafe_b64decode(segment + pad))


def _parse_mock(token: str) -> dict:
    """개발용 목 토큰(payload만) 파싱."""
    try:
        payload = _b64json(token.split(".")[1])
    except Exception as e:  # noqa: BLE001
        raise AuthError("잘못된 토큰 형식") from e
    if payload.get("exp", 0) < time.time():
        raise AuthError("만료된 토큰")
    groups = payload.get("cognito:groups", []) or []
    return {
        "username": payload.get("cognito:username", "unknown"),
        "is_admin": "admin" in groups,
    }


@lru_cache(maxsize=1)
def _jwks() -> dict:
    url = (
        f"https://cognito-idp.{config.COGNITO_REGION}.amazonaws.com/"
        f"{config.COGNITO_USER_POOL_ID}/.well-known/jwks.json"
    )
    return httpx.get(url, timeout=10.0).json()


def _parse_cognito(token: str) -> dict:
    try:
        headers = jwt.get_unverified_header(token)
        key = next(
            (k for k in _jwks()["keys"] if k["kid"] == headers["kid"]), None
        )
        if key is None:
            raise AuthError("서명 키를 찾을 수 없음")
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=config.COGNITO_CLIENT_ID,
            options={"verify_aud": True},
        )
    except AuthError:
        raise
    except Exception as e:  # noqa: BLE001
        raise AuthError(f"토큰 검증 실패: {e}") from e

    groups = claims.get("cognito:groups", []) or []
    return {
        "username": claims.get("cognito:username") or claims.get("username", "unknown"),
        "is_admin": "admin" in groups,
    }


def verify_token(authorization: str | None) -> dict:
    """Authorization 헤더에서 사용자 정보 추출. 실패 시 AuthError."""
    if not authorization or not authorization.startswith("Bearer "):
        raise AuthError("인증 토큰이 없습니다.")
    token = authorization.split(" ", 1)[1].strip()
    if config.AUTH_MOCK:
        return _parse_mock(token)
    return _parse_cognito(token)
