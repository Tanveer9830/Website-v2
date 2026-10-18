#!/usr/bin/env bash
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run as root: sudo /opt/top-cloud/scripts/restore-db.sh /var/backups/top-cloud/backup.dump' >&2; exit 1; }
[[ $# -eq 1 && -f "$1" && ! -L "$1" ]] || { echo 'Supply one existing, regular, non-symlink pg_dump custom-format backup file.' >&2; exit 1; }
ENV_FILE=/etc/top-cloud/.env
[[ -r "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }
set -a; . "$ENV_FILE"; set +a
[[ -n "${DATABASE_URL:-}" ]] || { echo 'DATABASE_URL is not configured.' >&2; exit 1; }
pg_restore --list "$1" >/dev/null || { echo 'Backup validation failed.' >&2; exit 1; }
DB_NAME="$(node -e 'const u=new URL(process.argv[1]);process.stdout.write(decodeURIComponent(u.pathname.slice(1)))' "$DATABASE_URL")"
echo "WARNING: this overwrites PostgreSQL database '$DB_NAME' from the supplied backup."
read -r -p "Type RESTORE to continue: " answer
[[ "$answer" == RESTORE ]] || { echo 'Restore cancelled.'; exit 1; }
restarted=0
restart(){ if [[ $restarted -eq 1 ]]; then systemctl start top-cloud || true; fi; }
trap restart EXIT
systemctl stop top-cloud
restarted=1
pg_restore --exit-on-error --clean --if-exists --no-owner --dbname "$DATABASE_URL" "$1"
systemctl start top-cloud
restarted=0
trap - EXIT
curl --fail --silent http://127.0.0.1:3000/health >/dev/null || { echo 'Database restored, but local health check failed. Inspect journalctl -u top-cloud.' >&2; exit 1; }
echo "Restore completed from $1; health check passed."
