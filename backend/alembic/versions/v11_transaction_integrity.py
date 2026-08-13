"""scope idempotency and enforce transaction invariants"""

from alembic import op
import sqlalchemy as sa

revision = "v11_transaction_integrity"
down_revision = "v10_auth_provider"
branch_labels = None
depends_on = None

NAMING = {"uq": "uq_%(table_name)s_%(column_0_name)s"}


def _assert_no_invalid_rows(bind) -> None:
    checks = {
        "wallets contains a negative balance": "SELECT 1 FROM wallets WHERE gold < 0 OR silver < 0 LIMIT 1",
        "holdings contains a negative quantity or cost": "SELECT 1 FROM holdings WHERE quantity < 0 OR average_cost < 0 LIMIT 1",
        "market_prices contains an invalid spread": "SELECT 1 FROM market_prices WHERE bid <= 0 OR ask <= 0 OR ask < bid LIMIT 1",
        "orders contains an unsupported side/status/quantity": "SELECT 1 FROM orders WHERE side NOT IN ('BUY','SELL') OR status NOT IN ('PENDING','FILLED','REJECTED') OR quantity <= 0 LIMIT 1",
        "order_matches contains an invalid quantity/price": "SELECT 1 FROM order_matches WHERE quantity <= 0 OR price <= 0 LIMIT 1",
        "active_squad contains an invalid position": "SELECT 1 FROM active_squad WHERE position < 1 OR position > 25 LIMIT 1",
    }
    for message, statement in checks.items():
        if bind.execute(sa.text(statement)).first():
            raise RuntimeError(message)


def _global_unique_name(inspector, table: str) -> str:
    for constraint in inspector.get_unique_constraints(table):
        if constraint.get("column_names") == ["idempotency_key"]:
            return constraint.get("name") or f"uq_{table}_idempotency_key"
    raise RuntimeError(f"Expected global idempotency constraint on {table}")


def upgrade():
    bind = op.get_bind()
    op.execute("UPDATE users SET preferred_currency = 'gold' WHERE preferred_currency IS NULL")
    op.execute("UPDATE users SET preferences = '{}' WHERE preferences IS NULL")
    op.execute("UPDATE users SET account_status = 'active' WHERE account_status IS NULL")
    op.execute("UPDATE users SET role = 'user' WHERE role IS NULL")
    op.execute("UPDATE users SET auth_provider = 'local' WHERE auth_provider IS NULL")
    op.execute("UPDATE users SET updated_at = created_at WHERE updated_at IS NULL")
    op.execute("UPDATE market_prices SET source = 'manual' WHERE source IS NULL")
    _assert_no_invalid_rows(bind)

    inspector = sa.inspect(bind)
    wallet_unique = _global_unique_name(inspector, "wallet_transactions")
    order_unique = _global_unique_name(inspector, "orders")

    with op.batch_alter_table("users", naming_convention=NAMING) as batch:
        batch.alter_column("preferred_currency", existing_type=sa.String(10), nullable=False, server_default="gold")
        batch.alter_column("preferences", existing_type=sa.JSON(), nullable=False, server_default="{}")
        batch.alter_column("account_status", existing_type=sa.String(16), nullable=False, server_default="active")
        batch.alter_column("role", existing_type=sa.String(16), nullable=False, server_default="user")
        batch.alter_column("auth_provider", existing_type=sa.String(16), nullable=False, server_default="local")
        batch.alter_column("updated_at", existing_type=sa.DateTime(timezone=True), nullable=False)
        batch.create_check_constraint("ck_users_account_status", "account_status IN ('active', 'suspended')")
        batch.create_check_constraint("ck_users_role", "role IN ('user', 'admin')")
        batch.create_check_constraint("ck_users_auth_provider", "auth_provider IN ('local', 'email', 'google', 'supabase')")
        batch.create_check_constraint("ck_users_preferred_currency", "preferred_currency IN ('gold', 'silver')")

    with op.batch_alter_table("wallets", naming_convention=NAMING) as batch:
        batch.create_check_constraint("ck_wallets_gold_nonnegative", "gold >= 0")
        batch.create_check_constraint("ck_wallets_silver_nonnegative", "silver >= 0")
    with op.batch_alter_table("wallet_transactions", naming_convention=NAMING) as batch:
        batch.drop_constraint(wallet_unique, type_="unique")
        batch.create_unique_constraint("uq_wallet_transactions_user_key", ["user_id", "idempotency_key"])
        batch.create_check_constraint("ck_wallet_transactions_currency", "currency IN ('gold', 'silver')")
    op.create_index("ix_wallet_transactions_user_key", "wallet_transactions", ["user_id", "idempotency_key"])

    with op.batch_alter_table("market_prices", naming_convention=NAMING) as batch:
        batch.alter_column("source", existing_type=sa.String(40), nullable=False, server_default="manual")
        batch.create_check_constraint("ck_market_prices_bid_positive", "bid > 0")
        batch.create_check_constraint("ck_market_prices_ask_positive", "ask > 0")
        batch.create_check_constraint("ck_market_prices_spread", "ask >= bid")

    with op.batch_alter_table("orders", naming_convention=NAMING) as batch:
        batch.drop_constraint(order_unique, type_="unique")
        batch.create_unique_constraint("uq_orders_user_key", ["user_id", "idempotency_key"])
        batch.create_check_constraint("ck_orders_side", "side IN ('BUY', 'SELL')")
        batch.create_check_constraint("ck_orders_status", "status IN ('PENDING', 'FILLED', 'REJECTED')")
        batch.create_check_constraint("ck_orders_quantity_positive", "quantity > 0")
    op.create_index("ix_orders_user_key", "orders", ["user_id", "idempotency_key"])

    with op.batch_alter_table("order_matches", naming_convention=NAMING) as batch:
        batch.create_unique_constraint("uq_order_matches_order_id", ["order_id"])
        batch.create_check_constraint("ck_order_matches_quantity_positive", "quantity > 0")
        batch.create_check_constraint("ck_order_matches_price_positive", "price > 0")
    with op.batch_alter_table("holdings", naming_convention=NAMING) as batch:
        batch.create_check_constraint("ck_holdings_quantity_nonnegative", "quantity >= 0")
        batch.create_check_constraint("ck_holdings_average_cost_nonnegative", "average_cost >= 0")
    with op.batch_alter_table("active_squad", naming_convention=NAMING) as batch:
        batch.create_check_constraint("ck_active_squad_position", "position >= 1 AND position <= 25")
    with op.batch_alter_table("signup_bonus_grants", naming_convention=NAMING) as batch:
        batch.create_check_constraint("ck_signup_bonus_gold_nonnegative", "gold_amount >= 0")
        batch.create_check_constraint("ck_signup_bonus_silver_nonnegative", "silver_amount >= 0")


def downgrade():
    raise RuntimeError("v11_transaction_integrity is intentionally irreversible; financial constraints must not be removed automatically")
