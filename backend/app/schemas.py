from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, EmailStr, Field

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    date_of_birth: datetime

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
class SportsLeagueOut(ModelOut): provider_id: int; slug: str; name: str; country: str; current_season_id: int | None; active: bool
class SportsTeamOut(ModelOut): provider_id: int; league_id: int | None; name: str; short_name: str | None; country: str | None
class SportsFixtureOut(ModelOut):
    provider_id: int
    league_id: int
    season_id: int | None
    home_team_id: int | None
    away_team_id: int | None
    home_team: str
    away_team: str
    event_date: datetime
    status: str
    home_score: int | None
    away_score: int | None
    round_name: str | None
class SportsPlayerOut(ModelOut):
    provider_id: int
    current_team_id: int | None
    name: str
    short_name: str | None
    position: str | None
    nationality: str | None
    market_value_eur: int | None
