FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements/ /tmp/requirements/
ARG REQUIREMENTS_FILE=dev.txt
RUN pip install --upgrade pip && pip install -r /tmp/requirements/${REQUIREMENTS_FILE}

COPY . /app

RUN chmod +x /app/scripts/*.sh || true

EXPOSE 8000

CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "config.asgi:application"]
