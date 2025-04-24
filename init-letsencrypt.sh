#!/bin/bash

# Initialize Let's Encrypt certificates using environment variables
# Based on https://github.com/wmnnd/nginx-certbot

if ! [ -x "$(command -v docker-compose)" ]; then
  echo 'Error: docker-compose is not installed.' >&2
  exit 1
fi

# Load environment variables from .env file
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Set default values if not defined in environment
domains=${DOMAIN_NAME:-example.com}
email=${EMAIL_ADDRESS:-admin@example.com}
rsa_key_size=4096
staging=0 # Set to 1 if you're testing your setup to avoid hitting request limits

echo "Creating directory structure for certificates..."
mkdir -p ./data/certbot/conf/live/$domains
mkdir -p ./data/certbot/www

echo "Creating dummy certificates for $domains..."
openssl req -x509 -nodes -newkey rsa:$rsa_key_size -days 1 \
  -keyout "./data/certbot/conf/live/$domains/privkey.pem" \
  -out "./data/certbot/conf/live/$domains/fullchain.pem" \
  -subj "/CN=localhost"

echo "Starting nginx to verify paths..."
docker-compose up --force-recreate -d frontend
echo "Waiting for nginx to start..."
sleep 5

echo "Removing dummy certificates..."
docker-compose run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/$domains && \
  rm -Rf /etc/letsencrypt/archive/$domains && \
  rm -Rf /etc/letsencrypt/renewal/$domains.conf" certbot

echo "Requesting Let's Encrypt certificate for $domains..."
#Join $domains to -d args
domain_args=""
for domain in $domains; do
  domain_args="$domain_args -d $domain"
done

# Select appropriate email arg
case "$email" in
  "") email_arg="--register-unsafely-without-email" ;;
  *) email_arg="--email $email" ;;
esac

# Enable staging mode if needed
if [ $staging != "0" ]; then staging_arg="--staging"; fi

docker-compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $staging_arg \
    $email_arg \
    $domain_args \
    --rsa-key-size $rsa_key_size \
    --agree-tos \
    --force-renewal" certbot

echo "Reloading nginx with new certificates..."
docker-compose exec frontend nginx -s reload