param(
  [Parameter(Position=0)][string]$EnvName = "",
  [Parameter(Position=1)][string]$Command = "",
  [Parameter(ValueFromRemainingArguments=$true)]$Rest
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Ensure-Env {
  if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example"
  }
}

function Usage {
  @"
Gadget Store — Docker helper (PowerShell)

Usage:
  .\docker.ps1 <env> <command> [args]

Environments:  dev | prod

Commands:
  up | down | rebuild | restart | logs | ps | shell | manage | migrate | seed | test | prune

Examples:
  .\docker.ps1 dev up
  .\docker.ps1 dev down
  .\docker.ps1 prod up
  .\docker.ps1 prod rebuild
  .\docker.ps1 prod down
  .\docker.ps1 dev logs backend
  .\docker.ps1 dev manage makemigrations
"@
}

if (-not $EnvName -or $EnvName -in @("-h","--help","help")) {
  Usage
  exit 0
}

if (-not $Command) {
  Usage
  exit 1
}

$composeFile = if ($EnvName -eq "dev") { "docker-compose.dev.yml" }
  elseif ($EnvName -eq "prod") { "docker-compose.prod.yml" }
  else { Write-Error "Unknown env: $EnvName"; exit 1 }

Ensure-Env
$dc = { docker compose -f $composeFile @args }

switch ($Command) {
  "up" {
    & docker compose -f $composeFile up -d @Rest
    Write-Host "✓ $EnvName stack is up"
    if ($EnvName -eq "dev") {
      Write-Host "  Frontend: http://localhost:5173"
      Write-Host "  API:      http://localhost:8000/api/v1/"
      Write-Host "  Docs:     http://localhost:8000/api/docs/"
    } else {
      Write-Host "  Frontend: http://localhost:8080"
      Write-Host "  API:      http://localhost:8000/api/v1/"
    }
  }
  "down" { & docker compose -f $composeFile down @Rest }
  "rebuild" {
    & docker compose -f $composeFile build --no-cache @Rest
    & docker compose -f $composeFile up -d --force-recreate
  }
  "restart" { & docker compose -f $composeFile restart @Rest }
  "logs" { & docker compose -f $composeFile logs -f --tail=200 @Rest }
  "ps" { & docker compose -f $composeFile ps }
  "shell" { & docker compose -f $composeFile exec backend bash }
  "manage" { & docker compose -f $composeFile exec backend python manage.py @Rest }
  "migrate" { & docker compose -f $composeFile exec backend python manage.py migrate }
  "seed" { & docker compose -f $composeFile exec backend python manage.py seed_demo }
  "test" { & docker compose -f $composeFile exec backend pytest -q @Rest }
  "prune" { & docker compose -f $composeFile down -v --remove-orphans }
  default { Write-Error "Unknown command: $Command"; Usage; exit 1 }
}
