#!/usr/bin/env bash
set -euo pipefail

project_root="${ZAOJING_PROJECT_ROOT:-/opt/zaojing}"
env_file="${project_root}/.env.production"

if [[ ! -f "${env_file}" ]]; then
  echo "Production environment file not found: ${env_file}" >&2
  exit 1
fi

echo "This setup runs on the server. Do not paste any key into chat."
read -r -p "Alipay production App ID: " app_id
read -r -s -p "Node.js PKCS#1 application private key: " private_key
echo
read -r -s -p "Alipay public key: " alipay_public_key
echo
read -r -p "Seller ID (recommended): " seller_id

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
if [[ ! "${seller_id}" =~ ^[0-9]{8,32}$ ]]; then
  echo "Seller ID format is invalid." >&2
  exit 1
fi

umask 077
temporary="$(mktemp "${env_file}.XXXXXX")"
cleanup() {
  rm -f -- "${temporary}"
  unset private_key alipay_public_key
}
trap cleanup EXIT

grep -v -E '^(PAYMENTS_ENABLED|ALIPAY_APP_ID|ALIPAY_PRIVATE_KEY|ALIPAY_PUBLIC_KEY|ALIPAY_GATEWAY|ALIPAY_NOTIFY_URL|ALIPAY_SELLER_ID|ALIPAY_SELLER_EMAIL)=' "${env_file}" > "${temporary}" || true
cat >> "${temporary}" <<EOF
PAYMENTS_ENABLED=false
ALIPAY_APP_ID=${app_id}
ALIPAY_PRIVATE_KEY=${private_key}
ALIPAY_PUBLIC_KEY=${alipay_public_key}
ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do
ALIPAY_NOTIFY_URL=https://picture.baiguan-consulting.com/api/payments/alipay/notify
ALIPAY_SELLER_ID=${seller_id}
ALIPAY_SELLER_EMAIL=
EOF

chmod 600 "${temporary}"
mv -f -- "${temporary}" "${env_file}"
trap - EXIT
unset private_key alipay_public_key

cd "${project_root}"
docker compose --env-file .env.production up -d --no-deps --force-recreate app

echo "Alipay production parameters were saved without displaying the keys."
echo "PAYMENTS_ENABLED remains false until the signed connection test and real payment acceptance pass."
