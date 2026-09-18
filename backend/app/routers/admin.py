from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import schemas
from ..db import get_db
from ..models import Habit, User
from .deps import require_admin

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[schemas.AdminUserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    counts = dict(
        db.execute(
            select(Habit.owner_id, func.count(Habit.id))
            .where(Habit.archived_at.is_(None))
            .group_by(Habit.owner_id)
        ).all()
    )
    users = db.scalars(select(User).order_by(User.created_at))
    return [
        schemas.AdminUserOut(
            id=u.id,
            email=u.email,
            display_name=u.display_name,
            accent=u.accent,
            is_admin=u.is_admin,
            created_at=u.created_at,
            habit_count=counts.get(u.id, 0),
        )
        for u in users
    ]
