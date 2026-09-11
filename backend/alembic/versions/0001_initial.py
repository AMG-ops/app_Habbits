"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-09-11
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=80), nullable=False),
        sa.Column("accent", sa.String(length=20), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )

    op.create_table(
        "habits",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("cadence", sa.String(length=10), nullable=False),
        sa.Column("schedule_mode", sa.String(length=10), nullable=False),
        sa.Column("weekdays", postgresql.ARRAY(sa.SmallInteger()), nullable=True),
        sa.Column("day_of_month", sa.SmallInteger(), nullable=True),
        sa.Column("month_of_year", sa.SmallInteger(), nullable=True),
        sa.Column("target_type", sa.String(length=10), nullable=False),
        sa.Column("target_value", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("unit", sa.String(length=24), nullable=True),
        sa.Column("color", sa.String(length=20), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "cadence IN ('daily', 'weekly', 'monthly', 'yearly')", name="ck_habits_cadence"
        ),
        sa.CheckConstraint(
            "schedule_mode IN ('flexible', 'fixed')", name="ck_habits_schedule_mode"
        ),
        sa.CheckConstraint(
            "target_type IN ('binary', 'quantity')", name="ck_habits_target_type"
        ),
        sa.CheckConstraint("target_value > 0", name="ck_habits_target_value"),
        sa.CheckConstraint(
            "day_of_month IS NULL OR (day_of_month BETWEEN 1 AND 31)",
            name="ck_habits_day_of_month",
        ),
        sa.CheckConstraint(
            "month_of_year IS NULL OR (month_of_year BETWEEN 1 AND 12)",
            name="ck_habits_month_of_year",
        ),
    )
    op.create_index("ix_habits_owner_archived", "habits", ["owner_id", "archived_at"])

    op.create_table(
        "entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("habit_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("logged_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("occurred_on", sa.Date(), nullable=False),
        sa.Column("value", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["habit_id"], ["habits.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["logged_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("habit_id", "occurred_on", name="uq_entries_habit_day"),
    )
    op.create_index("ix_entries_habit_date", "entries", ["habit_id", "occurred_on"])

    op.create_table(
        "shares",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("viewer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["viewer_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("owner_id", "viewer_id", name="uq_shares_owner_viewer"),
        sa.CheckConstraint("owner_id <> viewer_id", name="ck_shares_not_self"),
    )


def downgrade() -> None:
    op.drop_table("shares")
    op.drop_index("ix_entries_habit_date", table_name="entries")
    op.drop_table("entries")
    op.drop_index("ix_habits_owner_archived", table_name="habits")
    op.drop_table("habits")
    op.drop_table("users")
