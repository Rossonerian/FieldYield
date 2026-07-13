"""add compact user profile fields and signup bonus marker"""
from alembic import op
import sqlalchemy as sa

revision = "v3_user_profiles_bonus"
down_revision = "v2_bzzoiro_sports_data"
branch_labels = None
depends_on = None

def upgrade():
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("users")}
    additions = [
        ("username", sa.String(32)), ("first_name", sa.String(80)), ("last_name", sa.String(80)),
        ("country", sa.String(2)), ("avatar_url", sa.String(512)), ("preferred_currency", sa.String(10)),
        ("preferences", sa.JSON()), ("account_status", sa.String(16)), ("updated_at", sa.DateTime(timezone=True)),
        ("signup_bonus_awarded_at", sa.DateTime(timezone=True)),
    ]
    for name, column_type in additions:
        if name not in columns:
            op.add_column("users", sa.Column(name, column_type, nullable=True))
    op.execute("UPDATE users SET preferred_currency = 'gold' WHERE preferred_currency IS NULL")
    op.execute("UPDATE users SET account_status = 'active' WHERE account_status IS NULL")
    if "ix_users_username" not in {index["name"] for index in inspector.get_indexes("users")}:
        op.create_index("ix_users_username", "users", ["username"], unique=True)

def downgrade():
    op.drop_index("ix_users_username", table_name="users")
    for name in ("signup_bonus_awarded_at", "updated_at", "account_status", "preferences", "preferred_currency", "avatar_url", "country", "last_name", "first_name", "username"):
        op.drop_column("users", name)
