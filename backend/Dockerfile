FROM python:3.12.13-slim-bookworm@sha256:4766d8b510c428e595d74b9cc5bbb2fae8e26316fffb4adc89908d79aacd58a2

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

RUN groupadd --system --gid 10001 fieldyield \
    && useradd --system --uid 10001 --gid fieldyield --home-dir /app --shell /usr/sbin/nologin fieldyield

WORKDIR /app
COPY --chown=fieldyield:fieldyield requirements.txt ./requirements.txt
RUN python -m pip install --requirement requirements.txt
COPY --chown=fieldyield:fieldyield . .
RUN chmod 0555 /app/start.sh && find /app -type f -exec chmod 0444 {} + && chmod 0555 /app/start.sh

USER fieldyield:fieldyield
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["python", "-c", "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.getenv('PORT','8000')+'/health/live', timeout=3)"]
CMD ["sh", "/app/start.sh"]
