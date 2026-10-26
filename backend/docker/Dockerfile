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
ARG PIP_FALLBACK_INDEX_URL=https://mirror-pypi.runflare.com/simple
RUN (python -m pip install --upgrade pip --index-url https://pypi.org/simple --timeout 30 --retries 1 \
     || { echo "Primary PyPI failed upgrading pip; retrying with ${PIP_FALLBACK_INDEX_URL}"; \
          python -m pip install --upgrade pip --index-url "${PIP_FALLBACK_INDEX_URL}" --timeout 60 --retries 2; }) \
    && (python -m pip install -r "/tmp/requirements/${REQUIREMENTS_FILE}" \
          --index-url https://pypi.org/simple --timeout 30 --retries 1 \
        || { echo "Primary PyPI failed installing requirements; retrying with ${PIP_FALLBACK_INDEX_URL}"; \
             python -m pip install -r "/tmp/requirements/${REQUIREMENTS_FILE}" \
               --index-url "${PIP_FALLBACK_INDEX_URL}" --timeout 60 --retries 2; })

COPY . /app

RUN chmod +x /app/scripts/*.sh || true

EXPOSE 8000

CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "config.asgi:application"]
