"""
FastAPI application — Poker Hand Analyzer backend.
Run with: uvicorn api.main:app --reload
"""
import logging
import os
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

from core.database import init_db
from api.routes.hands import router as hands_router
from api.routes.auth import router as auth_router
from api.routes.web import router as web_router
from api.routes.practice import router as practice_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Poker Hand Analyzer API",
    description="MVP backend for AI-powered poker hand analysis",
    version="1.0.0",
)

# CORS — allow all origins for MVP; tighten in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(hands_router)
app.include_router(auth_router)
app.include_router(web_router)
app.include_router(practice_router)


@app.on_event("startup")
async def startup_event() -> None:
    await init_db()
    logger.info("FastAPI app started, DB initialized.")


@app.on_event("shutdown")
async def shutdown_event() -> None:
    logger.info("FastAPI app shutting down.")


@app.get("/health")
async def health_check() -> dict:
    return {"status": "ok", "service": "poker-hand-analyzer"}
