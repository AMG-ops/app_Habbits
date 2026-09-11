"""Where each habit stands right now, and the data behind the wall planner."""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import schemas
from .models import Entry, Habit
from .periods import period_bounds, period_key, previous_period_bounds, scheduled_dates


def habit_out(habit: Habit) -> schemas.HabitOut:
    return schemas.HabitOut(
        id=habit.id,
        owner_id=habit.owner_id,
        name=habit.name,
        note=habit.note,
        cadence=habit.cadence,
        schedule_mode=habit.schedule_mode,
        weekdays=habit.weekdays,
        day_of_month=habit.day_of_month,
        month_of_year=habit.month_of_year,
        target_type=habit.target_type,
        target_value=habit.target_value,
        unit=habit.unit,
        color=habit.color,
        position=habit.position,
        archived=habit.archived_at is not None,
    )


def _entries_by_habit(
    db: Session, habit_ids: list[uuid.UUID], since: date, until: date | None = None
) -> dict[uuid.UUID, dict[date, Decimal]]:
    if not habit_ids:
        return {}
    stmt = select(Entry.habit_id, Entry.occurred_on, Entry.value).where(
        Entry.habit_id.in_(habit_ids), Entry.occurred_on >= since
    )
    if until is not None:
        stmt = stmt.where(Entry.occurred_on <= until)

    out: dict[uuid.UUID, dict[date, Decimal]] = defaultdict(dict)
    for habit_id, occurred_on, value in db.execute(stmt):
        out[habit_id][occurred_on] = value
    return out


def compute_statuses(db: Session, habits: list[Habit], today: date) -> list[schemas.HabitStatus]:
    if not habits:
        return []

    earliest = min(previous_period_bounds(h.cadence, today)[0] for h in habits)
    entries = _entries_by_habit(db, [h.id for h in habits], earliest)

    statuses: list[schemas.HabitStatus] = []
    for habit in habits:
        start, end = period_bounds(habit.cadence, today)
        by_day = entries.get(habit.id, {})

        progress = sum((v for d, v in by_day.items() if start <= d <= end), Decimal(0))
        today_value = by_day.get(today, Decimal(0))
        target = habit.target_value if habit.target_type == "quantity" else Decimal(1)
        done = progress >= target

        pinned = scheduled_dates(habit, start, end)
        days_left = (end - today).days

        if done:
            state: schemas.HabitState = "done"
        elif pinned is not None:
            if today in pinned:
                state = "due_today"
            elif any(d < today for d in pinned):
                state = "late"
            else:
                state = "open"
        else:
            # A floating habit only becomes today's business on its last day.
            state = "due_today" if days_left <= 0 else "open"

        due_on = next((d for d in pinned if d >= today), None) if pinned else None

        # Did the habit already exist when the previous period closed?
        prev_start, prev_end = previous_period_bounds(habit.cadence, today)
        existed = habit.created_at.date() <= prev_end
        prev_progress = sum(
            (v for d, v in by_day.items() if prev_start <= d <= prev_end), Decimal(0)
        )
        missed_last_period = existed and prev_progress < target

        statuses.append(
            schemas.HabitStatus(
                habit=habit_out(habit),
                period_key=period_key(habit.cadence, today),
                period_start=start,
                period_end=end,
                progress=progress,
                today_value=today_value,
                target=target,
                done=done,
                state=state,
                due_on=due_on,
                missed_last_period=missed_last_period,
                days_left=max(days_left, 0),
            )
        )

    order = {"late": 0, "due_today": 1, "open": 2, "done": 3}
    statuses.sort(key=lambda s: (order[s.state], s.habit.position, s.habit.name.lower()))
    return statuses


def year_grid(db: Session, habits: list[Habit], year: int) -> dict:
    """Every logged day of `year`, per habit, plus a per-day count for the overview."""
    start, end = date(year, 1, 1), date(year, 12, 31)
    entries = _entries_by_habit(db, [h.id for h in habits], start, end)

    per_habit: dict[str, dict[str, str]] = {}
    per_day: dict[str, int] = defaultdict(int)
    for habit in habits:
        by_day = entries.get(habit.id, {})
        per_habit[str(habit.id)] = {d.isoformat(): str(v) for d, v in by_day.items()}
        for d in by_day:
            per_day[d.isoformat()] += 1

    return {
        "year": year,
        "habits": [habit_out(h) for h in habits],
        "entries": per_habit,
        "day_counts": dict(per_day),
    }
