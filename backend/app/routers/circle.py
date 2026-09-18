from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from .. import schemas
from ..db import get_db
from ..models import Habit, HabitShare, Share, User
from ..security import current_user

router = APIRouter(prefix="/circle", tags=["circle"])


@router.get("", response_model=schemas.CircleOut)
def my_circle(db: Session = Depends(get_db), user: User = Depends(current_user)):
    shares = db.scalars(select(Share).where(Share.owner_id == user.id))
    shared_with = []
    for share in shares:
        habit_ids = list(
            db.scalars(
                select(HabitShare.habit_id)
                .join(Habit, Habit.id == HabitShare.habit_id)
                .where(Habit.owner_id == user.id, HabitShare.viewer_id == share.viewer_id)
            )
        )
        shared_with.append(
            schemas.SharedWithOut(
                user=schemas.UserOut.model_validate(share.viewer), habit_ids=habit_ids
            )
        )

    shared_by = db.scalars(
        select(User).join(Share, Share.owner_id == User.id).where(Share.viewer_id == user.id)
    )
    return schemas.CircleOut(
        shared_with=shared_with,
        shared_by=[schemas.UserOut.model_validate(u) for u in shared_by],
    )


@router.post("", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def share_with(
    payload: schemas.ShareCreate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """Add someone to my circle. No habit is visible to them until I choose one."""
    email = payload.email.strip().lower()
    viewer = db.scalar(select(User).where(func.lower(User.email) == email))
    if viewer is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Personne n'utilise cette adresse sur Habitude."
        )
    if viewer.id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Tu vois déjà ton propre suivi.")

    exists = db.scalar(
        select(Share).where(Share.owner_id == user.id, Share.viewer_id == viewer.id)
    )
    if exists is None:
        db.add(Share(owner_id=user.id, viewer_id=viewer.id))
        db.commit()
    return schemas.UserOut.model_validate(viewer)


@router.delete("/{viewer_id}", status_code=status.HTTP_204_NO_CONTENT)
def stop_sharing(
    viewer_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> None:
    share = db.scalar(
        select(Share).where(Share.owner_id == user.id, Share.viewer_id == viewer_id)
    )
    if share is not None:
        db.execute(
            delete(HabitShare).where(
                HabitShare.viewer_id == viewer_id,
                HabitShare.habit_id.in_(select(Habit.id).where(Habit.owner_id == user.id)),
            )
        )
        db.delete(share)
        db.commit()


@router.put("/{viewer_id}/habits", response_model=schemas.SharedWithOut)
def set_shared_habits(
    viewer_id: uuid.UUID,
    payload: schemas.HabitVisibilityUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """Replace, wholesale, which of my habits `viewer_id` can see."""
    share = db.scalar(
        select(Share).where(Share.owner_id == user.id, Share.viewer_id == viewer_id)
    )
    if share is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cette personne n'est pas dans ton cercle.")

    valid_ids = set(
        db.scalars(
            select(Habit.id).where(Habit.owner_id == user.id, Habit.id.in_(payload.habit_ids))
        )
    )

    db.execute(
        delete(HabitShare).where(
            HabitShare.viewer_id == viewer_id,
            HabitShare.habit_id.in_(select(Habit.id).where(Habit.owner_id == user.id)),
        )
    )
    for habit_id in valid_ids:
        db.add(HabitShare(habit_id=habit_id, viewer_id=viewer_id))
    db.commit()

    viewer = db.get(User, viewer_id)
    return schemas.SharedWithOut(
        user=schemas.UserOut.model_validate(viewer), habit_ids=list(valid_ids)
    )
