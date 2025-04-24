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

# Check command argument
case "$1" in
  start)
    echo "Starting Game Server Manager containers..."
    docker-compose up -d
    echo "Containers started! Frontend should be available at http://localhost (or configured port)"
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
  *)
    echo "Usage: $0 {start|stop|restart|rebuild|logs|backup}"
    exit 1
    ;;
esac

exit 0