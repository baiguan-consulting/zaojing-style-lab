#!/usr/bin/env bash
set -euo pipefail

source_dir=/tmp/zaojing-template-deploy
target_dir=/opt/zaojing
required_slugs=(travel-art-poster glass-art-diptych low-poly-origami-pet)

test -f "$source_dir/templates.json"
test -d "$source_dir/uploads"

python3 - "$source_dir/templates.json" "${required_slugs[@]}" <<'PY'
import json
import sys

templates = json.load(open(sys.argv[1], encoding="utf-8"))
slugs = [item["slug"] for item in templates]
for slug in sys.argv[2:]:
    if slugs.count(slug) != 1:
        raise SystemExit(f"Expected exactly one {slug} template, found {slugs.count(slug)}")
PY

for slug in "${required_slugs[@]}"; do
  test "$(find "$source_dir/uploads" -maxdepth 1 -type f -name "$slug-*.jpg" | wc -l)" -eq 6
done

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
cp "$target_dir/storage/data/templates.json" "$target_dir/storage/data/templates.json.before-template-upload-$timestamp"
cp "$source_dir/templates.json" "$target_dir/storage/data/templates.json"
cp "$source_dir/uploads"/*.jpg "$target_dir/storage/uploads/"

printf 'backup=%s\n' "$target_dir/storage/data/templates.json.before-template-upload-$timestamp"
printf 'template_count='
grep -c '"slug"' "$target_dir/storage/data/templates.json"
printf 'uploaded_assets='
find "$target_dir/storage/uploads" -maxdepth 1 -type f \( -name 'travel-art-poster-*.jpg' -o -name 'glass-art-diptych-*.jpg' -o -name 'low-poly-origami-pet-*.jpg' \) | wc -l
