from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.core.redmine import redmine_client
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.core.deps import get_current_user
from app.models.user import User, UserRole
from app.models.audit_log import AuditLog
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse, RefreshRequest
from datetime import datetime, timezone

router = APIRouter(prefix="/api/auth", tags=["auth"])

def _make_tokens(redmine_id: str) -> dict:
    data = {"sub": str(redmine_id)}
    return {
        "access_token": create_access_token(data),
        "refresh_token": create_refresh_token(data),
    }

def _determine_role(redmine_user: dict) -> UserRole:
    """
    Временная логика определения роли.
    В Этапе 2 (синхронизация) заменим на чтение из кастомного поля Redmine.
    Пока: admin group → admin, иначе employee.
    """
    groups = redmine_user.get("groups", [])
    group_names = [g.get("name", "") for g in groups]
    if any("admin" in n.lower() or "kpi_admin" in n.lower() for n in group_names):
        return UserRole.admin
    if any("finance" in n.lower() or "бухг" in n.lower() for n in group_names):
        return UserRole.finance
    if any("manager" in n.lower() or "руков" in n.lower() for n in group_names):
        return UserRole.manager
    return UserRole.employee

@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    # 1. Проверить через Redmine API
    redmine_user = await redmine_client.verify_credentials(body.login, body.password)
    if not redmine_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль",
        )

    redmine_id = str(redmine_user["id"])

    # 2. Найти или создать пользователя в PG
    result = await db.execute(select(User).where(User.redmine_id == redmine_id))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            redmine_id=redmine_id,
            login=redmine_user.get("login", body.login),
            firstname=redmine_user.get("firstname", ""),
            lastname=redmine_user.get("lastname", ""),
            email=redmine_user.get("mail"),
            role=_determine_role(redmine_user),
            last_synced_at=datetime.now(timezone.utc),
        )
        db.add(user)
    else:
        user.firstname = redmine_user.get("firstname", user.firstname)
        user.lastname = redmine_user.get("lastname", user.lastname)
        user.email = redmine_user.get("mail", user.email)
        user.last_synced_at = datetime.now(timezone.utc)

    # 3. Аудит
    log = AuditLog(
        user_id=redmine_id,
        user_login=body.login,
        action="login",
        ip_address=request.client.host if request.client else None,
    )
    db.add(log)
    await db.commit()
    await db.refresh(user)

    # 4. Выдать токены
    tokens = _make_tokens(redmine_id)
    return TokenResponse(
        **tokens,
        user=UserResponse.model_validate(user),
    )

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Недействительный refresh токен")

    redmine_id = payload.get("sub")
    result = await db.execute(select(User).where(User.redmine_id == redmine_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден")

    tokens = _make_tokens(redmine_id)
    return TokenResponse(
        **tokens,
        user=UserResponse.model_validate(user),
    )

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)
