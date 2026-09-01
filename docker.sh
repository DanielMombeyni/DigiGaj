#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

DEV_COMPOSE="docker compose -f docker-compose.dev.yml"
PROD_COMPOSE="docker compose -f docker-compose.prod.yml"

ensure_env() {
  if [[ ! -f .env ]]; then
    echo "→ Creating .env from .env.example"
    cp .env.example .env
  fi
}

usage() {
  cat <<'EOF'
Gadget Store — Docker helper

Usage:
  ./docker.sh <env> <command> [args]

Environments:
  dev     Local development stack
  prod    Production stack

Commands:
  up              Start services (detached)
  down            Stop and remove containers
  rebuild         Rebuild images and recreate containers
  restart         Restart all services
  logs [svc]      Tail logs (optional service name)
  ps              List running containers
  shell           Open backend shell (bash)
  manage <args>   Run Django manage.py (e.g. migrate, createsuperuser)
  seed            Seed demo data
  migrate         Run migrations
  test            Run backend tests
  frontend-sh     Open frontend shell
  prune           Remove unused docker data for this project (careful)

Examples:
  ./docker.sh dev up
  ./docker.sh dev down
  ./docker.sh prod up
  ./docker.sh prod rebuild
  ./docker.sh prod down
  ./docker.sh dev logs backend
  ./docker.sh dev manage createsuperuser
  ./docker.sh dev seed
EOF
}

compose_for() {
  case "$1" in
    dev) echo "$DEV_COMPOSE" ;;
    prod) echo "$PROD_COMPOSE" ;;
    *) echo ""; return 1 ;;
  esac
}

main() {
  if [[ $# -lt 1 ]]; then
    usage
    exit 0
  fi

  local env="${1:-}"
  local cmd="${2:-}"

  if [[ "$env" == "-h" || "$env" == "--help" || "$env" == "help" ]]; then
    usage
    exit 0
  fi

  if [[ -z "$cmd" ]]; then
    usage
    exit 1
  fi

  local COMPOSE
  COMPOSE="$(compose_for "$env")" || {
    echo "Unknown env: $env (use dev|prod)"
    exit 1
  }

  ensure_env
  shift 2 || true

  case "$cmd" in
    up)
      $COMPOSE up -d "$@"
      echo "✓ $env stack is up"
      if [[ "$env" == "dev" ]]; then
        echo "  Frontend: http://localhost:5173"
        echo "  API:      http://localhost:8000/api/v1/"
        echo "  Docs:     http://localhost:8000/api/docs/"
        echo "  Admin:    http://localhost:8000/admin/"
      else
        echo "  Frontend: http://localhost:8080"
        echo "  API:      http://localhost:8000/api/v1/"
      fi
      ;;
    down)
      $COMPOSE down "$@"
      echo "✓ $env stack stopped"
      ;;
    rebuild)
      $COMPOSE build --no-cache "$@"
      $COMPOSE up -d --force-recreate
      echo "✓ $env rebuilt and restarted"
      ;;
    restart)
      $COMPOSE restart "$@"
      ;;
    logs)
      $COMPOSE logs -f --tail=200 "$@"
      ;;
    ps)
      $COMPOSE ps
      ;;
    shell)
      $COMPOSE exec backend bash || $COMPOSE exec backend sh
      ;;
    frontend-sh)
      $COMPOSE exec frontend sh
      ;;
    manage)
      $COMPOSE exec backend python manage.py "$@"
      ;;
    migrate)
      $COMPOSE exec backend python manage.py migrate
      ;;
    seed)
      $COMPOSE exec backend python manage.py seed_demo
      ;;
    test)
      $COMPOSE exec backend pytest -q "$@"
      ;;
    prune)
      $COMPOSE down -v --remove-orphans
      echo "✓ volumes removed for $env"
      ;;
    *)
      echo "Unknown command: $cmd"
      usage
      exit 1
      ;;
  esac
}

main "$@"
