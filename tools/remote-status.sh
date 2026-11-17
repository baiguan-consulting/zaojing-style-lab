#!/usr/bin/env bash
set -euo pipefail

cd /opt/zaojing
printf 'templates='
grep -c '"slug"' storage/data/templates.json
printf 'uploads='
find storage/uploads -maxdepth 1 -type f | wc -l
docker compose --env-file .env.production ps --format '{{.Name}} {{.State}} {{.Health}}'
