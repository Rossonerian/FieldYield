from __future__ import annotations

import logging
import re
import time
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import admin_user, current_user, oauth2, supabase_identity, verified_user
from app.core.config import settings
from app.core.database import engine, get_db
from app.core.http import RequestBodyLimitMiddleware
from app.core.metrics import record_metric
from app.core.rate_limit import enforce_rate_limit
from app.core.security import create_access_token
from app.integrations.market_engine import MarketEngineUnavailable, market_engine
from app.models import (
    AuditLog,
    Holding,
    MarketPrice,
    Notification,
    Order,
    Player,
    User,
    Wallet,
    WalletTransaction,
    Watchlist,
)
from app.schemas import (
    AdminStatusIn,
    AdminUserOut,
    AgeVerificationIn,
    CatalogImportIn,
    CatalogImportOut,
    CreditIn,
    HoldingOut,
    LoginIn,
    MarketPlayerOut,
    NotificationOut,
    OrderIn,
    OrderOut,
    ProfileSummaryOut,
    ProfileUpdateIn,
    RegisterIn,
    ReserveSquadOut,
    SignupBonusSyncOut,
    SquadOut,
    SquadPlayerIn,
    SquadStateOut,
    SupabaseSyncIn,
    SupabaseSyncOut,
    UserProfileOut,
    WalletOut,
    WalletTransactionOut,
    WatchlistIn,
    WatchlistOut,
)
from app.services import (
    age_ok,
    authenticate,
    credit,
    demote_player,
    order,
    order_output,
    promote_player,
    register,
    squad_state,
    sync_supabase_user,
)

logger = logging.getLogger("fieldyield.api")
REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$")

app = FastAPI(
    title="FieldYield Exchange API",
    version="1.1.0",
    docs_url="/docs" if settings.enable_api_docs else None,
    redoc_url="/redoc" if settings.enable_api_docs else None,
    openapi_url="/openapi.json" if settings.enable_api_docs else None,
)
app.add_middleware(
    RequestBodyLimitMiddleware,
    default_limit=settings.request_body_max_bytes,
    catalog_limit=settings.catalog_body_max_bytes,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    expose_headers=["X-Request-ID", "Retry-After"],
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    supplied = request.headers.get("x-request-id", "")
    request_id = supplied if REQUEST_ID_PATTERN.fullmatch(supplied) else str(uuid4())
    request.state.request_id = request_id
    started = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    duration_ms = (time.perf_counter() - started) * 1000
    logger.info(
        "request_id=%s method=%s path=%s status=%s duration_ms=%.2f",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if exc.status_code == 401:
        record_metric("authentication_failures")
    if exc.status_code == 429:
        record_metric("rate_limit_rejections")
    if request.url.path.startswith("/api/v1/trading/orders/") and exc.status_code >= 400:
        record_metric("orders_rejected")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "request_id": getattr(request.state, "request_id", None)},
        headers=exc.headers,
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, SQLAlchemyError):
        record_metric("database_errors")
    logger.exception("unhandled_api_exception request_id=%s error_type=%s", getattr(request.state, "request_id", None), type(exc).__name__)
    request_id = getattr(request.state, "request_id", None)
    headers = {"X-Request-ID": request_id} if request_id else {}
    origin = request.headers.get("origin")
    if origin in settings.cors_origin_list:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Vary"] = "Origin"
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "request_id": request_id},
        headers=headers,
    )


def _database_ready() -> str:
    try:
        with engine.connect() as connection:
            connection.exec_driver_sql("SELECT 1")
        return "ok"
    except Exception:
        logger.warning("readiness_failure component=database")
        return "error"


def _supabase_ready() -> str:
    if not settings.supabase_configured:
        return "not_configured"
    try:
        response = httpx.get(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/settings",
            headers={"apikey": settings.supabase_anon_key or ""},
            timeout=min(settings.supabase_http_timeout_seconds, 1.5),
        )
        return "ok" if response.is_success else "unavailable"
    except httpx.HTTPError:
        return "unavailable"


def _readiness_payload() -> tuple[dict[str, object], bool]:
    database = _database_ready()
    supabase = _supabase_ready()
    market = "not_configured"
    if market_engine.enabled:
        try:
            market_engine.health()
            market = "ok"
        except MarketEngineUnavailable:
            market = "unavailable"
    auth_ready = settings.auth_provider != "supabase" or supabase == "ok"
    market_ready = not settings.market_engine_trading_enabled or market == "ok"
    ready = database == "ok" and auth_ready and market_ready
    if not ready:
        record_metric("readiness_failures")
    payload = {
        "status": "ok" if ready else "degraded",
        "database": database,
        "supabase": supabase,
        "auth_provider": settings.auth_provider,
        "market_engine": market,
        "market_engine_trading_enabled": settings.market_engine_trading_enabled,
        "version": app.version,
    }
    return payload, ready


@app.get("/health/live")
def health_live():
    return {"status": "ok", "version": app.version}


@app.get("/health/ready")
def health_ready():
    payload, ready = _readiness_payload()
    return JSONResponse(payload, status_code=200 if ready else 503)


@app.get("/health")
def health():
    payload, _ = _readiness_payload()
    return payload


@app.get("/api/v1/market-engine/health")
def market_engine_health(request: Request):
    enforce_rate_limit(request, "market_engine_health", 120)
    if not market_engine.enabled:
        return {"configured": False, "status": "not_configured"}
    try:
        return {"configured": True, "status": "ok", "detail": market_engine.health()}
    except MarketEngineUnavailable as exc:
        record_metric("market_engine_failures")
        raise HTTPException(503, "Market Engine is unavailable") from exc


@app.post("/api/v1/auth/register")
def register_user(body: RegisterIn, request: Request, db: Session = Depends(get_db)):
    enforce_rate_limit(request, "auth_register", 10)
    if settings.auth_provider == "supabase":
        raise HTTPException(410, "Use Supabase Auth for registration")
    user = register(db, body.email, body.password, body.date_of_birth, body.username, body.first_name, body.last_name)
    return {"id": user.id, "email": user.email, "signup_bonus_awarded": bool(user.signup_bonus_awarded_at)}


@app.post("/api/v1/auth/login")
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    enforce_rate_limit(request, "auth_login", 20)
    if settings.auth_provider == "supabase":
        raise HTTPException(410, "Use Supabase Auth for login")
    user = authenticate(db, body.email, body.password)
    return {"access_token": create_access_token(str(user.id)), "token_type": "bearer"}


@app.post("/api/v1/auth/token")
def token(request: Request, form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    enforce_rate_limit(request, "auth_token", 20)
    if settings.auth_provider == "supabase":
        raise HTTPException(410, "Use Supabase Auth for login")
    user = authenticate(db, form.username, form.password)
    return {"access_token": create_access_token(str(user.id)), "token_type": "bearer"}


@app.post("/api/v1/auth/supabase-sync", response_model=SupabaseSyncOut)
def supabase_sync(body: SupabaseSyncIn, request: Request, token: str | None = Depends(oauth2), db: Session = Depends(get_db)):
    enforce_rate_limit(request, "supabase_sync", 30)
    if settings.auth_provider != "supabase":
        raise HTTPException(410, "Supabase Auth is not enabled for this deployment")
    identity = supabase_identity(token or "")
    if not identity:
        raise HTTPException(401, "Valid Supabase session required")
    user, granted_now, required_fields = sync_supabase_user(
        db,
        provider_id=str(identity["id"]),
        provider=str(identity["provider"]),
        email=str(identity["email"]),
        date_of_birth=body.date_of_birth,
        username=body.username,
        first_name=body.first_name,
        last_name=body.last_name,
    )
    if required_fields:
        return SupabaseSyncOut(status="profile_incomplete", required_fields=required_fields)
    if user is None:
        raise HTTPException(500, "Profile synchronization failed")
    return SupabaseSyncOut(
        status="ready",
        user=profile_view(user),
        bonus=SignupBonusSyncOut(
            granted_now=granted_now,
            already_granted=not granted_now and bool(user.signup_bonus_awarded_at),
            gold=float(settings.signup_bonus_gold) if granted_now else None,
            silver=float(settings.signup_bonus_silver) if granted_now else None,
        ),
    )


@app.get("/api/v1/users/me")
def me(user: User = Depends(current_user)) -> UserProfileOut:
    return profile_view(user)


@app.patch("/api/v1/users/me")
def update_me(body: ProfileUpdateIn, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)) -> UserProfileOut:
    enforce_rate_limit(request, "profile_update", 30, user_id=user.id)
    if body.username is not None:
        normalized = body.username.lower()
        if db.scalar(select(User).where(User.username == normalized, User.id != user.id)):
            raise HTTPException(409, "Username already registered")
        user.username = normalized
    for field in ("first_name", "last_name", "country", "avatar_url", "preferred_currency", "preferences"):
        value = getattr(body, field)
        if value is not None:
            setattr(user, field, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Profile details conflict with another account") from exc
    db.refresh(user)
    return profile_view(user)


@app.get("/api/v1/users/me/profile")
def profile(user: User = Depends(current_user)) -> UserProfileOut:
    return profile_view(user)


def _portfolio_totals(db: Session, user_id: int) -> tuple[Decimal, Decimal, Decimal, int]:
    open_rows = db.execute(
        select(Holding, MarketPrice)
        .join(MarketPrice, MarketPrice.player_id == Holding.player_id)
        .where(Holding.user_id == user_id, Holding.quantity > 0)
    ).all()
    market_value = sum((Decimal(holding.quantity) * Decimal(price.bid) for holding, price in open_rows), Decimal("0"))
    cost_basis = sum((Decimal(holding.quantity) * Decimal(holding.average_cost) for holding, _ in open_rows), Decimal("0"))
    realized = db.scalar(select(func.coalesce(func.sum(Holding.realized_pnl), 0)).where(Holding.user_id == user_id)) or Decimal("0")
    return market_value, cost_basis, Decimal(realized), len(open_rows)


def _wallet_or_error(db: Session, user_id: int) -> Wallet:
    wallet = db.scalar(select(Wallet).where(Wallet.user_id == user_id))
    if wallet is None:
        logger.error("invariant=missing_wallet operation=read user_id=%s", user_id)
        raise HTTPException(409, "Account wallet is unavailable")
    return wallet


@app.get("/api/v1/users/me/summary")
def profile_summary(user: User = Depends(current_user), db: Session = Depends(get_db)) -> ProfileSummaryOut:
    wallet = _wallet_or_error(db, user.id)
    value, cost, realized, holdings_count = _portfolio_totals(db, user.id)
    return ProfileSummaryOut(
        gold=float(wallet.gold),
        silver=float(wallet.silver),
        holdings_count=holdings_count,
        portfolio_market_value=float(value),
        portfolio_cost_basis=float(cost),
        unrealized_pnl=float(value - cost),
        realized_pnl=float(realized),
        orders_count=db.scalar(select(func.count(Order.id)).where(Order.user_id == user.id)) or 0,
        transactions_count=db.scalar(select(func.count(WalletTransaction.id)).where(WalletTransaction.user_id == user.id)) or 0,
        unread_notifications=db.scalar(select(func.count(Notification.id)).where(Notification.user_id == user.id, Notification.read.is_(False))) or 0,
    )


def profile_view(user: User) -> UserProfileOut:
    role = "admin" if user.role == "admin" or user.email.lower() in settings.configured_admin_emails else user.role
    return UserProfileOut(
        id=user.id,
        email=user.email,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        country=user.country,
        avatar_url=user.avatar_url,
        date_of_birth=user.date_of_birth,
        age_verified=user.age_verified,
        created_at=user.created_at,
        updated_at=user.updated_at or user.created_at,
        account_status=user.account_status,
        role=role,
        auth_provider=user.auth_provider,
        preferred_currency=user.preferred_currency,
        preferences=user.preferences or {},
        signup_bonus_awarded=bool(user.signup_bonus_awarded_at),
    )


@app.post("/api/v1/users/verify-age")
def verify_age(body: AgeVerificationIn, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    enforce_rate_limit(request, "profile_update", 30, user_id=user.id)
    if not age_ok(body.date_of_birth):
        raise HTTPException(400, "User must be 18 or older")
    user.age_verified = True
    user.date_of_birth = body.date_of_birth
    db.commit()
    return {"age_verified": True}


@app.post("/api/v1/wallet/credit")
def wallet_credit(body: CreditIn, request: Request, user: User = Depends(verified_user), db: Session = Depends(get_db)):
    enforce_rate_limit(request, "wallet_credit", 20, user_id=user.id)
    if not settings.allow_test_credit or settings.app_env not in {"test", "development"}:
        raise HTTPException(404, "Wallet credit endpoint is disabled")
    credit(db, user, body.currency, body.amount, body.idempotency_key)
    return wallet_view(user=user, db=db)


@app.get("/api/v1/wallet")
def wallet_view(user: User = Depends(current_user), db: Session = Depends(get_db)) -> WalletOut:
    wallet = _wallet_or_error(db, user.id)
    return WalletOut(gold=float(wallet.gold), silver=float(wallet.silver))


@app.get("/api/v1/wallet/ledger", response_model=list[WalletTransactionOut])
def ledger(limit: int = Query(default=50, ge=1, le=200), offset: int = Query(default=0, ge=0), user: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(WalletTransaction)
        .where(WalletTransaction.user_id == user.id)
        .order_by(WalletTransaction.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()


@app.post("/api/v1/trading/orders/market-buy", response_model=OrderOut)
def buy(body: OrderIn, request: Request, user: User = Depends(verified_user), db: Session = Depends(get_db)):
    enforce_rate_limit(request, "trading_mutation", 30, user_id=user.id)
    return order(db, user, "BUY", body.symbol, body.quantity, body.idempotency_key)


@app.post("/api/v1/trading/orders/market-sell", response_model=OrderOut)
def sell(body: OrderIn, request: Request, user: User = Depends(verified_user), db: Session = Depends(get_db)):
    enforce_rate_limit(request, "trading_mutation", 30, user_id=user.id)
    return order(db, user, "SELL", body.symbol, body.quantity, body.idempotency_key)


@app.get("/api/v1/trading/orders", response_model=list[OrderOut])
def orders(limit: int = Query(default=50, ge=1, le=200), offset: int = Query(default=0, ge=0), user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Order).where(Order.user_id == user.id).order_by(Order.id.desc()).limit(limit).offset(offset)).all()
    return [order_output(db, row) for row in rows]


@app.get("/api/v1/portfolio")
def portfolio(user: User = Depends(current_user), db: Session = Depends(get_db)):
    value, cost, realized, _ = _portfolio_totals(db, user.id)
    return {"market_value": value, "cost_basis": cost, "unrealized_pnl": value - cost, "realized_pnl": realized}


@app.get("/api/v1/portfolio/holdings", response_model=list[HoldingOut])
def holdings(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        select(Holding, Player, MarketPrice)
        .join(Player, Holding.player_id == Player.id)
        .join(MarketPrice, MarketPrice.player_id == Player.id)
        .where(Holding.user_id == user.id, Holding.quantity > 0)
        .limit(500)
    ).all()
    return [
        HoldingOut(
            symbol=player.symbol,
            name=player.name,
            league=player.league,
            club=player.club,
            quantity=holding.quantity,
            average_cost=holding.average_cost,
            realized_pnl=holding.realized_pnl,
            market_price=price.bid,
            market_value=holding.quantity * price.bid,
        )
        for holding, player, price in rows
    ]


def _active_squad_output(rows) -> list[SquadOut]:
    return [
        SquadOut(id=entry.id, player_id=entry.player_id, position=entry.position, symbol=player.symbol, name=player.name, club=player.club, league=player.league)
        for entry, player in rows
    ]


@app.get("/api/v1/squad", response_model=list[SquadOut])
def squad(user: User = Depends(current_user), db: Session = Depends(get_db)):
    active, _ = squad_state(db, user.id)
    return _active_squad_output(active)


@app.get("/api/v1/squad/state", response_model=SquadStateOut)
def squad_full_state(user: User = Depends(current_user), db: Session = Depends(get_db)):
    active, reserve = squad_state(db, user.id)
    return SquadStateOut(
        active=_active_squad_output(active),
        reserve=[ReserveSquadOut(player_id=player.id, symbol=player.symbol, name=player.name, club=player.club, league=player.league, quantity=holding.quantity) for holding, player in reserve],
        active_capacity=settings.active_squad_capacity,
        reserve_capacity=settings.reserve_squad_capacity,
    )


@app.post("/api/v1/squad/promote")
def promote(body: SquadPlayerIn, request: Request, user: User = Depends(verified_user), db: Session = Depends(get_db)):
    enforce_rate_limit(request, "squad_mutation", 30, user_id=user.id)
    return {"status": promote_player(db, user, body.symbol)}


@app.post("/api/v1/squad/demote")
def demote(body: SquadPlayerIn, request: Request, user: User = Depends(verified_user), db: Session = Depends(get_db)):
    enforce_rate_limit(request, "squad_mutation", 30, user_id=user.id)
    return {"status": demote_player(db, user, body.symbol)}


@app.get("/api/v1/sports/trading-players")
def players(request: Request, db: Session = Depends(get_db)):
    enforce_rate_limit(request, "public_market", 300)
    return db.scalars(select(Player).where(Player.active.is_(True)).limit(500)).all()


@app.get("/api/v1/market/prices", response_model=list[MarketPlayerOut])
def prices(request: Request, db: Session = Depends(get_db)):
    enforce_rate_limit(request, "public_market", 300)
    rows = db.execute(
        select(Player, MarketPrice)
        .join(MarketPrice, MarketPrice.player_id == Player.id)
        .where(Player.active.is_(True))
        .order_by(Player.name)
        .limit(500)
    ).all()
    return [
        MarketPlayerOut(symbol=p.symbol, name=p.name, league=p.league, club=p.club, active=p.active, bid=price.bid, ask=price.ask, updated_at=price.updated_at, source=price.source)
        for p, price in rows
    ]


@app.get("/api/v1/watchlists", response_model=list[WatchlistOut])
def watchlists(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        select(Watchlist, Player, MarketPrice)
        .join(Player, Watchlist.player_id == Player.id)
        .join(MarketPrice, MarketPrice.player_id == Player.id)
        .where(Watchlist.user_id == user.id)
        .order_by(Watchlist.created_at.desc())
        .limit(200)
    ).all()
    return [WatchlistOut(id=w.id, symbol=p.symbol, name=p.name, league=p.league, club=p.club, bid=price.bid, ask=price.ask, updated_at=price.updated_at, created_at=w.created_at) for w, p, price in rows]


@app.post("/api/v1/watchlists", response_model=WatchlistOut, status_code=201)
def add_watchlist(body: WatchlistIn, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    enforce_rate_limit(request, "watchlist_mutation", 30, user_id=user.id)
    player = db.scalar(select(Player).where(Player.symbol == body.symbol.upper(), Player.active.is_(True)))
    if not player:
        raise HTTPException(404, "Player not found")
    price = db.scalar(select(MarketPrice).where(MarketPrice.player_id == player.id))
    if price is None:
        raise HTTPException(409, "Market price is unavailable for this player")
    row = Watchlist(user_id=user.id, player_id=player.id)
    db.add(row)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Player is already on your watchlist") from exc
    db.refresh(row)
    return WatchlistOut(id=row.id, symbol=player.symbol, name=player.name, league=player.league, club=player.club, bid=price.bid, ask=price.ask, updated_at=price.updated_at, created_at=row.created_at)


@app.delete("/api/v1/watchlists/{symbol}", status_code=204)
def remove_watchlist(symbol: str, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    enforce_rate_limit(request, "watchlist_mutation", 30, user_id=user.id)
    row = db.scalar(select(Watchlist).join(Player).where(Watchlist.user_id == user.id, Player.symbol == symbol.upper()))
    if not row:
        raise HTTPException(404, "Watchlist entry not found")
    db.delete(row)
    db.commit()


@app.get("/api/v1/notifications", response_model=list[NotificationOut])
def notifications(limit: int = Query(default=50, ge=1, le=200), offset: int = Query(default=0, ge=0), user: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Notification).where(Notification.user_id == user.id).order_by(Notification.id.desc()).limit(limit).offset(offset)).all()


@app.post("/api/v1/notifications/{notification_id}/read", response_model=NotificationOut)
def mark_read(notification_id: int, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    enforce_rate_limit(request, "notification_mutation", 60, user_id=user.id)
    row = db.scalar(select(Notification).where(Notification.id == notification_id, Notification.user_id == user.id))
    if not row:
        raise HTTPException(404, "Notification not found")
    row.read = True
    db.commit()
    db.refresh(row)
    return row


@app.get("/api/v1/admin/users", response_model=list[AdminUserOut])
def admin_users(search: str | None = Query(default=None, max_length=120), limit: int = Query(default=50, ge=1, le=100), offset: int = Query(default=0, ge=0), _admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    query = select(User, Wallet).join(Wallet, Wallet.user_id == User.id).order_by(User.created_at.desc()).limit(limit).offset(offset)
    if search:
        term = f"%{search.strip().lower()}%"
        query = query.where(func.lower(User.email).like(term) | func.lower(func.coalesce(User.username, "")).like(term))
    return [AdminUserOut(id=u.id, email=u.email, username=u.username, account_status=u.account_status, role=u.role, created_at=u.created_at, signup_bonus_awarded=bool(u.signup_bonus_awarded_at), wallet_gold=w.gold, wallet_silver=w.silver) for u, w in db.execute(query).all()]


@app.patch("/api/v1/admin/users/{user_id}/status", response_model=AdminUserOut)
def admin_update_status(user_id: int, body: AdminStatusIn, request: Request, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    enforce_rate_limit(request, "admin_status", 30, user_id=admin.id)
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(404, "User not found")
    if target.id == admin.id and body.account_status == "suspended":
        raise HTTPException(400, "Administrators cannot suspend their own account")
    target.account_status = body.account_status
    db.add(AuditLog(actor_user_id=admin.id, target_user_id=target.id, action=f"user_status_{body.account_status}", details={"account_status": body.account_status}))
    db.commit()
    db.refresh(target)
    wallet = _wallet_or_error(db, target.id)
    return AdminUserOut(id=target.id, email=target.email, username=target.username, account_status=target.account_status, role=target.role, created_at=target.created_at, signup_bonus_awarded=bool(target.signup_bonus_awarded_at), wallet_gold=wallet.gold, wallet_silver=wallet.silver)


@app.get("/api/v1/admin/audit")
def admin_audit(limit: int = Query(default=50, ge=1, le=100), offset: int = Query(default=0, ge=0), _admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    return db.scalars(select(AuditLog).order_by(AuditLog.id.desc()).limit(limit).offset(offset)).all()


@app.post("/api/v1/admin/catalog/import", response_model=CatalogImportOut)
def import_catalog(body: CatalogImportIn, request: Request, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    enforce_rate_limit(request, "catalog_import", 10, user_id=admin.id)
    normalized_symbols = [record.symbol.upper() for record in body.records]
    if len(normalized_symbols) != len(set(normalized_symbols)):
        raise HTTPException(400, "Catalog contains duplicate symbols")
    created = updated = 0
    for record, symbol in zip(body.records, normalized_symbols):
        player = db.scalar(select(Player).where(Player.symbol == symbol))
        if player is None:
            player = Player(symbol=symbol, name=record.name, league=record.league, club=record.club, active=record.active)
            db.add(player)
            db.flush()
            db.add(MarketPrice(player_id=player.id, bid=record.bid, ask=record.ask, source=body.source, updated_at=datetime.now(timezone.utc)))
            created += 1
            continue
        player.name, player.league, player.club, player.active = record.name, record.league, record.club, record.active
        price = db.scalar(select(MarketPrice).where(MarketPrice.player_id == player.id))
        if price is None:
            db.add(MarketPrice(player_id=player.id, bid=record.bid, ask=record.ask, source=body.source, updated_at=datetime.now(timezone.utc)))
        else:
            price.bid, price.ask, price.source, price.updated_at = record.bid, record.ask, body.source, datetime.now(timezone.utc)
        updated += 1
    db.add(AuditLog(actor_user_id=admin.id, action="catalog_import", details={"source": body.source, "records": len(body.records), "created": created, "updated": updated}))
    db.commit()
    return CatalogImportOut(source=body.source, created=created, updated=updated, total=len(body.records))
