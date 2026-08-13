from datetime import datetime, timezone

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError


def _config(connection) -> Config:
    config = Config("alembic.ini")
    config.attributes["connection"] = connection
    return config


def test_populated_v10_fixture_upgrades_without_financial_history_loss(tmp_path):
    engine = create_engine(f"sqlite:///{(tmp_path / 'v10-upgrade.db').as_posix()}")
    timestamp = datetime(2026, 1, 1, tzinfo=timezone.utc)

    with engine.connect() as connection:
        config = _config(connection)
        command.upgrade(config, "v10_auth_provider")
        connection.execute(
            text(
                "INSERT INTO users "
                "(id, email, password_hash, date_of_birth, age_verified, created_at, preferred_currency, "
                "preferences, account_status, role, auth_provider) "
                "VALUES (1, 'legacy@example.com', 'hash', :dob, 1, :created, NULL, NULL, NULL, NULL, NULL)"
            ),
            {"dob": timestamp, "created": timestamp},
        )
        connection.execute(
            text("INSERT INTO players (id, symbol, name, league, club, active) VALUES (1, 'LEG', 'Legacy Player', 'EPL', 'Legacy FC', 1)")
        )
        connection.execute(text("INSERT INTO wallets (id, user_id, gold, silver) VALUES (1, 1, 900, 0)"))
        connection.execute(
            text(
                "INSERT INTO market_prices (id, player_id, bid, ask, updated_at, source) "
                "VALUES (1, 1, 99, 100, :created, 'legacy')"
            ),
            {"created": timestamp},
        )
        connection.execute(
            text(
                "INSERT INTO orders (id, user_id, player_id, side, quantity, status, idempotency_key, created_at) "
                "VALUES (1, 1, 1, 'BUY', 1, 'FILLED', 'legacy-order-key', :created)"
            ),
            {"created": timestamp},
        )
        connection.execute(
            text("INSERT INTO order_matches (id, order_id, quantity, price, created_at) VALUES (1, 1, 1, 100, :created)"),
            {"created": timestamp},
        )
        connection.execute(
            text(
                "INSERT INTO wallet_transactions "
                "(id, user_id, currency, amount, reason, idempotency_key, created_at) "
                "VALUES (1, 1, 'gold', -100, 'buy_execution', 'legacy-ledger-key', :created)"
            ),
            {"created": timestamp},
        )
        connection.execute(
            text("INSERT INTO holdings (id, user_id, player_id, quantity, average_cost, realized_pnl) VALUES (1, 1, 1, 1, 100, 0)")
        )
        connection.commit()

        command.upgrade(config, "head")

        for table in ("orders", "order_matches", "wallet_transactions", "holdings"):
            assert connection.scalar(text(f"SELECT COUNT(*) FROM {table}")) == 1
        user = connection.execute(
            text("SELECT preferred_currency, preferences, account_status, role, auth_provider, updated_at FROM users WHERE id = 1")
        ).one()
        assert user[0:5] == ("gold", "{}", "active", "user", "local")
        assert user.updated_at is not None

        connection.execute(
            text(
                "INSERT INTO users (id, email, password_hash, date_of_birth, age_verified, created_at, updated_at, "
                "preferred_currency, preferences, account_status, role, auth_provider) "
                "VALUES (2, 'second@example.com', 'hash', :dob, 1, :created, :created, 'gold', '{}', 'active', 'user', 'local')"
            ),
            {"dob": timestamp, "created": timestamp},
        )
        connection.execute(
            text(
                "INSERT INTO orders (id, user_id, player_id, side, quantity, status, idempotency_key, created_at) "
                "VALUES (2, 2, 1, 'BUY', 1, 'FILLED', 'legacy-order-key', :created)"
            ),
            {"created": timestamp},
        )
        connection.commit()

        with pytest.raises(IntegrityError):
            connection.execute(
                text(
                    "INSERT INTO orders (id, user_id, player_id, side, quantity, status, idempotency_key, created_at) "
                    "VALUES (3, 1, 1, 'BUY', 1, 'FILLED', 'legacy-order-key', :created)"
                ),
                {"created": timestamp},
            )
            connection.commit()
        connection.rollback()

        inspector = inspect(connection)
        assert {"user_id", "idempotency_key"} in [set(item["column_names"]) for item in inspector.get_unique_constraints("orders")]
        command.check(config)
    engine.dispose()
