"""로컬 테스트용 목(mock) JWT 생성기.

사용: python scripts/mock_token.py admin
      python scripts/mock_token.py user01
alg:none 개발용 토큰(서명 없음). 프론트 AuthContext의 목 토큰과 동일 형식.
"""
import base64
import json
import sys
import time


def b64(obj: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(obj).encode()).decode().rstrip("=")


def make(username: str) -> str:
    is_admin = username == "admin"
    header = b64({"alg": "none", "typ": "JWT"})
    payload = b64(
        {
            "cognito:username": username,
            "cognito:groups": ["admin"] if is_admin else [],
            "token_use": "id",
            "iss": "mock",
            "exp": int(time.time()) + 3600,
        }
    )
    return f"{header}.{payload}.mock"


if __name__ == "__main__":
    who = sys.argv[1] if len(sys.argv) > 1 else "user01"
    print(make(who))
