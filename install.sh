#!/usr/bin/env bash
set -Eeuo pipefail

cat <<'BANNER'
████████╗ ██████╗ ██████╗      ██████╗██╗      ██████╗ ██╗   ██╗██████╗
╚══██╔══╝██╔═══██╗██╔══██╗    ██╔════╝██║     ██╔═══██╗██║   ██║██╔══██╗
   ██║   ██║   ██║██████╔╝    ██║     ██║     ██║   ██║██║   ██║██║  ██║
   ██║   ██║   ██║██╔═══╝     ██║     ██║     ██║   ██║██║   ██║██║  ██║
   ██║   ╚██████╔╝██║         ╚██████╗███████╗╚██████╔╝██████╔╝██████╔╝
   ╚═╝    ╚═════╝ ╚═╝          ╚═════╝╚══════╝ ╚═════╝ ╚═════╝ ╚═════╝

                       STAFF APPLICATION PORTAL
                          MADE BY TANVEER
BANNER

readonly SERVICE=top-cloud
readonly APP_USER=topcloud
readonly APP_GROUP=topcloud
readonly APP_DIR=/opt/top-cloud
readonly ENV_DIR=/etc/top-cloud
readonly ENV_FILE=/etc/top-cloud/.env
readonly DATA_DIR=/var/lib/top-cloud
readonly REPO_URL="${TOP_CLOUD_REPO:-https://github.com/Tanveer9830/Website-v2.git}"
readonly BRANCH="${TOP_CLOUD_BRANCH:-arena/a9735ebd-website-v2}"
readonly HEALTH_URL="http://127.0.0.1:3000/health"
fail(){ echo "ERROR: $*" >&2; echo "Recovery: inspect the failed step, preserve $ENV_FILE and database data, correct the issue, then rerun. Logs: journalctl -u top-cloud -n 100 --no-pager" >&2; exit 1; }
trap 'rc=$?; echo "TOP CLOUD installer stopped with exit code $rc. Review output above; application logs: journalctl -u top-cloud -n 100 --no-pager" >&2; exit "$rc"' ERR
[[ $EUID -eq 0 ]] || fail 'Run as root: curl ... -o /tmp/top-cloud-install.sh && sudo bash /tmp/top-cloud-install.sh'
[[ -r /etc/os-release ]] || fail 'Cannot identify operating system.'
. /etc/os-release
[[ "${ID:-}" == ubuntu || "${ID:-}" == debian || " ${ID_LIKE:-} " == *" debian "* ]] || fail "Ubuntu or Debian is required (found ${PRETTY_NAME:-unknown})."
case "$(uname -m)" in x86_64) NODE_ARCH=x64; DEB_ARCH=amd64;; aarch64|arm64) NODE_ARCH=arm64; DEB_ARCH=arm64;; *) fail "Unsupported CPU architecture $(uname -m); supported: x86_64 and aarch64.";; esac
command -v apt-get >/dev/null || fail 'apt-get is required.'

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl git gnupg openssl postgresql postgresql-client build-essential
# Install a current Node.js 22 runtime from NodeSource's signed Debian repository.
install -d -m 0755 /etc/apt/keyrings
curl --fail --silent --show-error --location https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
chmod 0644 /etc/apt/keyrings/nodesource.gpg
printf 'deb [arch=%s signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main\n' "$DEB_ARCH" >/etc/apt/sources.list.d/nodesource.list
apt-get update
apt-get install -y --no-install-recommends nodejs
node - <<'NODE'
const [major,minor]=process.versions.node.split('.').map(Number);
if(major<22||(major===22&&minor<13)) throw new Error(`Node.js 22.13+ is required; found ${process.versions.node}`);
console.log(`Node.js ${process.versions.node}; npm ${require('child_process').execSync('npm --version',{encoding:'utf8'}).trim()}`);
NODE
npm --version >/dev/null

if ! getent group "$APP_GROUP" >/dev/null; then groupadd --system "$APP_GROUP"; fi
if ! id -u "$APP_USER" >/dev/null 2>&1; then useradd --system --gid "$APP_GROUP" --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"; fi
install -d -o root -g "$APP_GROUP" -m 0750 "$APP_DIR"
install -d -o "$APP_USER" -g "$APP_GROUP" -m 0750 "$DATA_DIR"
install -d -o root -g "$APP_GROUP" -m 0750 "$ENV_DIR"

if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" remote get-url origin | grep -Fxq "$REPO_URL" || fail 'Existing checkout origin differs from the configured repository; refusing to overwrite it.'
  [[ -z "$(git -C "$APP_DIR" status --porcelain)" ]] || fail 'Existing checkout has local changes; refusing to discard them.'
  git -C "$APP_DIR" fetch --prune origin "$BRANCH"
  if git -C "$APP_DIR" show-ref --verify --quiet "refs/heads/$BRANCH"; then git -C "$APP_DIR" checkout "$BRANCH"; else git -C "$APP_DIR" checkout -b "$BRANCH" "origin/$BRANCH"; fi
  git -C "$APP_DIR" merge --ff-only "origin/$BRANCH"
else
  [[ -z "$(find "$APP_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]] || fail "$APP_DIR is not empty and is not a Git checkout; refusing to overwrite it."
  git clone --branch "$BRANCH" --single-branch "$REPO_URL" "$APP_DIR"
fi
chown -R root:"$APP_GROUP" "$APP_DIR"
chmod -R u+rwX,g+rX,g-w,o-rwx "$APP_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  [[ -f "$APP_DIR/.env.example" ]] || fail '.env.example is missing.'
  install -o root -g "$APP_GROUP" -m 0640 "$APP_DIR/.env.example" "$ENV_FILE"
  db_password="$(openssl rand -hex 32)"
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://topcloud:${db_password}@127.0.0.1:5432/topcloud?schema=public|" "$ENV_FILE"
  unset db_password
  echo "Created $ENV_FILE using fresh random secrets."
else
  echo "Preserving existing environment and secrets in $ENV_FILE."
fi
chmod 0640 "$ENV_FILE"; chown root:"$APP_GROUP" "$ENV_FILE"
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a
[[ -n "${DATABASE_URL:-}" && "$DATABASE_URL" == postgresql://* ]] || fail 'DATABASE_URL must be a PostgreSQL connection URL in the environment file.'

# Create only the local service role/database when DATABASE_URL points to this VPS.
DB_HOST="$(node -e 'const u=new URL(process.argv[1]);process.stdout.write(u.hostname)' "$DATABASE_URL")"
if [[ "$DB_HOST" == 127.0.0.1 || "$DB_HOST" == localhost || "$DB_HOST" == ::1 ]]; then
  systemctl enable --now postgresql
  pg_isready -h 127.0.0.1 >/dev/null || fail 'Local PostgreSQL is not accepting TCP connections on 127.0.0.1.'
  LISTEN_ADDRESSES="$(runuser -u postgres -- psql -tAc 'SHOW listen_addresses')"
  if [[ "$LISTEN_ADDRESSES" == '*' || ",$LISTEN_ADDRESSES," == *',0.0.0.0,'* || ",$LISTEN_ADDRESSES," == *',::,'* ]]; then fail "PostgreSQL listens on a public/wildcard interface ($LISTEN_ADDRESSES). Bind it to localhost and firewall port 5432 before continuing."; fi
  DB_USER="$(node -e 'const u=new URL(process.argv[1]);process.stdout.write(decodeURIComponent(u.username))' "$DATABASE_URL")"
  DB_NAME="$(node -e 'const u=new URL(process.argv[1]);process.stdout.write(decodeURIComponent(u.pathname.slice(1)))' "$DATABASE_URL")"
  DB_PASSWORD="$(node -e 'const u=new URL(process.argv[1]);process.stdout.write(decodeURIComponent(u.password))' "$DATABASE_URL")"
  [[ "$DB_USER" =~ ^[a-zA-Z_][a-zA-Z0-9_]{0,62}$ && "$DB_NAME" =~ ^[a-zA-Z_][a-zA-Z0-9_]{0,62}$ ]] || fail 'The configured local PostgreSQL user/database names are not supported.'
  ROLE_EXISTS="$(runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'")"
  if [[ "$ROLE_EXISTS" != 1 ]]; then
    runuser -u postgres -- env APP_DB_PASSWORD="$DB_PASSWORD" psql --set=ON_ERROR_STOP=1 <<SQL
\getenv app_password APP_DB_PASSWORD
CREATE ROLE "$DB_USER" LOGIN PASSWORD :'app_password';
SQL
  fi
  DB_EXISTS="$(runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")"
  if [[ "$DB_EXISTS" != 1 ]]; then runuser -u postgres -- createdb --owner="$DB_USER" "$DB_NAME"; fi
  unset DB_PASSWORD
fi

# Install strictly from package-lock; no floating production dependency resolution.
cd "$APP_DIR"
npm ci --fund=false
npm run db:migrate
# Bootstrap is one-time/idempotent; password input is hidden and is never written to .env.
# On reruns the CLI sees an existing Super Owner and returns without asking/resetting credentials.
npm run owner:bootstrap
npm run build

# Application code is root-owned/read-only. Only data and Next's cache are writable by service.
install -d -o "$APP_USER" -g "$APP_GROUP" -m 0750 "$APP_DIR/.next/cache" "$DATA_DIR/backups"
install -d -m 0755 /etc/systemd/journald.conf.d
cat >/etc/systemd/journald.conf.d/top-cloud.conf <<'JOURNAL'
[Journal]
Storage=persistent
JOURNAL
systemctl restart systemd-journald || true
cat >/etc/systemd/system/${SERVICE}.service <<'UNIT'
[Unit]
Description=TOP CLOUD Staff Application Portal
After=network.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=topcloud
Group=topcloud
WorkingDirectory=/opt/top-cloud
EnvironmentFile=/etc/top-cloud/.env
Environment=NODE_ENV=production
Environment=NEXT_TELEMETRY_DISABLED=1
Environment=HOME=/var/lib/top-cloud
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=5
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/top-cloud /opt/top-cloud/.next/cache
CapabilityBoundingSet=
LockPersonality=true

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now "$SERVICE"

ready=0
for attempt in $(seq 1 40); do
  if curl --fail --silent "$HEALTH_URL" | grep -q '"status":"ok"'; then ready=1; break; fi
  sleep 2
done
if [[ $ready -ne 1 ]]; then systemctl --no-pager --full status "$SERVICE" || true; fail "Local health check failed. Inspect journalctl -u $SERVICE -n 100 --no-pager."; fi
printf '\nTOP CLOUD installation completed. Local health check: '
curl --fail --silent "$HEALTH_URL"; echo
printf 'Application directory: %s\nService: %s\nEnvironment: %s\nDatabase: %s\n' "$APP_DIR" "$SERVICE" "$ENV_FILE" "$DB_HOST"
echo 'Management: systemctl status top-cloud | restart | stop top-cloud'
echo 'Logs: journalctl -u top-cloud -n 100 --no-pager   (follow: journalctl -u top-cloud -f)'
echo 'The web service and PostgreSQL are local-only. Configure a domain and TLS reverse proxy before claiming public HTTPS access.'
