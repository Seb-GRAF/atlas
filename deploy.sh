#!/usr/bin/env bash
# Runs on the VPS. Triggered by .github/workflows/deploy.yml over SSH.
# Pulls the latest main, installs deps, builds the UI, restarts the service.

set -euo pipefail

REPO_DIR="/var/www/atlas"
SERVICE="atlas.service"
SERVICE_USER="www-data"

cd "$REPO_DIR"

echo "==> Fetching latest main"
sudo -u "$SERVICE_USER" git fetch --all --prune
sudo -u "$SERVICE_USER" git reset --hard origin/main

echo "==> Installing dependencies"
sudo -u "$SERVICE_USER" npm ci

echo "==> Building dashboard UI"
sudo -u "$SERVICE_USER" npm run build:ui

echo "==> Restarting $SERVICE"
sudo systemctl restart "$SERVICE"

echo "==> Waiting for service to come up"
sleep 3
systemctl is-active --quiet "$SERVICE" || {
  echo "ERROR: $SERVICE failed to start" >&2
  systemctl status "$SERVICE" --no-pager || true
  exit 1
}

echo "==> Deploy OK ($(git rev-parse --short HEAD))"
