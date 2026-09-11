from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base

CADENCES = ("daily", "weekly", "monthly", "yearly")
SCHEDULE_MODES = ("flexible", "fixed")
TARGET_TYPES = ("binary", "quantity")


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    # Each account gets its own accent so shared views stay visually separate.
    accent: Mapped[str] = mapped_column(String(20), nullable=False, default="bleu")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    habits: Mapped[list["Habit"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan", foreign_keys="Habit.owner_id"
    )


class Habit(Base):
    __tablename__ = "habits"
    __table_args__ = (
        CheckConstraint(f"cadence IN {CADENCES}", name="ck_habits_cadence"),
        CheckConstraint(f"schedule_mode IN {SCHEDULE_MODES}", name="ck_habits_schedule_mode"),
        CheckConstraint(f"target_type IN {TARGET_TYPES}", name="ck_habits_target_type"),
        CheckConstraint("target_value > 0", name="ck_habits_target_value"),
        CheckConstraint(
            "day_of_month IS NULL OR (day_of_month BETWEEN 1 AND 31)",
            name="ck_habits_day_of_month",
        ),
        CheckConstraint(
            "month_of_year IS NULL OR (month_of_year BETWEEN 1 AND 12)",
            name="ck_habits_month_of_year",
        ),
        Index("ix_habits_owner_archived", "owner_id", "archived_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)

    cadence: Mapped[str] = mapped_column(String(10), nullable=False, default="daily")
    schedule_mode: Mapped[str] = mapped_column(String(10), nullable=False, default="flexible")

    # Fixed-day scheduling. Only the fields relevant to `cadence` are read.
    weekdays: Mapped[list[int] | None] = mapped_column(ARRAY(SmallInteger))  # ISO 1=Mon..7=Sun
    day_of_month: Mapped[int | None] = mapped_column(SmallInteger)
    month_of_year: Mapped[int | None] = mapped_column(SmallInteger)

    target_type: Mapped[str] = mapped_column(String(10), nullable=False, default="binary")
    target_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=1)
    unit: Mapped[str | None] = mapped_column(String(24))

    color: Mapped[str] = mapped_column(String(20), nullable=False, default="bleu")
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    owner: Mapped[User] = relationship(back_populates="habits", foreign_keys=[owner_id])
    entries: Mapped[list["Entry"]] = relationship(
        back_populates="habit", cascade="all, delete-orphan"
    )


class Entry(Base):
    """One habit, one day. Weekly/monthly/yearly progress is summed from these."""

    __tablename__ = "entries"
    __table_args__ = (
        UniqueConstraint("habit_id", "occurred_on", name="uq_entries_habit_day"),
        Index("ix_entries_habit_date", "habit_id", "occurred_on"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    habit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("habits.id", ondelete="CASCADE"), nullable=False
    )
    # Who ticked it. Kept for shared habits; today it is always the owner.
    logged_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    occurred_on: Mapped[date] = mapped_column(Date, nullable=False)
    value: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    habit: Mapped[Habit] = relationship(back_populates="entries")


class Share(Base):
    """Read-only access: `viewer` may look at everything `owner` tracks."""

    __tablename__ = "shares"
    __table_args__ = (
        UniqueConstraint("owner_id", "viewer_id", name="uq_shares_owner_viewer"),
        CheckConstraint("owner_id <> viewer_id", name="ck_shares_not_self"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    viewer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    owner: Mapped[User] = relationship(foreign_keys=[owner_id])
    viewer: Mapped[User] = relationship(foreign_keys=[viewer_id])
