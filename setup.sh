#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=".env"
TEMPLATE_FILE=".env.example"

if [ ! -f "$TEMPLATE_FILE" ]; then
  echo "Error: $TEMPLATE_FILE is missing. Please restore it before running this script." >&2
  exit 1
fi

if [ -f "$ENV_FILE" ]; then
  read -r -p "$ENV_FILE already exists. Overwrite it? [y/N]: " OVERWRITE
  case "$OVERWRITE" in
    y|Y) echo "Overwriting existing $ENV_FILE";;
    *) echo "Aborting. Existing $ENV_FILE left untouched."; exit 0;;
  esac
fi

prompt_non_empty() {
  local prompt="$1"
  local value=""
  while [ -z "$value" ]; do
    read -r -p "$prompt" value
    if [ -z "$value" ]; then
      echo "Value cannot be empty. Please try again." >&2
    fi
  done
  echo "$value"
}

generate_secret() {
  local bytes="$1"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 "$bytes" | tr -d '\n'
  else
    python - <<'PY' "$bytes"
import base64, os, sys
n = int(sys.argv[1])
print(base64.b64encode(os.urandom(n)).decode())
PY
  fi
}

DOMAIN_NAME=$(prompt_non_empty "Domain name (e.g. example.com): ")
DEFAULT_EMAIL="admin@${DOMAIN_NAME}"
read -r -p "Admin email [${DEFAULT_EMAIL}]: " EMAIL_ADDRESS
EMAIL_ADDRESS=${EMAIL_ADDRESS:-$DEFAULT_EMAIL}

MONGO_PASSWORD=$(generate_secret 24)
SESSION_SECRET=$(generate_secret 48)
JWT_SECRET=$(generate_secret 48)

cat > "$ENV_FILE" <<EOF
# MongoDB Configuration
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=${MONGO_PASSWORD}

# Backend Configuration
API_PORT=5000
SESSION_SECRET=${SESSION_SECRET}
JWT_SECRET=${JWT_SECRET}

# Frontend Configuration
DOMAIN_NAME=${DOMAIN_NAME}
EMAIL_ADDRESS=${EMAIL_ADDRESS}
CLIENT_URL=https://${DOMAIN_NAME}

# Let's Encrypt with Cloudflare DNS Configuration
CLOUDFLARE_API_TOKEN=
EOF

echo "Created $ENV_FILE with generated secrets."
echo "Domain: ${DOMAIN_NAME}"
echo "Email: ${EMAIL_ADDRESS}"
echo "Cloudflare token left empty. Add it later if you use Cloudflare DNS validation."
