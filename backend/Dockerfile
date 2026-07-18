FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV PORT=8000

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc gosu \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN sed -i 's/\r$//' scripts/docker-entrypoint.sh \
    && chmod +x scripts/docker-entrypoint.sh \
    && addgroup --system zinapp \
    && adduser --system --ingroup zinapp --home /app zinapp \
    && chown -R zinapp:zinapp /app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD python -c "import os,urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\", \"8000\")}/api/health/')" || exit 1

# Entrypoint starts as root to chown the Railway media volume, then drops to zinapp.
USER root

ENTRYPOINT ["/bin/sh", "scripts/docker-entrypoint.sh"]
