from __future__ import annotations

import uuid
from datetime import date

from fastapi import Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Habit, HabitShare, Share, User
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


def require_admin(user: User = Depends(current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux administrateurs.")
    return user


def readable_owner(
    owner_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> User:
    """The current user themselves, an admin, or someone in the owner's circle.

    Being in the circle only grants entry here — which habits actually show up
    is decided by `visible_habits`.
    """
    if owner_id == user.id or user.is_admin:
        owner = user if owner_id == user.id else db.get(User, owner_id)
        if owner is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Ce compte n'existe pas.")
        return owner
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


def visible_habits(db: Session, owner: User, viewer: User) -> list[Habit]:
    """`owner`'s active habits, scoped to what `viewer` is allowed to see.

    The owner and admins see everything; anyone else only sees the habits
    explicitly exposed to them via `HabitShare`.
    """
    habits = active_habits(db, owner.id)
    if viewer.id == owner.id or viewer.is_admin:
        return habits
    allowed = set(
        db.scalars(
            select(HabitShare.habit_id)
            .join(Habit, Habit.id == HabitShare.habit_id)
            .where(Habit.owner_id == owner.id, HabitShare.viewer_id == viewer.id)
        )
    )
    return [h for h in habits if h.id in allowed]
