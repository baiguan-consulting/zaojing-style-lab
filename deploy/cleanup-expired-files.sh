#!/usr/bin/env bash
set -euo pipefail

data_root="${ZAOJING_DATA_ROOT:-/opt/zaojing/storage/data}"

for directory in "${data_root}/temporary-uploads" "${data_root}/generated-images"; do
  if [[ -d "${directory}" ]]; then
    find "${directory}" -type f -mmin +1440 -delete
  fi
done

