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
    preferred_currency: str
    preferences: dict
    signup_bonus_awarded: bool

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
    wallet: WalletOut
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
class NotificationOut(ModelOut): id: int; kind: str; message: str; read: bool; created_at: datetime
