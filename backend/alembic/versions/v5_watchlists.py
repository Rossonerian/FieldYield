"""add authenticated watchlists"""
from alembic import op
import sqlalchemy as sa

revision = "v5_watchlists"
down_revision = "v4_remove_live_notebook"
branch_labels = None
depends_on = None

def upgrade():
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("watchlists"):
        op.create_table("watchlists", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False), sa.Column("player_id", sa.Integer(), sa.ForeignKey("players.id"), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("user_id", "player_id", name="uq_watchlists_user_player"))
    indexes = {item["name"] for item in sa.inspect(op.get_bind()).get_indexes("watchlists")}
    if "ix_watchlists_user_id" not in indexes: op.create_index("ix_watchlists_user_id", "watchlists", ["user_id"])
    if "ix_watchlists_player_id" not in indexes: op.create_index("ix_watchlists_player_id", "watchlists", ["player_id"])

def downgrade():
    op.drop_table("watchlists")
