from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import schemas
from ..db import get_db
from ..mailer import send_email
from ..models import PasswordReset, User
from ..security import create_access_token, current_user, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

RESET_CODE_TTL = timedelta(minutes=15)
RESET_RESEND_COOLDOWN = timedelta(seconds=60)
RESET_MAX_ATTEMPTS = 5


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


@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
def forgot_password(payload: schemas.ForgotPassword, db: Session = Depends(get_db)) -> None:
    """Always answers the same way, whether or not the address is registered."""
    user = db.scalar(select(User).where(func.lower(User.email) == _normalise(payload.email)))
    if user is None:
        return None

    recent = db.scalar(
        select(PasswordReset)
        .where(PasswordReset.user_id == user.id)
        .order_by(PasswordReset.created_at.desc())
    )
    now = datetime.now(timezone.utc)
    if recent is not None and now - recent.created_at < RESET_RESEND_COOLDOWN:
        return None

    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(
        PasswordReset(
            user_id=user.id,
            code_hash=hash_password(code),
            expires_at=now + RESET_CODE_TTL,
        )
    )
    db.commit()

    send_email(
        user.email,
        "Ton code de réinitialisation Habitude",
        f"Voici ton code : {code}\n\n"
        "Il expire dans 15 minutes et ne sert qu'une fois. Si tu n'es pas à l'origine "
        "de cette demande, tu peux ignorer ce message.",
    )
    return None


@router.post("/reset-password", response_model=schemas.Token)
def reset_password(payload: schemas.ResetPassword, db: Session = Depends(get_db)) -> schemas.Token:
    invalid = HTTPException(status.HTTP_400_BAD_REQUEST, "Code invalide ou expiré.")
    user = db.scalar(select(User).where(func.lower(User.email) == _normalise(payload.email)))
    if user is None:
        raise invalid

    reset = db.scalar(
        select(PasswordReset)
        .where(PasswordReset.user_id == user.id, PasswordReset.consumed_at.is_(None))
        .order_by(PasswordReset.created_at.desc())
    )
    now = datetime.now(timezone.utc)
    if reset is None or reset.expires_at < now or reset.attempts >= RESET_MAX_ATTEMPTS:
        raise invalid
    if not verify_password(payload.code, reset.code_hash):
        reset.attempts += 1
        db.commit()
        raise invalid

    reset.consumed_at = now
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    db.refresh(user)

    return schemas.Token(
        access_token=create_access_token(user.id), user=schemas.UserOut.model_validate(user)
    )
