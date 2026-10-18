import { questionSchema } from "./validation";
export function makePositionQuestions(form: FormData) {
  const result = [];
  for (let i = 1; i <= 12; i++) {
    const label = String(form.get(`question_${i}`) || "").trim();
    if (!label) continue;
    const type = String(form.get(`type_${i}`) || "short");
    const options = String(form.get(`options_${i}`) || "")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
    const q = questionSchema.safeParse({
      id: `q${i}`,
      label,
      type,
      required: form.get(`required_${i}`) === "on",
      options,
      description: String(form.get(`section_${i}`) || ""),
    });
    if (!q.success) throw new Error(`FORM:${i}`);
    result.push(q.data);
  }
  return result;
}
