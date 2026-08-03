from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    date_of_birth: datetime
    username: str | None = Field(default=None, min_length=3, max_length=32)
    first_name: str | None = Field(default=None, max_length=80)
    last_name: str | None = Field(default=None, max_length=80)

    @field_validator("username", "first_name", "last_name")
    @classmethod
    def clean_text(cls, value):
        cleaned = value.strip() if value else value
        return cleaned or None

class SupabaseSyncIn(BaseModel):
    date_of_birth: datetime | None = None
    username: str | None = Field(default=None, min_length=3, max_length=32)
    first_name: str | None = Field(default=None, max_length=80)
    last_name: str | None = Field(default=None, max_length=80)

    @field_validator("username", "first_name", "last_name")
    @classmethod
    def clean_text(cls, value):
        cleaned = value.strip() if value else value
        return cleaned or None

class ProfileUpdateIn(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=32)
    first_name: str | None = Field(default=None, max_length=80)
    last_name: str | None = Field(default=None, max_length=80)
    country: str | None = Field(default=None, min_length=2, max_length=2)
    avatar_url: str | None = Field(default=None, max_length=512)
    preferred_currency: str | None = Field(default=None, pattern="^(gold|silver)$")
    preferences: dict | None = None

    @field_validator("username", "first_name", "last_name", "country", "avatar_url")
    @classmethod
    def clean_text(cls, value):
        cleaned = value.strip() if value else value
        return cleaned or None

    @field_validator("country")
    @classmethod
    def normalize_country(cls, value):
        return value.upper() if value else value

    @field_validator("avatar_url")
    @classmethod
    def validate_avatar_url(cls, value):
        if value is None:
            return value
        if not value.startswith("https://"):
            raise ValueError("avatar_url must be an https URL")
        return value

    @field_validator("preferences")
    @classmethod
    def limit_preferences(cls, value):
        if value is not None and len(value) > 12:
            raise ValueError("preferences contains too many entries")
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
    preferences: dict
    signup_bonus_awarded: bool

class SignupBonusSyncOut(BaseModel):
    granted_now: bool
    already_granted: bool
    gold: float | None = None
    silver: float | None = None

class SupabaseSyncOut(BaseModel):
    status: str
    user: UserProfileOut | None = None
    required_fields: list[str] = []
    bonus: SignupBonusSyncOut | None = None

class WalletOut(BaseModel):
    gold: float
    silver: float

class WatchlistIn(BaseModel):
    symbol: str = Field(min_length=1, max_length=20)

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
    password: str

class TokenOut(BaseModel): access_token: str; token_type: str = "bearer"
class AgeVerificationIn(BaseModel): date_of_birth: datetime
class CreditIn(BaseModel): currency: str; amount: Decimal = Field(gt=0); idempotency_key: str | None = None
class OrderIn(BaseModel): symbol: str; quantity: int = Field(gt=0); idempotency_key: str | None = None
class SquadPlayerIn(BaseModel): symbol: str
class ModelOut(BaseModel): model_config = ConfigDict(from_attributes=True)
class PlayerOut(ModelOut): id: int; symbol: str; name: str; league: str; club: str; active: bool
class PriceOut(ModelOut): symbol: str; name: str; bid: Decimal; ask: Decimal; updated_at: datetime
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
    symbol: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=1, max_length=120)
    league: str = Field(min_length=1, max_length=30)
    club: str = Field(default="", max_length=120)
    bid: Decimal = Field(gt=0)
    ask: Decimal = Field(gt=0)
    active: bool = True

    @field_validator("symbol", "name", "league", "club")
    @classmethod
    def clean_catalog_text(cls, value: str) -> str:
        return value.strip()

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
        return value.strip()

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
    account_status: str = Field(pattern="^(active|suspended)$")
class NotificationOut(ModelOut): id: int; kind: str; message: str; read: bool; created_at: datetime
