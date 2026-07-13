"""v2 bzzoiro sports data schema"""
from alembic import op
import sqlalchemy as sa

revision = "v2_bzzoiro_sports_data"
down_revision = "v1_initial_trading"
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())

    if not inspector.has_table("sports_leagues"):
        op.create_table(
            "sports_leagues",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("provider_id", sa.Integer(), nullable=False),
            sa.Column("slug", sa.String(length=40), nullable=False),
            sa.Column("name", sa.String(length=80), nullable=False),
            sa.Column("country", sa.String(length=60), nullable=False),
            sa.Column("current_season_id", sa.Integer(), nullable=True),
            sa.Column("active", sa.Boolean(), nullable=False),
            sa.Column("synced_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_sports_leagues_provider_id", "sports_leagues", ["provider_id"], unique=True)
        op.create_index("ix_sports_leagues_slug", "sports_leagues", ["slug"], unique=True)

    if not inspector.has_table("sports_teams"):
        op.create_table(
            "sports_teams",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("provider_id", sa.Integer(), nullable=False),
            sa.Column("league_id", sa.Integer(), sa.ForeignKey("sports_leagues.id"), nullable=True),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("short_name", sa.String(length=40), nullable=True),
            sa.Column("country", sa.String(length=60), nullable=True),
            sa.Column("synced_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_sports_teams_provider_id", "sports_teams", ["provider_id"], unique=True)
        op.create_index("ix_sports_teams_league_id", "sports_teams", ["league_id"])

    if not inspector.has_table("sports_fixtures"):
        op.create_table(
            "sports_fixtures",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("provider_id", sa.Integer(), nullable=False),
            sa.Column("league_id", sa.Integer(), sa.ForeignKey("sports_leagues.id"), nullable=False),
            sa.Column("season_id", sa.Integer(), nullable=True),
            sa.Column("home_team_id", sa.Integer(), nullable=True),
            sa.Column("away_team_id", sa.Integer(), nullable=True),
            sa.Column("home_team", sa.String(length=120), nullable=False),
            sa.Column("away_team", sa.String(length=120), nullable=False),
            sa.Column("event_date", sa.DateTime(timezone=True), nullable=False),
            sa.Column("status", sa.String(length=30), nullable=False),
            sa.Column("home_score", sa.Integer(), nullable=True),
            sa.Column("away_score", sa.Integer(), nullable=True),
            sa.Column("round_name", sa.String(length=80), nullable=True),
            sa.Column("synced_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_sports_fixtures_provider_id", "sports_fixtures", ["provider_id"], unique=True)
        op.create_index("ix_sports_fixtures_league_id", "sports_fixtures", ["league_id"])
        op.create_index("ix_sports_fixtures_season_id", "sports_fixtures", ["season_id"])
        op.create_index("ix_sports_fixtures_event_date", "sports_fixtures", ["event_date"])
        op.create_index("ix_sports_fixtures_status", "sports_fixtures", ["status"])

    if not inspector.has_table("sports_players"):
        op.create_table(
            "sports_players",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("provider_id", sa.Integer(), nullable=False),
            sa.Column("current_team_id", sa.Integer(), nullable=True),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("short_name", sa.String(length=80), nullable=True),
            sa.Column("position", sa.String(length=20), nullable=True),
            sa.Column("nationality", sa.String(length=60), nullable=True),
            sa.Column("market_value_eur", sa.Integer(), nullable=True),
            sa.Column("synced_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_sports_players_provider_id", "sports_players", ["provider_id"], unique=True)
        op.create_index("ix_sports_players_current_team_id", "sports_players", ["current_team_id"])

    if not inspector.has_table("sports_sync_runs"):
        op.create_table(
            "sports_sync_runs",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("scope", sa.String(length=80), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("message", sa.Text(), nullable=True),
        )
        op.create_index("ix_sports_sync_runs_scope", "sports_sync_runs", ["scope"])


def downgrade():
    op.drop_index("ix_sports_sync_runs_scope", table_name="sports_sync_runs")
    op.drop_table("sports_sync_runs")
    op.drop_index("ix_sports_players_current_team_id", table_name="sports_players")
    op.drop_index("ix_sports_players_provider_id", table_name="sports_players")
    op.drop_table("sports_players")
    op.drop_index("ix_sports_fixtures_status", table_name="sports_fixtures")
    op.drop_index("ix_sports_fixtures_event_date", table_name="sports_fixtures")
    op.drop_index("ix_sports_fixtures_season_id", table_name="sports_fixtures")
    op.drop_index("ix_sports_fixtures_league_id", table_name="sports_fixtures")
    op.drop_index("ix_sports_fixtures_provider_id", table_name="sports_fixtures")
    op.drop_table("sports_fixtures")
    op.drop_index("ix_sports_teams_league_id", table_name="sports_teams")
    op.drop_index("ix_sports_teams_provider_id", table_name="sports_teams")
    op.drop_table("sports_teams")
    op.drop_index("ix_sports_leagues_slug", table_name="sports_leagues")
    op.drop_index("ix_sports_leagues_provider_id", table_name="sports_leagues")
    op.drop_table("sports_leagues")
