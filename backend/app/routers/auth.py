from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import schemas
from ..db import get_db
from ..models import User
from ..security import create_access_token, current_user, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def _normalise(email: str) -> str:
    return email.strip().lower()


@router.post("/signup", response_model=schemas.Token, status_code=status.HTTP_201_CREATED)
def sign_up(payload: schemas.SignUp, db: Session = Depends(get_db)) -> schemas.Token:
    email = _normalise(payload.email)
    exists = db.scalar(select(User).where(func.lower(User.email) == email))
    if exists:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Un compte utilise déjà cette adresse."
        )
    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name.strip(),
        accent=payload.accent,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return schemas.Token(
        access_token=create_access_token(user.id), user=schemas.UserOut.model_validate(user)
    )


@router.post("/signin", response_model=schemas.Token)
def sign_in(payload: schemas.SignIn, db: Session = Depends(get_db)) -> schemas.Token:
    user = db.scalar(select(User).where(func.lower(User.email) == _normalise(payload.email)))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Adresse ou mot de passe incorrect."
        )
    return schemas.Token(
        access_token=create_access_token(user.id), user=schemas.UserOut.model_validate(user)
    )


@router.get("/me", response_model=schemas.UserOut)
def me(user: User = Depends(current_user)) -> User:
    return user


@router.patch("/me", response_model=schemas.UserOut)
def update_me(
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> User:
    if payload.display_name is not None:
        user.display_name = payload.display_name.strip()
    if payload.accent is not None:
        user.accent = payload.accent
    db.commit()
    db.refresh(user)
    return user
