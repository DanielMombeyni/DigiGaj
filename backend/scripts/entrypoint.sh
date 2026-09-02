#!/bin/sh
set -e
echo "Waiting for PostgreSQL..."
until python -c "import socket; s=socket.socket(); s.settimeout(1); s.connect(('${POSTGRES_HOST:-db}', int('${POSTGRES_PORT:-5432}'))); s.close()" 2>/dev/null; do
  sleep 1
done
echo "DB is up."
python manage.py migrate --noinput
python manage.py collectstatic --noinput || true
if [ "${DJANGO_ENV:-}" = "production" ] && [ "${AUTO_DEPLOY_CONFIG:-1}" != "0" ]; then
  python /app/scripts/detect_deploy_env.py || true
  if [ -f /app/runtime/deploy.env ]; then
    set -a
    # shellcheck disable=SC1091
    . /app/runtime/deploy.env
    set +a
  fi
fi
python manage.py seed_bootstrap --if-needed || true
if [ "${RUN_SEED:-0}" = "1" ]; then
  python manage.py seed_demo --if-needed || true
fi
exec "$@"