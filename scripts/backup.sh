#!/bin/bash

# Database backup script

BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="ticket_classification_db"
BACKUP_FILE="${BACKUP_DIR}/backup_${DATE}.sql"

mkdir -p $BACKUP_DIR

echo "📦 Creating database backup..."
pg_dump $DB_NAME > $BACKUP_FILE

echo "✅ Backup created: $BACKUP_FILE"

# Keep only last 7 backups
find $BACKUP_DIR -name "backup_*.sql" -type f -mtime +7 -delete
