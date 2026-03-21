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
from pathlib import Path

from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request, Depends
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
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
    print(f"[RESPONSE] {request.method} {request.url.path} -> {response.status_code}", flush=True)
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

app.include_router(patient_router)
app.include_router(biomarker_router)
app.include_router(analyze_report_router)
app.include_router(adherence_router)
app.include_router(alert_router)
app.include_router(report_router)
app.include_router(risk_router)
app.include_router(ws_router)
app.include_router(interaction_router)
app.include_router(abha_router)


# ── Health check (must be before frontend catch-all) ───────────────────────────
@app.on_event("startup")
async def startup_event():
    import sys
    import nirogi_ai
    print(f"DEBUG: sys.path = {sys.path}", flush=True)
    print(f"DEBUG: nirogi_ai located at {nirogi_ai.__file__}", flush=True)
    # Also ensure project root is in path
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if project_root not in sys.path:
        sys.path.insert(0, project_root)
        print(f"DEBUG: Added {project_root} to sys.path", flush=True)

@app.get("/", tags=["Health"])
async def health_check():
    return {
        "status": "ok",
        "service": settings.APP_TITLE,
        "version": settings.APP_VERSION,
    }


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy", "db": settings.DB_PATH}


# ── Serve frontend (production) ───────────────────────────────────────────────
_FRONTEND_DIST = Path(__file__).resolve().parent.parent / "Frontend" / "dist"

if _FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=_FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", tags=["Frontend"])
    async def serve_frontend(path: str = ""):
        """Serve frontend SPA for client-side routes. / and /health handled above."""
        if path and not path.startswith(("api", "patient", "ws", "docs", "redoc", "openapi")):
            file_path = _FRONTEND_DIST / path
            if file_path.is_file():
                return FileResponse(file_path)
        return FileResponse(_FRONTEND_DIST / "index.html")


# ── Global exception handler ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
