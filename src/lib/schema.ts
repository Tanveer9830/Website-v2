import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", [
  "SUPER_OWNER",
  "ADMIN",
  "REVIEWER",
  "APPLICANT",
]);
export const accountStatusEnum = pgEnum("account_status", [
  "ACTIVE",
  "SUSPENDED",
  "DISABLED",
]);
export const applicationStatusEnum = pgEnum("application_status", [
  "PENDING",
  "REVIEWING",
  "UNDER_CONSIDERATION",
  "APPROVED",
  "REJECTED",
  "ON_HOLD",
]);
export const reviewKindEnum = pgEnum("review_kind", [
  "STATUS",
  "NOTE",
  "MESSAGE",
  "ASSIGNMENT",
]);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: varchar("username", { length: 40 }).notNull().unique(),
    email: varchar("email", { length: 254 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    role: roleEnum("role").notNull().default("APPLICANT"),
    status: accountStatusEnum("status").notNull().default("ACTIVE"),
    permissions: text("permissions").array().notNull().default([]),
    mustChangePassword: boolean("must_change_password")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("users_role_status_idx").on(t.role, t.status)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("sessions_user_expiry_idx").on(t.userId, t.expiresAt)],
);

export type QuestionType =
  | "short"
  | "long"
  | "choice"
  | "multi"
  | "dropdown"
  | "checkbox"
  | "date"
  | "section";
export type FormQuestion = {
  id: string;
  label: string;
  type: QuestionType;
  required?: boolean;
  options?: string[];
  description?: string;
};
export const positions = pgTable(
  "positions",
  {
    id: text("id").primaryKey(),
    title: varchar("title", { length: 100 }).notNull(),
    description: varchar("description", { length: 4000 }).notNull(),
    requirements: varchar("requirements", { length: 4000 })
      .notNull()
      .default(""),
    isOpen: boolean("is_open").notNull().default(true),
    deadline: date("deadline"),
    formSchema: jsonb("form_schema")
      .$type<FormQuestion[]>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("positions_open_deadline_idx").on(t.isOpen, t.deadline)],
);

export const applications = pgTable(
  "applications",
  {
    id: text("id").primaryKey(),
    applicantId: text("applicant_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    positionId: text("position_id")
      .notNull()
      .references(() => positions.id, { onDelete: "restrict" }),
    positionTitle: varchar("position_title", { length: 100 }).notNull(),
    status: applicationStatusEnum("status").notNull().default("PENDING"),
    answers: jsonb("answers")
      .$type<Record<string, string | string[]>>()
      .notNull(),
    schemaSnapshot: jsonb("schema_snapshot").$type<FormQuestion[]>().notNull(),
    assignedToId: text("assigned_to_id").references(() => users.id, {
      onDelete: "set null",
    }),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("applications_applicant_position_uq").on(
      t.applicantId,
      t.positionId,
    ),
    index("applications_status_submitted_idx").on(t.status, t.submittedAt),
    index("applications_assignee_idx").on(t.assignedToId, t.submittedAt),
    index("applications_position_idx").on(t.positionId, t.submittedAt),
  ],
);

export const reviewEvents = pgTable(
  "review_events",
  {
    id: text("id").primaryKey(),
    applicationId: text("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    kind: reviewKindEnum("kind").notNull(),
    content: varchar("content", { length: 5000 }).notNull(),
    visibleToApplicant: boolean("visible_to_applicant")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("review_events_application_time_idx").on(
      t.applicationId,
      t.createdAt,
    ),
  ],
);

export const siteSettings = pgTable("site_settings", {
  key: varchar("key", { length: 80 }).primaryKey(),
  value: varchar("value", { length: 4000 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    event: varchar("event", { length: 100 }).notNull(),
    detail: varchar("detail", { length: 500 }).notNull().default(""),
    ipAddress: varchar("ip_address", { length: 64 }).notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_created_idx").on(t.createdAt),
    index("audit_event_idx").on(t.event, t.createdAt),
  ],
);
export const rateLimits = pgTable("rate_limits", {
  key: varchar("key", { length: 100 }).primaryKey(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  count: integer("count").notNull().default(0),
});
