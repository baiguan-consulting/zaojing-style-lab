#!/usr/bin/env bash
set -euo pipefail

cd /opt/zaojing
docker compose --env-file .env.production restart app

for _ in $(seq 1 24); do
  if [ "$(docker inspect --format '{{.State.Health.Status}}' zaojing-app-1)" = "healthy" ]; then
    break
  fi
  sleep 5
done

test "$(docker inspect --format '{{.State.Health.Status}}' zaojing-app-1)" = "healthy"

curl -fsSI -H 'Host: picture.baiguan-consulting.com' http://127.0.0.1/uploads/travel-art-poster-after-1.jpg >/dev/null
curl -fsSI -H 'Host: picture.baiguan-consulting.com' http://127.0.0.1/uploads/glass-art-diptych-after-1.jpg >/dev/null
curl -fsSI -H 'Host: picture.baiguan-consulting.com' http://127.0.0.1/uploads/low-poly-origami-pet-after-1.jpg >/dev/null
curl -fsS -H 'Host: picture.baiguan-consulting.com' http://127.0.0.1/ >/tmp/zaojing-homepage.html
grep -q '/uploads/travel-art-poster-after-1.jpg' /tmp/zaojing-homepage.html
grep -q '/uploads/glass-art-diptych-after-1.jpg' /tmp/zaojing-homepage.html
grep -q '/uploads/low-poly-origami-pet-after-1.jpg' /tmp/zaojing-homepage.html

echo 'app=healthy'
echo 'homepage=contains-three-templates'
echo 'assets=three-cover-images-reachable'
