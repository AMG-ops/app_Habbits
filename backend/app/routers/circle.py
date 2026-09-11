from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import schemas
from ..db import get_db
from ..models import Share, User
from ..security import current_user

router = APIRouter(prefix="/circle", tags=["circle"])


@router.get("", response_model=schemas.CircleOut)
def my_circle(db: Session = Depends(get_db), user: User = Depends(current_user)):
    shared_with = db.scalars(
        select(User).join(Share, Share.viewer_id == User.id).where(Share.owner_id == user.id)
    )
    shared_by = db.scalars(
        select(User).join(Share, Share.owner_id == User.id).where(Share.viewer_id == user.id)
    )
    return schemas.CircleOut(
        shared_with=[schemas.UserOut.model_validate(u) for u in shared_with],
        shared_by=[schemas.UserOut.model_validate(u) for u in shared_by],
    )


@router.post("", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def share_with(
    payload: schemas.ShareCreate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """Let someone read my tracking. I can revoke it at any time."""
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
        db.delete(share)
        db.commit()
