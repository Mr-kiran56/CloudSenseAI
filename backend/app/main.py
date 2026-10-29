import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .core.config import settings
from .core.logging import setup_logging, logger
from .db.init_db import init_db
from .api.v1.router import api_router
from .ml.model_service import ml_service

# Setup logging
setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup sequence
    logger.info("Initializing CloudSense AI Database...")
    init_db()
    
    logger.info("Checking ML Model Status...")
    model_status = ml_service.get_models_status()
    for m_key, info in model_status.items():
        logger.info("  -> %s: Loaded=%s", info["name"], info["loaded"])
    
    logger.info("CloudSense AI Backend v%s started successfully.", settings.VERSION)
    yield
    # Shutdown sequence
    logger.info("CloudSense AI Backend shutting down...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Production-Ready Cloud Cost Intelligence, Machine Learning, and MCP Remediation Backend",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled error processing %s: %s", request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error occurred in CloudSense AI engine."},
    )

# Mount API Routers
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs_url": "/docs",
        "api_v1": settings.API_V1_STR,
        "models": ml_service.get_models_status()
    }

@app.get(f"{settings.API_V1_STR}/health")
def health():
    return {
        "status": "healthy",
        "database": "connected",
        "mcp_engine": "ready",
        "models": ml_service.get_models_status()
    }
