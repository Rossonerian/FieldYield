"""add compact role, bonus grant, and admin audit records"""
from alembic import op
import sqlalchemy as sa

revision = "v6_user_admin_bonus_audit"
down_revision = "v5_watchlists"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "role" not in user_columns:
        op.add_column("users", sa.Column("role", sa.String(length=16), nullable=True))
        op.execute("UPDATE users SET role = 'user' WHERE role IS NULL")
        if bind.dialect.name != "sqlite":
            op.alter_column("users", "role", nullable=False, server_default="user")
        else:
            op.create_index("ix_users_role", "users", ["role"])
    if "ix_users_role" not in {index["name"] for index in sa.inspect(bind).get_indexes("users")}:
        op.create_index("ix_users_role", "users", ["role"])

    if not inspector.has_table("signup_bonus_grants"):
        op.create_table(
            "signup_bonus_grants",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("gold_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
            sa.Column("silver_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
            sa.Column("reason", sa.String(length=40), nullable=False, server_default="signup_bonus"),
            sa.Column("idempotency_key", sa.String(length=120), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("user_id", name="uq_signup_bonus_grants_user"),
            sa.UniqueConstraint("idempotency_key", name="uq_signup_bonus_grants_key"),
        )
        op.create_index("ix_signup_bonus_grants_user_id", "signup_bonus_grants", ["user_id"])

    if not inspector.has_table("audit_logs"):
        op.create_table(
            "audit_logs",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("actor_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("target_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("action", sa.String(length=80), nullable=False),
            sa.Column("details", sa.JSON(), nullable=False, server_default="{}"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_audit_logs_actor_user_id", "audit_logs", ["actor_user_id"])
        op.create_index("ix_audit_logs_target_user_id", "audit_logs", ["target_user_id"])
        op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])


def downgrade():
    op.drop_table("audit_logs")
    op.drop_table("signup_bonus_grants")
    op.drop_index("ix_users_role", table_name="users")
    op.drop_column("users", "role")
