#!/bin/bash

# Backup script for game server containers
# This script runs inside the gsm-backend container

# Check if container name is provided
if [ -z "$1" ]; then
    echo "Error: Container name not provided"
    echo "Usage: $0 <container_name> [retention_days]"
    exit 1
fi

CONTAINER_NAME="$1"
RETENTION="${2:-5}"  # Default to 5 if not provided
BACKUP_DIR="${BACKUP_PATH:-/app/backups}"
VOLUMES_DIR="/app/container-volumes"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${CONTAINER_NAME}-${DATE}.tar.gz"

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Check if container volume directory exists
if [ ! -d "${VOLUMES_DIR}/${CONTAINER_NAME}" ]; then
    echo "Error: Volume directory not found for container ${CONTAINER_NAME}"
    exit 1
fi

echo "Starting backup of container ${CONTAINER_NAME}..."

# Create tar archive of the container's volume
cd "${VOLUMES_DIR}" || exit
tar -cf - "${CONTAINER_NAME}/" | pv -s "$(du -sb "${CONTAINER_NAME}/" | awk '{print $1}')" | gzip > "${BACKUP_FILE}"

if [ $? -eq 0 ]; then
    echo "Backup completed successfully: ${BACKUP_FILE}"
    # Keep only the specified number of most recent backups for this container
    cd "${BACKUP_DIR}" || exit
    ls -t "${CONTAINER_NAME}"-*.tar.gz 2>/dev/null | tail -n +$((RETENTION + 1)) | xargs -r rm
    echo "Cleaned up old backups, keeping the ${RETENTION} most recent"
    exit 0
else
    echo "Error: Backup failed"
    rm -f "${BACKUP_FILE}"
    exit 1
fi