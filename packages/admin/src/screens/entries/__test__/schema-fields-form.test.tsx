import { TooltipProvider } from "@monti-cms/ui";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { issueLine } from "../../../api/error-message";
import { renderWithSite as render } from "../../../test/site";
import { EMPTY_FORM, type EntryForm } from "../entry-form";
import { entriesMessages } from "../messages";
import { SchemaFields } from "../schema-fields";
import { EntryFormProvider, type EntryFormValue } from "../use-field";

afterEach(cleanup);

const t = testSite.createTranslator(entriesMessages);

function renderFields(value: Partial<EntryFormValue>, props: Parameters<typeof SchemaFields>[0] = {}) {
	const setForm = vi.fn();
	render(
		<TooltipProvider>
			<EntryFormProvider value={{ collection: "post", form: { ...EMPTY_FORM }, setForm, ...value }}>
				<SchemaFields {...props} />
			</EntryFormProvider>
		</TooltipProvider>,
	);
	return setForm;
}

describe("SchemaFields on the form provider", () => {
	it("shows a publish problem under its field and links it to the input", () => {
		const issue = {
			code: "missing_field",
			path: "summary",
			message: "요약",
			text: "요약을 입력하세요.",
			where: "summary",
		};
		renderFields({ issues: [issue] }, { include: (group) => group.fields.includes("summary") });
		const input = screen.getByLabelText(/요약/) as HTMLInputElement;
		expect(input.getAttribute("aria-invalid")).toBe("true");
		expect(input.getAttribute("aria-describedby")).toBe("cms-summary-error");
		expect(document.getElementById("cms-summary-error")?.textContent).toBe(issueLine(issue));
	});

	it("a change reaches the owner as a patch of that field only", () => {
		const form: EntryForm = { ...EMPTY_FORM, summary: "A", oldField: "kept" };
		const setForm = renderFields({ form }, { include: (group) => group.fields.includes("summary") });
		fireEvent.change(screen.getByDisplayValue("A"), { target: { value: "AB" } });
		expect(setForm).toHaveBeenCalledWith({ summary: "AB" });
	});

	it("the slug input uses `onSlugChange` when given, and the form otherwise", () => {
		const onSlugChange = vi.fn();
		const setForm = renderFields(
			{ form: { ...EMPTY_FORM, slug: "a" } },
			{ include: (group) => group.fields.includes("slug"), onSlugChange },
		);
		fireEvent.change(screen.getByDisplayValue("a"), { target: { value: "ab" } });
		expect(onSlugChange).toHaveBeenCalledWith("ab");
		expect(setForm).not.toHaveBeenCalled();
		cleanup();

		const plain = renderFields(
			{ form: { ...EMPTY_FORM, slug: "a" } },
			{ include: (group) => group.fields.includes("slug") },
		);
		fireEvent.change(screen.getByDisplayValue("a"), { target: { value: "ac" } });
		expect(plain).toHaveBeenCalledWith({ slug: "ac" });
	});

	it("a disabled form ignores a change", () => {
		const setForm = renderFields(
			{ form: { ...EMPTY_FORM, summary: "S" }, disabled: true },
			{ include: (group) => group.fields.includes("summary") },
		);
		fireEvent.change(screen.getByDisplayValue("S"), { target: { value: "T" } });
		expect(setForm).not.toHaveBeenCalled();
	});

	it("fills a field from the body when clicking the fillFromBody button", () => {
		const doc = {
			type: "doc" as const,
			version: 1,
			content: [
				{
					type: "paragraph",
					content: [{ type: "text", text: "This is body paragraph text." }],
				},
			],
		};
		const form: EntryForm = { ...EMPTY_FORM, doc, summary: "" };
		const setForm = renderFields({ form }, { include: (group) => group.fields.includes("summary") });
		const button = screen.getByRole("button", { name: t("field.fillFromBody") });
		expect(button).toBeTruthy();
		fireEvent.click(button);
		expect(setForm).toHaveBeenCalledWith({ summary: "This is body paragraph text." });
	});
});
