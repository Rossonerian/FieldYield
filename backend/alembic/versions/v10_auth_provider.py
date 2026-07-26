"""record the verified identity provider without storing OAuth profile data"""
from alembic import op
import sqlalchemy as sa

revision = "v10_auth_provider"
down_revision = "v9_supabase_rls_guard"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("users")}
    if "auth_provider" not in columns:
        op.add_column("users", sa.Column("auth_provider", sa.String(length=16), nullable=True, server_default="local"))
        op.execute("UPDATE users SET auth_provider = 'local' WHERE auth_provider IS NULL")
        if bind.dialect.name != "sqlite":
            op.alter_column("users", "auth_provider", nullable=False, server_default="local")


def downgrade():
    inspector = sa.inspect(op.get_bind())
    if "auth_provider" in {column["name"] for column in inspector.get_columns("users")}:
        op.drop_column("users", "auth_provider")
