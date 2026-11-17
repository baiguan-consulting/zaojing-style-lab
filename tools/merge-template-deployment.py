from __future__ import annotations

import json
import sys
from pathlib import Path


SLUGS = {
    "travel-art-poster",
    "glass-art-diptych",
    "low-poly-origami-pet",
}


def main(remote_path: str, local_path: str, output_path: str) -> None:
    remote = json.loads(Path(remote_path).read_text(encoding="utf-8"))
    local = json.loads(Path(local_path).read_text(encoding="utf-8"))

    existing = [item for item in remote if item.get("slug") not in SLUGS]
    additions = [item for item in local if item.get("slug") in SLUGS]
    if {item["slug"] for item in additions} != SLUGS:
        raise SystemExit("The local template additions are incomplete.")

    Path(output_path).write_text(
        json.dumps(additions + existing, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main(*sys.argv[1:])
