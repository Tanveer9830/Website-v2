CREATE TYPE role AS ENUM ('SUPER_OWNER','ADMIN','REVIEWER','APPLICANT');
CREATE TYPE account_status AS ENUM ('ACTIVE','SUSPENDED','DISABLED');
CREATE TYPE application_status AS ENUM ('PENDING','REVIEWING','UNDER_CONSIDERATION','APPROVED','REJECTED','ON_HOLD');
CREATE TYPE review_kind AS ENUM ('STATUS','NOTE','MESSAGE','ASSIGNMENT');

CREATE TABLE users (
  id text PRIMARY KEY, username varchar(40) NOT NULL UNIQUE, email varchar(254) NOT NULL UNIQUE, password_hash varchar(255) NOT NULL,
  role role NOT NULL DEFAULT 'APPLICANT', status account_status NOT NULL DEFAULT 'ACTIVE', permissions text[] NOT NULL DEFAULT '{}',
  must_change_password boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX users_role_status_idx ON users(role,status);
CREATE TABLE sessions (
  id text PRIMARY KEY, token_hash varchar(64) NOT NULL UNIQUE, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_expiry_idx ON sessions(user_id,expires_at);
CREATE TABLE positions (
  id text PRIMARY KEY, title varchar(100) NOT NULL, description varchar(4000) NOT NULL, requirements varchar(4000) NOT NULL DEFAULT '',
  is_open boolean NOT NULL DEFAULT true, deadline date, form_schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX positions_open_deadline_idx ON positions(is_open,deadline);
CREATE TABLE applications (
  id text PRIMARY KEY, applicant_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT, position_id text NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
  position_title varchar(100) NOT NULL, status application_status NOT NULL DEFAULT 'PENDING', answers jsonb NOT NULL, schema_snapshot jsonb NOT NULL,
  assigned_to_id text REFERENCES users(id) ON DELETE SET NULL, submitted_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT applications_applicant_position_uq UNIQUE(applicant_id,position_id)
);
CREATE INDEX applications_status_submitted_idx ON applications(status,submitted_at);
CREATE INDEX applications_assignee_idx ON applications(assigned_to_id,submitted_at);
CREATE INDEX applications_position_idx ON applications(position_id,submitted_at);
CREATE TABLE review_events (
  id text PRIMARY KEY, application_id text NOT NULL REFERENCES applications(id) ON DELETE CASCADE, actor_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  kind review_kind NOT NULL, content varchar(5000) NOT NULL, visible_to_applicant boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX review_events_application_time_idx ON review_events(application_id,created_at);
CREATE TABLE site_settings (key varchar(80) PRIMARY KEY, value varchar(4000) NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE audit_logs (
  id text PRIMARY KEY, actor_id text REFERENCES users(id) ON DELETE SET NULL, event varchar(100) NOT NULL, detail varchar(500) NOT NULL DEFAULT '',
  ip_address varchar(64) NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_created_idx ON audit_logs(created_at);
CREATE INDEX audit_event_idx ON audit_logs(event,created_at);
CREATE TABLE rate_limits (key varchar(100) PRIMARY KEY, window_started_at timestamptz NOT NULL DEFAULT now(), count integer NOT NULL DEFAULT 0);
