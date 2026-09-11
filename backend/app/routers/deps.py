from __future__ import annotations

import uuid
from datetime import date

from fastapi import Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Habit, Share, User
from ..security import current_user


def today_param(today: date | None = Query(default=None)) -> date:
    """The client sends its own date so period rollover follows the user's timezone."""
    return today or date.today()


def owned_habit(
    habit_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> Habit:
    habit = db.get(Habit, habit_id)
    if habit is None or habit.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cette habitude n'existe pas.")
    return habit


def readable_owner(
    owner_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> User:
    """The current user themselves, or someone who shared their tracking with them."""
    if owner_id == user.id:
        return user
    share = db.scalar(
        select(Share).where(Share.owner_id == owner_id, Share.viewer_id == user.id)
    )
    if share is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Ce suivi ne t'est pas partagé.")
    owner = db.get(User, owner_id)
    if owner is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ce compte n'existe pas.")
    return owner


def active_habits(db: Session, owner_id: uuid.UUID) -> list[Habit]:
    return list(
        db.scalars(
            select(Habit)
            .where(Habit.owner_id == owner_id, Habit.archived_at.is_(None))
            .order_by(Habit.position, Habit.name)
        )
    )
