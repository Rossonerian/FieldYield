from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.api.deps import current_user, verified_user
from app.core.config import settings
from app.core.database import Base, engine, get_db
from app.core.security import create_access_token
from app.models import ActiveSquad, Holding, MarketPrice, Notification, Order, Player, User, Wallet, WalletTransaction
from app.schemas import AgeVerificationIn, CreditIn, LoginIn, OrderIn, RegisterIn, SquadPlayerIn
from app.services import age_ok, authenticate, credit, order, register, seed_players

@asynccontextmanager
async def lifespan(app):
    Base.metadata.create_all(engine)
    with Session(engine) as db: seed_players(db)
    yield

app = FastAPI(title="FieldYield Exchange API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health(): return {"status": "ok"}

@app.post("/api/v1/auth/register")
def register_user(body: RegisterIn, db: Session = Depends(get_db)):
    return {"id": register(db, body.email, body.password, body.date_of_birth).id, "email": body.email}

@app.post("/api/v1/auth/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    return {"access_token": create_access_token(str(authenticate(db, body.email, body.password).id)), "token_type": "bearer"}

@app.post("/api/v1/auth/token")
def token(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    return {"access_token": create_access_token(str(authenticate(db, form.username, form.password).id)), "token_type": "bearer"}

@app.get("/api/v1/users/me")
def me(user: User = Depends(current_user)): return {"id": user.id, "email": user.email, "age_verified": user.age_verified}

@app.post("/api/v1/users/verify-age")
def verify_age(body: AgeVerificationIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not age_ok(body.date_of_birth): raise HTTPException(400, "User must be 18 or older")
    user.age_verified = True; user.date_of_birth = body.date_of_birth; db.commit(); return {"age_verified": True}

@app.post("/api/v1/wallet/credit")
def wallet_credit(body: CreditIn, user: User = Depends(verified_user), db: Session = Depends(get_db)):
    credit(db, user, body.currency, body.amount, body.idempotency_key); return wallet_view(user, db)

@app.get("/api/v1/wallet")
def wallet_view(user: User = Depends(current_user), db: Session = Depends(get_db)):
    wallet = db.scalar(select(Wallet).where(Wallet.user_id == user.id)); return {"gold": wallet.gold, "silver": wallet.silver}

@app.get("/api/v1/wallet/ledger")
def ledger(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.scalars(select(WalletTransaction).where(WalletTransaction.user_id == user.id).order_by(WalletTransaction.id.desc())).all()

@app.post("/api/v1/trading/orders/market-buy")
def buy(body: OrderIn, user: User = Depends(verified_user), db: Session = Depends(get_db)): return order(db, user, "BUY", body.symbol, body.quantity, body.idempotency_key)

@app.post("/api/v1/trading/orders/market-sell")
def sell(body: OrderIn, user: User = Depends(verified_user), db: Session = Depends(get_db)): return order(db, user, "SELL", body.symbol, body.quantity, body.idempotency_key)

@app.get("/api/v1/trading/orders")
def orders(user: User = Depends(current_user), db: Session = Depends(get_db)): return db.scalars(select(Order).where(Order.user_id == user.id).order_by(Order.id.desc())).all()

@app.get("/api/v1/portfolio")
def portfolio(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.execute(select(Holding, Player, MarketPrice).join(Player, Holding.player_id == Player.id).join(MarketPrice, MarketPrice.player_id == Player.id).where(Holding.user_id == user.id, Holding.quantity > 0)).all()
    value = sum((h.quantity * p.bid for h, _, p in rows), 0); cost = sum((h.quantity * h.average_cost for h, _, _ in rows), 0)
    return {"market_value": value, "cost_basis": cost, "unrealized_pnl": value - cost, "realized_pnl": sum((h.realized_pnl for h, _, _ in rows), 0)}

@app.get("/api/v1/portfolio/holdings")
def holdings(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.execute(select(Holding, Player).join(Player, Holding.player_id == Player.id).where(Holding.user_id == user.id, Holding.quantity > 0)).all()

@app.get("/api/v1/squad")
def squad(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.execute(select(ActiveSquad, Player).join(Player, ActiveSquad.player_id == Player.id).where(ActiveSquad.user_id == user.id).order_by(ActiveSquad.position)).all()

@app.post("/api/v1/squad/promote")
def promote(body: SquadPlayerIn, user: User = Depends(verified_user), db: Session = Depends(get_db)):
    player = db.scalar(select(Player).where(Player.symbol == body.symbol.upper())); holding = db.scalar(select(Holding).where(Holding.user_id == user.id, Holding.player_id == player.id))
    if not holding or holding.quantity <= 0: raise HTTPException(400, "Player is not held")
    if db.query(ActiveSquad).filter_by(user_id=user.id).count() >= 25: raise HTTPException(400, "Active squad cap of 25 exceeded")
    if db.scalar(select(ActiveSquad).where(ActiveSquad.user_id == user.id, ActiveSquad.player_id == player.id)): return {"status": "already_active"}
    db.add(ActiveSquad(user_id=user.id, player_id=player.id, position=db.query(ActiveSquad).filter_by(user_id=user.id).count() + 1)); db.commit(); return {"status": "active"}

@app.post("/api/v1/squad/demote")
def demote(body: SquadPlayerIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = db.scalar(select(ActiveSquad).join(Player).where(ActiveSquad.user_id == user.id, Player.symbol == body.symbol.upper()))
    if not row: raise HTTPException(404, "Player is not active")
    db.delete(row); db.commit(); return {"status": "inactive"}

@app.get("/api/v1/sports/players")
def players(db: Session = Depends(get_db)): return db.scalars(select(Player).where(Player.league == "EPL")).all()

@app.post("/api/v1/sports/ingest")
def ingest(db: Session = Depends(get_db)): seed_players(db); return {"status": "ingested"}

@app.get("/api/v1/market/prices")
def prices(db: Session = Depends(get_db)):
    return db.execute(select(Player.symbol, Player.name, MarketPrice.bid, MarketPrice.ask, MarketPrice.updated_at).join(MarketPrice, MarketPrice.player_id == Player.id)).mappings().all()

@app.get("/api/v1/notifications")
def notifications(user: User = Depends(current_user), db: Session = Depends(get_db)): return db.scalars(select(Notification).where(Notification.user_id == user.id).order_by(Notification.id.desc())).all()

@app.post("/api/v1/notifications/{notification_id}/read")
def mark_read(notification_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = db.scalar(select(Notification).where(Notification.id == notification_id, Notification.user_id == user.id))
    if not row: raise HTTPException(404, "Notification not found")
    row.read = True; db.commit(); return row
