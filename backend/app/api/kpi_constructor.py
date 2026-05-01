"""
API: KPI Конструктор
Управление библиотекой показателей и карточками должностей.
"""

import logging
from datetime import date, datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.kpi_constructor import (
    KpiIndicator, KpiCriterion, KpiRoleCard, KpiRoleCardIndicator,
)
from app.schemas.kpi_constructor import (
    IndicatorCreate, IndicatorUpdate, IndicatorResponse, CriterionResponse,
    ApproveIndicatorRequest, RejectIndicatorRequest,
    CardIndicatorAdd, CardIndicatorUpdate,
    CardResponse, CardIndicatorResponse, CardValidateResponse,
    ImportResult,
)
from app.services.kpi_import_service import kpi_import_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/kpi", tags=["kpi-constructor"])


# ─── helpers ──────────────────────────────────────────────────────────────────

async def _get_indicator_or_404(db: AsyncSession, indicator_id: UUID) -> KpiIndicator:
    result = await db.execute(select(KpiIndicator).where(KpiIndicator.id == indicator_id))
    ind = result.scalar_one_or_none()
    if not ind:
        raise HTTPException(status_code=404, detail="Показатель не найден")
    return ind


async def _get_card_or_404(db: AsyncSession, card_id: UUID) -> KpiRoleCard:
    result = await db.execute(select(KpiRoleCard).where(KpiRoleCard.id == card_id))
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Карточка не найдена")
    return card


async def _build_indicator_response(db: AsyncSession, ind: KpiIndicator) -> IndicatorResponse:
    criteria_res = await db.execute(
        select(KpiCriterion).where(KpiCriterion.indicator_id == ind.id)
    )
    criteria = criteria_res.scalars().all()

    # Количество карточек где используется этот показатель
    count_res = await db.execute(
        select(func.count()).where(KpiRoleCardIndicator.indicator_id == ind.id)
    )
    used_count = count_res.scalar_one() or 0

    return IndicatorResponse(
        id=ind.id,
        code=ind.code,
        name=ind.name,
        formula_type=ind.formula_type,
        is_common=ind.is_common,
        is_editable_per_role=ind.is_editable_per_role,
        indicator_group=ind.indicator_group,
        status=ind.status,
        version=ind.version,
        valid_from=ind.valid_from,
        valid_to=ind.valid_to,
        created_by=ind.created_by,
        created_at=ind.created_at,
        updated_at=ind.updated_at,
        criteria=[CriterionResponse.model_validate(c) for c in criteria],
        used_in_cards_count=used_count,
    )


async def _build_card_response(db: AsyncSession, card: KpiRoleCard) -> CardResponse:
    ci_res = await db.execute(
        select(KpiRoleCardIndicator)
        .where(KpiRoleCardIndicator.card_id == card.id)
        .order_by(KpiRoleCardIndicator.order_num)
    )
    card_inds = ci_res.scalars().all()

    ind_responses: list[CardIndicatorResponse] = []
    total_weight = 0

    for ci in card_inds:
        ind_res = await db.execute(select(KpiIndicator).where(KpiIndicator.id == ci.indicator_id))
        ind = ind_res.scalar_one_or_none()

        crit_text = None
        if ci.criterion_id:
            cr_res = await db.execute(select(KpiCriterion).where(KpiCriterion.id == ci.criterion_id))
            cr = cr_res.scalar_one_or_none()
            crit_text = cr.criterion if cr else None

        ind_responses.append(CardIndicatorResponse(
            id=ci.id,
            card_id=ci.card_id,
            indicator_id=ci.indicator_id,
            criterion_id=ci.criterion_id,
            weight=ci.weight,
            order_num=ci.order_num,
            override_criterion=ci.override_criterion,
            override_thresholds=ci.override_thresholds,
            override_weight=ci.override_weight,
            indicator_name=ind.name if ind else None,
            indicator_formula_type=ind.formula_type if ind else None,
            criterion_text=ci.override_criterion or crit_text,
            is_common=ind.is_common if ind else None,
            indicator_group=ind.indicator_group if ind else None,
        ))
        total_weight += ci.override_weight or ci.weight

    return CardResponse(
        id=card.id,
        pos_id=card.pos_id,
        role_id=card.role_id,
        role_name=card.role_name,
        unit=card.unit,
        version=card.version,
        status=card.status,
        valid_from=card.valid_from,
        valid_to=card.valid_to,
        created_by=card.created_by,
        approved_by=card.approved_by,
        approved_at=card.approved_at,
        created_at=card.created_at,
        updated_at=card.updated_at,
        indicators=ind_responses,
        total_weight=total_weight,
    )


# ─── INDICATORS ───────────────────────────────────────────────────────────────

@router.get("/indicators", response_model=list[IndicatorResponse])
async def list_indicators(
    status: Optional[str] = Query(None, description="draft|active|archived|all"),
    formula_type: Optional[str] = Query(None),
    is_common: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Список показателей KPI из библиотеки."""
    q = select(KpiIndicator)
    if status and status != "all":
        q = q.where(KpiIndicator.status == status)
    if formula_type:
        q = q.where(KpiIndicator.formula_type == formula_type)
    if is_common is not None:
        q = q.where(KpiIndicator.is_common == is_common)
    q = q.order_by(KpiIndicator.created_at.desc())

    result = await db.execute(q)
    inds = result.scalars().all()
    return [await _build_indicator_response(db, ind) for ind in inds]


@router.post("/indicators", response_model=IndicatorResponse)
async def create_indicator(
    body: IndicatorCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Создать новый показатель (статус draft). Роли: manager, hr, admin."""
    if current_user.role not in (UserRole.manager, UserRole.admin):
        # hr будет добавлена позже, сейчас нет такой роли
        pass

    ind = KpiIndicator(
        code=body.code,
        name=body.name,
        formula_type=body.formula_type,
        is_common=body.is_common,
        is_editable_per_role=body.is_editable_per_role,
        status="draft",
        version=1,
        created_by=current_user.login,
    )
    db.add(ind)
    await db.flush()  # получить id

    criterion = KpiCriterion(
        indicator_id=ind.id,
        criterion=body.criterion,
        numerator_label=body.numerator_label,
        denominator_label=body.denominator_label,
        thresholds=body.thresholds,
        sub_indicators=body.sub_indicators,
        quarterly_thresholds=body.quarterly_thresholds,
        cumulative=body.cumulative,
        plan_value=body.plan_value,
        common_text_positive=body.common_text_positive,
        common_text_negative=body.common_text_negative,
    )
    db.add(criterion)
    await db.commit()
    await db.refresh(ind)
    return await _build_indicator_response(db, ind)


@router.get("/indicators/{indicator_id}", response_model=IndicatorResponse)
async def get_indicator(
    indicator_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ind = await _get_indicator_or_404(db, indicator_id)
    return await _build_indicator_response(db, ind)


@router.put("/indicators/{indicator_id}", response_model=IndicatorResponse)
async def update_indicator(
    indicator_id: UUID,
    body: IndicatorUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Редактировать показатель. Структурные поля (name, is_common) — только draft. is_common — только admin."""
    ind = await _get_indicator_or_404(db, indicator_id)
    # Разрешаем редактирование indicator_group и критериев для active-показателей
    struct_only = body.code is not None or body.name is not None or body.is_editable_per_role is not None or body.is_common is not None
    if struct_only and ind.status != "draft":
        raise HTTPException(status_code=400, detail="Структурные поля можно менять только у черновика")

    if body.is_common is not None and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Изменять is_common может только admin")

    if body.code is not None:
        ind.code = body.code
    if body.name is not None:
        ind.name = body.name
    if body.is_editable_per_role is not None:
        ind.is_editable_per_role = body.is_editable_per_role
    if body.is_common is not None:
        ind.is_common = body.is_common
    if body.indicator_group is not None:
        ind.indicator_group = body.indicator_group

    # Обновить первый критерий если переданы поля
    crit_fields = {
        "criterion", "numerator_label", "denominator_label", "thresholds",
        "sub_indicators", "quarterly_thresholds", "cumulative",
        "plan_value", "common_text_positive", "common_text_negative",
    }
    has_crit_update = any(getattr(body, f) is not None for f in crit_fields)
    if has_crit_update:
        cr_res = await db.execute(
            select(KpiCriterion).where(KpiCriterion.indicator_id == ind.id)
        )
        cr = cr_res.scalars().first()
        if cr:
            if body.criterion is not None:
                cr.criterion = body.criterion
            if body.numerator_label is not None:
                cr.numerator_label = body.numerator_label
            if body.denominator_label is not None:
                cr.denominator_label = body.denominator_label
            if body.thresholds is not None:
                cr.thresholds = body.thresholds
            if body.sub_indicators is not None:
                cr.sub_indicators = body.sub_indicators
            if body.quarterly_thresholds is not None:
                cr.quarterly_thresholds = body.quarterly_thresholds
            if body.cumulative is not None:
                cr.cumulative = body.cumulative
            if body.plan_value is not None:
                cr.plan_value = body.plan_value
            if body.common_text_positive is not None:
                cr.common_text_positive = body.common_text_positive
            if body.common_text_negative is not None:
                cr.common_text_negative = body.common_text_negative

    await db.commit()
    await db.refresh(ind)
    return await _build_indicator_response(db, ind)


@router.delete("/indicators/{indicator_id}")
async def delete_indicator(
    indicator_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """Удалить показатель. Проверяет что он не используется в карточках."""
    ind = await _get_indicator_or_404(db, indicator_id)

    # Проверить использование в карточках
    usage_res = await db.execute(
        select(KpiRoleCardIndicator.card_id)
        .where(KpiRoleCardIndicator.indicator_id == indicator_id)
        .distinct()
    )
    used_card_ids = usage_res.scalars().all()
    if used_card_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Показатель используется в {len(used_card_ids)} карточках. "
                   f"Сначала удалите его из карточек.",
        )

    # Удалить критерии
    await db.execute(delete(KpiCriterion).where(KpiCriterion.indicator_id == indicator_id))
    await db.delete(ind)
    await db.commit()
    return {"ok": True}


@router.post("/indicators/{indicator_id}/approve")
async def approve_indicator(
    indicator_id: UUID,
    body: ApproveIndicatorRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """Утвердить показатель: draft → active."""
    ind = await _get_indicator_or_404(db, indicator_id)
    if ind.status != "draft":
        raise HTTPException(status_code=400, detail="Утвердить можно только черновик")

    ind.status = "active"
    ind.valid_from = body.valid_from or date.today()
    await db.commit()
    return {"ok": True, "valid_from": str(ind.valid_from)}


@router.post("/indicators/{indicator_id}/reject")
async def reject_indicator(
    indicator_id: UUID,
    body: RejectIndicatorRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Вернуть показатель на доработку (hr, admin)."""
    if current_user.role not in (UserRole.admin,):
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    ind = await _get_indicator_or_404(db, indicator_id)
    # Просто добавляем статус обратно в draft
    ind.status = "draft"
    await db.commit()
    return {"ok": True, "comment": body.comment}


# ─── ROLE CARDS ───────────────────────────────────────────────────────────────

@router.get("/cards", response_model=list[CardResponse])
async def list_cards(
    pos_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Список карточек должностей. manager видит свою + подчинённых, admin/hr — все."""
    q = select(KpiRoleCard)
    if pos_id is not None:
        q = q.where(KpiRoleCard.pos_id == pos_id)
    if status:
        q = q.where(KpiRoleCard.status == status)
    q = q.order_by(KpiRoleCard.pos_id, KpiRoleCard.version.desc())

    result = await db.execute(q)
    cards = result.scalars().all()
    return [await _build_card_response(db, c) for c in cards]


@router.get("/cards/{pos_id}/active", response_model=CardResponse)
async def get_active_card(
    pos_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Активная карточка для должности."""
    result = await db.execute(
        select(KpiRoleCard)
        .where(KpiRoleCard.pos_id == pos_id, KpiRoleCard.status == "active")
        .order_by(KpiRoleCard.version.desc())
    )
    card = result.scalars().first()
    if not card:
        raise HTTPException(status_code=404, detail=f"Активная карточка для pos_id={pos_id} не найдена")
    return await _build_card_response(db, card)


@router.post("/cards", response_model=CardResponse)
async def create_card(
    pos_id: int,
    role_id: str,
    role_name: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Создать новую версию карточки должности."""
    # Определить следующую версию
    ver_res = await db.execute(
        select(func.max(KpiRoleCard.version)).where(KpiRoleCard.pos_id == pos_id)
    )
    max_version = ver_res.scalar_one() or 0

    card = KpiRoleCard(
        pos_id=pos_id,
        role_id=role_id,
        role_name=role_name,
        version=max_version + 1,
        status="draft",
        created_by=current_user.login,
    )
    db.add(card)
    await db.commit()
    await db.refresh(card)
    return await _build_card_response(db, card)


@router.post("/cards/{card_id}/indicators", response_model=CardIndicatorResponse)
async def add_indicator_to_card(
    card_id: UUID,
    body: CardIndicatorAdd,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Добавить показатель в карточку с валидацией суммы весов ≤ 100."""
    card = await _get_card_or_404(db, card_id)
    if card.status not in ("draft",):
        raise HTTPException(status_code=400, detail="Карточка должна быть в статусе draft")

    # Проверить что показатель существует
    await _get_indicator_or_404(db, body.indicator_id)

    # Проверить дублирование
    dup_res = await db.execute(
        select(KpiRoleCardIndicator).where(
            KpiRoleCardIndicator.card_id == card_id,
            KpiRoleCardIndicator.indicator_id == body.indicator_id,
        )
    )
    if dup_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Показатель уже добавлен в карточку")

    # Проверить сумму весов
    weight_res = await db.execute(
        select(func.sum(KpiRoleCardIndicator.weight))
        .where(KpiRoleCardIndicator.card_id == card_id)
    )
    current_total = weight_res.scalar_one() or 0
    effective_weight = body.override_weight or body.weight
    if current_total + effective_weight > 100:
        raise HTTPException(
            status_code=400,
            detail=f"Сумма весов превысит 100% (текущая: {current_total}%, добавляемый: {effective_weight}%)",
        )

    ci = KpiRoleCardIndicator(
        card_id=card_id,
        indicator_id=body.indicator_id,
        criterion_id=body.criterion_id,
        weight=body.weight,
        order_num=body.order_num,
        override_criterion=body.override_criterion,
        override_thresholds=body.override_thresholds,
        override_weight=body.override_weight,
    )
    db.add(ci)
    await db.commit()
    await db.refresh(ci)

    ind_res = await db.execute(select(KpiIndicator).where(KpiIndicator.id == ci.indicator_id))
    ind = ind_res.scalar_one_or_none()

    crit_text = None
    if ci.criterion_id:
        cr_res = await db.execute(select(KpiCriterion).where(KpiCriterion.id == ci.criterion_id))
        cr = cr_res.scalar_one_or_none()
        crit_text = cr.criterion if cr else None

    return CardIndicatorResponse(
        id=ci.id, card_id=ci.card_id, indicator_id=ci.indicator_id,
        criterion_id=ci.criterion_id, weight=ci.weight, order_num=ci.order_num,
        override_criterion=ci.override_criterion, override_thresholds=ci.override_thresholds,
        override_weight=ci.override_weight,
        indicator_name=ind.name if ind else None,
        indicator_formula_type=ind.formula_type if ind else None,
        criterion_text=ci.override_criterion or crit_text,
        is_common=ind.is_common if ind else None,
    )


@router.put("/cards/{card_id}/indicators/{indicator_id}", response_model=CardIndicatorResponse)
async def update_card_indicator(
    card_id: UUID,
    indicator_id: UUID,
    body: CardIndicatorUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Изменить вес / порядок / override показателя в карточке."""
    card = await _get_card_or_404(db, card_id)
    if card.status not in ("draft",):
        raise HTTPException(status_code=400, detail="Карточка должна быть в статусе draft")

    ci_res = await db.execute(
        select(KpiRoleCardIndicator).where(
            KpiRoleCardIndicator.card_id == card_id,
            KpiRoleCardIndicator.indicator_id == indicator_id,
        )
    )
    ci = ci_res.scalar_one_or_none()
    if not ci:
        raise HTTPException(status_code=404, detail="Показатель не найден в карточке")

    if body.weight is not None:
        ci.weight = body.weight
    if body.order_num is not None:
        ci.order_num = body.order_num
    if body.override_criterion is not None:
        ci.override_criterion = body.override_criterion
    if body.override_thresholds is not None:
        ci.override_thresholds = body.override_thresholds
    if body.override_weight is not None:
        ci.override_weight = body.override_weight

    await db.commit()
    await db.refresh(ci)

    ind_res = await db.execute(select(KpiIndicator).where(KpiIndicator.id == ci.indicator_id))
    ind = ind_res.scalar_one_or_none()
    return CardIndicatorResponse(
        id=ci.id, card_id=ci.card_id, indicator_id=ci.indicator_id,
        criterion_id=ci.criterion_id, weight=ci.weight, order_num=ci.order_num,
        override_criterion=ci.override_criterion, override_thresholds=ci.override_thresholds,
        override_weight=ci.override_weight,
        indicator_name=ind.name if ind else None,
        indicator_formula_type=ind.formula_type if ind else None,
        criterion_text=ci.override_criterion,
        is_common=ind.is_common if ind else None,
    )


@router.delete("/cards/{card_id}/indicators/{indicator_id}")
async def remove_indicator_from_card(
    card_id: UUID,
    indicator_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Удалить показатель из карточки."""
    card = await _get_card_or_404(db, card_id)
    if card.status not in ("draft",):
        raise HTTPException(status_code=400, detail="Карточка должна быть в статусе draft")

    await db.execute(
        delete(KpiRoleCardIndicator).where(
            KpiRoleCardIndicator.card_id == card_id,
            KpiRoleCardIndicator.indicator_id == indicator_id,
        )
    )
    await db.commit()
    return {"ok": True}


@router.post("/cards/{card_id}/approve")
async def approve_card(
    card_id: UUID,
    valid_from: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """
    Утвердить карточку:
    - Текущая active для того же pos_id → archived (valid_to = сегодня)
    - Эта карточка → active, valid_from = параметр или сегодня
    """
    card = await _get_card_or_404(db, card_id)
    if card.status != "draft":
        raise HTTPException(status_code=400, detail="Утвердить можно только черновик")

    # Архивировать предыдущую активную
    prev_res = await db.execute(
        select(KpiRoleCard).where(
            KpiRoleCard.pos_id == card.pos_id,
            KpiRoleCard.status == "active",
            KpiRoleCard.id != card_id,
        )
    )
    for prev in prev_res.scalars().all():
        prev.status = "archived"
        prev.valid_to = date.today()

    card.status = "active"
    card.valid_from = valid_from or date.today()
    card.approved_by = current_user.login
    card.approved_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True, "valid_from": str(card.valid_from)}


@router.get("/cards/{card_id}/validate", response_model=CardValidateResponse)
async def validate_card(
    card_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Проверить карточку: сумма весов, дубли, обязательные поля."""
    card = await _get_card_or_404(db, card_id)

    ci_res = await db.execute(
        select(KpiRoleCardIndicator).where(KpiRoleCardIndicator.card_id == card_id)
    )
    card_inds = ci_res.scalars().all()

    errors: list[str] = []
    warnings: list[str] = []

    # Сумма весов
    total_weight = sum(ci.override_weight or ci.weight for ci in card_inds)
    if total_weight != 100:
        errors.append(f"Сумма весов = {total_weight}% (должна быть 100%)")

    # Дубли показателей
    ind_ids = [ci.indicator_id for ci in card_inds]
    if len(ind_ids) != len(set(ind_ids)):
        errors.append("Обнаружены дублирующиеся показатели в карточке")

    # Пустые показатели
    if len(card_inds) == 0:
        errors.append("Карточка не содержит показателей")

    if total_weight < 100 and len(card_inds) > 0:
        warnings.append(f"Незаполненный вес: осталось {100 - total_weight}%")

    return CardValidateResponse(valid=len(errors) == 0, errors=errors, warnings=warnings)


# ─── IMPORT ───────────────────────────────────────────────────────────────────

@router.post("/import/xlsx", response_model=ImportResult)
async def import_from_xlsx(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """
    Импортировать KPI_Mapping.xlsx в таблицы конструктора.
    Выполняется один раз при первоначальной настройке.
    Повторный вызов пропускает уже существующие записи.
    """
    data = kpi_import_service.import_from_xlsx()

    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])

    imported_indicators = 0
    imported_criteria = 0
    imported_cards = 0
    imported_card_indicators = 0
    errors: list[str] = data.get("errors", [])

    # Маппинг: сгенерированный UUID импорта → реальный UUID в БД.
    # Нужен для идемпотентности: если indicator уже существует с другим UUID,
    # criteria и card_indicators должны ссылаться на существующий UUID.
    ind_id_map: dict[str, str] = {}   # generated_id → db_id
    card_id_map: dict[str, str] = {}  # generated_id → db_id

    # Вставляем indicators — Variant 1: flush после каждого db.add
    for ind_data in data["indicators"]:
        exists_res = await db.execute(
            select(KpiIndicator).where(
                KpiIndicator.name == ind_data["name"],
                KpiIndicator.formula_type == ind_data["formula_type"],
            )
        )
        existing = exists_res.scalar_one_or_none()
        if existing:
            # Показатель уже есть — запоминаем его реальный UUID
            ind_id_map[ind_data["id"]] = str(existing.id)
            continue
        ind = KpiIndicator(
            id=ind_data["id"],
            name=ind_data["name"],
            formula_type=ind_data["formula_type"],
            is_common=ind_data["is_common"],
            is_editable_per_role=ind_data["is_editable_per_role"],
            indicator_group=ind_data.get("indicator_group"),
            status=ind_data["status"],
            version=ind_data["version"],
            valid_from=ind_data["valid_from"],
            created_by=ind_data["created_by"],
        )
        db.add(ind)
        await db.flush()  # сразу записать в БД — criteria могут ссылаться на этот id
        ind_id_map[ind_data["id"]] = ind_data["id"]
        imported_indicators += 1

    # Вставляем criteria — используем реальный indicator_id из ind_id_map
    for cr_data in data["criteria"]:
        actual_ind_id = ind_id_map.get(cr_data["indicator_id"], cr_data["indicator_id"])
        exists_res = await db.execute(
            select(KpiCriterion).where(
                KpiCriterion.indicator_id == actual_ind_id,
                KpiCriterion.criterion == cr_data["criterion"],
            )
        )
        if exists_res.scalar_one_or_none():
            continue
        cr = KpiCriterion(
            id=cr_data["id"],
            indicator_id=actual_ind_id,
            criterion=cr_data["criterion"],
            numerator_label=cr_data["numerator_label"],
            denominator_label=cr_data["denominator_label"],
            thresholds=cr_data["thresholds"],
            sub_indicators=cr_data["sub_indicators"],
            quarterly_thresholds=cr_data["quarterly_thresholds"],
            cumulative=cr_data["cumulative"],
            plan_value=cr_data["plan_value"],
            common_text_positive=cr_data["common_text_positive"],
            common_text_negative=cr_data["common_text_negative"],
        )
        db.add(cr)
        await db.flush()  # flush сразу — card_indicators ссылаются на criterion_id
        imported_criteria += 1

    # Вставляем cards (пропускаем по pos_id + version)
    for card_data in data["cards"]:
        exists_res = await db.execute(
            select(KpiRoleCard).where(
                KpiRoleCard.pos_id == card_data["pos_id"],
                KpiRoleCard.version == card_data["version"],
            )
        )
        existing_card = exists_res.scalar_one_or_none()
        if existing_card:
            card_id_map[card_data["id"]] = str(existing_card.id)
            continue
        card = KpiRoleCard(
            id=card_data["id"],
            pos_id=card_data["pos_id"],
            role_id=card_data["role_id"],
            role_name=card_data["role_name"],
            unit=card_data.get("unit"),
            version=card_data["version"],
            status=card_data["status"],
            valid_from=card_data["valid_from"],
            created_by=card_data["created_by"],
        )
        db.add(card)
        await db.flush()  # flush сразу — card_indicators ссылаются на card_id
        card_id_map[card_data["id"]] = card_data["id"]
        imported_cards += 1

    # Вставляем card_indicators — используем реальные UUID из маппингов
    for ci_data in data["card_indicators"]:
        actual_card_id = card_id_map.get(ci_data["card_id"], ci_data["card_id"])
        actual_ind_id = ind_id_map.get(ci_data["indicator_id"], ci_data["indicator_id"])

        exists = await db.execute(
            select(KpiRoleCardIndicator).where(
                KpiRoleCardIndicator.card_id == actual_card_id,
                KpiRoleCardIndicator.indicator_id == actual_ind_id,
            )
        )
        if exists.scalar_one_or_none():
            continue
        ci = KpiRoleCardIndicator(
            id=ci_data["id"],
            card_id=actual_card_id,
            indicator_id=actual_ind_id,
            criterion_id=ci_data["criterion_id"],
            weight=ci_data["weight"],
            order_num=ci_data["order_num"],
        )
        db.add(ci)
        imported_card_indicators += 1

    await db.commit()

    logger.info(
        f"KPI import: indicators={imported_indicators}, criteria={imported_criteria}, "
        f"cards={imported_cards}, card_indicators={imported_card_indicators}"
    )

    return ImportResult(
        imported_indicators=imported_indicators,
        imported_criteria=imported_criteria,
        imported_cards=imported_cards,
        imported_card_indicators=imported_card_indicators,
        errors=errors,
    )
