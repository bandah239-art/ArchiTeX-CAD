"""Initial portfolio schema

Revision ID: 0001
Revises:
Create Date: 2026-05-29
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("project_name", sa.String, nullable=False),
        sa.Column("project_code", sa.String, default=""),
        sa.Column("project_type", sa.String, default="building"),
        sa.Column("country_code", sa.String, default="ZM"),
        sa.Column("province", sa.String, default=""),
        sa.Column("district", sa.String, default=""),
        sa.Column("contract_value_usd", sa.Float, default=0),
        sa.Column("funding_source", sa.String, default="GRZ"),
        sa.Column("contractor_name", sa.String, default=""),
        sa.Column("consultant_name", sa.String, default=""),
        sa.Column("commencement_date", sa.String, default=""),
        sa.Column("original_completion", sa.String, default=""),
        sa.Column("status", sa.String, default="active"),
        sa.Column("completion_pct", sa.Float, default=0),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "snapshots",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.String, sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("snapshot_date", sa.String, default=""),
        sa.Column("completion_pct", sa.Float, default=0),
        sa.Column("expenditure_usd", sa.Float, default=0),
        sa.Column("report_narrative", sa.Text, default=""),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "variations",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.String, sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("variation_no", sa.String, default=""),
        sa.Column("description", sa.Text, default=""),
        sa.Column("value_usd", sa.Float, default=0),
        sa.Column("direction", sa.String, default="addition"),
        sa.Column("status", sa.String, default="pending"),
        sa.Column("reason", sa.Text, default=""),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_index("ix_snapshots_project_id", "snapshots", ["project_id"])
    op.create_index("ix_variations_project_id", "variations", ["project_id"])


def downgrade() -> None:
    op.drop_index("ix_variations_project_id")
    op.drop_index("ix_snapshots_project_id")
    op.drop_table("variations")
    op.drop_table("snapshots")
    op.drop_table("projects")
