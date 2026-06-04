"""Initial schema

Revision ID: 001
Revises: None
Create Date: 2026-06-03

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # --- Users ---
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False, unique=True, index=True),
        sa.Column("hashed_password", sa.String(128), nullable=False),
        sa.Column("full_name", sa.String(256), nullable=False),
        sa.Column(
            "role",
            sa.Enum("ADMIN", "ANALYST", "VIEWER", name="user_role_enum"),
            nullable=False,
            server_default="ANALYST",
        ),
        sa.Column("api_key", sa.String(64), nullable=True, unique=True, index=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # --- Documents ---
    op.create_table(
        "documents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(512), nullable=False, index=True),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("source_url", sa.String(2048), nullable=True),
        sa.Column(
            "doc_type",
            sa.Enum("PDF", "REPORT", "PATENT", "STARTUP_PROFILE", "WEB", name="doc_type_enum"),
            nullable=False,
            server_default="PDF",
        ),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # --- Document Chunks (with pgvector) ---
    op.create_table(
        "document_chunks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "document_id",
            sa.String(36),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
    )

    # Add vector column via raw SQL (pgvector)
    op.execute(
        "ALTER TABLE document_chunks ADD COLUMN embedding vector(1536)"
    )

    # --- Analysis Requests ---
    op.create_table(
        "analysis_requests",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("query", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("PENDING", "PROCESSING", "COMPLETED", "FAILED", name="analysis_status_enum"),
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column("result", postgresql.JSONB(), nullable=True),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    # --- Agent Traces ---
    op.create_table(
        "agent_traces",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "analysis_request_id",
            sa.String(36),
            sa.ForeignKey("analysis_requests.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("agent_name", sa.String(128), nullable=False),
        sa.Column("input", sa.Text(), nullable=False, server_default=""),
        sa.Column("output", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    # --- Entities ---
    op.create_table(
        "entities",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(512), nullable=False, index=True),
        sa.Column(
            "entity_type",
            sa.Enum(
                "TECHNOLOGY", "COMPANY", "STARTUP", "MARKET", "PATENT", "RESEARCH_TOPIC",
                name="entity_type_enum",
            ),
            nullable=False,
        ),
        sa.Column("properties", postgresql.JSONB(), nullable=True),
        sa.Column("neo4j_id", sa.String(128), nullable=True, index=True),
    )

    # --- Relationships ---
    op.create_table(
        "relationships",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "source_entity_id",
            sa.String(36),
            sa.ForeignKey("entities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "target_entity_id",
            sa.String(36),
            sa.ForeignKey("entities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("relationship_type", sa.String(128), nullable=False),
        sa.Column("properties", postgresql.JSONB(), nullable=True),
        sa.Column("neo4j_id", sa.String(128), nullable=True, index=True),
    )


def downgrade() -> None:
    op.drop_table("relationships")
    op.drop_table("entities")
    op.drop_table("agent_traces")
    op.drop_table("analysis_requests")
    op.drop_table("document_chunks")
    op.drop_table("documents")
    op.drop_table("users")

    op.execute("DROP TYPE IF EXISTS user_role_enum")
    op.execute("DROP TYPE IF EXISTS doc_type_enum")
    op.execute("DROP TYPE IF EXISTS analysis_status_enum")
    op.execute("DROP TYPE IF EXISTS entity_type_enum")
    op.execute("DROP EXTENSION IF EXISTS vector")
