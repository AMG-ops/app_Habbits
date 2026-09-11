"""Period arithmetic and fixed-day scheduling.

A habit's progress is always measured over the period its cadence defines:
a day, an ISO week, a calendar month, a calendar year. Entries are stored per
day, so progress is the sum of the entries falling inside the current period.
"""

from __future__ import annotations

from calendar import monthrange
from datetime import date, timedelta
from typing import Protocol


class Schedule(Protocol):
    cadence: str
    schedule_mode: str
    weekdays: list[int] | None
    day_of_month: int | None
    month_of_year: int | None


def period_bounds(cadence: str, day: date) -> tuple[date, date]:
    """First and last day of the period containing `day` (both inclusive)."""
    if cadence == "daily":
        return day, day
    if cadence == "weekly":
        start = day - timedelta(days=day.isoweekday() - 1)
        return start, start + timedelta(days=6)
    if cadence == "monthly":
        last = monthrange(day.year, day.month)[1]
        return date(day.year, day.month, 1), date(day.year, day.month, last)
    if cadence == "yearly":
        return date(day.year, 1, 1), date(day.year, 12, 31)
    raise ValueError(f"unknown cadence: {cadence}")


def period_key(cadence: str, day: date) -> str:
    """Stable label for a period, e.g. 2026-09-11, 2026-W37, 2026-09, 2026."""
    if cadence == "daily":
        return day.isoformat()
    if cadence == "weekly":
        iso = day.isocalendar()
        return f"{iso.year}-W{iso.week:02d}"
    if cadence == "monthly":
        return f"{day.year}-{day.month:02d}"
    if cadence == "yearly":
        return str(day.year)
    raise ValueError(f"unknown cadence: {cadence}")


def previous_period_bounds(cadence: str, day: date) -> tuple[date, date]:
    start, _ = period_bounds(cadence, day)
    return period_bounds(cadence, start - timedelta(days=1))


def _clamp_day(year: int, month: int, requested: int) -> date:
    """The 31st in a 30-day month lands on the 30th, 29 Feb on the 28th."""
    return date(year, month, min(requested, monthrange(year, month)[1]))


def scheduled_dates(habit: Schedule, start: date, end: date) -> list[date] | None:
    """Dates in [start, end] the habit is pinned to, or None if it floats.

    A habit in `flexible` mode can be done any day of its period, so it has no
    pinned dates. In `fixed` mode the cadence decides which fields matter.
    """
    if habit.schedule_mode != "fixed":
        return None

    cadence = habit.cadence

    if cadence in ("daily", "weekly"):
        wanted = set(habit.weekdays or [])
        if not wanted:
            return None
        days: list[date] = []
        cursor = start
        while cursor <= end:
            if cursor.isoweekday() in wanted:
                days.append(cursor)
            cursor += timedelta(days=1)
        return days

    if cadence == "monthly":
        if not habit.day_of_month:
            return None
        days = []
        year, month = start.year, start.month
        while (year, month) <= (end.year, end.month):
            candidate = _clamp_day(year, month, habit.day_of_month)
            if start <= candidate <= end:
                days.append(candidate)
            month += 1
            if month > 12:
                year, month = year + 1, 1
        return days

    if cadence == "yearly":
        if not (habit.month_of_year and habit.day_of_month):
            return None
        days = []
        for year in range(start.year, end.year + 1):
            candidate = _clamp_day(year, habit.month_of_year, habit.day_of_month)
            if start <= candidate <= end:
                days.append(candidate)
        return days

    raise ValueError(f"unknown cadence: {cadence}")


def next_due_date(habit: Schedule, today: date, horizon_days: int = 400) -> date | None:
    """The next pinned date on or after `today`, for fixed habits only."""
    dates = scheduled_dates(habit, today, today + timedelta(days=horizon_days))
    return dates[0] if dates else None
