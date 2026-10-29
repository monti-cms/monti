import { TooltipProvider } from "@monti-cms/ui";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithSite as render } from "../../../test/site";
import { EMPTY_FORM, type EntryForm } from "../entry-form";
import { PropertyFields } from "../property-fields";
import { EntryFormProvider, type EntryFormValue } from "../use-field";

afterEach(cleanup);

/** The summary and the slug of the post: the two text properties the cases below read and change. */
const only = (name: string) => (group: { fields: readonly string[] }) => group.fields.includes(name);

function renderFields(
	value: Partial<EntryFormValue>,
	props: Partial<Parameters<typeof PropertyFields>[0]> & { name?: string } = {},
) {
	const setForm = vi.fn();
	const { name = "summary", ...rest } = props;
	render(
		<TooltipProvider>
			<EntryFormProvider value={{ collection: "post", form: { ...EMPTY_FORM }, setForm, ...value }}>
				<PropertyFields include={only(name)} {...rest} />
			</EntryFormProvider>
		</TooltipProvider>,
	);
	return setForm;
}
const open = (label: RegExp) => {
	fireEvent.click(screen.getByRole("button", { name: label }));
	return screen.getByRole("textbox");
};

describe("PropertyFields on the form provider", () => {
	it("shows a publish problem under its value and links the opened input to it", () => {
		const issue = {
			code: "missing_field",
			path: "summary",
			message: "요약",
			text: "요약을 입력하세요.",
			where: "summary",
		};
		renderFields({ issues: [issue] });
		// The field already says where the problem is, so its key is not part of the text.
		expect(document.getElementById("cms-summary-error")?.textContent).toBe(issue.text);
		const input = open(/^요약/);
		expect(input.getAttribute("aria-invalid")).toBe("true");
		expect(input.getAttribute("aria-describedby")).toBe("cms-summary-error");
	});

	it("a change reaches the owner as a patch of that field only", () => {
		const form: EntryForm = { ...EMPTY_FORM, summary: "A", oldField: "kept" };
		const setForm = renderFields({ form });
		fireEvent.change(open(/^요약/), { target: { value: "AB" } });
		expect(setForm).toHaveBeenCalledWith({ summary: "AB" });
	});

	it("the slug input uses `onSlugChange` when given, and the form otherwise", () => {
		const onSlugChange = vi.fn();
		const setForm = renderFields({ form: { ...EMPTY_FORM, slug: "a" } }, { name: "slug", onSlugChange });
		fireEvent.change(open(/^주소/), { target: { value: "ab" } });
		expect(onSlugChange).toHaveBeenCalledWith("ab");
		expect(setForm).not.toHaveBeenCalled();
		cleanup();

		const plain = renderFields({ form: { ...EMPTY_FORM, slug: "a" } }, { name: "slug" });
		fireEvent.change(open(/^주소/), { target: { value: "ac" } });
		expect(plain).toHaveBeenCalledWith({ slug: "ac" });
	});

	it("a disabled form shows the value but does not open it", () => {
		const setForm = renderFields({ form: { ...EMPTY_FORM, summary: "S" }, disabled: true });
		expect(screen.queryByRole("button", { name: /^요약/ })).toBeNull();
		expect(screen.getByText("S")).toBeTruthy();
		expect(setForm).not.toHaveBeenCalled();
	});

	it("fills a field from the body when its button is pressed while the field is open", () => {
		const doc = {
			type: "doc" as const,
			version: 1,
			content: [{ type: "paragraph", content: [{ type: "text", text: "This is body paragraph text." }] }],
		};
		const setForm = renderFields({ form: { ...EMPTY_FORM, doc, summary: "" } });
		expect(screen.queryByRole("button", { name: "본문에서 가져오기" })).toBeNull();
		open(/^요약/);
		fireEvent.click(screen.getByRole("button", { name: "본문에서 가져오기" }));
		expect(setForm).toHaveBeenCalledWith({ summary: "This is body paragraph text." });
	});
});
