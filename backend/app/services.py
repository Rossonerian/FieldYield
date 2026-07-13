from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.core.security import hash_password, verify_password
from app.models import ActiveSquad, Holding, MarketPrice, Notification, Order, OrderMatch, Player, User, Wallet, WalletTransaction

def now(): return datetime.now(timezone.utc)

SEED_PLAYERS = [("HA9", "Erling Haaland", "Manchester City", Decimal("120.00")), ("SA7", "Bukayo Saka", "Arsenal", Decimal("95.00")), ("WI11", "Florian Wirtz", "Liverpool", Decimal("88.00"))]

def seed_players(db: Session):
    if db.scalar(select(Player).limit(1)): return
    for symbol, name, club, price in SEED_PLAYERS:
        player = Player(symbol=symbol, name=name, club=club, league="EPL")
        db.add(player); db.flush(); db.add(MarketPrice(player_id=player.id, bid=price - 2, ask=price + 2))
    db.commit()

def age_ok(dob):
    today = datetime.now(timezone.utc).date(); birth = dob.date()
    return (today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))) >= 18

def register(db, email, password, dob, username=None, first_name=None, last_name=None):
    if db.scalar(select(User).where(User.email == email)): raise HTTPException(409, "Email already registered")
    if not age_ok(dob): raise HTTPException(400, "User must be 18 or older")
    if username and db.scalar(select(User).where(User.username == username.lower())):
        raise HTTPException(409, "Username already registered")
    user = User(email=email.lower(), username=username.lower() if username else None, first_name=first_name, last_name=last_name,
                password_hash=hash_password(password), date_of_birth=dob, age_verified=True)
    db.add(user); db.flush(); wallet = Wallet(user_id=user.id); db.add(wallet); db.flush()
    from app.core.config import settings
    if settings.signup_bonus_enabled and (settings.signup_bonus_gold or settings.signup_bonus_silver):
        wallet = db.scalar(select(Wallet).where(Wallet.user_id == user.id).with_for_update())
        if settings.signup_bonus_gold:
            wallet.gold = settings.signup_bonus_gold
            db.add(WalletTransaction(user_id=user.id, currency="gold", amount=settings.signup_bonus_gold, reason="signup_bonus", idempotency_key=f"signup_bonus:{user.id}:gold"))
        if settings.signup_bonus_silver:
            wallet.silver = settings.signup_bonus_silver
            db.add(WalletTransaction(user_id=user.id, currency="silver", amount=settings.signup_bonus_silver, reason="signup_bonus", idempotency_key=f"signup_bonus:{user.id}:silver"))
        user.signup_bonus_awarded_at = now()
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Account details are already registered")
    db.refresh(user); return user

def authenticate(db, email, password):
    user = db.scalar(select(User).where(User.email == email))
    if not user or not verify_password(password, user.password_hash): raise HTTPException(401, "Invalid credentials")
    return user

def notify(db, user_id, kind, message): db.add(Notification(user_id=user_id, kind=kind, message=message))

def credit(db, user, currency, amount, key=None):
    currency = currency.lower()
    if currency not in ("gold", "silver"): raise HTTPException(400, "Currency must be Gold or Silver")
    if key and db.scalar(select(WalletTransaction).where(WalletTransaction.idempotency_key == key)): return
    wallet = db.scalar(select(Wallet).where(Wallet.user_id == user.id).with_for_update())
    setattr(wallet, currency, getattr(wallet, currency) + amount)
    db.add(WalletTransaction(user_id=user.id, currency=currency, amount=amount, reason="test_credit", idempotency_key=key))
    notify(db, user.id, "wallet_credit", f"Credited {amount} {currency.title()}"); db.commit()

def order(db, user, side, symbol, quantity, key=None):
    if key:
        prior = db.scalar(select(Order).where(Order.idempotency_key == key))
        if prior: return prior
    player = db.scalar(select(Player).where(Player.symbol == symbol.upper(), Player.league == "EPL", Player.active.is_(True)))
    if not player: raise HTTPException(400, "Only active EPL players can be traded")
    price = db.scalar(select(MarketPrice).where(MarketPrice.player_id == player.id).with_for_update())
    wallet = db.scalar(select(Wallet).where(Wallet.user_id == user.id).with_for_update())
    holding = db.scalar(select(Holding).where(Holding.user_id == user.id, Holding.player_id == player.id).with_for_update())
    order_row = Order(user_id=user.id, player_id=player.id, side=side, quantity=quantity, idempotency_key=key)
    db.add(order_row); db.flush()
    unit = price.ask if side == "BUY" else price.bid; total = unit * quantity
    try:
        if side == "BUY":
            active_count = db.scalar(select(ActiveSquad).where(ActiveSquad.user_id == user.id).count()) if False else db.query(ActiveSquad).filter_by(user_id=user.id).count()
            if not holding and active_count >= 25: raise ValueError("Active squad cap of 25 exceeded")
            if wallet.gold < total: raise ValueError("Insufficient Gold balance")
            wallet.gold -= total
            if not holding: holding = Holding(user_id=user.id, player_id=player.id, quantity=0, average_cost=0); db.add(holding)
            holding.average_cost = ((holding.average_cost * holding.quantity) + total) / (holding.quantity + quantity)
            holding.quantity += quantity
        else:
            if not holding or holding.quantity < quantity: raise ValueError("Insufficient holdings")
            wallet.gold += total; holding.realized_pnl += (unit - holding.average_cost) * quantity; holding.quantity -= quantity
        db.add(OrderMatch(order_id=order_row.id, quantity=quantity, price=unit))
        db.add(WalletTransaction(user_id=user.id, currency="gold", amount=-total if side == "BUY" else total, reason=f"{side.lower()}_execution", idempotency_key=f"order:{order_row.id}"))
        order_row.status = "FILLED"; notify(db, user.id, "order_filled", f"{side.title()} {quantity} {player.name} at {unit} Gold")
    except ValueError as exc:
        order_row.status = "REJECTED"; order_row.failure_reason = str(exc); notify(db, user.id, "order_failed", str(exc))
    db.commit(); db.refresh(order_row); return order_row
