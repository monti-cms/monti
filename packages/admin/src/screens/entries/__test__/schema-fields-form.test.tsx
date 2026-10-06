import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "../../../ui/tooltip";
import { cmsIssueMessage } from "../../api-error-message";
import { EMPTY_FORM, type EntryForm } from "../entry-form";
import { SchemaFields } from "../schema-fields";
import { EntryFormProvider, type EntryFormValue } from "../use-field";

afterEach(cleanup);

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
		const issue = { code: "missing_field", path: "title", message: "제목" };
		renderFields({ issues: [issue] }, { include: (group) => group.fields.includes("title") });
		const input = screen.getByLabelText(/제목/) as HTMLInputElement;
		expect(input.getAttribute("aria-invalid")).toBe("true");
		expect(input.getAttribute("aria-describedby")).toBe("cms-title-error");
		expect(document.getElementById("cms-title-error")?.textContent).toBe(cmsIssueMessage(issue));
	});

	it("a change reaches the owner as a patch of that field only", () => {
		const form: EntryForm = { ...EMPTY_FORM, title: "A", oldField: "kept" };
		const setForm = renderFields({ form }, { include: (group) => group.fields.includes("title") });
		fireEvent.change(screen.getByDisplayValue("A"), { target: { value: "AB" } });
		expect(setForm).toHaveBeenCalledWith({ title: "AB" });
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
});
