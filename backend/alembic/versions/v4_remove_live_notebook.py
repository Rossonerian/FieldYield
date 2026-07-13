"""remove obsolete live sports notebook storage"""
from alembic import op
import sqlalchemy as sa

revision = "v4_remove_live_notebook"
down_revision = "v3_user_profiles_bonus"
branch_labels = None
depends_on = None

def upgrade():
    inspector = sa.inspect(op.get_bind())
    for table in ("sports_sync_runs", "sports_fixtures", "sports_players", "sports_teams", "sports_leagues"):
        if inspector.has_table(table):
            op.drop_table(table)

def downgrade():
    # Historical provider data is intentionally not recreated by downgrade.
    pass
