#!/bin/bash

# Load environment variables
source /root/gsm/.env

# Wrapper script to run MongoDB backup from host system
CONTAINER_NAME="gsm-mongodb"
BACKUP_DIR="/mnt/backup/mongo"
CONTAINER_BACKUP_DIR="/app/backups/mongodb"

# Ensure backup directories exist
mkdir -p "${BACKUP_DIR}"
docker exec ${CONTAINER_NAME} mkdir -p "${CONTAINER_BACKUP_DIR}"

echo "Starting MongoDB backup process..."

# Create timestamp
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="backup-${TIMESTAMP}.gz"

# Execute backup script inside the container
docker exec ${CONTAINER_NAME} mongodump \
    --host localhost \
    --port 27017 \
    --username "$MONGO_INITDB_ROOT_USERNAME" \
    --password "$MONGO_INITDB_ROOT_PASSWORD" \
    --authenticationDatabase admin \
    --db gameserver-manager \
    --gzip \
    --archive="${CONTAINER_BACKUP_DIR}/${BACKUP_NAME}"

if [ $? -eq 0 ]; then
    # Copy the backup from container to host
    docker cp "${CONTAINER_NAME}:${CONTAINER_BACKUP_DIR}/${BACKUP_NAME}" "${BACKUP_DIR}/"
    if [ $? -eq 0 ]; then
        echo "Backup copied to host successfully: ${BACKUP_DIR}/${BACKUP_NAME}"
        
        # Clean up the backup in container
        docker exec ${CONTAINER_NAME} rm "${CONTAINER_BACKUP_DIR}/${BACKUP_NAME}"
        
        # Clean up old backups (older than 7 days)
        find "${BACKUP_DIR}" -name "backup-*.gz" -mtime +7 -delete
        echo "Cleaned up old backups"
    else
        echo "Error: Failed to copy backup from container"
        exit 1
    fi
else
    echo "Error: Backup failed"
    exit 1
fi