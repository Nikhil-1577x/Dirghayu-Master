"""
main.py – FastAPI application entrypoint.

Startup sequence:
  1. Init SQLite database (create tables)
  2. Start MQTT background consumer
  3. Start APScheduler background jobs
  4. Register all API routers

Shutdown:
  1. Stop MQTT client
  2. Stop scheduler
"""
import logging
import os
from pathlib import Path

from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_db

# Load project-root .env so nirogi_ai and backend share configuration
load_dotenv(dotenv_path=Path(__file__).resolve().parents[2] / ".env", override=True)

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s – %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────────
    logger.info("=== Smart Medication Adherence System starting ===")

    # 1. Init DB
    init_db()
    logger.info("Database initialised")
    try:
        from app.iot.iot_service import ensure_iot_tables
        ensure_iot_tables()
    except Exception as exc:
        logger.warning("IoT table ensure skipped: %s", exc)
    try:
        from app.services.chat_service import ensure_chat_tables
        ensure_chat_tables()
    except Exception as exc:
        logger.warning("Chat table ensure skipped: %s", exc)

    # 2. Start MQTT consumer
    from app.services.mqtt_consumer import start_mqtt_client
    start_mqtt_client()

    # 3. Start scheduler
    from app.services.scheduler_service import start_scheduler
    start_scheduler()

    yield  # Application is running

    # ── Shutdown ─────────────────────────────────────────────────────────────
    logger.info("=== Shutting down ===")
    from app.services.mqtt_consumer import stop_mqtt_client
    from app.services.scheduler_service import stop_scheduler
    stop_mqtt_client()
    stop_scheduler()


# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.APP_VERSION,
    description="Production backend for Smart Pill Dispenser / Medication Adherence System",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Dev: Vite (5173) proxies /patient, /iot, etc. — same-origin, no CORS.
# If the frontend uses VITE_API_URL=http://localhost:8000, the browser calls 8000 directly;
# we must allow those origins explicitly (wildcard * is unreliable with credentials).
_DEV_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
)
_env = list(settings.ALLOWED_ORIGINS) if settings.ALLOWED_ORIGINS else []
if not _env or _env == ["*"]:
    _cors_origins = list(_DEV_ORIGINS)
elif settings.DEBUG:
    _cors_origins = list(dict.fromkeys(_env + list(_DEV_ORIGINS)))
else:
    _cors_origins = list(_env)
_cors_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=_cors_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request logging (debug visibility) ─────────────────────────────────────────
# This makes it obvious whether requests are reaching FastAPI at all.
@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"[INCOMING] {request.method} {request.url.path}", flush=True)
    try:
        response = await call_next(request)
    except Exception as exc:
        print(f"[ERROR] {request.method} {request.url.path}: {exc!r}", flush=True)
        raise
    code = getattr(response, "status_code", "?")
    print(f"[RESPONSE] {request.method} {request.url.path} -> {code}", flush=True)
    return response


# ── API Key auth (placeholder) ────────────────────────────────────────────────
def verify_api_key(request: Request) -> None:
    """
    Middleware-style dependency for API key verification.
    Enable by adding `Depends(verify_api_key)` to sensitive routers.
    """
    key = request.headers.get("X-API-Key", "")
    if key != settings.API_KEY:
        # Return 401 – uncomment when ready to enforce auth
        # raise HTTPException(status_code=401, detail="Invalid API key")
        pass


# ── Register Routers ──────────────────────────────────────────────────────────
from app.api.patient_routes import router as patient_router
from app.api.biomarker_routes import router as biomarker_router
from app.api.analyze_report import router as analyze_report_router
from app.api.adherence_routes import router as adherence_router
from app.api.alert_routes import router as alert_router
from app.api.report_routes import router as report_router
from app.api.risk_routes import router as risk_router
from app.api.websocket_routes import router as ws_router
from app.api.interaction_routes import router as interaction_router
from app.api.abha_routes import router as abha_router
from app.api.pdf_routes import router as pdf_router
from app.api.iot_routes import router as iot_router, legacy_router as iot_legacy_router
from app.api.chat_routes import router as chat_router
from app.api.chat_ws import router as chat_ws_router

app.include_router(patient_router)
app.include_router(biomarker_router)
app.include_router(analyze_report_router)
app.include_router(adherence_router)
app.include_router(alert_router)
app.include_router(report_router)
app.include_router(risk_router)
# Chat routes before generic /ws/{patient_id} so /ws/chat/{user_id} is never ambiguous.
app.include_router(chat_router)
app.include_router(chat_ws_router)
app.include_router(ws_router)
app.include_router(interaction_router)
app.include_router(abha_router)
app.include_router(pdf_router)
app.include_router(iot_router)
app.include_router(iot_legacy_router)


# ── Health check (must be before frontend catch-all) ───────────────────────────
@app.get("/", tags=["Health"])
async def health_check():
    return {
        "status": "ok",
        "service": settings.APP_TITLE,
        "version": settings.APP_VERSION,
    }


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy", "db": "postgresql"}


# ── Serve frontend (production) ───────────────────────────────────────────────
# Repo layout: doc/frontend/dist (Vite build), not Backend/Frontend/dist
_FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"

if _FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=_FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", tags=["Frontend"])
    async def serve_frontend(path: str = ""):
        """Serve frontend SPA for client-side routes. / and /health handled above."""
        # If this handler runs for API namespaces, no API route matched (e.g. stale server).
        # Return JSON 404 — never send index.html (avoids "Unexpected token '<'" in API clients).
        if path:
            first = path.split("/", 1)[0]
            reserved_first = {
                "api",
                "patient",
                "abha",
                "iot",
                "chat",
                "ws",
                "docs",
                "redoc",
                "openapi.json",
                "analyze-report",
            }
            if first in reserved_first or path.startswith("openapi"):
                raise HTTPException(status_code=404, detail="Not found")
        if path and not path.startswith(
            ("api", "patient", "abha", "iot", "ws", "chat", "docs", "redoc", "openapi", "analyze-report")
        ):
            file_path = _FRONTEND_DIST / path
            if file_path.is_file():
                return FileResponse(file_path)
        return FileResponse(_FRONTEND_DIST / "index.html")


# ── Global exception handler ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    detail = "Internal server error"
    if settings.DEBUG:
        detail = f"{type(exc).__name__}: {exc}"
    return JSONResponse(status_code=500, content={"detail": detail})
