from __future__ import annotations

import logging
import secrets
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.metrics import record_metric
from app.core.security import hash_password, verify_password
from app.models import (
    ActiveSquad,
    Holding,
    MarketPrice,
    Notification,
    Order,
    OrderMatch,
    Player,
    SignupBonusGrant,
    User,
    Wallet,
    WalletTransaction,
)

logger = logging.getLogger("fieldyield.transactions")
ZERO = Decimal("0")


def now() -> datetime:
    return datetime.now(timezone.utc)


def age_ok(dob: datetime) -> bool:
    today = now().date()
    birth = dob.date()
    return (today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))) >= 18


def register(db: Session, email: str, password: str, dob: datetime, username=None, first_name=None, last_name=None):
    normalized_email = email.strip().lower()
    if db.scalar(select(User).where(func.lower(User.email) == normalized_email)):
        raise HTTPException(409, "Email already registered")
    if not age_ok(dob):
        raise HTTPException(400, "User must be 18 or older")
    normalized_username = username.lower() if username else None
    if normalized_username and db.scalar(select(User).where(User.username == normalized_username)):
        raise HTTPException(409, "Username already registered")
    user = User(
        email=normalized_email,
        username=normalized_username,
        first_name=first_name,
        last_name=last_name,
        role="admin" if normalized_email in settings.configured_admin_emails else "user",
        password_hash=hash_password(password),
        date_of_birth=dob,
        age_verified=True,
    )
    db.add(user)
    db.flush()
    wallet = Wallet(user_id=user.id)
    db.add(wallet)
    db.flush()
    _grant_signup_bonus(db, user, wallet)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Account details are already registered") from exc
    db.refresh(user)
    return user


def _grant_signup_bonus(db: Session, user: User, wallet: Wallet) -> bool:
    if not settings.signup_bonus_enabled or not (settings.signup_bonus_gold or settings.signup_bonus_silver):
        return False
    wallet = db.scalar(select(Wallet).where(Wallet.user_id == user.id).with_for_update()) or wallet
    grant_key = f"signup_bonus:{user.id}"
    if db.scalar(select(SignupBonusGrant).where(SignupBonusGrant.user_id == user.id)):
        user.signup_bonus_awarded_at = user.signup_bonus_awarded_at or now()
        return False
    db.add(
        SignupBonusGrant(
            user_id=user.id,
            gold_amount=settings.signup_bonus_gold,
            silver_amount=settings.signup_bonus_silver,
            idempotency_key=grant_key,
        )
    )
    if settings.signup_bonus_gold:
        wallet.gold += settings.signup_bonus_gold
        db.add(
            WalletTransaction(
                user_id=user.id,
                currency="gold",
                amount=settings.signup_bonus_gold,
                reason="signup_bonus",
                idempotency_key=f"signup_bonus:{user.id}:gold",
            )
        )
    if settings.signup_bonus_silver:
        wallet.silver += settings.signup_bonus_silver
        db.add(
            WalletTransaction(
                user_id=user.id,
                currency="silver",
                amount=settings.signup_bonus_silver,
                reason="signup_bonus",
                idempotency_key=f"signup_bonus:{user.id}:silver",
            )
        )
    user.signup_bonus_awarded_at = now()
    return True


def sync_supabase_user(
    db: Session,
    *,
    provider_id: str,
    provider: str,
    email: str,
    date_of_birth: datetime | None = None,
    username: str | None = None,
    first_name: str | None = None,
    last_name: str | None = None,
) -> tuple[User | None, bool, list[str]]:
    provider = provider if provider in {"google", "email", "supabase"} else "supabase"
    existing = db.scalar(select(User).where(User.auth_provider_id == provider_id).with_for_update())
    if existing:
        existing.auth_provider = provider
        if db.scalar(select(Wallet).where(Wallet.user_id == existing.id)) is None:
            db.add(Wallet(user_id=existing.id))
        if existing.account_status != "active":
            db.rollback()
            raise HTTPException(403, "Account is suspended")
        db.commit()
        db.refresh(existing)
        return existing, False, []
    normalized_email = email.strip().lower()
    if db.scalar(select(User).where(func.lower(User.email) == normalized_email)):
        raise HTTPException(409, "An account with this email already exists; sign in with its linked provider or link identities in Supabase")
    if date_of_birth is None:
        return None, False, ["date_of_birth"]
    if not age_ok(date_of_birth):
        raise HTTPException(400, "User must be 18 or older")
    normalized_username = username.lower() if username else None
    if normalized_username and db.scalar(select(User).where(User.username == normalized_username)):
        raise HTTPException(409, "Username already registered")
    user = User(
        email=normalized_email,
        username=normalized_username,
        first_name=first_name,
        last_name=last_name,
        role="admin" if normalized_email in settings.configured_admin_emails else "user",
        auth_provider=provider,
        auth_provider_id=provider_id,
        password_hash=hash_password(secrets.token_urlsafe(32)),
        date_of_birth=date_of_birth,
        age_verified=True,
    )
    db.add(user)
    try:
        db.flush()
        wallet = Wallet(user_id=user.id)
        db.add(wallet)
        db.flush()
        granted_now = _grant_signup_bonus(db, user, wallet)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        concurrent = db.scalar(select(User).where(User.auth_provider_id == provider_id))
        if concurrent:
            return concurrent, False, []
        raise HTTPException(409, "Account identity is already registered") from exc
    db.refresh(user)
    return user, granted_now, []


def authenticate(db: Session, email: str, password: str) -> User:
    normalized_email = email.strip().lower()
    user = db.scalar(select(User).where(func.lower(User.email) == normalized_email))
    try:
        valid_password = bool(user and verify_password(password, user.password_hash))
    except (ValueError, TypeError):
        valid_password = False
    if not valid_password:
        raise HTTPException(401, "Invalid credentials")
    if user.account_status != "active":
        raise HTTPException(403, "Account is suspended")
    return user


def notify(db: Session, user_id: int, kind: str, message: str) -> None:
    db.add(Notification(user_id=user_id, kind=kind, message=message))


def _assert_credit_matches(row: WalletTransaction, currency: str, amount: Decimal) -> None:
    if row.reason != "test_credit" or row.currency != currency or Decimal(row.amount) != amount:
        raise HTTPException(409, "Idempotency key was already used with a different credit request")


def credit(db: Session, user: User, currency: str, amount: Decimal, key: str | None = None) -> None:
    currency = currency.lower()
    amount = Decimal(amount)
    # User is the first mutation lock for every account transaction. Taking it
    # before inserting a foreign-key row avoids PostgreSQL KEY SHARE/FOR UPDATE
    # lock inversion with concurrent orders.
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    if key:
        prior = db.scalar(
            select(WalletTransaction).where(
                WalletTransaction.user_id == user.id,
                WalletTransaction.idempotency_key == key,
            )
        )
        if prior:
            _assert_credit_matches(prior, currency, amount)
            return
    transaction = WalletTransaction(
        user_id=user.id,
        currency=currency,
        amount=amount,
        reason="test_credit",
        idempotency_key=key,
    )
    db.add(transaction)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        prior = db.scalar(
            select(WalletTransaction).where(
                WalletTransaction.user_id == user.id,
                WalletTransaction.idempotency_key == key,
            )
        )
        if prior:
            _assert_credit_matches(prior, currency, amount)
            return
        raise HTTPException(409, "Credit request conflicted with another operation") from exc
    wallet = db.scalar(select(Wallet).where(Wallet.user_id == user.id).with_for_update())
    if wallet is None:
        db.rollback()
        logger.error("invariant=missing_wallet operation=test_credit user_id=%s", user.id)
        raise HTTPException(409, "Account wallet is unavailable")
    setattr(wallet, currency, Decimal(getattr(wallet, currency)) + amount)
    notify(db, user.id, "wallet_credit", f"Credited {amount} {currency.title()}")
    db.commit()


def _aware(timestamp: datetime) -> datetime:
    return timestamp if timestamp.tzinfo else timestamp.replace(tzinfo=timezone.utc)


def _validate_price(price: MarketPrice | None, player: Player) -> MarketPrice:
    if price is None:
        logger.warning("order_rejected=missing_price player_id=%s symbol=%s", player.id, player.symbol)
        raise HTTPException(409, "Market price is unavailable for this player")
    price_time = _aware(price.updated_at)
    age_seconds = (now() - price_time).total_seconds()
    if age_seconds > settings.market_price_max_age_seconds:
        record_metric("stale_price_rejections")
        logger.warning(
            "order_rejected=stale_price player_id=%s source=%s updated_at=%s age_seconds=%.3f",
            player.id,
            price.source,
            price_time.isoformat(),
            age_seconds,
        )
        raise HTTPException(409, "Market price is stale; wait for a fresh quote")
    if age_seconds < -settings.market_price_future_skew_seconds:
        logger.warning(
            "order_rejected=future_price player_id=%s source=%s updated_at=%s age_seconds=%.3f",
            player.id,
            price.source,
            price_time.isoformat(),
            age_seconds,
        )
        raise HTTPException(409, "Market price timestamp is invalid")
    return price


def _assert_order_matches(row: Order, *, side: str, player_id: int, quantity: int) -> None:
    if row.side != side or row.player_id != player_id or row.quantity != quantity:
        raise HTTPException(409, "Idempotency key was already used with a different order request")


def order_output(db: Session, row: Order) -> dict[str, object]:
    match = db.scalar(select(OrderMatch).where(OrderMatch.order_id == row.id))
    return {
        "id": row.id,
        "player_id": row.player_id,
        "side": row.side,
        "quantity": row.quantity,
        "status": row.status,
        "failure_reason": row.failure_reason,
        "created_at": row.created_at,
        "execution_price": match.price if match else None,
        "executed_total": match.price * match.quantity if match else None,
    }


def _reserve_count(db: Session, user_id: int) -> int:
    return int(
        db.scalar(
            select(func.count(Holding.id))
            .outerjoin(
                ActiveSquad,
                (ActiveSquad.user_id == Holding.user_id) & (ActiveSquad.player_id == Holding.player_id),
            )
            .where(Holding.user_id == user_id, Holding.quantity > 0, ActiveSquad.id.is_(None))
        )
        or 0
    )


def order(db: Session, user: User, side: str, symbol: str, quantity: int, key: str | None = None) -> dict[str, object]:
    side = side.upper()
    if quantity > settings.max_order_quantity:
        raise HTTPException(422, f"Order quantity cannot exceed {settings.max_order_quantity}")
    player = db.scalar(
        select(Player).where(Player.symbol == symbol.upper(), Player.league == "EPL", Player.active.is_(True))
    )
    if not player:
        raise HTTPException(400, "Only active EPL players can be traded")
    # Serialize this account before inserting an order row. PostgreSQL acquires
    # a KEY SHARE lock for the user foreign key during INSERT; inserting first
    # and then requesting FOR UPDATE can deadlock with another account order.
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    if key:
        prior = db.scalar(select(Order).where(Order.user_id == user.id, Order.idempotency_key == key))
        if prior:
            _assert_order_matches(prior, side=side, player_id=player.id, quantity=quantity)
            record_metric("idempotent_replays")
            return order_output(db, prior)

    order_row = Order(
        user_id=user.id,
        player_id=player.id,
        side=side,
        quantity=quantity,
        idempotency_key=key,
    )
    db.add(order_row)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        prior = db.scalar(select(Order).where(Order.user_id == user.id, Order.idempotency_key == key))
        if prior:
            _assert_order_matches(prior, side=side, player_id=player.id, quantity=quantity)
            record_metric("idempotent_replays")
            return order_output(db, prior)
        raise HTTPException(409, "Order request conflicted with another operation") from exc

    # After the user lock, lock price, wallet, and holding in this order. This
    # sequence is shared by buy, sell, credit, and squad mutations.
    price = _validate_price(
        db.scalar(select(MarketPrice).where(MarketPrice.player_id == player.id).with_for_update()),
        player,
    )
    wallet = db.scalar(select(Wallet).where(Wallet.user_id == user.id).with_for_update())
    if wallet is None:
        db.rollback()
        logger.error("invariant=missing_wallet operation=order user_id=%s", user.id)
        raise HTTPException(409, "Account wallet is unavailable")
    holding = db.scalar(
        select(Holding)
        .where(Holding.user_id == user.id, Holding.player_id == player.id)
        .with_for_update()
    )
    unit = Decimal(price.ask if side == "BUY" else price.bid)
    total = unit * quantity
    if side == "BUY":
        is_new_positive_holding = holding is None or holding.quantity == 0
        is_active = bool(
            db.scalar(
                select(ActiveSquad.id).where(
                    ActiveSquad.user_id == user.id,
                    ActiveSquad.player_id == player.id,
                )
            )
        )
        if is_new_positive_holding and not is_active and _reserve_count(db, user.id) >= settings.reserve_squad_capacity:
            db.rollback()
            raise HTTPException(409, f"Reserve squad cap of {settings.reserve_squad_capacity} exceeded")
        if Decimal(wallet.gold) < total:
            db.rollback()
            raise HTTPException(409, "Insufficient Gold balance")
        wallet.gold = Decimal(wallet.gold) - total
        if holding is None:
            holding = Holding(user_id=user.id, player_id=player.id, quantity=0, average_cost=ZERO)
            db.add(holding)
        previous_quantity = holding.quantity
        holding.average_cost = ((Decimal(holding.average_cost) * previous_quantity) + total) / (previous_quantity + quantity)
        holding.quantity = previous_quantity + quantity
    else:
        if holding is None or holding.quantity < quantity:
            db.rollback()
            raise HTTPException(409, "Insufficient holdings")
        wallet.gold = Decimal(wallet.gold) + total
        holding.realized_pnl = Decimal(holding.realized_pnl) + (unit - Decimal(holding.average_cost)) * quantity
        holding.quantity -= quantity
        if holding.quantity == 0:
            active_entry = db.scalar(
                select(ActiveSquad)
                .where(ActiveSquad.user_id == user.id, ActiveSquad.player_id == player.id)
                .with_for_update()
            )
            if active_entry:
                db.delete(active_entry)

    db.add(OrderMatch(order_id=order_row.id, quantity=quantity, price=unit))
    db.add(
        WalletTransaction(
            user_id=user.id,
            currency="gold",
            amount=-total if side == "BUY" else total,
            reason=f"{side.lower()}_execution",
            idempotency_key=f"order:{order_row.id}",
        )
    )
    order_row.status = "FILLED"
    notify(db, user.id, "order_filled", f"{side.title()} {quantity} {player.name} at {unit} Gold")
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if key:
            prior = db.scalar(select(Order).where(Order.user_id == user.id, Order.idempotency_key == key))
            if prior:
                _assert_order_matches(prior, side=side, player_id=player.id, quantity=quantity)
                record_metric("idempotent_replays")
                return order_output(db, prior)
        raise HTTPException(409, "Order could not be completed because account state changed") from exc
    db.refresh(order_row)
    record_metric("orders_filled")
    return order_output(db, order_row)


def squad_state(db: Session, user_id: int) -> tuple[list[tuple[ActiveSquad, Player]], list[tuple[Holding, Player]]]:
    active = db.execute(
        select(ActiveSquad, Player)
        .join(Player, ActiveSquad.player_id == Player.id)
        .where(ActiveSquad.user_id == user_id)
        .order_by(ActiveSquad.position)
    ).all()
    reserve = db.execute(
        select(Holding, Player)
        .join(Player, Holding.player_id == Player.id)
        .outerjoin(
            ActiveSquad,
            (ActiveSquad.user_id == Holding.user_id) & (ActiveSquad.player_id == Holding.player_id),
        )
        .where(Holding.user_id == user_id, Holding.quantity > 0, ActiveSquad.id.is_(None))
        .order_by(Player.name)
    ).all()
    return active, reserve


def promote_player(db: Session, user: User, symbol: str) -> str:
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    player = db.scalar(select(Player).where(Player.symbol == symbol.upper()))
    if not player:
        raise HTTPException(404, "Player not found")
    holding = db.scalar(
        select(Holding).where(Holding.user_id == user.id, Holding.player_id == player.id).with_for_update()
    )
    if not holding or holding.quantity <= 0:
        raise HTTPException(400, "Player is not held")
    existing = db.scalar(
        select(ActiveSquad).where(ActiveSquad.user_id == user.id, ActiveSquad.player_id == player.id)
    )
    if existing:
        return "already_active"
    used_positions = set(
        db.scalars(select(ActiveSquad.position).where(ActiveSquad.user_id == user.id).with_for_update()).all()
    )
    position = next((candidate for candidate in range(1, settings.active_squad_capacity + 1) if candidate not in used_positions), None)
    if position is None:
        raise HTTPException(409, f"Active squad cap of {settings.active_squad_capacity} exceeded")
    db.add(ActiveSquad(user_id=user.id, player_id=player.id, position=position))
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        concurrent = db.scalar(
            select(ActiveSquad).where(ActiveSquad.user_id == user.id, ActiveSquad.player_id == player.id)
        )
        if concurrent:
            return "already_active"
        raise HTTPException(409, "Squad changed concurrently; refresh and retry") from exc
    return "active"


def demote_player(db: Session, user: User, symbol: str) -> str:
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    row = db.scalar(
        select(ActiveSquad)
        .join(Player)
        .where(ActiveSquad.user_id == user.id, Player.symbol == symbol.upper())
        .with_for_update()
    )
    if not row:
        raise HTTPException(404, "Player is not active")
    if _reserve_count(db, user.id) >= settings.reserve_squad_capacity:
        raise HTTPException(409, f"Reserve squad cap of {settings.reserve_squad_capacity} exceeded")
    db.delete(row)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Squad changed concurrently; refresh and retry") from exc
    return "inactive"
