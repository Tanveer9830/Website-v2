# TOP CLOUD — Staff Application Portal

A TOP CLOUD recruitment website and staff review control center. Built with **Next.js App Router + TypeScript + PostgreSQL**, Drizzle ORM, Argon2id, server-side database sessions, and server-rendered responsive pages.

**Made by Tanveer | Discord: tanveer5637**

```
████████╗ ██████╗ ██████╗      ██████╗██╗      ██████╗ ██╗   ██╗██████╗
╚══██╔══╝██╔═══██╗██╔══██╗    ██╔════╝██║     ██╔═══██╗██║   ██║██╔══██╗
   ██║   ██║   ██║██████╔╝    ██║     ██║     ██║   ██║██║   ██║██║  ██║
   ██║   ██║   ██║██╔═══╝     ██║     ██║     ██║   ██║██║   ██║██║  ██║
   ██║   ╚██████╔╝██║         ╚██████╗███████╗╚██████╔╝██████╔╝██████╔╝
   ╚═╝    ╚═════╝ ╚═╝          ╚═════╝╚══════╝ ╚═════╝ ╚═════╝ ╚═════╝

                       STAFF APPLICATION PORTAL
                          MADE BY TANVEER
```

## Architecture and protections

- **Next.js 16 / React 19 / TypeScript**, custom accessible dark SaaS design; responsive landing page, applicant dashboard, separate admin and owner consoles.
- **PostgreSQL** is the persistent relational database. Drizzle ORM schemas live in `src/lib/schema.ts`; numbered SQL migrations live in `migrations/`. `npm run db:migrate` applies unapplied files transactionally using a PostgreSQL advisory lock and migration ledger.
- Passwords use Argon2id. Random opaque session tokens are stored only as SHA-256 hashes in PostgreSQL and sent in HTTP-only, SameSite cookies. Password changes invalidate other sessions. Registration and login have shared-database rate limits. Mutating routes require exact same-origin `Origin` plus same-site fetch metadata.
- Permissions are enforced on the server in `src/lib/security.ts` and checked again by route handlers. CSRF validation, input schemas, SQL parameterization, CSP/security headers, account status checks, and audit events are used across sensitive operations.
- The production service binds only to `127.0.0.1:3000`; PostgreSQL is provisioned for loopback use by the VPS installer. No database credentials or passwords are committed.

### Routes and roles

- `/` public TOP CLOUD recruitment site, open positions/deadlines, announcements, editable about/contact content, process and FAQ.
- `/register`, `/login` applicant registration and sign-in.
- `/dashboard` applicants can edit their own username/email, browse open roles, submit validated dynamic applications, review their own statuses, and read applicant-visible messages only.
- `/admin` authorized queue, search, status/position filters, pagination, application review, private notes, applicant-facing messages, assignments, and (when permitted) position publishing/applicant/audit access.
- `/admin/owner` **only** the `SUPER_OWNER` account named `tanveer` can access. It shows all applications and saved answers, analytics with date/position filters, staff account/permission controls, recruitment positions/form editing, site settings, maintenance pause, and security/audit activity. The Owner Panel links to `/admin`; Super Owner uses the same account for both.
- `/admin/applications/[id]` checks application-level access; reviewers can view assigned applications only. Form schema and all answers are snapshotted on submission. Staff notes are distinct from applicant messages and are not queried by applicant pages.
- Roles: `SUPER_OWNER`, `ADMIN`, `REVIEWER`, `APPLICANT`. Admin permission keys: `applications.read`, `applications.review`, `applications.assign`, `positions.manage`, `applicants.manage`, `audit.read`. Only the bootstrap-created Super Owner can grant elevated staff roles; no route creates or upgrades another Super Owner.

## Local development

Use Node.js **22.13+**, npm, and a PostgreSQL database.

```bash
npm ci
cp .env.example .env
# Set DATABASE_URL to a local PostgreSQL database; set APP_ORIGIN for a fixed browser origin.
# For localhost HTTP, cookies are not marked Secure outside production.
set -a; . ./.env; set +a
npm run db:migrate
npm run owner:bootstrap
npm run dev
```

`owner:bootstrap` prompts for an email and then a password twice without echoing it. It creates exactly one `SUPER_OWNER` with username `tanveer`, hashes the chosen password, and safely skips if an owner already exists. There is no public Super Owner registration route. The password included in a chat message is **not** embedded in this repository or used by the installer; choose a new private credential during bootstrap.

For a schema update, add a numbered SQL migration in `migrations/`, then run `npm run db:migrate`. Existing applications keep their question and answer snapshot when a position form is edited.

## One-command Ubuntu/Debian installation

The installer (`install.sh`) supports Ubuntu/Debian on `x86_64` and `aarch64`. It validates the OS/architecture; installs Node.js 22 from NodeSource's signed apt repository, PostgreSQL, Git and required build utilities; safely clones or fast-forward-updates this repository/branch; preserves an existing environment, database and local changes (it stops if the checkout is dirty or has a different origin); creates a dedicated `topcloud` OS service user; creates a local PostgreSQL account/database on first setup without resetting existing credentials; installs the exact `package-lock.json` dependencies; runs migrations; privately bootstraps `tanveer` once; builds Next.js; configures a restrictive systemd service with restart behavior and persistent journal storage; then verifies `http://127.0.0.1:3000/health`.

Verified repository remote: `https://github.com/Tanveer9830/Website-v2.git`.

Once this branch is pushed and GitHub serves the installer file, run:

```bash
curl -fsSL "https://raw.githubusercontent.com/Tanveer9830/Website-v2/arena/a9735ebd-website-v2/install.sh" -o /tmp/top-cloud-install.sh && sudo bash /tmp/top-cloud-install.sh
```

The one-time bootstrap prompt is interactive and password-hidden. The installer never takes an initial password from a URL, command argument, repository file, or `.env`; on re-run it does not reset the account password, overwrite environment secrets, or delete database data. If an existing local checkout has changes or a different origin, it fails safely rather than force-resetting it. Review `install.sh` before running it on any production server.

Service commands:

```bash
sudo systemctl status top-cloud
sudo systemctl restart top-cloud
sudo systemctl stop top-cloud
sudo journalctl -u top-cloud -n 100 --no-pager
sudo journalctl -u top-cloud -f
```

The app directory is `/opt/top-cloud`, protected environment file `/etc/top-cloud/.env`, PostgreSQL data is managed by PostgreSQL, and service logs use journald. The systemd account is not root and has write access only to its Next cache and `/var/lib/top-cloud`.

### Domain and HTTPS

The installer does **not** claim public reachability or configure your DNS/domain. The web process is loopback-only. For a conventional VPS, install Caddy, point your domain A/AAAA records at the VPS, permit inbound TCP 80/443 only, and use:

```caddyfile
apply.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
}
```

Set `APP_ORIGIN=https://apply.example.com` in `/etc/top-cloud/.env`, then restart both `top-cloud` and Caddy. Verify the public HTTPS landing page and `https://apply.example.com/health` yourself. Do not expose port 3000 or PostgreSQL 5432 to the internet. `/admin` and `/admin/owner` are protected by server-side session/role checks, not URL secrecy.

Cloudflare Tunnel is also supported: install/authenticate `cloudflared` on the VPS, create a named tunnel and DNS route, configure the web origin as `http://127.0.0.1:3000`, and run the tunnel as a systemd service. Route only the public web hostname; do not publish SSH, PostgreSQL, or other management ports. Optionally apply Cloudflare Access policy as an additional layer while retaining TOP CLOUD's own application authentication. Set `APP_ORIGIN` to the public HTTPS origin.

### Backups and restore

The installer includes local-operator-only scripts:

```bash
sudo /opt/top-cloud/scripts/backup-db.sh
sudo /opt/top-cloud/scripts/restore-db.sh /var/backups/top-cloud/top-cloud-YYYYMMDDTHHMMSSZ.dump
```

Backups are custom-format `pg_dump` files under `/var/backups/top-cloud`, mode `0600`, and validated after creation. Restore requires a `RESTORE` confirmation, validates the file, stops the service, restores the PostgreSQL database, and restarts/checks the app. Keep encrypted off-host copies and test restore procedures; never give database restore access to a web request.

## Verification

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
DATABASE_URL='postgresql://user:password@127.0.0.1:5432/topcloud?schema=public' npm run build
bash -n install.sh scripts/backup-db.sh scripts/restore-db.sh
npm audit
```

Tests include role/object authorization, Super Owner unbounded access independent of ordinary permission flags, registration validation/reserved owner name, form validation and complete choice answers, allowed workflow statuses, PostgreSQL migration schema/enums, and unique applicant-position application enforcement. Build and static checks do not require live database contents.

## Scope and deployment notes

A real Ubuntu/Debian VPS, systemd/apt/NodeSource install, external domain/DNS/TLS, production PostgreSQL service, and public HTTPS have **not** been exercised in this workspace. The migration SQL is integration-tested against PGlite (embedded PostgreSQL-compatible engine), but the full web request flow has not been run against a real PostgreSQL server here. The installer is syntax-checked but requires a real root VPS to verify all package/service/proxy steps.

Transactional email/password reset delivery, file uploads, applicant drafts and withdrawals, SSO/integrations, and automated retention/deletion schedules are not enabled. Password recovery is intentionally limited to the private VPS console: stop the service, use `psql`/a secure operator workflow to reset credentials only if necessary, and audit the event; never expose a reset endpoint without a verified email provider/token workflow. For local-console password recovery, use the same root-owned environment and a hidden prompt (it revokes existing sessions and requires a new password at next sign-in):

```bash
sudo bash -lc 'cd /opt/top-cloud && set -a && . /etc/top-cloud/.env && set +a && npm run account:reset -- tanveer'
```

The app does not provide unrestricted shell or SQL execution.
