from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.health import router as health_router

app = FastAPI(
    title="KPI Portal API",
    description="API для системы KPI-отчётов ГКУ МО «РЦТ»",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)

@app.on_event("startup")
async def startup():
    print(f"✅ KPI Portal запущен в режиме: {settings.app_env}")
