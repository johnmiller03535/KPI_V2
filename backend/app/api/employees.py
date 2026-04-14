from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from pydantic import BaseModel
from datetime import datetime
from app.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.employee import Employee, EmployeeStatus

router = APIRouter(prefix="/api/employees", tags=["employees"])


class EmployeeResponse(BaseModel):
    id: str
    redmine_id: str
    login: str
    firstname: str
    lastname: str
    full_name: str
    email: Optional[str]
    department_code: Optional[str]
    department_name: Optional[str]
    position_id: Optional[str]
    status: str
    last_synced_at: Optional[datetime]

    class Config:
        from_attributes = True


@router.get("/", response_model=list[EmployeeResponse])
async def list_employees(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    department: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
):
    """Список сотрудников с фильтрацией по подразделению и статусу."""
    query = select(Employee)
    if department:
        query = query.where(Employee.department_code == department)
    if status:
        query = query.where(Employee.status == status)
    else:
        query = query.where(Employee.status == EmployeeStatus.active)

    result = await db.execute(query)
    employees = result.scalars().all()
    return [
        EmployeeResponse(
            id=str(e.id),
            redmine_id=e.redmine_id,
            login=e.login,
            firstname=e.firstname,
            lastname=e.lastname,
            full_name=e.full_name,
            email=e.email,
            department_code=e.department_code,
            department_name=e.department_name,
            position_id=e.position_id,
            status=e.status,
            last_synced_at=e.last_synced_at,
        )
        for e in employees
    ]


@router.get("/me", response_model=EmployeeResponse)
async def get_my_employee_record(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получить запись сотрудника для текущего пользователя."""
    result = await db.execute(
        select(Employee).where(Employee.redmine_id == current_user.redmine_id)
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Запись сотрудника не найдена")
    return EmployeeResponse(
        id=str(emp.id),
        redmine_id=emp.redmine_id,
        login=emp.login,
        firstname=emp.firstname,
        lastname=emp.lastname,
        full_name=emp.full_name,
        email=emp.email,
        department_code=emp.department_code,
        department_name=emp.department_name,
        position_id=emp.position_id,
        status=emp.status,
        last_synced_at=emp.last_synced_at,
    )
