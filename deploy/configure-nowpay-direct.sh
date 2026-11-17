#!/usr/bin/env bash
set -euo pipefail

project_root="${ZAOJING_PROJECT_ROOT:-/opt/zaojing}"
env_file="${project_root}/.env.production"
product_id="DIRECT_a6d335a25c543fda9ca6c2b2bf78a214"

if [[ ! -f "${env_file}" ]]; then
  echo "Production environment file not found: ${env_file}" >&2
  exit 1
fi

echo "Configure the Alipay application that owns the NowPay product."
echo "Private keys are hidden and must never be pasted into chat."
read -r -p "Alipay production App ID: " app_id
read -r -s -p "Node.js PKCS#1 application private key: " private_key
echo
read -r -s -p "Alipay public key: " alipay_public_key
echo

if [[ ! "${app_id}" =~ ^[0-9]{12,24}$ ]]; then
  echo "App ID format is invalid." >&2
  exit 1
fi
if [[ ${#private_key} -lt 256 || "${private_key}" == *"BEGIN"* ]]; then
  echo "The application private key must be the raw one-line PKCS#1 value without PEM headers." >&2
  exit 1
fi
if [[ ${#alipay_public_key} -lt 256 || "${alipay_public_key}" == *"BEGIN"* ]]; then
  echo "The Alipay public key must be the raw one-line value without PEM headers." >&2
  exit 1
fi

umask 077
temporary="$(mktemp "${env_file}.XXXXXX")"
cleanup() {
  rm -f -- "${temporary}"
  unset private_key alipay_public_key
}
trap cleanup EXIT

grep -v -E '^(NOWPAY_ENABLED|NOWPAY_PRODUCT_ID|ALIPAY_APP_ID|ALIPAY_PRIVATE_KEY|ALIPAY_PUBLIC_KEY|ALIPAY_GATEWAY)=' "${env_file}" > "${temporary}" || true
cat >> "${temporary}" <<EOF
NOWPAY_ENABLED=false
NOWPAY_PRODUCT_ID=${product_id}
ALIPAY_APP_ID=${app_id}
ALIPAY_PRIVATE_KEY=${private_key}
ALIPAY_PUBLIC_KEY=${alipay_public_key}
ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do
EOF

chmod 600 "${temporary}"
mv -f -- "${temporary}" "${env_file}"
trap - EXIT
unset private_key alipay_public_key

cd "${project_root}"
docker compose --env-file .env.production up -d --no-deps --force-recreate app

echo "NowPay Direct parameters were saved without displaying keys."
echo "NOWPAY_ENABLED remains false until product, purchase, balance and consumption checks pass."
