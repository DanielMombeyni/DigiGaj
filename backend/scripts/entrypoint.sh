#!/bin/sh
set -e
echo "Waiting for PostgreSQL..."
until python -c "import socket; s=socket.socket(); s.settimeout(1); s.connect(('${POSTGRES_HOST:-db}', int('${POSTGRES_PORT:-5432}'))); s.close()" 2>/dev/null; do
  sleep 1
done
echo "DB is up."
python manage.py migrate --noinput
python manage.py collectstatic --noinput || true
if [ "${RUN_SEED:-0}" = "1" ]; then
  python manage.py seed_demo || true
fi
exec "$@"