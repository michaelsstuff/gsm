#!/bin/bash
# Docker Deployment Script for Game Server Manager

# Detect container runtime and compose command
# Try Docker first, then Podman
if command -v docker &> /dev/null; then
  CONTAINER_RUNTIME="docker"
  echo "Detected Docker runtime"
  if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
    echo "Using docker-compose (V1)"
  elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
    echo "Using docker compose (V2)"
  else
    echo "Error: Docker is available but Docker Compose is not."
    echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
  fi
elif command -v podman &> /dev/null; then
  CONTAINER_RUNTIME="podman"
  echo "Detected Podman runtime"
  if command -v podman-compose &> /dev/null; then
    DOCKER_COMPOSE="podman-compose"
    echo "Using podman-compose"
  elif podman compose version &> /dev/null; then
    DOCKER_COMPOSE="podman compose"
    echo "Using podman compose"
  else
    echo "Error: Podman is available but podman-compose is not."
    echo "Please install podman-compose: https://github.com/containers/podman-compose"
    exit 1
  fi
else
  echo "Error: Neither Docker nor Podman is available."
  echo "Please install Docker or Podman to use this script."
  exit 1
fi

echo "Container runtime: $CONTAINER_RUNTIME"
echo "Compose command: $DOCKER_COMPOSE"
echo ""

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

# Load environment variables
source .env
DOMAIN=${DOMAIN_NAME:-example.com}

# Check command argument
case "$1" in
  start)
    echo "Starting Game Server Manager containers..."
    $DOCKER_COMPOSE up -d
    echo "Containers started! Frontend should be available at https://$DOMAIN"
    ;;
  stop)
    echo "Stopping Game Server Manager containers..."
    $DOCKER_COMPOSE down
    ;;
  restart)
    echo "Restarting Game Server Manager containers..."
    $DOCKER_COMPOSE restart
    ;;
  rebuild)
    echo "Rebuilding and restarting Game Server Manager containers..."
    $DOCKER_COMPOSE down
    $DOCKER_COMPOSE build --no-cache
    $DOCKER_COMPOSE up -d
    ;;
  logs)
    echo "Showing logs for Game Server Manager containers..."
    $DOCKER_COMPOSE logs -f
    ;;
  backup)
    echo "Backing up MongoDB data..."
    # Create backup directory if it doesn't exist
    BACKUP_DIR="${BACKUP_PATH:-/mnt/backup/container}/mongodb"
    mkdir -p "$BACKUP_DIR"
    # Get container ID
    CONTAINER_ID=$($DOCKER_COMPOSE ps -q mongodb)
    # Run mongodump inside the container
    $CONTAINER_RUNTIME exec $CONTAINER_ID mongodump --username ${MONGO_INITDB_ROOT_USERNAME:-admin} --password ${MONGO_INITDB_ROOT_PASSWORD:-admin_password} --authenticationDatabase admin --db gameserver-manager --out /data/db/backup
    # Copy backup from container to host
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    $CONTAINER_RUNTIME cp $CONTAINER_ID:/data/db/backup "$BACKUP_DIR/mongodb-$TIMESTAMP"
    echo "Backup created at: $BACKUP_DIR/mongodb-$TIMESTAMP"
    ;;
  letsencrypt-cloudflare)
    # Check if Cloudflare API token is set in environment variables
    CF_API_TOKEN=${CLOUDFLARE_API_TOKEN}
    
    # Allow override from command line parameter
    if [ ! -z "$2" ]; then
      CF_API_TOKEN=$2
    fi
    
    # Check for API token
    if [ ! -z "$CF_API_TOKEN" ]; then
      # Use API token
      CLOUDFLARE_CREDS="dns_cloudflare_api_token = $CF_API_TOKEN"
      echo "Using Cloudflare API Token"
    else
      echo "Error: Cloudflare API token is required."
      echo "Set CLOUDFLARE_API_TOKEN in .env file"
      echo "Or provide API token as parameter:"
      echo "Usage: $0 letsencrypt-cloudflare <cloudflare-api-token>"
      echo "Example: $0 letsencrypt-cloudflare 1234567890abcdef1234567890abcdef"
      exit 1
    fi
    
    echo "Setting up Let's Encrypt certificates for domain: $DOMAIN using Cloudflare DNS validation"
    
    # Create necessary directories (but NOT the domain-specific live directory - certbot creates that)
    mkdir -p ./data/certbot/conf/live
    mkdir -p ./data/certbot/cloudflare
    
    # Create Cloudflare credentials file
    cat > ./data/certbot/cloudflare/cloudflare.ini << EOF
$CLOUDFLARE_CREDS
EOF

    # Set proper permissions for credentials file
    chmod 600 ./data/certbot/cloudflare/cloudflare.ini
    
    # Run certbot with Cloudflare DNS plugin
    $CONTAINER_RUNTIME run --rm -v "$(pwd)/data/certbot/conf:/etc/letsencrypt" \
                    -v "$(pwd)/data/certbot/cloudflare:/cloudflare" \
                    certbot/dns-cloudflare:latest certonly \
                    --dns-cloudflare \
                    --dns-cloudflare-credentials /cloudflare/cloudflare.ini \
                    --email ${EMAIL_ADDRESS:-admin@${DOMAIN}} \
                    --agree-tos \
                    --no-eff-email \
                    -d $DOMAIN \
                    --rsa-key-size 4096
    
    # Check if certificates were successfully obtained
    # Certbot may create $DOMAIN-0001, -0002, etc. if $DOMAIN directory exists from previous attempts
    if [ -f "./data/certbot/conf/live/$DOMAIN/fullchain.pem" ]; then
      CERT_DIR="$DOMAIN"
    else
      # Find the most recent certificate directory with a numeric suffix
      CERT_DIR=$(find ./data/certbot/conf/live -maxdepth 1 -type d -name "${DOMAIN}-[0-9]*" | sort -V | tail -n 1 | xargs basename 2>/dev/null)
      
      if [ ! -z "$CERT_DIR" ] && [ -f "./data/certbot/conf/live/$CERT_DIR/fullchain.pem" ]; then
        echo "Certificates created in $CERT_DIR, creating symlink to $DOMAIN..."
        cd ./data/certbot/conf/live
        ln -sf $CERT_DIR $DOMAIN
        cd - > /dev/null
      else
        echo "Failed to obtain Let's Encrypt certificates. Check the output above for errors."
        exit 1
      fi
    fi
    
    if [ -f "./data/certbot/conf/live/$DOMAIN/fullchain.pem" ] && [ -f "./data/certbot/conf/live/$DOMAIN/privkey.pem" ]; then
      echo "Let's Encrypt certificates successfully obtained!"
      
      # Set proper permissions
      chmod 600 ./data/certbot/conf/live/$DOMAIN/privkey.pem
      
      # Restart frontend to apply new certificates
      $DOCKER_COMPOSE restart frontend
      
      echo "Certificates installed. Your site should now be available at https://$DOMAIN"
      echo "Note: These certificates will auto-renew when needed."
      
      # Setup auto-renewal
      echo "Setting up auto-renewal..."
      (crontab -l 2>/dev/null; echo "0 3 * * * cd $(pwd) && ./docker-deploy.sh renew-certificates") | crontab -
      echo "Auto-renewal configured to run daily at 3:00 AM."
    else
      echo "Failed to create certificate symlink. Check the output above for errors."
      exit 1
    fi
    ;;
  renew-certificates)
    # Use environment variables for renewal
    echo "Renewing Let's Encrypt certificates..."
    $CONTAINER_RUNTIME run --rm -v "$(pwd)/data/certbot/conf:/etc/letsencrypt" \
                    -v "$(pwd)/data/certbot/cloudflare:/cloudflare" \
                    certbot/dns-cloudflare:latest renew \
                    --dns-cloudflare \
                    --dns-cloudflare-credentials /cloudflare/cloudflare.ini
    
    # Copy renewed certificates to the path nginx expects (if they exist)
    if [ -f "./data/certbot/conf/live/$DOMAIN-0001/fullchain.pem" ]; then
      echo "Copying renewed certificates to nginx path..."
      cp "./data/certbot/conf/live/$DOMAIN-0001/fullchain.pem" "./data/certbot/conf/live/$DOMAIN/fullchain.pem"
      cp "./data/certbot/conf/live/$DOMAIN-0001/privkey.pem" "./data/certbot/conf/live/$DOMAIN/privkey.pem"
      cp "./data/certbot/conf/live/$DOMAIN-0001/chain.pem" "./data/certbot/conf/live/$DOMAIN/chain.pem"
      cp "./data/certbot/conf/live/$DOMAIN-0001/cert.pem" "./data/certbot/conf/live/$DOMAIN/cert.pem"
      echo "Certificates copied successfully."
    fi
    
    # Restart frontend to apply renewed certificates
    $DOCKER_COMPOSE restart frontend
    echo "Certificate renewal attempt completed."
    ;;
  custom-ssl)
    # Check if certificate files are provided
    if [ -z "$2" ] || [ -z "$3" ]; then
      echo "No certificate files provided - generating self-signed certificates for domain: $DOMAIN"
      echo "⚠️  WARNING: Self-signed certificates will show browser security warnings"
      echo "   Only use this for development/testing purposes"
      
      # Create certificate directories if they don't exist
      mkdir -p ./data/certbot/conf/live/$DOMAIN
      
      # Generate self-signed certificate
      openssl req -x509 -nodes -days 365 -newkey rsa:4096 \
        -keyout "./data/certbot/conf/live/$DOMAIN/privkey.pem" \
        -out "./data/certbot/conf/live/$DOMAIN/fullchain.pem" \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN"
      
      echo "✓ Self-signed certificates generated"
    else
      CERT_PATH=$2
      KEY_PATH=$3
      
      echo "Setting up custom SSL certificates for domain: $DOMAIN"
      
      # Create certificate directories if they don't exist
      mkdir -p ./data/certbot/conf/live/$DOMAIN
      
      # Copy the provided certificates
      cp "$CERT_PATH" ./data/certbot/conf/live/$DOMAIN/fullchain.pem
      cp "$KEY_PATH" ./data/certbot/conf/live/$DOMAIN/privkey.pem
      
      echo "✓ Custom certificates installed"
    fi
    
    # Set proper permissions
    chmod 600 ./data/certbot/conf/live/$DOMAIN/privkey.pem
    
    # Restart frontend to apply new certificates
    $DOCKER_COMPOSE restart frontend
    
    echo "Custom SSL certificates installed. Your site should now be available at https://$DOMAIN"
    ;;
  reset)
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                      ⚠️  WARNING ⚠️                            ║"
    echo "║                                                               ║"
    echo "║  This will PERMANENTLY DELETE all Game Server Manager data:  ║"
    echo "║                                                               ║"
    echo "║  • All containers will be stopped and removed                ║"
    echo "║  • All Docker volumes will be deleted (MongoDB data)         ║"
    echo "║  • All SSL certificates will be removed                      ║"
    echo "║  • Database backups in \$BACKUP_PATH will be preserved        ║"
    echo "║  • .env file will be preserved                               ║"
    echo "║                                                               ║"
    echo "║  THIS ACTION CANNOT BE UNDONE!                               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo ""
    read -p "Type 'DELETE EVERYTHING' to confirm (case-sensitive): " CONFIRM
    
    if [ "$CONFIRM" != "DELETE EVERYTHING" ]; then
      echo "Reset cancelled. No changes were made."
      exit 0
    fi
    
    echo ""
    echo "Proceeding with complete reset..."
    echo ""
    
    # Stop all containers
    echo "→ Stopping all containers..."
    $DOCKER_COMPOSE down
    
    # Remove containers forcefully if they still exist
    echo "→ Removing containers..."
    $CONTAINER_RUNTIME rm -f gsm-frontend gsm-backend gsm-mongodb 2>/dev/null || true
    
    # Remove Docker volumes
    echo "→ Removing Docker volumes..."
    $DOCKER_COMPOSE down -v
    $CONTAINER_RUNTIME volume rm gsm_mongodb-data 2>/dev/null || true
    
    # Remove SSL certificates
    echo "→ Removing SSL certificates..."
    rm -rf ./data/certbot/conf/*
    rm -rf ./data/certbot/cloudflare/*
    
    # Remove built images (optional - commented out by default)
    # Uncomment these lines if you also want to remove the built images
    # echo "→ Removing built images..."
    # $CONTAINER_RUNTIME rmi gsm-frontend gsm-backend 2>/dev/null || true
    
    echo ""
    echo "✓ Reset complete!"
    echo ""
    echo "All containers, volumes, and certificates have been removed."
    echo "Preserved: .env file and \$BACKUP_PATH directory"
    echo ""
    echo "To start fresh, run: ./docker-deploy.sh start"
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|rebuild|logs|backup|letsencrypt-cloudflare|renew-certificates|custom-ssl|reset}"
    exit 1
    ;;
esac

exit 0