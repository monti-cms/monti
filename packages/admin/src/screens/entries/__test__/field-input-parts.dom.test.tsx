import type { CmsConfig } from "@monti-cms/core";
import { createSite, type Site } from "@monti-cms/core/site";
import { TooltipProvider } from "@monti-cms/ui";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testConfig, testSite } from "../../../../../core/test/site";
import { AdminComponentsProvider, type FieldInputParts } from "../../../admin-components";
import { fakeApi } from "../../../test/fake-api";
import { renderWithSite as render } from "../../../test/site";
import { AdminFeaturesProvider } from "../../shared/admin-features";
import { EMPTY_FORM, type EntryForm } from "../entry-form";
import { entriesMessages } from "../messages";
import { PropertyFields } from "../property-fields";
import { EntryFormProvider } from "../use-field";

const t = testSite.createTranslator(entriesMessages);

/**
 * Input parts registered by extensions (`FieldInputParts`) and the media field's default input. Regardless of config, it finds in the current config
 * the text field that has `input` (both example configs have an SEO extension field), and makes the select with an input part and the media field
 * with the default picker from fields of the config, since neither example config has them.
 */

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const find = (kind: string, withInput: boolean) => {
	for (const collection of testSite.COLLECTIONS) {
		const stored = testSite
			.storedFields(collection)
			.find(({ field, when }) => !when && field.kind === kind && Boolean(field.input) === withInput);
		if (stored) return { collection, ...stored };
	}
	return undefined;
};
const text = find("text", true);
const media = find("media", false);
/** What a test found above. A config without it skips that test (`it.skipIf`), so inside the test it is there; a miss fails the test. */
const present = <T,>(value: T | undefined | null): T => {
	if (value === undefined || value === null) throw new Error("the config has no such field");
	return value;
};

type Found = NonNullable<ReturnType<typeof find>>;
const configFields = (collection: string) =>
	present(
		(testConfig.collections as unknown as Record<string, { fields: Record<string, { kind: string }> }>)[collection],
	).fields;
/** The site with one field of the config changed by `patch`, and that field as the changed site reads it (same collection, name and label). */
function withField(found: Found, patch: Record<string, unknown>): { site: Site; target: Found } {
	const collection = present(testConfig.collections[found.collection]);
	const field = { ...present(configFields(found.collection)[found.name]), label: found.field.label, ...patch };
	const site = createSite({
		...testConfig,
		collections: {
			...testConfig.collections,
			[found.collection]: { ...collection, fields: { ...collection.fields, [found.name]: field } },
		},
	} as CmsConfig);
	return { site, target: { ...found, field: present(site.storedField(found.collection, found.name)).field } };
}
/** A select field of the config (not the choice of a conditional field) given an input part a test registers: no select of the examples has one. */
const select = (() => {
	const plain = testSite.COLLECTIONS.flatMap((collection) =>
		testSite
			.storedFields(collection)
			.filter(({ field, when }) => !when && field.kind === "select" && !field.input)
			.map((stored) => ({ collection, ...stored })),
	).find(({ collection, name }) => configFields(collection)[name]?.kind === "select");
	return plain && withField(plain, { input: "test-toggle" });
})();
/** A media field with the default picker: the media fields of the examples name the input of their extension. */
const plainMedia = (() => {
	const named = find("media", true) ?? media;
	return named && withField(named, { input: undefined });
})();

function renderFields(
	target: { collection: (typeof testSite.COLLECTIONS)[number]; name: string },
	form: EntryForm,
	fieldInputs: Readonly<Record<string, FieldInputParts>> = {},
	onChange = vi.fn(),
	site: Site = testSite,
) {
	render(
		<TooltipProvider>
			<AdminComponentsProvider components={{ fieldInputs }}>
				<EntryFormProvider value={{ collection: target.collection, form, setForm: onChange }}>
					<PropertyFields include={(group) => group.fields.includes(target.name)} />
				</EntryFormProvider>
			</AdminComponentsProvider>
		</TooltipProvider>,
		{ site },
	);
	return onChange;
}

describe("input parts (`FieldInputParts`)", () => {
	it.skipIf(!text?.field.input)(
		"PLUG-A2 keeps the default input and changes the hint text and the right side of the label row. A part reads other field values (`form`)",
		() => {
			const target = present(text);
			renderFields(
				target,
				{ ...EMPTY_FORM, title: "Fallback title" },
				{
					[present(target.field.input)]: {
						placeholder: ({ form }) => String(form.title),
						Aside: ({ value, form }) => <span>count {String(value || form.title).length}</span>,
					},
				},
			);
			// At rest the list only reads; the hint and the label row's piece come with the open field.
			expect(screen.queryByText("count 14")).toBeNull();
			fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${target.field.label}`) }));
			expect((screen.getByRole("textbox", { name: target.field.label }) as HTMLInputElement).placeholder).toBe(
				"Fallback title",
			);
			expect(screen.getByText("count 14")).toBeInTheDocument();
		},
	);

	it.skipIf(!text?.field.input)("PLUG-A2 `Empty` is what the list reads in place of an empty value", () => {
		const target = present(text);
		renderFields(
			target,
			{ ...EMPTY_FORM, title: "Fallback title", [target.name]: "" },
			{ [present(target.field.input)]: { Empty: ({ form }) => <>Same as {String(form.title)}</> } },
		);
		expect(screen.getByRole("button", { name: new RegExp(`^${target.field.label}`) }).textContent).toBe(
			"Same as Fallback title",
		);
	});

	it.skipIf(!select)(
		"PLUG-A2 with `Input: null`, only the label row's `Aside` renders, without an input row (toggle)",
		() => {
			const { site, target } = present(select);
			const field = target.field;
			if (field.kind !== "select") throw new Error("find returned a field of another kind");
			const off = field.defaultValue;
			const on = Object.keys(field.options).find((option) => option !== off) ?? off;
			const onChange = renderFields(
				target,
				{ ...EMPTY_FORM, title: "x" },
				{
					[present(field.input)]: {
						Input: null,
						Aside: ({ id, onChange: change }) => (
							<button type="button" id={id} onClick={() => change(on)}>
								toggle
							</button>
						),
					},
				},
				vi.fn(),
				site,
			);
			expect(screen.queryByRole("combobox")).toBeNull();
			fireEvent.click(screen.getByRole("button", { name: field.label }));
			expect(onChange).toHaveBeenCalledWith({ [target.name]: on });
		},
	);

	it.skipIf(!text)("PLUG-A2 an unregistered `input` is the kind's default input", () => {
		const target = present(text);
		renderFields(target, { ...EMPTY_FORM, title: "x", [target.name]: "kept" });
		fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${target.field.label}`) }));
		expect((screen.getByRole("textbox", { name: target.field.label }) as HTMLInputElement).value).toBe("kept");
	});
});

describe("media field (`fields.media`)", () => {
	it.skipIf(!plainMedia)(
		"MEDIA-P1 reads as its file name and opens the media picker input. A picked value is cleared with remove",
		async () => {
			const { site, target } = present(plainMedia);
			fakeApi()
				.on("GET /v1/media/:id", () => ({ filename: "cover.png", byteSize: 1024, mimeType: "image/png" }))
				.install();
			const onChange = renderFields(
				target,
				{ ...EMPTY_FORM, title: "x", [target.name]: "11111111-1111-4111-8111-111111111111" },
				{},
				vi.fn(),
				site,
			);
			const value = screen.getByRole("button", { name: new RegExp(`^${target.field.label}`) });
			await waitFor(() => expect(value.textContent).toContain("cover.png"));
			fireEvent.click(value);
			expect(screen.getByRole("button", { name: target.field.label }).textContent).toBe(t("media.change"));
			fireEvent.click(screen.getByRole("button", { name: t("media.remove") }));
			expect(onChange).toHaveBeenCalledWith({ [target.name]: "" });
		},
	);

	it.skipIf(!plainMedia)("MEDIA-U6 cannot pick when the server has no media storage", () => {
		const { site, target } = present(plainMedia);
		render(
			<TooltipProvider>
				<AdminFeaturesProvider features={{ media: false }}>
					<EntryFormProvider
						value={{ collection: target.collection, form: { ...EMPTY_FORM, title: "x" }, setForm: vi.fn() }}
					>
						<PropertyFields include={(group) => group.fields.includes(target.name)} />
					</EntryFormProvider>
				</AdminFeaturesProvider>
			</TooltipProvider>,
			{ site },
		);
		fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${target.field.label}`) }));
		expect((screen.getByRole("button", { name: target.field.label }) as HTMLButtonElement).disabled).toBe(true);
	});
});
