import type { Collection } from "@monti-cms/core/client";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { CmsAdminComponentsProvider, type FieldViewProps } from "../../../admin-components";
import { TooltipProvider } from "../../../ui/tooltip";
import { renderWithSite as render } from "../../__test__/site-wrapper";
import { EMPTY_FORM, type EntryForm } from "../entry-form";
import { InspectorPanel } from "../inspector-panel";
import { entriesMessages } from "../messages";
import { EntryFormProvider } from "../use-field";

const t = testSite.createTranslator(entriesMessages);

/**
 * Field `tab` and view fields (regression guard, independent of config). Collection, field and tab names are found in the current config
 * (the reference blog config has the SEO extension field in the `SEO` tab; another site's config uses a `Search` tab).
 */

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ items: [], total: 0 }) })),
	);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

/** The first collection with a text field that has a field `tab`, and that field (an unregistered `input` renders as the default input). */
const found = (() => {
	for (const collection of testSite.COLLECTIONS) {
		for (const [name, field] of Object.entries(testSite.schemaOf(collection).fields)) {
			if (field.tab && field.kind === "text") return { collection, name, field };
		}
	}
	return undefined;
})();
const viewField = found
	? Object.entries(testSite.schemaOf(found.collection).fields).find(([, field]) => field.kind === "view" && field.tab)
	: undefined;

function renderPanel(collection: Collection, form: EntryForm, children?: (panel: React.ReactNode) => React.ReactNode) {
	const panel = (
		<EntryFormProvider value={{ collection, form, setForm: vi.fn() }}>
			<InspectorPanel
				incomingReferences={[]}
				isLoadingIncomingReferences={false}
				onRefreshIncomingReferences={vi.fn()}
				onSlugChange={vi.fn()}
				onRegenerateSlug={vi.fn()}
				onClose={vi.fn()}
			/>
		</EntryFormProvider>
	);
	render(<TooltipProvider>{children ? children(panel) : panel}</TooltipProvider>);
}

describe("properties panel: field `tab`", () => {
	it("the config has a field with `tab`", () => {
		expect(found).toBeDefined();
	});

	it("a field with a field `tab` renders in that tab, and not in the default tab, even without a layout entry", async () => {
		if (!found || !testSite.isCollection(found.collection)) return;
		renderPanel(found.collection, { ...EMPTY_FORM, title: "Title", [found.name]: "Tab value" });
		expect(screen.queryByLabelText(found.field.label)).toBeNull();
		fireEvent.click(screen.getByRole("tab", { name: found.field.tab }));
		expect(((await screen.findByLabelText(found.field.label)) as HTMLInputElement).value).toBe("Tab value");
	});

	it("a view field renders the registered view (`fieldViews`) in that tab, and renders nothing when none is registered", async () => {
		if (!found || !viewField || viewField[1].kind !== "view") return;
		const [, view] = viewField;
		const Custom = ({ form }: FieldViewProps) => <p>preview: {String(form.title)}</p>;
		renderPanel(found.collection, { ...EMPTY_FORM, title: "Title" }, (panel) => (
			<CmsAdminComponentsProvider components={{ fieldViews: { [view.view]: Custom } }}>
				{panel}
			</CmsAdminComponentsProvider>
		));
		fireEvent.click(screen.getByRole("tab", { name: view.tab }));
		expect(await screen.findByText("preview: Title")).toBeTruthy();
		cleanup();
		renderPanel(found.collection, { ...EMPTY_FORM, title: "Title" });
		fireEvent.click(screen.getByRole("tab", { name: view.tab }));
		expect(screen.queryByText("preview: Title")).toBeNull();
	});

	it("a collection without `tab` has only the default tab", () => {
		const plain = testSite.COLLECTIONS.find((collection) =>
			Object.values(testSite.schemaOf(collection).fields).every((field) => !field.tab),
		);
		if (!plain || (testSite.schemaOf(plain).layout ?? []).some((group) => group.tab)) return;
		renderPanel(plain, { ...EMPTY_FORM, title: "Plain" });
		expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([t("tab.default")]);
	});
});
