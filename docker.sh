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

print_urls() {
  local env="$1"
  if [[ "$env" == "dev" ]]; then
    echo "  Frontend: http://localhost:5173"
    echo "  API:      http://localhost:8000/api/v1/"
    echo "  Docs:     http://localhost:8000/api/docs/"
    echo "  Admin:    http://localhost:8000/admin/"
  else
    echo "  Site:     https://digigadg.com (or http://SERVER_IP without SSL)"
    echo "  API:      /api/v1/ (same domain via proxy)"
    echo "  Panel:    /panel-dashboard"
  fi
}

usage() {
  cat <<'EOF'
Gadget Store — Docker helper

Usage:
  ./docker.sh <env> <command> [args]

Environments:
  dev          Local development stack
  Production   Production stack

Commands:
  up [svc]        Start stack (build if needed). Backend auto-runs:
                  migrate, collectstatic, deploy detect, seed (once only).
  rebuild [svc]   Rebuild images from scratch and recreate containers.
  restart [svc] Restart all services, or only named ones (backend, proxy, …).
  down            Stop and remove containers
  logs [svc]      Tail logs (optional service name)
  ps              List running containers
  shell           Open backend shell (bash)
  manage <args>   Run Django manage.py
  seed            Force bootstrap seed
  seed-demo       Force demo catalog seed
  migrate         Run migrations
  test            Run backend tests
  frontend-sh     Open frontend shell
  prune           Remove unused docker data for this project (careful)

Examples:
  ./docker.sh Production up
  ./docker.sh Production rebuild
  ./docker.sh Production restart
  ./docker.sh Production restart backend proxy
  ./docker.sh dev up
  ./docker.sh dev logs backend
EOF
}

compose_for() {
  case "$1" in
    dev) echo "$DEV_COMPOSE" ;;
    Production|production|prod) echo "$PROD_COMPOSE" ;;
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
    echo "Unknown env: $env (use dev|Production)"
    exit 1
  }

  ensure_env
  shift 2 || true

  case "$cmd" in
    up)
      echo "→ Starting $env stack (build if needed)..."
      echo "  Backend entrypoint: migrate · static · deploy detect · seed (once)"
      $COMPOSE up -d --build "$@"
      echo ""
      $COMPOSE ps
      echo ""
      echo "✓ $env stack is up"
      print_urls "$env"
      ;;
    down)
      $COMPOSE down "$@"
      echo "✓ $env stack stopped"
      ;;
    rebuild)
      echo "→ Rebuilding $env images (no cache)..."
      if [[ $# -gt 0 ]]; then
        $COMPOSE build --no-cache "$@"
        $COMPOSE up -d --force-recreate "$@"
      else
        $COMPOSE build --no-cache
        $COMPOSE up -d --force-recreate
      fi
      echo ""
      $COMPOSE ps
      echo ""
      echo "✓ $env rebuilt and restarted"
      print_urls "$env"
      ;;
    restart)
      if [[ $# -eq 0 ]]; then
        echo "→ Restarting all $env services..."
        $COMPOSE restart
      else
        echo "→ Restarting $env service(s): $*"
        $COMPOSE restart "$@"
      fi
      echo "✓ restart complete"
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
      $COMPOSE exec backend python manage.py seed_bootstrap --force "$@"
      ;;
    seed-demo)
      $COMPOSE exec backend python manage.py seed_demo --force "$@"
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
