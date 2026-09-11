from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import schemas, services
from ..db import get_db
from ..models import Entry, Habit, User
from ..security import current_user
from .deps import active_habits, owned_habit, readable_owner, today_param

router = APIRouter(tags=["habits"])

_SCHEDULE_FIELDS = (
    "name",
    "note",
    "cadence",
    "schedule_mode",
    "weekdays",
    "day_of_month",
    "month_of_year",
    "target_type",
    "target_value",
    "unit",
    "color",
)


@router.get("/habits", response_model=list[schemas.HabitOut])
def list_habits(
    include_archived: bool = Query(default=False),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    stmt = select(Habit).where(Habit.owner_id == user.id)
    if not include_archived:
        stmt = stmt.where(Habit.archived_at.is_(None))
    habits = db.scalars(stmt.order_by(Habit.position, Habit.name))
    return [services.habit_out(h) for h in habits]


@router.post("/habits", response_model=schemas.HabitOut, status_code=status.HTTP_201_CREATED)
def create_habit(
    payload: schemas.HabitCreate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    last = db.scalar(
        select(func.coalesce(func.max(Habit.position), -1)).where(Habit.owner_id == user.id)
    )
    habit = Habit(owner_id=user.id, position=last + 1, **payload.model_dump())
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return services.habit_out(habit)


@router.patch("/habits/{habit_id}", response_model=schemas.HabitOut)
def update_habit(
    payload: schemas.HabitUpdate,
    habit: Habit = Depends(owned_habit),
    db: Session = Depends(get_db),
):
    data = payload.model_dump()
    for field in _SCHEDULE_FIELDS:
        setattr(habit, field, data[field])
    if data["position"] is not None:
        habit.position = data["position"]
    if data["archived"] is not None:
        habit.archived_at = datetime.now(timezone.utc) if data["archived"] else None
    db.commit()
    db.refresh(habit)
    return services.habit_out(habit)


@router.delete("/habits/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_habit(habit: Habit = Depends(owned_habit), db: Session = Depends(get_db)) -> None:
    db.delete(habit)
    db.commit()


@router.put("/habits/{habit_id}/entries", response_model=schemas.EntryOut)
def log_entry(
    payload: schemas.EntryWrite,
    habit: Habit = Depends(owned_habit),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """Record or correct a day. Any past date is accepted."""
    value = payload.value if payload.value is not None else Decimal(1)
    entry = db.scalar(
        select(Entry).where(
            Entry.habit_id == habit.id, Entry.occurred_on == payload.occurred_on
        )
    )
    if entry is None:
        entry = Entry(
            habit_id=habit.id,
            occurred_on=payload.occurred_on,
            value=value,
            logged_by_id=user.id,
        )
        db.add(entry)
    else:
        entry.value = value
        entry.logged_by_id = user.id
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/habits/{habit_id}/entries", status_code=status.HTTP_204_NO_CONTENT)
def clear_entry(
    occurred_on: date,
    habit: Habit = Depends(owned_habit),
    db: Session = Depends(get_db),
) -> None:
    entry = db.scalar(
        select(Entry).where(Entry.habit_id == habit.id, Entry.occurred_on == occurred_on)
    )
    if entry is not None:
        db.delete(entry)
        db.commit()


@router.get("/users/{owner_id}/today", response_model=list[schemas.HabitStatus])
def today_view(
    owner: User = Depends(readable_owner),
    today: date = Depends(today_param),
    db: Session = Depends(get_db),
):
    return services.compute_statuses(db, active_habits(db, owner.id), today)


@router.get("/users/{owner_id}/grid")
def grid_view(
    owner: User = Depends(readable_owner),
    year: int = Query(default_factory=lambda: date.today().year, ge=1970, le=2200),
    db: Session = Depends(get_db),
):
    return services.year_grid(db, active_habits(db, owner.id), year)
