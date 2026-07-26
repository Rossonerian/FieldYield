"""link local profiles to optional Supabase Auth identities"""
from alembic import op
import sqlalchemy as sa

revision = "v7_supabase_auth_identity"
down_revision = "v6_user_admin_bonus_audit"
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("users")}
    if "auth_provider_id" not in columns:
        op.add_column("users", sa.Column("auth_provider_id", sa.String(length=64), nullable=True))
    indexes = {index["name"] for index in sa.inspect(op.get_bind()).get_indexes("users")}
    if "ix_users_auth_provider_id" not in indexes:
        op.create_index("ix_users_auth_provider_id", "users", ["auth_provider_id"], unique=True)


def downgrade():
    op.drop_index("ix_users_auth_provider_id", table_name="users")
    op.drop_column("users", "auth_provider_id")
