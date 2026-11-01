import { type CmsConfig, fields } from "@monti-cms/core";
import { type Collection, createSite } from "@monti-cms/core/site";
import { TooltipProvider } from "@monti-cms/ui";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contentCollection } from "../../../../../core/test/any-site";
import { testConfig, testSite } from "../../../../../core/test/site";
import { AdminComponentsProvider, type FieldViewProps } from "../../../admin-components";
import { fakeApi } from "../../../test/fake-api";
import { renderWithSite as render } from "../../../test/site";
import { EMPTY_FORM, type EntryForm } from "../entry-form";
import { InspectorPanel } from "../inspector-panel";
import { EntryFormProvider } from "../use-field";

/**
 * The tab a plugin places its fields in, and view fields (regression guard, independent of config). Collection, field and tab names are found in the current config
 * (the reference blog config has the SEO extension fields in the `SEO` tab; another site's config uses a `Search` tab).
 */

beforeEach(() => {
	fakeApi().install();
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

/** The first collection with a text field a plugin placed in a tab of its own, and that field (an unregistered `input` renders as the default input). */
const found = (() => {
	for (const collection of testSite.COLLECTIONS) {
		for (const group of testSite.panelGroupsOf(collection)) {
			if (group.placedBy === undefined) continue;
			for (const name of group.fields) {
				const field = testSite.schemaOf(collection).fields[name];
				if (field?.kind === "text") return { collection, name, field, tab: group.tab };
			}
		}
	}
	return undefined;
})();

function renderPanel(collection: Collection, form: EntryForm) {
	const panel = (
		<EntryFormProvider value={{ collection, form, setForm: vi.fn() }}>
			<InspectorPanel
				incomingReferences={[]}
				isLoadingIncomingReferences={false}
				onRefreshIncomingReferences={vi.fn()}
				onSlugChange={vi.fn()}
				onRegenerateSlug={vi.fn()}
			/>
		</EntryFormProvider>
	);
	render(<TooltipProvider>{panel}</TooltipProvider>);
}

describe("properties panel: the tab a plugin places fields in", () => {
	it("PLUG-A7 a field a plugin places renders in that tab, and not in the default tab, even without a layout entry", async () => {
		// Both example configs place the SEO fields in a tab of their own; a config without such a field fails here instead of passing unseen.
		if (!found || !testSite.isCollection(found.collection))
			throw new Error("the config has no text field a plugin places");
		renderPanel(found.collection, { ...EMPTY_FORM, title: "Title", [found.name]: "Tab value" });
		expect(screen.queryByText(found.field.label)).toBeNull();
		fireEvent.click(screen.getByRole("tab", { name: found.tab }));
		const value = await screen.findByRole("button", { name: new RegExp(`^${found.field.label}`) });
		expect(value.textContent).toBe("Tab value");
	});

	it("PLUG-A2 a view field renders the registered view (`fieldViews`) in the list, and renders nothing when none is registered", async () => {
		const collections = testConfig.collections as Record<string, { fields: object }>;
		const site = createSite({
			...testConfig,
			collections: {
				...collections,
				[contentCollection]: {
					...collections[contentCollection],
					fields: { ...collections[contentCollection]?.fields, note: fields.view({ view: "note" }) },
				},
			},
		} as unknown as CmsConfig);
		const Custom = ({ form }: FieldViewProps) => <p>preview: {String(form.title)}</p>;
		const panel = (
			<EntryFormProvider
				value={{ collection: contentCollection, form: { ...EMPTY_FORM, title: "Title" }, setForm: vi.fn() }}
			>
				<InspectorPanel
					incomingReferences={[]}
					isLoadingIncomingReferences={false}
					onRefreshIncomingReferences={vi.fn()}
					onSlugChange={vi.fn()}
					onRegenerateSlug={vi.fn()}
				/>
			</EntryFormProvider>
		);
		render(
			<TooltipProvider>
				<AdminComponentsProvider components={{ fieldViews: { note: Custom } }}>{panel}</AdminComponentsProvider>
			</TooltipProvider>,
			{ site },
		);
		expect(await screen.findByText("preview: Title")).toBeInTheDocument();
		cleanup();
		render(<TooltipProvider>{panel}</TooltipProvider>, { site });
		await screen.findAllByRole("tab");
		expect(screen.queryByText("preview: Title")).toBeNull();
	});
});
