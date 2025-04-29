#!/bin/bash

# Load environment variables
source /root/gsm/.env

# Wrapper script to restore MongoDB backup
CONTAINER_NAME="gsm-mongodb"
BACKUP_DIR="/mnt/backup/mongo"

# Check if backup file is provided
if [ -z "$1" ]; then
    echo "Error: No backup file specified"
    echo "Usage: $0 <backup-filename.gz>"
    echo "Available backups:"
    ls -lh "${BACKUP_DIR}"
    exit 1
fi

BACKUP_FILE="$1"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

# Check if backup file exists
if [ ! -f "${BACKUP_PATH}" ]; then
    echo "Error: Backup file not found: ${BACKUP_PATH}"
    echo "Available backups:"
    ls -lh "${BACKUP_DIR}"
    exit 1
fi

echo "Starting MongoDB restore process..."
echo "Using backup file: ${BACKUP_PATH}"
echo "WARNING: This will overwrite existing data. Press Ctrl+C within 5 seconds to cancel..."
sleep 5

# Copy backup file to container
echo "Copying backup file to container..."
docker cp "${BACKUP_PATH}" "${CONTAINER_NAME}:/tmp/${BACKUP_FILE}"

if [ $? -eq 0 ]; then
    echo "Restoring database from backup..."
    # Execute restore command inside the container
    docker exec ${CONTAINER_NAME} mongorestore \
        --host localhost \
        --port 27017 \
        --username "$MONGO_INITDB_ROOT_USERNAME" \
        --password "$MONGO_INITDB_ROOT_PASSWORD" \
        --authenticationDatabase admin \
        --gzip \
        --archive="/tmp/${BACKUP_FILE}" \
        --drop

    RESTORE_STATUS=$?
    
    # Clean up temporary file in container
    docker exec ${CONTAINER_NAME} rm "/tmp/${BACKUP_FILE}"
    
    if [ $RESTORE_STATUS -eq 0 ]; then
        echo "Database restore completed successfully!"
    else
        echo "Error: Database restore failed"
        exit 1
    fi
else
    echo "Error: Failed to copy backup file to container"
    exit 1
fi