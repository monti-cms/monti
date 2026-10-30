import { describe, expect, it } from "vitest";
import { testSite } from "../../../../../core/test/site";
import type { CmsIssue } from "../../../api/error-message";
import type { SlotApplyMode } from "../../../slots/registry";
import { EMPTY_FORM, type FormValue } from "../entry-form";
import { applySlotValue, type FieldStateInput, fieldState } from "../use-field";

// The reference blog's fields: `title` is per language and required, `categoryId` is shared by a translation group, `replacementPostId` depends on
// a conditional field, and `slug` is the address.

const input = (overrides: Partial<FieldStateInput> = {}): FieldStateInput => ({
	form: { ...EMPTY_FORM },
	issues: [],
	disabled: false,
	...overrides,
});
const stateOf = (name: string, overrides: Partial<FieldStateInput> = {}) =>
	fieldState(testSite, "post", name, input(overrides));

const locked = (values: Record<string, FormValue>): FieldStateInput["locked"] => ({
	values: { ...EMPTY_FORM, ...values },
	note: "From the original",
});

describe("fieldState", () => {
	it.each([
		{
			case: "an editable field with a value",
			name: "title",
			given: { form: { ...EMPTY_FORM, title: "Hello" } },
			want: { value: "Hello", required: true, readOnly: false, readOnlyReason: null, lockedNote: undefined },
		},
		{
			case: "a missing value",
			name: "summary",
			given: {},
			want: { value: null, readOnly: false, readOnlyReason: null },
		},
		{
			case: "a key that is not a schema field (a language tab key)",
			name: "title:en",
			given: { form: { ...EMPTY_FORM, "title:en": "Hi" } },
			want: { value: "Hi", definition: undefined, label: "title:en", required: false, readOnlyReason: null },
		},
		{
			case: "a disabled form",
			name: "title",
			given: { disabled: true },
			want: { readOnly: true, readOnlyReason: "disabled" },
		},
		{
			case: "a shared field on a translation: the original's value, read-only, with the note and not required",
			name: "categoryId",
			given: { form: { ...EMPTY_FORM, categoryId: "other" }, locked: locked({ categoryId: "cat-1" }) },
			want: {
				value: "cat-1",
				required: false,
				readOnly: true,
				readOnlyReason: "locked",
				lockedNote: "From the original",
			},
		},
		{
			case: "a per-language field on a translation: its own value, editable, no note",
			name: "title",
			given: { form: { ...EMPTY_FORM, title: "Own title" }, locked: locked({ title: "Original title" }) },
			want: { value: "Own title", required: true, readOnly: false, readOnlyReason: null, lockedNote: undefined },
		},
		{
			case: "a locked field on a disabled form says it is locked",
			name: "categoryId",
			given: { disabled: true, locked: locked({}) },
			want: { readOnly: true, readOnlyReason: "locked" },
		},
		{
			case: "a field that depends on a conditional field follows that field: shared, so locked",
			name: "replacementPostId",
			given: { locked: locked({}) },
			want: { readOnlyReason: "locked" },
		},
		{
			case: "the slug on a translation: never locked",
			name: "slug",
			given: { form: { ...EMPTY_FORM, slug: "own" }, locked: locked({ slug: "original" }) },
			want: { value: "own", readOnly: false, readOnlyReason: null },
		},
	])("$case", ({ name, given, want }) => {
		expect(stateOf(name, given)).toMatchObject(want);
	});

	it("gives the definition and label of the collection's field, the nested field of a conditional field included", () => {
		const title = testSite.titleField("post").field;
		expect(stateOf("title")).toMatchObject({ definition: title, label: title.label });
		expect(stateOf("replacementPostId").definition?.kind).toBe("relation");
		expect(stateOf("slug").definition?.kind).toBe("slug");
	});

	it("takes the issues on the field's path as its errors, the first one as its error, and none on a locked field", () => {
		const issues: CmsIssue[] = [
			{ code: "missing_field", path: "title", text: "Enter a title." },
			{ code: "too_long", path: "title", text: "Shorter, please." },
			{ code: "other", path: "summary", text: "x" },
			{ code: "missing_field", path: "categoryId", text: "x" },
		];
		const title = stateOf("title", { issues });
		expect(title.errors).toEqual([
			{ code: "missing_field", message: "Enter a title.", issue: issues[0] },
			{ code: "too_long", message: "Shorter, please.", issue: issues[1] },
		]);
		expect(title.error).toBe(title.errors[0]);
		expect(stateOf("tagIds", { issues })).toMatchObject({ error: null, errors: [] });
		expect(stateOf("categoryId", { issues, locked: locked({}) })).toMatchObject({ error: null, errors: [] });
	});
});

describe("applySlotValue", () => {
	const cases: {
		case: string;
		current: FormValue | undefined;
		next: string;
		mode: SlotApplyMode;
		want: FormValue | null;
	}[] = [
		{ case: "append adds to the list", current: ["a", "b"], next: "c", mode: "append", want: ["a", "b", "c"] },
		{
			case: "append of a value the list holds changes nothing",
			current: ["a", "b"],
			next: "b",
			mode: "append",
			want: null,
		},
		{ case: "append to a field that is not a list starts one", current: "x", next: "c", mode: "append", want: ["c"] },
		{ case: "replace writes the value as it is", current: ["a"], next: "only", mode: "replace", want: "only" },
	];
	it.each(cases)("$case", ({ current, next, mode, want }) => {
		expect(applySlotValue(current, next, mode)).toEqual(want);
	});
});
