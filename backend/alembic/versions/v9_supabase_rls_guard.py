"""guard direct Supabase API access; FastAPI remains the data authority

The application uses a server-side SQLAlchemy connection and does not expose
these tables through the Supabase REST API.  RLS is enabled so an accidental
anon/authenticated PostgREST exposure is deny-by-default.  The migration is
PostgreSQL-only; SQLite and ordinary local PostgreSQL development remain
usable without Supabase's ``anon`` and ``authenticated`` roles.
"""
from alembic import op

revision = "v9_supabase_rls_guard"
down_revision = "v8_market_price_source"
branch_labels = None
depends_on = None

TABLES = (
    "users", "wallets", "wallet_transactions", "signup_bonus_grants",
    "players", "market_prices", "orders", "order_matches", "holdings",
    "active_squad", "notifications", "watchlists", "audit_logs",
)


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    # Supabase supplies these roles.  The conditional keeps the same Alembic
    # chain portable when it is validated against a non-Supabase PostgreSQL.
    op.execute("""
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
         AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE 'CREATE POLICY fieldyield_deny_direct_api ON users FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)';
      END IF;
    END $$;
    """)


def downgrade():
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    op.execute("DROP POLICY IF EXISTS fieldyield_deny_direct_api ON users")
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
