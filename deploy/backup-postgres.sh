#!/usr/bin/env bash
set -euo pipefail

project_root="${ZAOJING_PROJECT_ROOT:-/opt/zaojing}"
backup_root="${ZAOJING_BACKUP_ROOT:-${project_root}/backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="${backup_root}/zaojing-${timestamp}.sql.gz"
temporary="${target}.tmp"

umask 077
mkdir -p "${backup_root}"
cd "${project_root}"

docker compose --env-file .env.production exec -T postgres \
  sh -c 'pg_dump --clean --if-exists --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  | gzip -9 > "${temporary}"

mv "${temporary}" "${target}"
find "${backup_root}" -type f -name 'zaojing-*.sql.gz' -mtime +7 -delete

echo "Database backup created: ${target}"

