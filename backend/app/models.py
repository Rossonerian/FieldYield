from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255))
    username: Mapped[str | None] = mapped_column(String(32), unique=True, index=True, nullable=True)
    first_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    country: Mapped[str | None] = mapped_column(String(2), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    date_of_birth: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    age_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    account_status: Mapped[str] = mapped_column(String(16), default="active")
    role: Mapped[str] = mapped_column(String(16), default="user", index=True)
    auth_provider: Mapped[str] = mapped_column(String(16), default="local")
    auth_provider_id: Mapped[str | None] = mapped_column(String(64), unique=True, index=True, nullable=True)
    preferred_currency: Mapped[str] = mapped_column(String(10), default="gold")
    preferences: Mapped[dict] = mapped_column(JSON, default=dict)
    signup_bonus_awarded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)
    __table_args__ = (
        UniqueConstraint("email", name="uq_users_email"),
        Index("ix_users_email", "email"),
        CheckConstraint("account_status IN ('active', 'suspended')", name="ck_users_account_status"),
        CheckConstraint("role IN ('user', 'admin')", name="ck_users_role"),
        CheckConstraint("auth_provider IN ('local', 'email', 'google', 'supabase')", name="ck_users_auth_provider"),
        CheckConstraint("preferred_currency IN ('gold', 'silver')", name="ck_users_preferred_currency"),
    )


class SignupBonusGrant(Base):
    __tablename__ = "signup_bonus_grants"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    gold_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    silver_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    reason: Mapped[str] = mapped_column(String(40), default="signup_bonus")
    idempotency_key: Mapped[str] = mapped_column(String(120), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_signup_bonus_grants_user"),
        Index("ix_signup_bonus_grants_user_id", "user_id"),
        CheckConstraint("gold_amount >= 0", name="ck_signup_bonus_gold_nonnegative"),
        CheckConstraint("silver_amount >= 0", name="ck_signup_bonus_silver_nonnegative"),
    )


class Player(Base):
    __tablename__ = "players"
    id: Mapped[int] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(120))
    league: Mapped[str] = mapped_column(String(30), default="EPL")
    club: Mapped[str] = mapped_column(String(120), default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    __table_args__ = (
        UniqueConstraint("symbol", name="uq_players_symbol"),
        Index("ix_players_symbol", "symbol"),
    )


class Wallet(Base):
    __tablename__ = "wallets"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    gold: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    silver: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    __table_args__ = (
        CheckConstraint("gold >= 0", name="ck_wallets_gold_nonnegative"),
        CheckConstraint("silver >= 0", name="ck_wallets_silver_nonnegative"),
    )


class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    currency: Mapped[str] = mapped_column(String(10))
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    reason: Mapped[str] = mapped_column(String(120))
    idempotency_key: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        UniqueConstraint("user_id", "idempotency_key", name="uq_wallet_transactions_user_key"),
        CheckConstraint("currency IN ('gold', 'silver')", name="ck_wallet_transactions_currency"),
        Index("ix_wallet_transactions_user_key", "user_id", "idempotency_key"),
    )


class MarketPrice(Base):
    __tablename__ = "market_prices"
    id: Mapped[int] = mapped_column(primary_key=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"), unique=True)
    bid: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    ask: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    source: Mapped[str] = mapped_column(String(40), default="manual")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)
    __table_args__ = (
        CheckConstraint("bid > 0", name="ck_market_prices_bid_positive"),
        CheckConstraint("ask > 0", name="ck_market_prices_ask_positive"),
        CheckConstraint("ask >= bid", name="ck_market_prices_spread"),
    )


class Order(Base):
    __tablename__ = "orders"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"), index=True)
    side: Mapped[str] = mapped_column(String(4))
    quantity: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="PENDING")
    idempotency_key: Mapped[str | None] = mapped_column(String(120), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        UniqueConstraint("user_id", "idempotency_key", name="uq_orders_user_key"),
        CheckConstraint("side IN ('BUY', 'SELL')", name="ck_orders_side"),
        CheckConstraint("status IN ('PENDING', 'FILLED', 'REJECTED')", name="ck_orders_status"),
        CheckConstraint("quantity > 0", name="ck_orders_quantity_positive"),
        Index("ix_orders_user_key", "user_id", "idempotency_key"),
    )


class OrderMatch(Base):
    __tablename__ = "order_matches"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"))
    quantity: Mapped[int] = mapped_column(Integer)
    price: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        UniqueConstraint("order_id", name="uq_order_matches_order_id"),
        Index("ix_order_matches_order_id", "order_id"),
        CheckConstraint("quantity > 0", name="ck_order_matches_quantity_positive"),
        CheckConstraint("price > 0", name="ck_order_matches_price_positive"),
    )


class Holding(Base):
    __tablename__ = "holdings"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    average_cost: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    realized_pnl: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    __table_args__ = (
        UniqueConstraint("user_id", "player_id", name="uq_holdings_user_player"),
        CheckConstraint("quantity >= 0", name="ck_holdings_quantity_nonnegative"),
        CheckConstraint("average_cost >= 0", name="ck_holdings_average_cost_nonnegative"),
    )


class ActiveSquad(Base):
    __tablename__ = "active_squad"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"))
    position: Mapped[int] = mapped_column(Integer)
    __table_args__ = (
        UniqueConstraint("user_id", "player_id", name="uq_active_squad_user_player"),
        UniqueConstraint("user_id", "position", name="uq_active_squad_user_position"),
        CheckConstraint("position >= 1 AND position <= 25", name="ck_active_squad_position"),
    )


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String(40))
    message: Mapped[str] = mapped_column(Text)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Watchlist(Base):
    __tablename__ = "watchlists"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (UniqueConstraint("user_id", "player_id", name="uq_watchlists_user_player"),)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    actor_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True, nullable=True)
    target_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True, nullable=True)
    action: Mapped[str] = mapped_column(String(80))
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
