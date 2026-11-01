import { TooltipProvider } from "@monti-cms/ui";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { contentCollection } from "../../../../../core/test/any-site";
import { testSite } from "../../../../../core/test/site";
import { renderWithSite as render } from "../../../test/site";
import { EMPTY_FORM } from "../entry-form";
import { entriesMessages } from "../messages";
import { PropertyFields } from "../property-fields";
import { EntryFormProvider, type EntryFormValue } from "../use-field";

const tEntries = testSite.createTranslator(entriesMessages);

afterEach(cleanup);

/**
 * The two text properties the cases below read and change: the collection's summary (the multi-line text field the body can fill) and its slug.
 * They are found in the config, with the labels their value buttons start with.
 */
const SUMMARY = testSite.fillFromBodyFields(contentCollection).find(({ field, when }) => !when && field.multiline);
if (!SUMMARY) throw new Error(`${contentCollection} has no text field the body fills`);
const SUMMARY_NAME = SUMMARY.name;
const SLUG_LABEL = testSite.schemaOf(contentCollection).fields.slug?.label ?? "slug";
const startsWith = (label: string) => new RegExp(`^${label}`);
const only = (name: string) => (group: { fields: readonly string[] }) => group.fields.includes(name);

function renderFields(
	value: Partial<EntryFormValue>,
	props: Partial<Parameters<typeof PropertyFields>[0]> & { name?: string } = {},
) {
	const setForm = vi.fn();
	const { name = SUMMARY_NAME, ...rest } = props;
	render(
		<TooltipProvider>
			<EntryFormProvider value={{ collection: contentCollection, form: { ...EMPTY_FORM }, setForm, ...value }}>
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
	it("WRITE-P1 shows a publish problem under its value and links the opened input to it", () => {
		const issue = {
			code: "missing_field",
			path: SUMMARY_NAME,
			message: SUMMARY.field.label,
			text: "요약을 입력하세요.",
			where: SUMMARY_NAME,
		};
		renderFields({ issues: [issue] });
		// The field already says where the problem is, so its key is not part of the text.
		expect(screen.getByText(issue.text)).toBeInTheDocument();
		const input = open(startsWith(SUMMARY.field.label));
		expect(input.getAttribute("aria-invalid")).toBe("true");
		expect(input).toHaveAccessibleDescription(issue.text);
	});

	it("WRITE-P4 the slug input uses `onSlugChange` when given, and the form otherwise", () => {
		const onSlugChange = vi.fn();
		const setForm = renderFields({ form: { ...EMPTY_FORM, slug: "a" } }, { name: "slug", onSlugChange });
		fireEvent.change(open(startsWith(SLUG_LABEL)), { target: { value: "ab" } });
		expect(onSlugChange).toHaveBeenCalledWith("ab");
		expect(setForm).not.toHaveBeenCalled();
		cleanup();

		const plain = renderFields({ form: { ...EMPTY_FORM, slug: "a" } }, { name: "slug" });
		fireEvent.change(open(startsWith(SLUG_LABEL)), { target: { value: "ac" } });
		expect(plain).toHaveBeenCalledWith({ slug: "ac" });
	});

	it("TRASH-T7 a disabled form shows the value but does not open it", () => {
		const setForm = renderFields({ form: { ...EMPTY_FORM, [SUMMARY_NAME]: "S" }, disabled: true });
		expect(screen.queryByRole("button", { name: startsWith(SUMMARY.field.label) })).toBeNull();
		expect(screen.getByText("S")).toBeInTheDocument();
		expect(setForm).not.toHaveBeenCalled();
	});

	it("WRITE-W12 fills a field from the body when its button is pressed while the field is open", () => {
		const doc = {
			type: "doc" as const,
			version: 1,
			content: [{ type: "paragraph", content: [{ type: "text", text: "This is body paragraph text." }] }],
		};
		const setForm = renderFields({ form: { ...EMPTY_FORM, doc, [SUMMARY_NAME]: "" } });
		expect(screen.queryByRole("button", { name: tEntries("field.fillFromBody") })).toBeNull();
		open(startsWith(SUMMARY.field.label));
		fireEvent.click(screen.getByRole("button", { name: tEntries("field.fillFromBody") }));
		expect(setForm).toHaveBeenCalledWith({ [SUMMARY_NAME]: "This is body paragraph text." });
	});
});
