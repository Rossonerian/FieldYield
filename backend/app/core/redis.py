from redis import Redis
from app.core.config import settings

def get_redis(): return Redis.from_url(settings.redis_url, decode_responses=True)

def get_redis_or_none():
    try:
        client = get_redis()
        client.ping()
        return client
    except Exception:
        return None
