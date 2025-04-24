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
    echo "Usage: $0 {start|stop|restart|rebuild|logs|backup|custom-ssl}"
    exit 1
    ;;
esac

exit 0