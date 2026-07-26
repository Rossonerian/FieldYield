"""add source metadata to imported market prices"""
from alembic import op
import sqlalchemy as sa

revision = "v8_market_price_source"
down_revision = "v7_supabase_auth_identity"
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("market_prices")}
    if "source" not in columns:
        op.add_column("market_prices", sa.Column("source", sa.String(length=40), nullable=True, server_default="manual"))
        op.execute("UPDATE market_prices SET source = 'manual' WHERE source IS NULL")
        if op.get_bind().dialect.name != "sqlite":
            op.alter_column("market_prices", "source", nullable=False, server_default="manual")


def downgrade():
    inspector = sa.inspect(op.get_bind())
    if "source" in {column["name"] for column in inspector.get_columns("market_prices")}:
        op.drop_column("market_prices", "source")
