from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

Cadence = Literal["daily", "weekly", "monthly", "yearly"]
ScheduleMode = Literal["flexible", "fixed"]
TargetType = Literal["binary", "quantity"]
HabitState = Literal["done", "due_today", "open", "late"]

ACCENTS = ("bleu", "garance", "ocre", "olive", "prune", "ardoise")


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- users -------------------------------------------------------------------

class SignUp(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=80)
    accent: str = "bleu"

    @field_validator("accent")
    @classmethod
    def known_accent(cls, v: str) -> str:
        return v if v in ACCENTS else "bleu"


class SignIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(ORM):
    id: uuid.UUID
    email: EmailStr
    display_name: str
    accent: str
    is_admin: bool


class UserUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=80)
    accent: str | None = None

    @field_validator("accent")
    @classmethod
    def known_accent(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return v if v in ACCENTS else "bleu"


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# --- habits ------------------------------------------------------------------

class HabitBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    note: str | None = Field(default=None, max_length=2000)
    cadence: Cadence = "daily"
    schedule_mode: ScheduleMode = "flexible"
    weekdays: list[int] | None = None
    day_of_month: int | None = Field(default=None, ge=1, le=31)
    month_of_year: int | None = Field(default=None, ge=1, le=12)
    target_type: TargetType = "binary"
    target_value: Decimal = Decimal(1)
    unit: str | None = Field(default=None, max_length=24)
    color: str = "bleu"
    category: str | None = Field(default=None, max_length=40)

    @field_validator("category")
    @classmethod
    def clean_category(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @field_validator("weekdays")
    @classmethod
    def clean_weekdays(cls, v: list[int] | None) -> list[int] | None:
        if not v:
            return None
        days = sorted({d for d in v if 1 <= d <= 7})
        return days or None

    @field_validator("color")
    @classmethod
    def known_color(cls, v: str) -> str:
        return v if v in ACCENTS else "bleu"

    @model_validator(mode="after")
    def coherent_schedule(self):
        if self.target_type == "binary":
            self.target_value = Decimal(1)
            self.unit = None
        elif self.target_value <= 0:
            raise ValueError("L'objectif doit être supérieur à zéro.")

        if self.schedule_mode == "fixed":
            if self.cadence in ("daily", "weekly") and not self.weekdays:
                raise ValueError("Choisis au moins un jour de la semaine.")
            if self.cadence == "monthly" and not self.day_of_month:
                raise ValueError("Choisis le jour du mois.")
            if self.cadence == "yearly" and not (self.month_of_year and self.day_of_month):
                raise ValueError("Choisis le mois et le jour.")
        return self


class HabitCreate(HabitBase):
    pass


class HabitUpdate(HabitBase):
    position: int | None = None
    archived: bool | None = None


class HabitOut(ORM):
    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    note: str | None
    cadence: Cadence
    schedule_mode: ScheduleMode
    weekdays: list[int] | None
    day_of_month: int | None
    month_of_year: int | None
    target_type: TargetType
    target_value: Decimal
    unit: str | None
    color: str
    category: str | None
    position: int
    archived: bool


class HabitStatus(BaseModel):
    """A habit plus where it stands in the period happening right now."""

    habit: HabitOut
    period_key: str
    period_start: date
    period_end: date
    progress: Decimal
    today_value: Decimal
    target: Decimal
    done: bool
    state: HabitState
    due_on: date | None = None
    missed_last_period: bool = False
    days_left: int = 0


# --- entries -----------------------------------------------------------------

class EntryWrite(BaseModel):
    occurred_on: date
    value: Decimal | None = None  # None means "one unit / simply done"


class EntryOut(ORM):
    id: uuid.UUID
    habit_id: uuid.UUID
    occurred_on: date
    value: Decimal
    logged_by_id: uuid.UUID | None


# --- circle ------------------------------------------------------------------

class ShareCreate(BaseModel):
    email: EmailStr


class ShareOut(ORM):
    id: uuid.UUID
    owner: UserOut
    viewer: UserOut


class SharedWithOut(BaseModel):
    """A circle member, plus which of my habits they're actually allowed to see."""

    user: UserOut
    habit_ids: list[uuid.UUID]


class CircleOut(BaseModel):
    shared_with: list[SharedWithOut]   # people who can see (some of) me
    shared_by: list[UserOut]           # people I can watch


class HabitVisibilityUpdate(BaseModel):
    habit_ids: list[uuid.UUID]


# --- admin ---------------------------------------------------------------

class AdminUserOut(UserOut):
    created_at: datetime
    habit_count: int
