#!/usr/bin/env bash
set -euo pipefail

cd /opt/zaojing
echo 'mounted-files:'
docker compose --env-file .env.production exec -T app sh -c 'find /app/public/uploads -maxdepth 1 -type f | sort | tail -20'
echo 'internal-statuses:'
docker compose --env-file .env.production exec -T app node -e "Promise.all(['travel-art-poster-after-1.jpg','glass-art-diptych-after-1.jpg','low-poly-origami-pet-after-1.jpg'].map(async name => console.log(name, (await fetch('http://127.0.0.1:3000/uploads/' + name)).status))).catch(error => { console.error(error); process.exit(1) })"
echo 'homepage-template-links:'
docker compose --env-file .env.production exec -T app node -e "fetch('http://127.0.0.1:3000/').then(response => response.text()).then(html => ['travel-art-poster','glass-art-diptych','low-poly-origami-pet'].forEach(slug => console.log(slug, html.includes('/templates/' + slug)))).catch(error => { console.error(error); process.exit(1) })"
