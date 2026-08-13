from __future__ import annotations

import json
import re
from datetime import datetime
from decimal import Decimal
from typing import Any
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

IDEMPOTENCY_KEY_MAX_LENGTH = 120
USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_.-]{2,31}$")
NAME_PATTERN = re.compile(r"^[^\x00-\x1f\x7f<>]{1,80}$")
SYMBOL_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,19}$")


def _clean_optional_text(value: str | None) -> str | None:
    cleaned = value.strip() if value else None
    return cleaned or None


def _validate_username(value: str | None) -> str | None:
    value = _clean_optional_text(value)
    if value is not None and not USERNAME_PATTERN.fullmatch(value):
        raise ValueError("username may contain letters, numbers, dot, dash, and underscore")
    return value


def _validate_name(value: str | None) -> str | None:
    value = _clean_optional_text(value)
    if value is not None and not NAME_PATTERN.fullmatch(value):
        raise ValueError("name contains unsupported characters")
    return value


def _preference_shape(value: Any, *, depth: int = 0) -> tuple[int, int]:
    if depth > 4:
        raise ValueError("preferences nesting is too deep")
    if isinstance(value, dict):
        if len(value) > 32:
            raise ValueError("preferences contains too many entries")
        keys = 0
        values = 0
        for key, child in value.items():
            if not isinstance(key, str) or not key or len(key) > 64:
                raise ValueError("preference keys must be 1 to 64 characters")
            child_keys, child_values = _preference_shape(child, depth=depth + 1)
            keys += 1 + child_keys
            values += child_values
        return keys, values
    if isinstance(value, list):
        if len(value) > 32:
            raise ValueError("preference lists are too long")
        totals = [_preference_shape(child, depth=depth + 1) for child in value]
        return sum(item[0] for item in totals), sum(item[1] for item in totals)
    if isinstance(value, str) and len(value) > 256:
        raise ValueError("preference values are too long")
    if value is not None and not isinstance(value, (str, int, float, bool)):
        raise ValueError("preferences contains an unsupported value")
    return 0, 1


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    date_of_birth: datetime
    username: str | None = Field(default=None, min_length=3, max_length=32)
    first_name: str | None = Field(default=None, max_length=80)
    last_name: str | None = Field(default=None, max_length=80)

    _username = field_validator("username")(_validate_username)
    _names = field_validator("first_name", "last_name")(_validate_name)


class SupabaseSyncIn(BaseModel):
    date_of_birth: datetime | None = None
    username: str | None = Field(default=None, min_length=3, max_length=32)
    first_name: str | None = Field(default=None, max_length=80)
    last_name: str | None = Field(default=None, max_length=80)

    _username = field_validator("username")(_validate_username)
    _names = field_validator("first_name", "last_name")(_validate_name)


class ProfileUpdateIn(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=32)
    first_name: str | None = Field(default=None, max_length=80)
    last_name: str | None = Field(default=None, max_length=80)
    country: str | None = Field(default=None, min_length=2, max_length=2, pattern=r"^[A-Za-z]{2}$")
    avatar_url: str | None = Field(default=None, max_length=512)
    preferred_currency: str | None = Field(default=None, pattern=r"^(gold|silver)$")
    preferences: dict[str, Any] | None = None

    _username = field_validator("username")(_validate_username)
    _names = field_validator("first_name", "last_name")(_validate_name)

    @field_validator("country")
    @classmethod
    def normalize_country(cls, value: str | None) -> str | None:
        value = _clean_optional_text(value)
        return value.upper() if value else None

    @field_validator("avatar_url")
    @classmethod
    def validate_avatar_url(cls, value: str | None) -> str | None:
        value = _clean_optional_text(value)
        if value is None:
            return None
        parsed = urlparse(value)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("avatar_url must be a public https URL without credentials")
        return value

    @field_validator("preferences")
    @classmethod
    def limit_preferences(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        if value is None:
            return None
        keys, _ = _preference_shape(value)
        if keys > 64 or len(json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode()) > 4096:
            raise ValueError("preferences is too large")
        return value


class UserProfileOut(BaseModel):
    id: int
    email: EmailStr
    username: str | None
    first_name: str | None
    last_name: str | None
    country: str | None
    avatar_url: str | None
    date_of_birth: datetime
    age_verified: bool
    created_at: datetime
    updated_at: datetime
    account_status: str
    role: str
    auth_provider: str
    preferred_currency: str
    preferences: dict[str, Any]
    signup_bonus_awarded: bool


class SignupBonusSyncOut(BaseModel):
    granted_now: bool
    already_granted: bool
    gold: float | None = None
    silver: float | None = None


class SupabaseSyncOut(BaseModel):
    status: str
    user: UserProfileOut | None = None
    required_fields: list[str] = Field(default_factory=list)
    bonus: SignupBonusSyncOut | None = None


class WalletOut(BaseModel):
    gold: float
    silver: float


class WatchlistIn(BaseModel):
    symbol: str = Field(min_length=1, max_length=20, pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]{0,19}$")


class WatchlistOut(BaseModel):
    id: int
    symbol: str
    name: str
    league: str
    club: str
    bid: Decimal
    ask: Decimal
    updated_at: datetime
    created_at: datetime


class ProfileSummaryOut(BaseModel):
    gold: float
    silver: float
    holdings_count: int
    portfolio_market_value: float
    portfolio_cost_basis: float
    unrealized_pnl: float
    realized_pnl: float
    orders_count: int
    transactions_count: int
    unread_notifications: int


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AgeVerificationIn(BaseModel):
    date_of_birth: datetime


class CreditIn(BaseModel):
    currency: str = Field(pattern=r"^(?i:gold|silver)$")
    amount: Decimal = Field(gt=0, max_digits=18, decimal_places=2)
    idempotency_key: str | None = Field(default=None, min_length=1, max_length=IDEMPOTENCY_KEY_MAX_LENGTH)


class OrderIn(BaseModel):
    symbol: str = Field(min_length=1, max_length=20, pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]{0,19}$")
    quantity: int = Field(gt=0, le=1_000_000)
    idempotency_key: str | None = Field(default=None, min_length=1, max_length=IDEMPOTENCY_KEY_MAX_LENGTH)


class SquadPlayerIn(BaseModel):
    symbol: str = Field(min_length=1, max_length=20, pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]{0,19}$")


class ModelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PlayerOut(ModelOut):
    id: int
    symbol: str
    name: str
    league: str
    club: str
    active: bool


class HoldingOut(ModelOut):
    symbol: str
    name: str
    league: str
    club: str
    quantity: int
    average_cost: Decimal
    realized_pnl: Decimal
    market_price: Decimal
    market_value: Decimal


class SquadOut(ModelOut):
    id: int
    player_id: int
    position: int
    symbol: str
    name: str
    club: str
    league: str


class ReserveSquadOut(ModelOut):
    player_id: int
    symbol: str
    name: str
    club: str
    league: str
    quantity: int


class SquadStateOut(BaseModel):
    active: list[SquadOut]
    reserve: list[ReserveSquadOut]
    active_capacity: int
    reserve_capacity: int


class WalletTransactionOut(ModelOut):
    id: int
    currency: str
    amount: Decimal
    reason: str
    created_at: datetime


class OrderOut(ModelOut):
    id: int
    player_id: int
    side: str
    quantity: int
    status: str
    failure_reason: str | None
    created_at: datetime
    execution_price: float | None = None
    executed_total: float | None = None


class MarketPlayerOut(ModelOut):
    symbol: str
    name: str
    league: str
    club: str
    active: bool
    bid: Decimal
    ask: Decimal
    updated_at: datetime
    source: str


class CatalogRecordIn(BaseModel):
    symbol: str = Field(min_length=1, max_length=20, pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]{0,19}$")
    name: str = Field(min_length=1, max_length=120)
    league: str = Field(min_length=1, max_length=30)
    club: str = Field(default="", max_length=120)
    bid: Decimal = Field(gt=0, max_digits=18, decimal_places=2)
    ask: Decimal = Field(gt=0, max_digits=18, decimal_places=2)
    active: bool = True

    @field_validator("symbol", "name", "league", "club")
    @classmethod
    def clean_catalog_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned and value:
            raise ValueError("catalog text cannot be blank")
        return cleaned

    @field_validator("ask")
    @classmethod
    def ask_not_below_bid(cls, value: Decimal, info):
        bid = info.data.get("bid")
        if bid is not None and value < bid:
            raise ValueError("ask must be greater than or equal to bid")
        return value


class CatalogImportIn(BaseModel):
    source: str = Field(min_length=1, max_length=40)
    records: list[CatalogRecordIn] = Field(min_length=1, max_length=500)

    @field_validator("source")
    @classmethod
    def clean_source(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("source cannot be blank")
        return cleaned


class CatalogImportOut(BaseModel):
    source: str
    created: int
    updated: int
    total: int


class AdminUserOut(ModelOut):
    id: int
    email: EmailStr
    username: str | None
    account_status: str
    role: str
    created_at: datetime
    signup_bonus_awarded: bool
    wallet_gold: Decimal
    wallet_silver: Decimal


class AdminStatusIn(BaseModel):
    account_status: str = Field(pattern=r"^(active|suspended)$")


class NotificationOut(ModelOut):
    id: int
    kind: str
    message: str
    read: bool
    created_at: datetime
