#!/bin/bash
# Docker Deployment Script for Game Server Manager

# Check if .env file exists, if not create from template
if [ ! -f .env ]; then
  echo "Creating .env file from template..."
  cp .env.example .env
  echo "Please edit the .env file with your preferred settings."
  echo "You should at least change the passwords and secrets before deploying to production."
  exit 1
fi

# Load environment variables
source .env
DOMAIN=${DOMAIN_NAME:-example.com}

# Check command argument
case "$1" in
  start)
    echo "Starting Game Server Manager containers..."
    docker-compose up -d
    echo "Containers started! Frontend should be available at https://$DOMAIN"
    ;;
  stop)
    echo "Stopping Game Server Manager containers..."
    docker-compose down
    ;;
  restart)
    echo "Restarting Game Server Manager containers..."
    docker-compose restart
    ;;
  rebuild)
    echo "Rebuilding and restarting Game Server Manager containers..."
    docker-compose down
    docker-compose build --no-cache
    docker-compose up -d
    ;;
  logs)
    echo "Showing logs for Game Server Manager containers..."
    docker-compose logs -f
    ;;
  backup)
    echo "Backing up MongoDB data..."
    # Create backup directory if it doesn't exist
    mkdir -p ./backups
    # Get container ID
    CONTAINER_ID=$(docker-compose ps -q mongodb)
    # Run mongodump inside the container
    docker exec $CONTAINER_ID mongodump --username ${MONGO_INITDB_ROOT_USERNAME:-admin} --password ${MONGO_INITDB_ROOT_PASSWORD:-admin_password} --authenticationDatabase admin --db gameserver-manager --out /data/db/backup
    # Copy backup from container to host
    docker cp $CONTAINER_ID:/data/db/backup ./backups/mongodb-$(date +%Y%m%d-%H%M%S)
    echo "Backup created in ./backups directory"
    ;;
  letsencrypt-cloudflare)
    # Check if Cloudflare credentials are set in environment variables
    CF_EMAIL=${CLOUDFLARE_EMAIL}
    CF_API_KEY=${CLOUDFLARE_API_KEY}
    
    # Allow override from command line parameters
    if [ ! -z "$2" ] && [ ! -z "$3" ]; then
      CF_EMAIL=$2
      CF_API_KEY=$3
    fi
    
    # Final check for required credentials
    if [ -z "$CF_EMAIL" ] || [ -z "$CF_API_KEY" ]; then
      echo "Error: Cloudflare credentials are required."
      echo "Either set CLOUDFLARE_EMAIL and CLOUDFLARE_API_KEY in .env file"
      echo "Or provide them as parameters:"
      echo "Usage: $0 letsencrypt-cloudflare <cloudflare-email> <cloudflare-api-key>"
      echo "Example: $0 letsencrypt-cloudflare user@example.com 1234567890abcdef1234567890abcdef"
      exit 1
    fi
    
    echo "Setting up Let's Encrypt certificates for domain: $DOMAIN using Cloudflare DNS validation"
    
    # Create necessary directories
    mkdir -p ./data/certbot/conf/live/$DOMAIN
    mkdir -p ./data/certbot/cloudflare
    
    # Create Cloudflare credentials file
    cat > ./data/certbot/cloudflare/cloudflare.ini << EOF
dns_cloudflare_email = $CF_EMAIL
dns_cloudflare_api_key = $CF_API_KEY
EOF

    # Set proper permissions for credentials file
    chmod 600 ./data/certbot/cloudflare/cloudflare.ini
    
    # Run certbot with Cloudflare DNS plugin
    docker run --rm -v "$(pwd)/data/certbot/conf:/etc/letsencrypt" \
                    -v "$(pwd)/data/certbot/cloudflare:/cloudflare" \
                    certbot/dns-cloudflare:latest certonly \
                    --dns-cloudflare \
                    --dns-cloudflare-credentials /cloudflare/cloudflare.ini \
                    --email $CF_EMAIL \
                    --agree-tos \
                    --no-eff-email \
                    -d $DOMAIN \
                    --rsa-key-size 4096
    
    # Check if certificates were successfully obtained
    if [ -f "./data/certbot/conf/live/$DOMAIN/fullchain.pem" ] && [ -f "./data/certbot/conf/live/$DOMAIN/privkey.pem" ]; then
      echo "Let's Encrypt certificates successfully obtained!"
      
      # Set proper permissions
      chmod 600 ./data/certbot/conf/live/$DOMAIN/privkey.pem
      
      # Restart frontend to apply new certificates
      docker-compose restart frontend
      
      echo "Certificates installed. Your site should now be available at https://$DOMAIN"
      echo "Note: These certificates will auto-renew when needed."
      
      # Setup auto-renewal
      echo "Setting up auto-renewal..."
      (crontab -l 2>/dev/null; echo "0 3 * * * cd $(pwd) && ./docker-deploy.sh renew-certificates") | crontab -
      echo "Auto-renewal configured to run daily at 3:00 AM."
    else
      echo "Failed to obtain Let's Encrypt certificates. Check the output above for errors."
      exit 1
    fi
    ;;
  renew-certificates)
    # Use environment variables for renewal
    echo "Renewing Let's Encrypt certificates..."
    docker run --rm -v "$(pwd)/data/certbot/conf:/etc/letsencrypt" \
                    -v "$(pwd)/data/certbot/cloudflare:/cloudflare" \
                    certbot/dns-cloudflare:latest renew \
                    --dns-cloudflare \
                    --dns-cloudflare-credentials /cloudflare/cloudflare.ini \
                    --quiet
    
    # Restart frontend to apply renewed certificates
    docker-compose restart frontend
    echo "Certificate renewal attempt completed."
    ;;
  custom-ssl)
    # Check if certificate files are provided
    if [ -z "$2" ] || [ -z "$3" ]; then
      echo "Usage: $0 custom-ssl <path-to-fullchain.pem> <path-to-privkey.pem>"
      echo "Example: $0 custom-ssl ./my-cert.pem ./my-key.pem"
      exit 1
    fi
    
    CERT_PATH=$2
    KEY_PATH=$3
    
    echo "Setting up custom SSL certificates for domain: $DOMAIN"
    
    # Create certificate directories if they don't exist
    mkdir -p ./data/certbot/conf/live/$DOMAIN
    
    # Copy the provided certificates
    cp "$CERT_PATH" ./data/certbot/conf/live/$DOMAIN/fullchain.pem
    cp "$KEY_PATH" ./data/certbot/conf/live/$DOMAIN/privkey.pem
    
    # Set proper permissions
    chmod 600 ./data/certbot/conf/live/$DOMAIN/privkey.pem
    
    # Restart frontend to apply new certificates
    docker-compose restart frontend
    
    echo "Custom SSL certificates installed. Your site should now be available at https://$DOMAIN"
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|rebuild|logs|backup|letsencrypt-cloudflare|renew-certificates|custom-ssl}"
    exit 1
    ;;
esac

exit 0