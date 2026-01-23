#!/bin/bash

# MongoDB Backup Script
# This script creates a backup of the MongoDB database

# Load environment variables
source ../../.env

# Configuration
BACKUP_DIR="${BACKUP_PATH:-/app/backups}/mongodb"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_PATH="${BACKUP_DIR}/backup-${TIMESTAMP}"
KEEP_DAYS=7

# Create backup directory
mkdir -p "${BACKUP_DIR}"

echo "Starting MongoDB backup..."

# Run mongodump
mongodump \
    --host mongodb \
    --port 27017 \
    --username admin \
    --password "${MONGO_PASSWORD}" \
    --authenticationDatabase admin \
    --db gameserver-manager \
    --out "${BACKUP_PATH}"

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "Database dump completed successfully"
    
    # Compress the backup
    cd "${BACKUP_DIR}"
    tar czf "backup-${TIMESTAMP}.tar.gz" "backup-${TIMESTAMP}"
    rm -rf "backup-${TIMESTAMP}"
    
    echo "Backup compressed: backup-${TIMESTAMP}.tar.gz"
    
    # Delete backups older than KEEP_DAYS days
    find "${BACKUP_DIR}" -name "backup-*.tar.gz" -mtime +${KEEP_DAYS} -delete
    
    echo "Cleaned up old backups (older than ${KEEP_DAYS} days)"
    echo "Backup completed successfully!"
    exit 0
else
    echo "Error: Database backup failed"
    rm -rf "${BACKUP_PATH}"
    exit 1
fi