import { COLLECTIONS, storedFields } from "@monti-cms/core/client";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CmsAdminComponentsProvider, type FieldInputParts } from "../../../admin-components";
import { TooltipProvider } from "../../../ui/tooltip";
import { EMPTY_FORM, type EntryForm } from "../entry-form";
import { SchemaFields } from "../schema-fields";
import { t } from "../translate";

/**
 * Input parts registered by extensions (`FieldInputParts`) and the media field's default input. Regardless of config, it finds in the current config
 * the text/select fields that have `input` and the media field (both example configs have an SEO extension field).
 */

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const find = (kind: string, withInput: boolean) => {
	for (const collection of COLLECTIONS) {
		const stored = storedFields(collection).find(
			({ field, when }) => !when && field.kind === kind && Boolean(field.input) === withInput,
		);
		if (stored) return { collection, ...stored };
	}
	return undefined;
};
const text = find("text", true);
const select = find("select", true);
const media = find("media", false);

function renderFields(
	target: { collection: (typeof COLLECTIONS)[number]; name: string },
	form: EntryForm,
	fieldInputs: Readonly<Record<string, FieldInputParts>> = {},
	onChange = vi.fn(),
) {
	render(
		<TooltipProvider>
			<CmsAdminComponentsProvider components={{ fieldInputs }}>
				<SchemaFields
					collection={target.collection}
					form={form}
					context={{ disabled: false }}
					onChange={onChange}
					include={(group) => group.fields.includes(target.name)}
				/>
			</CmsAdminComponentsProvider>
		</TooltipProvider>,
	);
	return onChange;
}

describe("input parts (`FieldInputParts`)", () => {
	it("keeps the default input and changes the hint text and the right side of the label row. A part reads other field values (`form`)", () => {
		if (!text?.field.input) return;
		renderFields(
			text,
			{ ...EMPTY_FORM, title: "Fallback title" },
			{
				[text.field.input]: {
					placeholder: ({ form }) => form.title,
					Aside: ({ value, form }) => <span>count {String(value || form.title).length}</span>,
				},
			},
		);
		expect((screen.getByLabelText(text.field.label) as HTMLInputElement).placeholder).toBe("Fallback title");
		expect(screen.getByText("count 14")).toBeTruthy();
	});

	it("with `Input: null`, only the label row's `Aside` renders, without an input row (toggle)", () => {
		if (!select?.field.input || select.field.kind !== "select") return;
		const off = select.field.defaultValue;
		const on = Object.keys(select.field.options).find((option) => option !== off) ?? off;
		const onChange = renderFields(
			select,
			{ ...EMPTY_FORM, title: "x" },
			{
				[select.field.input]: {
					Input: null,
					Aside: ({ id, onChange: change }) => (
						<button type="button" id={id} onClick={() => change(on)}>
							toggle
						</button>
					),
				},
			},
		);
		expect(screen.queryByRole("combobox")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: select.field.label }));
		expect(onChange).toHaveBeenCalledWith({ [select.name]: on });
	});

	it("an unregistered `input` is the kind's default input", () => {
		if (!text) return;
		renderFields(text, { ...EMPTY_FORM, title: "x", [text.name]: "kept" });
		expect((screen.getByLabelText(text.field.label) as HTMLInputElement).value).toBe("kept");
	});
});

describe("media field (`fields.media`)", () => {
	it("renders the media picker input by kind. A picked value is cleared with remove", () => {
		if (!media) return;
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ publicUrl: null }) })),
		);
		const onChange = renderFields(media, {
			...EMPTY_FORM,
			title: "x",
			[media.name]: "11111111-1111-4111-8111-111111111111",
		});
		expect(screen.getByRole("button", { name: media.field.label }).textContent).toBe(t("media.change"));
		fireEvent.click(screen.getByRole("button", { name: t("media.remove") }));
		expect(onChange).toHaveBeenCalledWith({ [media.name]: "" });
	});

	it("when empty, it is a pick button", () => {
		if (!media) return;
		renderFields(media, { ...EMPTY_FORM, title: "x" });
		expect(screen.getByRole("button", { name: media.field.label }).textContent).toBe(t("media.chooseImage"));
	});
});
