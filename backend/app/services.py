"""Where each habit stands right now, and the data behind the wall planner."""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import date, timedelta
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
        category=habit.category,
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


_STREAK_LOOKBACK = timedelta(days=3650)
_STREAK_CAPS = {"weekly": 520, "monthly": 120, "yearly": 15}


def _current_streak(habit: Habit, by_day: dict[date, Decimal], today: date) -> int:
    """Consecutive completed periods up to today, most recent first.

    A period still open (today's day, or the current week/month/year) doesn't
    break the streak just because it isn't done *yet* — only a truly missed
    period does.
    """
    target = habit.target_value if habit.target_type == "quantity" else Decimal(1)

    if habit.cadence == "daily":
        wanted = set(habit.weekdays or []) if habit.schedule_mode == "fixed" else None
        cursor = today
        if by_day.get(cursor, Decimal(0)) < target:
            cursor -= timedelta(days=1)
        streak = 0
        for _ in range(_STREAK_LOOKBACK.days):
            if wanted is not None and cursor.isoweekday() not in wanted:
                cursor -= timedelta(days=1)
                continue
            if by_day.get(cursor, Decimal(0)) >= target:
                streak += 1
                cursor -= timedelta(days=1)
            else:
                break
        return streak

    def period_progress(start: date, end: date) -> Decimal:
        return sum((v for d, v in by_day.items() if start <= d <= end), Decimal(0))

    start, end = period_bounds(habit.cadence, today)
    if period_progress(start, end) < target:
        start, end = previous_period_bounds(habit.cadence, today)

    streak = 0
    for _ in range(_STREAK_CAPS.get(habit.cadence, 60)):
        if period_progress(start, end) >= target:
            streak += 1
            start, end = previous_period_bounds(habit.cadence, start)
        else:
            break
    return streak


def week_grid(db: Session, habits: list[Habit], start: date, today: date) -> dict:
    """Seven days (`start`..`start`+6), every habit, plus each one's live streak."""
    end = start + timedelta(days=6)
    since = min(start, today) - _STREAK_LOOKBACK
    entries = _entries_by_habit(db, [h.id for h in habits], since, max(end, today))

    days = [start + timedelta(days=i) for i in range(7)]
    cells: dict[str, dict[str, dict]] = {}
    streaks: dict[str, int] = {}

    for habit in habits:
        by_day = entries.get(habit.id, {})
        target = habit.target_value if habit.target_type == "quantity" else Decimal(1)
        daily_fixed_days = (
            set(habit.weekdays or [])
            if habit.cadence == "daily" and habit.schedule_mode == "fixed"
            else None
        )

        created_on = habit.created_at.date()
        habit_cells: dict[str, dict] = {}
        for d in days:
            value = by_day.get(d, Decimal(0))
            if value > 0 and value >= target:
                state = "done"
            elif d < created_on:
                # The habit didn't exist yet — nothing to have missed.
                state = "na"
            elif d > today:
                state = "future"
            elif habit.cadence == "daily":
                applies = d.isoweekday() in daily_fixed_days if daily_fixed_days is not None else True
                if not applies:
                    state = "na"
                elif d == today:
                    state = "pending"
                else:
                    state = "missed"
            elif habit.schedule_mode == "fixed":
                applies = bool(scheduled_dates(habit, d, d))
                if not applies:
                    state = "na"
                elif d == today:
                    state = "pending"
                else:
                    state = "missed"
            else:
                # Flexible weekly/monthly/yearly: any day of the period can
                # cover it, so a quiet day only reads as "missed" once the
                # whole period closes — that's the year page's business, not
                # a single cell here.
                pstart, pend = period_bounds(habit.cadence, d)
                progress = sum((v for dd, v in by_day.items() if pstart <= dd <= pend), Decimal(0))
                if progress >= target:
                    state = "na"
                elif d == today:
                    state = "pending"
                else:
                    state = "na"
            habit_cells[d.isoformat()] = {"value": str(value), "state": state}

        cells[str(habit.id)] = habit_cells
        streaks[str(habit.id)] = _current_streak(habit, by_day, today)

    return {
        "start": start.isoformat(),
        "days": [d.isoformat() for d in days],
        "today": today.isoformat(),
        "habits": [habit_out(h) for h in habits],
        "cells": cells,
        "streaks": streaks,
    }
