"""로컬 개발용 FastAPI 서버.

프론트엔드(Vite, 5173)에서 /api 프록시로 호출한다.
배포 시에는 이 핸들러 로직을 AgentCore Runtime 엔트리포인트로 이식한다.

엔드포인트:
  GET  /api/health
  GET  /api/content/{category}
  POST /api/chat               (JWT 필요)
  POST /api/admin/ingest       (JWT + admin 필요)
"""
from __future__ import annotations

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import config
from .auth import AuthError, verify_token
from .agents import orchestrator, ingestion
from .tools import datastore

app = FastAPI(title="TeaVerse Backend", version="0.1.0")

# 로컬 개발: 프론트(5173)에서의 직접 호출도 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatReq(BaseModel):
    message: str
    sessionId: str | None = None


class IngestReq(BaseModel):
    category: str


def _require_user(authorization: str | None) -> dict:
    try:
        return verify_token(authorization)
    except AuthError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "authMode": "mock" if config.AUTH_MOCK else "cognito",
        "dataBackend": config.DATA_BACKEND,
        "models": {"haiku": config.MODEL_HAIKU, "sonnet": config.MODEL_SONNET},
    }


@app.get("/api/content/{category}")
def content(category: str) -> dict:
    if category not in config.CATEGORIES:
        raise HTTPException(status_code=404, detail="알 수 없는 카테고리")
    return {"category": category, "items": datastore.list_items(category)}


@app.post("/api/chat")
def chat(req: ChatReq, authorization: str | None = Header(default=None)) -> dict:
    user = _require_user(authorization)
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="빈 메시지")
    return orchestrator.handle(req.message, is_admin=user["is_admin"])


@app.post("/api/admin/ingest")
def admin_ingest(
    req: IngestReq, authorization: str | None = Header(default=None)
) -> dict:
    user = _require_user(authorization)
    if not user["is_admin"]:
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다.")
    if req.category == "all":
        result = ingestion.ingest_all()
        updated = sum(v.get("updated", 0) for v in result.values())
    elif req.category in config.CATEGORIES:
        result = ingestion.ingest_category(req.category)
        updated = result.get("updated", 0)
    else:
        raise HTTPException(status_code=400, detail="알 수 없는 카테고리")
    return {"status": "done", "updated": updated, "result": result}
