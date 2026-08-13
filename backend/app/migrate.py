from alembic import command
from alembic.config import Config
from sqlalchemy import text

from app.core.database import engine

LOCK_ID = 0x4649454C44594945  # "FIELDYIE" as a stable signed-64-bit advisory key.


def main() -> None:
    config = Config("alembic.ini")
    if engine.dialect.name != "postgresql":
        command.upgrade(config, "head")
        return
    with engine.connect() as connection:
        connection.execute(text("SELECT pg_advisory_lock(:lock_id)"), {"lock_id": LOCK_ID})
        try:
            config.attributes["connection"] = connection
            command.upgrade(config, "head")
        finally:
            connection.execute(text("SELECT pg_advisory_unlock(:lock_id)"), {"lock_id": LOCK_ID})


if __name__ == "__main__":
    main()
