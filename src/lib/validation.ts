import { z } from "zod";
export const registrationSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[a-zA-Z0-9_]+$/)
    .transform((v) => v.toLowerCase())
    .refine((v) => v !== "tanveer", "Reserved username."),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(128),
});
export const loginSchema = z.object({
  account: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(128),
});
export const positionSchema = z.object({
  title: z.string().trim().min(2).max(100),
  description: z.string().trim().min(5).max(4000),
  requirements: z.string().trim().max(4000).default(""),
  deadline: z
    .string()
    .optional()
    .transform((v) => v || undefined),
});
export const staffSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[a-zA-Z0-9_]+$/)
    .transform((v) => v.toLowerCase()),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(128),
  role: z.enum(["ADMIN", "REVIEWER"]),
  permissions: z.array(z.string()).default([]),
});
export const statusSchema = z.enum([
  "PENDING",
  "REVIEWING",
  "UNDER_CONSIDERATION",
  "APPROVED",
  "REJECTED",
  "ON_HOLD",
]);
export const settingsSchema = z.object({
  about_text: z.string().max(3000).default(""),
  support_email: z.string().email().max(254),
  announcement: z.string().max(1000).default(""),
  maintenance_mode: z.enum(["on", "off"]).default("off"),
});
export const questionSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/),
    label: z.string().min(1).max(250),
    type: z.enum([
      "short",
      "long",
      "choice",
      "multi",
      "dropdown",
      "checkbox",
      "date",
      "section",
    ]),
    required: z.boolean().optional(),
    options: z.array(z.string().min(1).max(120)).max(30).optional(),
    description: z.string().max(1000).optional(),
  })
  .superRefine((q, ctx) => {
    if (
      ["choice", "multi", "dropdown", "checkbox"].includes(q.type) &&
      (!q.options || q.options.length < 2)
    )
      ctx.addIssue({
        code: "custom",
        message: "Choice questions must have at least two options.",
      });
  });
export type FormQuestion = z.infer<typeof questionSchema>;
export function validateAnswers(schema: FormQuestion[], data: FormData) {
  const answers: Record<string, string | string[]> = {};
  const errors: string[] = [];
  for (const q of schema) {
    if (q.type === "section") continue;
    const values = data
      .getAll(`q_${q.id}`)
      .filter((x): x is string => typeof x === "string")
      .map((v) => v.trim());
    const multi = ["multi", "checkbox"].includes(q.type);
    const val = multi ? values : (values[0] ?? "");
    if (q.required && (!val || (Array.isArray(val) && val.length === 0)))
      errors.push(`${q.label} is required.`);
    if ((Array.isArray(val) ? val : [val]).some((x) => x.length > 5000))
      errors.push("Answers must be 5000 characters or fewer.");
    if (["choice", "multi", "dropdown", "checkbox"].includes(q.type)) {
      const allowed = q.options ?? [];
      if (
        (Array.isArray(val) ? val : [val]).some(
          (x) => x && !allowed.includes(x),
        )
      )
        errors.push(`Choose valid options for ${q.label}.`);
    }
    if (q.type === "date" && typeof val === "string" && val) {
      const parsed = new Date(`${val}T00:00:00Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(val) ||
        Number.isNaN(parsed.valueOf()) ||
        parsed.toISOString().slice(0, 10) !== val
      )
        errors.push(`Enter a valid date for ${q.label}.`);
    }
    answers[q.id] = val;
  }
  return { answers, errors };
}
