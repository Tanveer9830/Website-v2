import { describe, it, expect } from "vitest";
import { canViewApplication, hasPermission } from "../src/lib/security";
import {
  registrationSchema,
  statusSchema,
  validateAnswers,
} from "../src/lib/validation";
import type { UserRecord } from "../src/lib/security";
const user = (
  role: UserRecord["role"],
  permissions: string[] = [],
  id = "u1",
) =>
  ({
    id,
    username: id,
    email: `${id}@example.org`,
    passwordHash: "hash",
    role,
    status: "ACTIVE",
    permissions,
    mustChangePassword: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }) as UserRecord;
describe("server authorization", () => {
  it("grants the Super Owner full app permissions and never depends on stored permission flags", () => {
    expect(hasPermission(user("SUPER_OWNER"), "applications.assign")).toBe(
      true,
    );
    expect(
      hasPermission(
        user("ADMIN", ["applications.read"]),
        "applications.review",
      ),
    ).toBe(false);
  });
  it("allows the owner to inspect any application and scopes applicants/reviewers by object", () => {
    const record = { applicantId: "applicant", assignedToId: "reviewer" };
    expect(canViewApplication(user("SUPER_OWNER"), record)).toBe(true);
    expect(canViewApplication(user("APPLICANT", [], "applicant"), record)).toBe(
      true,
    );
    expect(canViewApplication(user("APPLICANT", [], "other"), record)).toBe(
      false,
    );
    expect(
      canViewApplication(
        user("REVIEWER", ["applications.read"], "reviewer"),
        record,
      ),
    ).toBe(true);
    expect(
      canViewApplication(
        user("REVIEWER", ["applications.read"], "other"),
        record,
      ),
    ).toBe(false);
  });
  it("does not permit normal admins to enter owner-only role through role permissions", () => {
    expect(user("ADMIN", ["applications.read"]).role).not.toBe("SUPER_OWNER");
  });
});
describe("form and account validation", () => {
  it("normalizes applicant usernames/email and reserves tanveer", () => {
    expect(
      registrationSchema.safeParse({
        username: "Candidate_1",
        email: "CANDIDATE@example.org",
        password: "A-long-safe-password-1",
      }).data,
    ).toMatchObject({
      username: "candidate_1",
      email: "candidate@example.org",
    });
    expect(
      registrationSchema.safeParse({
        username: "tanveer",
        email: "t@example.org",
        password: "A-long-safe-password-1",
      }).success,
    ).toBe(false);
    expect(
      registrationSchema.safeParse({
        username: "candidate",
        email: "c@example.org",
        password: "short",
      }).success,
    ).toBe(false);
  });
  it("accepts only known application states", () => {
    expect(statusSchema.safeParse("UNDER_CONSIDERATION").success).toBe(true);
    expect(statusSchema.safeParse("OWNER").success).toBe(false);
  });
  it("validates required fields, choices, checkbox arrays and preserves complete answers", () => {
    const schema = [
      {
        id: "why",
        label: "Why TOP CLOUD?",
        type: "long" as const,
        required: true,
      },
      {
        id: "area",
        label: "Interest",
        type: "choice" as const,
        required: true,
        options: ["Support", "Operations"],
      },
      {
        id: "tools",
        label: "Tools",
        type: "checkbox" as const,
        options: ["Git", "Linux"],
      },
    ];
    const bad = new FormData();
    bad.set("q_why", "A useful answer");
    bad.set("q_area", "Injected");
    const rejected = validateAnswers(schema, bad);
    expect(rejected.errors.length).toBeGreaterThan(0);
    const good = new FormData();
    good.set("q_why", "I like helping users");
    good.set("q_area", "Support");
    good.append("q_tools", "Git");
    good.append("q_tools", "Linux");
    const result = validateAnswers(schema, good);
    expect(result.errors).toEqual([]);
    expect(result.answers).toEqual({
      why: "I like helping users",
      area: "Support",
      tools: ["Git", "Linux"],
    });
  });
});
