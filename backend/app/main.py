from contextlib import asynccontextmanager
import logging
import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.api.deps import admin_user, current_user, supabase_identity, verified_user, oauth2
from app.core.config import settings
from app.core.database import Base, engine, get_db
from app.core.security import create_access_token
from app.models import ActiveSquad, AuditLog, Holding, MarketPrice, Notification, Order, Player, User, Wallet, WalletTransaction, Watchlist
from app.schemas import AdminStatusIn, AdminUserOut, AgeVerificationIn, CatalogImportIn, CatalogImportOut, CreditIn, HoldingOut, LoginIn, MarketPlayerOut, OrderIn, OrderOut, ProfileSummaryOut, ProfileUpdateIn, RegisterIn, SquadOut, SquadPlayerIn, SupabaseSyncIn, UserProfileOut, WalletOut, WalletTransactionOut, WatchlistIn, WatchlistOut
from app.services import age_ok, authenticate, credit, order, register, sync_supabase_user
from app.integrations.market_engine import MarketEngineUnavailable, market_engine

logger = logging.getLogger("fieldyield.api")

@asynccontextmanager
async def lifespan(app):
    Base.metadata.create_all(engine)
    yield

app = FastAPI(title="FieldYield Exchange API", version="1.0.0", lifespan=lifespan)
print("CORS allowed origin:", settings.frontend_url)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    response = await call_next(request)
    logger.info("%s %s -> %s", request.method, request.url, response.status_code)
    return response

@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers={
            "Access-Control-Allow-Origin": settings.frontend_url,
            "Access-Control-Allow-Credentials": "true",
        },
    )

@app.exception_handler(Exception)
async def global_exception_handler(_request: Request, _exc: Exception):
    logger.exception("Unhandled API exception")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"},
        headers={
            "Access-Control-Allow-Origin": settings.frontend_url,
            "Access-Control-Allow-Credentials": "true",
        },
    )

@app.get("/health")
def health():
    database = "ok"
    try:
        with engine.connect() as connection:
            connection.exec_driver_sql("SELECT 1")
    except Exception:
        database = "error"
    market = "not_configured"
    if market_engine.enabled:
        try:
            market_engine.health()
            market = "ok"
        except MarketEngineUnavailable:
            market = "unavailable"
    supabase = "not_configured"
    if settings.supabase_url and settings.supabase_anon_key:
        try:
            response = httpx.get(f"{settings.supabase_url.rstrip('/')}/auth/v1/settings", headers={"apikey": settings.supabase_anon_key}, timeout=1.5)
            supabase = "ok" if response.is_success else "unavailable"
        except httpx.HTTPError:
            supabase = "unavailable"
    auth = settings.effective_auth_provider
    auth_ready = auth != "supabase" or supabase == "ok"
    return {"status": "ok" if database == "ok" and auth_ready else "degraded", "database": database, "supabase": supabase, "auth_provider": auth, "market_engine": market, "version": app.version}

@app.get("/api/v1/market-engine/health")
def market_engine_health():
    if not market_engine.enabled:
        return {"configured": False, "status": "not_configured"}
    try:
        return {"configured": True, "status": "ok", "detail": market_engine.health()}
    except MarketEngineUnavailable:
        raise HTTPException(503, "Market Engine is unavailable")

@app.post("/api/v1/auth/register")
def register_user(body: RegisterIn, db: Session = Depends(get_db)):
    if settings.effective_auth_provider == "supabase":
        raise HTTPException(410, "Use Supabase Auth for registration")
    user = register(db, body.email, body.password, body.date_of_birth, body.username, body.first_name, body.last_name)
    return {"id": user.id, "email": user.email, "signup_bonus_awarded": bool(user.signup_bonus_awarded_at)}

@app.post("/api/v1/auth/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    if settings.effective_auth_provider == "supabase":
        raise HTTPException(410, "Use Supabase Auth for login")
    user = authenticate(db, body.email, body.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"access_token": create_access_token(str(user.id)), "token_type": "bearer"}

@app.post("/api/v1/auth/token")
def token(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    if settings.effective_auth_provider == "supabase":
        raise HTTPException(410, "Use Supabase Auth for login")
    user = authenticate(db, form.username, form.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"access_token": create_access_token(str(user.id)), "token_type": "bearer"}

@app.post("/api/v1/auth/supabase-sync")
def supabase_sync(body: SupabaseSyncIn, token: str | None = Depends(oauth2), db: Session = Depends(get_db)):
    if settings.effective_auth_provider != "supabase":
        raise HTTPException(410, "Supabase Auth is not enabled for this deployment")
    identity = supabase_identity(token or "")
    if not identity:
        raise HTTPException(401, "Valid Supabase session required")
    user = sync_supabase_user(db, provider_id=str(identity["id"]), provider=str(identity["provider"]), email=str(identity["email"]), date_of_birth=body.date_of_birth, username=body.username, first_name=body.first_name, last_name=body.last_name)
    return profile_view(user)

@app.get("/api/v1/users/me")
def me(user: User = Depends(current_user)) -> UserProfileOut:
    return profile_view(user)

@app.patch("/api/v1/users/me")
def update_me(body: ProfileUpdateIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> UserProfileOut:
    if body.username is not None:
        normalized = body.username.lower()
        existing = db.scalar(select(User).where(User.username == normalized, User.id != user.id))
        if existing: raise HTTPException(409, "Username already registered")
        user.username = normalized
    for field in ("first_name", "last_name", "country", "avatar_url", "preferred_currency", "preferences"):
        value = getattr(body, field)
        if value is not None: setattr(user, field, value)
    db.commit(); db.refresh(user); return profile_view(user)

@app.get("/api/v1/users/me/profile")
def profile(user: User = Depends(current_user)) -> UserProfileOut: return profile_view(user)

@app.get("/api/v1/users/me/summary")
def profile_summary(user: User = Depends(current_user), db: Session = Depends(get_db)) -> ProfileSummaryOut:
    wallet = db.scalar(select(Wallet).where(Wallet.user_id == user.id))
    rows = db.execute(select(Holding, MarketPrice).join(MarketPrice, MarketPrice.player_id == Holding.player_id).where(Holding.user_id == user.id, Holding.quantity > 0)).all()
    value = sum((holding.quantity * price.bid for holding, price in rows), 0)
    cost = sum((holding.quantity * holding.average_cost for holding, _ in rows), 0)
    return ProfileSummaryOut(gold=float(wallet.gold), silver=float(wallet.silver), holdings_count=len(rows), portfolio_market_value=float(value), portfolio_cost_basis=float(cost), unrealized_pnl=float(value-cost), realized_pnl=float(sum((holding.realized_pnl for holding, _ in rows), 0)), orders_count=db.scalar(select(func.count(Order.id)).where(Order.user_id == user.id)) or 0, transactions_count=db.scalar(select(func.count(WalletTransaction.id)).where(WalletTransaction.user_id == user.id)) or 0, unread_notifications=db.scalar(select(func.count(Notification.id)).where(Notification.user_id == user.id, Notification.read.is_(False))) or 0)

def profile_view(user: User) -> UserProfileOut:
    role = "admin" if user.role == "admin" or user.email.lower() in settings.configured_admin_emails else user.role
    return UserProfileOut(id=user.id, email=user.email, username=user.username, first_name=user.first_name, last_name=user.last_name, country=user.country, avatar_url=user.avatar_url, date_of_birth=user.date_of_birth, age_verified=user.age_verified, created_at=user.created_at, updated_at=user.updated_at or user.created_at, account_status=user.account_status, role=role, auth_provider=user.auth_provider, preferred_currency=user.preferred_currency, preferences=user.preferences or {}, signup_bonus_awarded=bool(user.signup_bonus_awarded_at))

@app.post("/api/v1/users/verify-age")
def verify_age(body: AgeVerificationIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not age_ok(body.date_of_birth): raise HTTPException(400, "User must be 18 or older")
    user.age_verified = True; user.date_of_birth = body.date_of_birth; db.commit(); return {"age_verified": True}

@app.post("/api/v1/wallet/credit")
def wallet_credit(body: CreditIn, user: User = Depends(verified_user), db: Session = Depends(get_db)):
    if not settings.allow_test_credit and "test_fieldyield" not in settings.database_url:
        raise HTTPException(404, "Wallet credit endpoint is disabled")
    credit(db, user, body.currency, body.amount, body.idempotency_key); return wallet_view(user=user, db=db)

@app.get("/api/v1/wallet")
def wallet_view(user: User = Depends(current_user), db: Session = Depends(get_db)) -> WalletOut:
    wallet = db.scalar(select(Wallet).where(Wallet.user_id == user.id)); return WalletOut(gold=float(wallet.gold), silver=float(wallet.silver))

@app.get("/api/v1/wallet/ledger", response_model=list[WalletTransactionOut])
def ledger(limit: int = Query(default=50, ge=1, le=200), offset: int = Query(default=0, ge=0), user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(WalletTransaction).where(WalletTransaction.user_id == user.id).order_by(WalletTransaction.id.desc()).limit(limit).offset(offset)).all()
    return [WalletTransactionOut(id=row.id, currency=row.currency, amount=row.amount, reason=row.reason, created_at=row.created_at) for row in rows]

@app.post("/api/v1/trading/orders/market-buy")
def buy(body: OrderIn, user: User = Depends(verified_user), db: Session = Depends(get_db)): return order(db, user, "BUY", body.symbol, body.quantity, body.idempotency_key)

@app.post("/api/v1/trading/orders/market-sell")
def sell(body: OrderIn, user: User = Depends(verified_user), db: Session = Depends(get_db)): return order(db, user, "SELL", body.symbol, body.quantity, body.idempotency_key)

@app.get("/api/v1/trading/orders", response_model=list[OrderOut])
def orders(limit: int = Query(default=50, ge=1, le=200), offset: int = Query(default=0, ge=0), user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Order).where(Order.user_id == user.id).order_by(Order.id.desc()).limit(limit).offset(offset)).all()
    return [OrderOut(id=row.id, player_id=row.player_id, side=row.side, quantity=row.quantity, status=row.status, failure_reason=row.failure_reason, created_at=row.created_at) for row in rows]

@app.get("/api/v1/portfolio")
def portfolio(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.execute(select(Holding, Player, MarketPrice).join(Player, Holding.player_id == Player.id).join(MarketPrice, MarketPrice.player_id == Player.id).where(Holding.user_id == user.id, Holding.quantity > 0)).all()
    value = sum((h.quantity * p.bid for h, _, p in rows), 0); cost = sum((h.quantity * h.average_cost for h, _, _ in rows), 0)
    return {"market_value": value, "cost_basis": cost, "unrealized_pnl": value - cost, "realized_pnl": sum((h.realized_pnl for h, _, _ in rows), 0)}

@app.get("/api/v1/portfolio/holdings", response_model=list[HoldingOut])
def holdings(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.execute(select(Holding, Player, MarketPrice).join(Player, Holding.player_id == Player.id).join(MarketPrice, MarketPrice.player_id == Player.id).where(Holding.user_id == user.id, Holding.quantity > 0).limit(500)).all()
    return [HoldingOut(symbol=player.symbol, name=player.name, league=player.league, club=player.club, quantity=holding.quantity, average_cost=holding.average_cost, realized_pnl=holding.realized_pnl, market_price=price.bid, market_value=holding.quantity * price.bid) for holding, player, price in rows]

@app.get("/api/v1/squad", response_model=list[SquadOut])
def squad(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.execute(select(ActiveSquad, Player).join(Player, ActiveSquad.player_id == Player.id).where(ActiveSquad.user_id == user.id).order_by(ActiveSquad.position)).all()
    return [SquadOut(id=entry.id, player_id=entry.player_id, position=entry.position, symbol=player.symbol, name=player.name, club=player.club, league=player.league) for entry, player in rows]

@app.post("/api/v1/squad/promote")
def promote(body: SquadPlayerIn, user: User = Depends(verified_user), db: Session = Depends(get_db)):
    player = db.scalar(select(Player).where(Player.symbol == body.symbol.upper()))
    if not player: raise HTTPException(404, "Player not found")
    holding = db.scalar(select(Holding).where(Holding.user_id == user.id, Holding.player_id == player.id))
    if not holding or holding.quantity <= 0: raise HTTPException(400, "Player is not held")
    if db.query(ActiveSquad).filter_by(user_id=user.id).count() >= 25: raise HTTPException(400, "Active squad cap of 25 exceeded")
    if db.scalar(select(ActiveSquad).where(ActiveSquad.user_id == user.id, ActiveSquad.player_id == player.id)): return {"status": "already_active"}
    db.add(ActiveSquad(user_id=user.id, player_id=player.id, position=db.query(ActiveSquad).filter_by(user_id=user.id).count() + 1)); db.commit(); return {"status": "active"}

@app.post("/api/v1/squad/demote")
def demote(body: SquadPlayerIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = db.scalar(select(ActiveSquad).join(Player).where(ActiveSquad.user_id == user.id, Player.symbol == body.symbol.upper()))
    if not row: raise HTTPException(404, "Player is not active")
    db.delete(row); db.commit(); return {"status": "inactive"}

@app.get("/api/v1/sports/trading-players")
def players(db: Session = Depends(get_db)): return db.scalars(select(Player).where(Player.active.is_(True)).limit(500)).all()


@app.get("/api/v1/market/prices", response_model=list[MarketPlayerOut])
def prices(db: Session = Depends(get_db)):
    rows = db.execute(select(Player, MarketPrice).join(MarketPrice, MarketPrice.player_id == Player.id).where(Player.active.is_(True)).order_by(Player.name).limit(500)).all()
    return [MarketPlayerOut(symbol=player.symbol, name=player.name, league=player.league, club=player.club, active=player.active, bid=price.bid, ask=price.ask, updated_at=price.updated_at, source=price.source) for player, price in rows]

@app.get("/api/v1/watchlists", response_model=list[WatchlistOut])
def watchlists(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.execute(select(Watchlist, Player, MarketPrice).join(Player, Watchlist.player_id == Player.id).join(MarketPrice, MarketPrice.player_id == Player.id).where(Watchlist.user_id == user.id).order_by(Watchlist.created_at.desc()).limit(200)).all()
    return [WatchlistOut(id=w.id, symbol=p.symbol, name=p.name, league=p.league, club=p.club, bid=price.bid, ask=price.ask, updated_at=price.updated_at, created_at=w.created_at) for w, p, price in rows]

@app.post("/api/v1/watchlists", response_model=WatchlistOut, status_code=201)
def add_watchlist(body: WatchlistIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    player = db.scalar(select(Player).where(Player.symbol == body.symbol.upper(), Player.active.is_(True)))
    if not player: raise HTTPException(404, "Player not found")
    existing = db.scalar(select(Watchlist).where(Watchlist.user_id == user.id, Watchlist.player_id == player.id))
    if existing: raise HTTPException(409, "Player is already on your watchlist")
    row = Watchlist(user_id=user.id, player_id=player.id); db.add(row); db.commit(); db.refresh(row)
    price = db.scalar(select(MarketPrice).where(MarketPrice.player_id == player.id))
    return WatchlistOut(id=row.id, symbol=player.symbol, name=player.name, league=player.league, club=player.club, bid=price.bid, ask=price.ask, updated_at=price.updated_at, created_at=row.created_at)

@app.delete("/api/v1/watchlists/{symbol}", status_code=204)
def remove_watchlist(symbol: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = db.scalar(select(Watchlist).join(Player).where(Watchlist.user_id == user.id, Player.symbol == symbol.upper()))
    if not row: raise HTTPException(404, "Watchlist entry not found")
    db.delete(row); db.commit()

@app.get("/api/v1/notifications")
def notifications(limit: int = Query(default=50, ge=1, le=200), offset: int = Query(default=0, ge=0), user: User = Depends(current_user), db: Session = Depends(get_db)): return db.scalars(select(Notification).where(Notification.user_id == user.id).order_by(Notification.id.desc()).limit(limit).offset(offset)).all()

@app.post("/api/v1/notifications/{notification_id}/read")
def mark_read(notification_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = db.scalar(select(Notification).where(Notification.id == notification_id, Notification.user_id == user.id))
    if not row: raise HTTPException(404, "Notification not found")
    row.read = True; db.commit(); return row


@app.get("/api/v1/admin/users", response_model=list[AdminUserOut])
def admin_users(search: str | None = Query(default=None, max_length=120), limit: int = Query(default=50, ge=1, le=100), offset: int = Query(default=0, ge=0), _admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    query = select(User, Wallet).join(Wallet, Wallet.user_id == User.id).order_by(User.created_at.desc()).limit(limit).offset(offset)
    if search:
        term = f"%{search.strip().lower()}%"
        query = query.where(func.lower(User.email).like(term) | func.lower(func.coalesce(User.username, "")).like(term))
    rows = db.execute(query).all()
    return [AdminUserOut(id=user.id, email=user.email, username=user.username, account_status=user.account_status, role=user.role, created_at=user.created_at, signup_bonus_awarded=bool(user.signup_bonus_awarded_at), wallet_gold=wallet.gold, wallet_silver=wallet.silver) for user, wallet in rows]


@app.patch("/api/v1/admin/users/{user_id}/status", response_model=AdminUserOut)
def admin_update_status(user_id: int, body: AdminStatusIn, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(404, "User not found")
    if target.id == admin.id and body.account_status == "suspended":
        raise HTTPException(400, "Administrators cannot suspend their own account")
    target.account_status = body.account_status
    db.add(AuditLog(actor_user_id=admin.id, target_user_id=target.id, action=f"user_status_{body.account_status}", details={"account_status": body.account_status}))
    db.commit(); db.refresh(target)
    wallet = db.scalar(select(Wallet).where(Wallet.user_id == target.id))
    return AdminUserOut(id=target.id, email=target.email, username=target.username, account_status=target.account_status, role=target.role, created_at=target.created_at, signup_bonus_awarded=bool(target.signup_bonus_awarded_at), wallet_gold=wallet.gold, wallet_silver=wallet.silver)


@app.get("/api/v1/admin/audit")
def admin_audit(limit: int = Query(default=50, ge=1, le=100), offset: int = Query(default=0, ge=0), _admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    return db.scalars(select(AuditLog).order_by(AuditLog.id.desc()).limit(limit).offset(offset)).all()


@app.post("/api/v1/admin/catalog/import", response_model=CatalogImportOut)
def import_catalog(body: CatalogImportIn, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    normalized_symbols = [record.symbol.strip().upper() for record in body.records]
    if len(normalized_symbols) != len(set(normalized_symbols)):
        raise HTTPException(400, "Catalog contains duplicate symbols")
    created = updated = 0
    for record, symbol in zip(body.records, normalized_symbols):
        player = db.scalar(select(Player).where(Player.symbol == symbol))
        if player is None:
            player = Player(symbol=symbol, name=record.name, league=record.league, club=record.club, active=record.active)
            db.add(player)
            db.flush()
            db.add(MarketPrice(player_id=player.id, bid=record.bid, ask=record.ask, source=body.source))
            created += 1
            continue
        player.name, player.league, player.club, player.active = record.name, record.league, record.club, record.active
        price = db.scalar(select(MarketPrice).where(MarketPrice.player_id == player.id))
        if price is None:
            db.add(MarketPrice(player_id=player.id, bid=record.bid, ask=record.ask, source=body.source))
        else:
            price.bid, price.ask, price.source = record.bid, record.ask, body.source
        updated += 1
    db.add(AuditLog(actor_user_id=admin.id, action="catalog_import", details={"source": body.source, "records": len(body.records), "created": created, "updated": updated}))
    db.commit()
    return CatalogImportOut(source=body.source, created=created, updated=updated, total=len(body.records))
