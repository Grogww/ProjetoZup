#!/bin/bash
set -e

BACKUP_FILE="/init/zup_backup.backup"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Arquivo de backup nao encontrado em $BACKUP_FILE. Pulando restore."
  exit 0
fi

echo "Iniciando restauracao do backup em $POSTGRES_DB..."
pg_restore \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --no-owner \
  --no-privileges \
  --verbose \
  "$BACKUP_FILE"
echo "Restauracao concluida."
