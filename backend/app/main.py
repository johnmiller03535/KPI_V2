from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.sync import router as sync_router
from app.api.employees import router as employees_router
from app.api.periods import router as periods_router
from app.api.kpi_submissions import router as submissions_router
from app.scheduler import start_scheduler, stop_scheduler

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
app.include_router(auth_router)
app.include_router(sync_router)
app.include_router(employees_router)
app.include_router(periods_router)
app.include_router(submissions_router)

@app.on_event("startup")
async def startup():
    print(f"✅ KPI Portal запущен в режиме: {settings.app_env}")
    start_scheduler()

@app.on_event("shutdown")
async def shutdown():
    stop_scheduler()
