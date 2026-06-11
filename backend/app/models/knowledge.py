from __future__ import annotations

import enum

from sqlalchemy import (
    Enum,
    ForeignKey,
    String,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class EntityType(str, enum.Enum):
    TECHNOLOGY = "TECHNOLOGY"
    COMPANY = "COMPANY"
    STARTUP = "STARTUP"
    MARKET = "MARKET"
    PATENT = "PATENT"
    RESEARCH_TOPIC = "RESEARCH_TOPIC"


class Entity(Base):
    __tablename__ = "entities"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    entity_type: Mapped[EntityType] = mapped_column(
        Enum(EntityType, name="entity_type_enum"),
        nullable=False,
    )
    properties: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True, default=dict)
    neo4j_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)

    outgoing_relationships: Mapped[list[Relationship]] = relationship(
        "Relationship",
        foreign_keys="Relationship.source_entity_id",
        back_populates="source_entity",
        cascade="all, delete-orphan",
    )
    incoming_relationships: Mapped[list[Relationship]] = relationship(
        "Relationship",
        foreign_keys="Relationship.target_entity_id",
        back_populates="target_entity",
        cascade="all, delete-orphan",
    )


class Relationship(Base):
    __tablename__ = "relationships"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    source_entity_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("entities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_entity_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("entities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    relationship_type: Mapped[str] = mapped_column(String(128), nullable=False)
    properties: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True, default=dict)
    neo4j_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)

    source_entity: Mapped[Entity] = relationship(
        "Entity",
        foreign_keys=[source_entity_id],
        back_populates="outgoing_relationships",
    )
    target_entity: Mapped[Entity] = relationship(
        "Entity",
        foreign_keys=[target_entity_id],
        back_populates="incoming_relationships",
    )
