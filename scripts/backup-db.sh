#!/usr/bin/env bash
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run as root: sudo /opt/top-cloud/scripts/backup-db.sh' >&2; exit 1; }
ENV_FILE=/etc/top-cloud/.env
BACKUP_DIR=/var/backups/top-cloud
[[ -r "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }
set -a; . "$ENV_FILE"; set +a
[[ -n "${DATABASE_URL:-}" ]] || { echo 'DATABASE_URL is not configured.' >&2; exit 1; }
install -d -o root -g root -m 0700 "$BACKUP_DIR"
file="$BACKUP_DIR/top-cloud-$(date -u +%Y%m%dT%H%M%SZ).dump"
[[ ! -e "$file" ]] || { echo 'Backup filename already exists; wait one second and retry.' >&2; exit 1; }
pg_dump --format=custom --no-owner --file="$file" "$DATABASE_URL"
chmod 0600 "$file"
pg_restore --list "$file" >/dev/null
echo "Database backup verified: $file"
