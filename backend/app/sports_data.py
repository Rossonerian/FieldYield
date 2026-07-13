from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.redis import get_redis_or_none
from app.models import SportsFixture, SportsLeague, SportsPlayer, SportsSyncRun, SportsTeam, now

TOP_UEFA_LEAGUES = [
    {"slug": "premier-league", "name": "Premier League", "country": "England", "aliases": ["Premier League"]},
    {"slug": "la-liga", "name": "La Liga", "country": "Spain", "aliases": ["La Liga"]},
    {"slug": "serie-a", "name": "Serie A", "country": "Italy", "aliases": ["Serie A"]},
    {"slug": "bundesliga", "name": "Bundesliga", "country": "Germany", "aliases": ["Bundesliga"]},
    {"slug": "ligue-1", "name": "Ligue 1", "country": "France", "aliases": ["Ligue 1"]},
    {"slug": "eredivisie", "name": "Eredivisie", "country": "Netherlands", "aliases": ["Eredivisie"]},
    {"slug": "primeira-liga", "name": "Primeira Liga", "country": "Portugal", "aliases": ["Liga Portugal Betclic", "Primeira Liga"]},
]


class BzzoiroClient:
    def __init__(self):
        self.base_url = settings.bzzoiro_base_url.rstrip("/")
        self.cache_ttl = settings.bzzoiro_cache_ttl_seconds
        self.redis = get_redis_or_none()

    def get(self, path: str, params: dict[str, Any] | None = None, ttl: int | None = None) -> Any:
        if not settings.bzzoiro_api_key:
            raise HTTPException(503, "BZZOIRO_API_KEY is not configured")
        clean_params = {key: value for key, value in (params or {}).items() if value not in (None, "")}
        cache_key = f"bzzoiro:{path}:{json.dumps(clean_params, sort_keys=True, default=str)}"
        if self.redis:
            cached = self.redis.get(cache_key)
            if cached:
                return json.loads(cached)
            lock_key = f"{cache_key}:lock"
            self.redis.set(lock_key, "1", nx=True, ex=30)
        try:
            response = httpx.get(
                f"{self.base_url}{path}",
                params=clean_params,
                headers={"Authorization": f"Token {settings.bzzoiro_api_key}"},
                timeout=12,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code in (401, 403):
                raise HTTPException(502, "Bzzoiro rejected the configured API token") from exc
            if exc.response.status_code == 429:
                raise HTTPException(429, "Bzzoiro rate limit exceeded; retry shortly") from exc
            raise HTTPException(502, "Bzzoiro sports data request failed") from exc
        except httpx.HTTPError as exc:
            raise HTTPException(502, "Bzzoiro sports data is temporarily unavailable") from exc
        payload = response.json()
        if self.redis:
            self.redis.setex(cache_key, ttl or self.cache_ttl, json.dumps(payload, default=str))
        return payload


def page_results(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, dict) and isinstance(payload.get("results"), list):
        return payload["results"]
    if isinstance(payload, list):
        return payload
    return []


def current_season_id(league: dict[str, Any]) -> int | None:
    season = league.get("current_season")
    if isinstance(season, dict):
        return season.get("id")
    if isinstance(season, int):
        return season
    return None


def parse_event_date(value: str | None) -> datetime:
    if not value:
        return now()
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def find_top_league(item: dict[str, Any]) -> dict[str, Any] | None:
    name = str(item.get("name", "")).casefold()
    country = str(item.get("country", "")).casefold()
    for league in TOP_UEFA_LEAGUES:
        if country == league["country"].casefold() and name in {alias.casefold() for alias in league["aliases"]}:
            return league
    return None


def upsert_leagues(db: Session, items: list[dict[str, Any]]) -> list[SportsLeague]:
    rows: list[SportsLeague] = []
    for item in items:
        target = find_top_league(item)
        if not target:
            continue
        row = db.scalar(select(SportsLeague).where(SportsLeague.provider_id == item["id"]))
        if not row:
            row = SportsLeague(provider_id=item["id"], slug=target["slug"])
            db.add(row)
        row.slug = target["slug"]
        row.name = target["name"]
        row.country = target["country"]
        row.current_season_id = current_season_id(item)
        row.active = bool(item.get("is_active", True))
        row.synced_at = now()
        rows.append(row)
    db.commit()
    return rows


def sync_top_leagues(db: Session, client: BzzoiroClient | None = None) -> list[SportsLeague]:
    client = client or BzzoiroClient()
    payload = client.get("/api/v2/leagues/", {"limit": 200, "offset": 0, "include_inactive": False, "is_women": False}, ttl=86_400)
    return upsert_leagues(db, page_results(payload))


def get_top_leagues(db: Session, refresh: bool = False) -> list[SportsLeague]:
    rows = db.scalars(select(SportsLeague).order_by(SportsLeague.name)).all()
    if refresh or len(rows) < len(TOP_UEFA_LEAGUES):
        rows = sync_top_leagues(db)
    return rows


def league_by_slug(db: Session, slug: str) -> SportsLeague:
    league = db.scalar(select(SportsLeague).where(SportsLeague.slug == slug))
    if not league:
        get_top_leagues(db, refresh=True)
        league = db.scalar(select(SportsLeague).where(SportsLeague.slug == slug))
    if not league:
        raise HTTPException(404, "Supported league not found")
    return league


def upsert_teams(db: Session, league: SportsLeague, items: list[dict[str, Any]]) -> list[SportsTeam]:
    rows: list[SportsTeam] = []
    for item in items:
        row = db.scalar(select(SportsTeam).where(SportsTeam.provider_id == item["id"]))
        if not row:
            row = SportsTeam(provider_id=item["id"])
            db.add(row)
        row.league_id = league.id
        row.name = item.get("name") or item.get("short_name") or "Unknown team"
        row.short_name = item.get("short_name")
        row.country = item.get("country")
        row.synced_at = now()
        rows.append(row)
    db.commit()
    return rows


def teams_for_league(db: Session, slug: str, limit: int, offset: int, refresh: bool = False) -> list[SportsTeam]:
    league = league_by_slug(db, slug)
    query = select(SportsTeam).where(SportsTeam.league_id == league.id).order_by(SportsTeam.name).limit(limit).offset(offset)
    rows = db.scalars(query).all()
    if refresh or not rows:
        client = BzzoiroClient()
        payload = client.get("/api/v2/teams/", {"league_id": league.provider_id, "limit": limit, "offset": offset}, ttl=3_600)
        rows = upsert_teams(db, league, page_results(payload))
    return rows


def upsert_fixtures(db: Session, league: SportsLeague, items: list[dict[str, Any]]) -> list[SportsFixture]:
    rows: list[SportsFixture] = []
    for item in items:
        row = db.scalar(select(SportsFixture).where(SportsFixture.provider_id == item["id"]))
        if not row:
            row = SportsFixture(provider_id=item["id"], league_id=league.id)
            db.add(row)
        row.league_id = league.id
        row.season_id = item.get("season_id")
        row.home_team_id = item.get("home_team_id")
        row.away_team_id = item.get("away_team_id")
        row.home_team = item.get("home_team") or "Home"
        row.away_team = item.get("away_team") or "Away"
        row.event_date = parse_event_date(item.get("event_date") or item.get("match_date"))
        row.status = item.get("status") or "unknown"
        row.home_score = item.get("home_score")
        row.away_score = item.get("away_score")
        row.round_name = item.get("round_name")
        row.synced_at = now()
        rows.append(row)
    db.commit()
    return rows


def fixtures_for_league(
    db: Session,
    slug: str,
    date_from: str | None,
    date_to: str | None,
    status: str | None,
    limit: int,
    offset: int,
    season_id: int | None = None,
    refresh: bool = False,
) -> list[SportsFixture]:
    league = league_by_slug(db, slug)
    query = select(SportsFixture).where(SportsFixture.league_id == league.id).order_by(SportsFixture.event_date).limit(limit).offset(offset)
    rows = db.scalars(query).all()
    if refresh or not rows:
        params = {
            "league_id": league.provider_id,
            "season_id": season_id or league.current_season_id,
            "date_from": date_from,
            "date_to": date_to,
            "status": status,
            "limit": limit,
            "offset": offset,
        }
        payload = BzzoiroClient().get("/api/v2/events/", params, ttl=300)
        rows = upsert_fixtures(db, league, page_results(payload))
    return rows


def upsert_players(db: Session, items: list[dict[str, Any]]) -> list[SportsPlayer]:
    rows: list[SportsPlayer] = []
    for item in items:
        row = db.scalar(select(SportsPlayer).where(SportsPlayer.provider_id == item["id"]))
        if not row:
            row = SportsPlayer(provider_id=item["id"])
            db.add(row)
        row.current_team_id = item.get("current_team_id")
        row.name = item.get("name") or item.get("short_name") or "Unknown player"
        row.short_name = item.get("short_name")
        row.position = item.get("position")
        row.nationality = item.get("nationality")
        row.market_value_eur = item.get("market_value_eur")
        row.synced_at = now()
        rows.append(row)
    db.commit()
    return rows


def players_for_team(db: Session, team_id: int, limit: int, offset: int, refresh: bool = False) -> list[SportsPlayer]:
    query = select(SportsPlayer).where(SportsPlayer.current_team_id == team_id).order_by(SportsPlayer.name).limit(limit).offset(offset)
    rows = db.scalars(query).all()
    if refresh or not rows:
        payload = BzzoiroClient().get("/api/v2/players/", {"team_id": team_id, "limit": limit, "offset": offset}, ttl=3_600)
        rows = upsert_players(db, page_results(payload))
    return rows


def run_minimal_sync(db: Session, days_ahead: int = 21) -> dict[str, int]:
    sync = SportsSyncRun(scope="top-uefa-leagues", status="running")
    db.add(sync)
    db.commit()
    counts = {"leagues": 0, "teams": 0, "fixtures": 0}
    try:
        leagues = sync_top_leagues(db)
        counts["leagues"] = len(leagues)
        date_from = datetime.now(timezone.utc).date().isoformat()
        date_to = (datetime.now(timezone.utc) + timedelta(days=days_ahead)).date().isoformat()
        for league in leagues:
            counts["teams"] += len(teams_for_league(db, league.slug, 200, 0, refresh=True))
            counts["fixtures"] += len(fixtures_for_league(db, league.slug, date_from, date_to, None, 200, 0, refresh=True))
        sync.status = "success"
        sync.message = json.dumps(counts)
    except Exception as exc:
        sync.status = "failed"
        sync.message = str(exc)
        raise
    finally:
        sync.finished_at = now()
        db.commit()
    return counts


def cleanup_stale_sports_data(db: Session, keep_finished_days: int = 540) -> dict[str, int]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=keep_finished_days)
    result = db.execute(delete(SportsFixture).where(SportsFixture.status == "finished", SportsFixture.event_date < cutoff))
    player_cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    player_result = db.execute(delete(SportsPlayer).where(SportsPlayer.synced_at < player_cutoff))
    db.commit()
    return {"fixtures_deleted": result.rowcount or 0, "players_deleted": player_result.rowcount or 0}
