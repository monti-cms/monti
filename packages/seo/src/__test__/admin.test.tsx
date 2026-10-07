import { EMPTY_FORM, type EntryForm, TooltipProvider } from "@monti-cms/admin/kit";
import { type SlotAction, SlotRegistryProvider } from "@monti-cms/admin/slots";
import { type Collection, SiteProvider } from "@monti-cms/core/client";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// The properties panel is read from the admin package source, not the public entry point (tests only).
import { InspectorPanel } from "../../../admin/src/screens/entries/inspector-panel";
import { EntryFormProvider } from "../../../admin/src/screens/entries/use-field";
import { testSite } from "../../test/site";
import { SEO_ROLES } from "..";
import { SeoAdminProvider } from "../admin/provider";
import { seoMessages } from "../messages";

// UI text follows the admin language from the config, so the same wording is picked from the dictionary.
const t = testSite.createTranslator(seoMessages);

/**
 * Admin UI of the SEO extension (works regardless of config; regression guard). Collections, fields and tabs are found by role in the current config
 * (the example blog config uses `seoTitle`… in the `SEO` tab, the other-site config uses `metaTitle`… in the `Search` tab).
 */

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ items: [], total: 0, publicUrl: null }) })),
	);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const collection = testSite.COLLECTIONS.find((name) => testSite.roleField(name, SEO_ROLES.title)) as Collection;
const field = (role: string) => {
	const stored = testSite.roleField(collection, role);
	if (!stored) throw new Error(`no ${role} field`);
	return stored;
};
const summaryField = testSite.roleField(collection, "summary");
const tab = field(SEO_ROLES.title).field.tab ?? "";

function renderPanel(form: EntryForm, onChange = vi.fn(), sources: SlotAction[] = []) {
	render(
		<SiteProvider site={testSite}>
			<TooltipProvider>
				<SeoAdminProvider>
					<SlotRegistryProvider
						sources={[(request) => (request.target === field(SEO_ROLES.title).name ? sources : [])]}
					>
						<EntryFormProvider value={{ collection, form, setForm: onChange }}>
							<InspectorPanel
								incomingReferences={[]}
								isLoadingIncomingReferences={false}
								onRefreshIncomingReferences={vi.fn()}
								onSlugChange={vi.fn()}
								onRegenerateSlug={vi.fn()}
								onClose={vi.fn()}
							/>
						</EntryFormProvider>
					</SlotRegistryProvider>
				</SeoAdminProvider>
			</TooltipProvider>
		</SiteProvider>,
	);
	fireEvent.click(screen.getByRole("tab", { name: tab }));
	return onChange;
}

describe("SEO extension admin UI", () => {
	it("SEO fields gather in their tab even without a layout", async () => {
		const title = field(SEO_ROLES.title);
		renderPanel({ ...EMPTY_FORM, title: "Entry title", [title.name]: "Search value" });
		expect(((await screen.findByLabelText(title.field.label)) as HTMLInputElement).value).toBe("Search value");
		expect(screen.getByLabelText(field(SEO_ROLES.description).field.label).tagName).toBe("TEXTAREA");
		// The share image is a media field, so it is entered through the media picker.
		expect(screen.getByLabelText(field(SEO_ROLES.image).field.label).textContent).toBeTruthy();
	});

	it("the search preview uses role field values and falls back to the title and summary when empty", async () => {
		renderPanel({
			...EMPTY_FORM,
			title: "Entry title",
			slug: "hello",
			...(summaryField ? { [summaryField.name]: "Lead" } : {}),
		});
		const search = await screen.findByRole("region", { name: t("preview.search") });
		expect(within(search).getByText("Entry title")).toBeTruthy();
		if (summaryField) expect(within(search).getByText("Lead")).toBeTruthy();
		expect(within(search).getByText(new RegExp(`${testSite.SITE_NAME}.*hello`))).toBeTruthy();
		expect(screen.getByRole("region", { name: t("preview.share") })).toBeTruthy();
	});

	it("an empty search title or description shows the fallback value as a hint and character count", async () => {
		const title = field(SEO_ROLES.title);
		renderPanel({ ...EMPTY_FORM, title: "Entry title", ...(summaryField ? { [summaryField.name]: "Lead" } : {}) });
		expect(((await screen.findByLabelText(title.field.label)) as HTMLInputElement).placeholder).toBe("Entry title");
		const limit = title.field.kind === "text" ? (title.field.max ?? title.field.inputOptions?.limit) : undefined;
		expect(screen.getByText(`11/${limit}`)).toBeTruthy();
		if (summaryField) {
			const description = screen.getByLabelText(field(SEO_ROLES.description).field.label) as HTMLTextAreaElement;
			expect(description.placeholder).toBe("Lead");
		}
	});

	it("hide is a switch in the label row, and on means `noindex`", async () => {
		const noindex = field(SEO_ROLES.noindex);
		const onChange = renderPanel({ ...EMPTY_FORM, title: "Entry" });
		fireEvent.click(await screen.findByRole("switch", { name: noindex.field.label }));
		expect(onChange).toHaveBeenCalledWith({ [noindex.name]: "noindex" });
	});

	it("actions next to the search title (AI and others) stay attached and receive the summary role value as `summary`", async () => {
		const run = vi.fn<SlotAction["run"]>(async () => ({ kind: "text", text: "New" }));
		renderPanel({ ...EMPTY_FORM, title: "Entry", ...(summaryField ? { [summaryField.name]: "Lead" } : {}) }, vi.fn(), [
			{ id: "t", label: "Suggest", apply: "replace", run },
		]);
		fireEvent.click(await screen.findByRole("button", { name: "Suggest" }));
		await waitFor(() => expect(run).toHaveBeenCalled());
		expect(run.mock.calls[0]?.[0]).toMatchObject({ title: "Entry", ...(summaryField ? { summary: "Lead" } : {}) });
	});

	it("a collection without an SEO tab has a single default tab", () => {
		const plain = testSite.COLLECTIONS.find((name) =>
			Object.values(testSite.schemaOf(name).fields).every((item) => !item.tab),
		);
		if (!plain) return;
		render(
			<SiteProvider site={testSite}>
				<TooltipProvider>
					<SeoAdminProvider>
						<EntryFormProvider value={{ collection: plain, form: { ...EMPTY_FORM, title: "Plain" }, setForm: vi.fn() }}>
							<InspectorPanel
								incomingReferences={[]}
								isLoadingIncomingReferences={false}
								onRefreshIncomingReferences={vi.fn()}
								onSlugChange={vi.fn()}
								onRegenerateSlug={vi.fn()}
								onClose={vi.fn()}
							/>
						</EntryFormProvider>
					</SeoAdminProvider>
				</TooltipProvider>
			</SiteProvider>,
		);
		expect(screen.getAllByRole("tab")).toHaveLength(1);
	});
});
