import type { FormQuestion } from "@/lib/schema";
type Props = {
  action: string;
  position?: {
    id: string;
    title: string;
    description: string;
    requirements: string;
    deadline: string | null;
    formSchema: FormQuestion[];
  };
  updateSchema?: boolean;
};
export function PositionEditor({
  action,
  position,
  updateSchema = false,
}: Props) {
  const initial = position?.formSchema ?? [];
  return (
    <form action={action} method="post" className="form-card form-grid">
      <label>
        Position title
        <input
          name="title"
          maxLength={100}
          defaultValue={position?.title}
          required
        />
      </label>
      <label>
        Application deadline
        <input
          type="date"
          name="deadline"
          defaultValue={position?.deadline ?? ""}
        />
      </label>
      <label className="full">
        Role description
        <textarea
          name="description"
          rows={3}
          defaultValue={position?.description}
          required
        />
      </label>
      <label className="full">
        Eligibility / requirements
        <textarea
          name="requirements"
          rows={2}
          defaultValue={position?.requirements}
        />
      </label>
      {position && (
        <label className="full check-label">
          <input
            type="checkbox"
            name="update_form_schema"
            defaultChecked={updateSchema}
          />{" "}
          Replace the application form with the questions below. Existing
          applications preserve their submitted form version.
        </label>
      )}
      <div className="full">
        <h3>Dynamic application form · up to 12 items</h3>
        <p className="muted">
          Question types: text, choice, multiple choice, dropdown, checkboxes,
          date, or section heading.
        </p>
      </div>
      {Array.from({ length: 12 }, (_, idx) => {
        const i = idx + 1;
        const question = initial[idx];
        return (
          <fieldset className="question-fields" key={i}>
            <label>
              Form item {i}
              <input
                name={`question_${i}`}
                defaultValue={question?.label}
                placeholder="Question or section heading"
              />
            </label>
            <label>
              Type
              <select
                name={`type_${i}`}
                defaultValue={question?.type ?? "short"}
              >
                <option value="short">Short text</option>
                <option value="long">Long text</option>
                <option value="choice">Single choice</option>
                <option value="multi">Multiple choice</option>
                <option value="dropdown">Dropdown</option>
                <option value="checkbox">Checkboxes</option>
                <option value="date">Date</option>
                <option value="section">Section heading</option>
              </select>
            </label>
            <label>
              Choices (one per line)
              <textarea
                name={`options_${i}`}
                rows={2}
                defaultValue={question?.options?.join("\n")}
                placeholder="Only for choice fields"
              />
            </label>
            <label className="inline-check">
              <input
                type="checkbox"
                name={`required_${i}`}
                defaultChecked={question?.required}
              />{" "}
              Required
            </label>
            <label>
              Section description
              <input
                name={`section_${i}`}
                defaultValue={question?.description}
              />
            </label>
          </fieldset>
        );
      })}
      <div className="full">
        <button className="button">
          {position ? "Save position" : "Publish position"}
        </button>
      </div>
    </form>
  );
}
