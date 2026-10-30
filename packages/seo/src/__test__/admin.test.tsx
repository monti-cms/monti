import { AdminComponentsProvider } from "@monti-cms/admin";
import { EMPTY_FORM, type EntryForm, TooltipProvider } from "@monti-cms/admin/kit";
import { type SlotAction, SlotRegistryProvider } from "@monti-cms/admin/slots";
import { type Collection, SiteProvider } from "@monti-cms/core/site";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// The properties panel is read from the admin package source, not the public entry point (tests only).
import { InspectorPanel } from "../../../admin/src/screens/entries/inspector-panel";
import { EntryFormProvider } from "../../../admin/src/screens/entries/use-field";
import { pressOption } from "../../../admin/src/test/base-ui";
import { fakeApi } from "../../../admin/src/test/fake-api";
import { SiteWrapper } from "../../../admin/src/test/site";
import { testSite } from "../../test/site";
import { SEO_ROLES } from "..";
import { SEO_ADMIN_COMPONENTS } from "../admin/provider";
import { seoMessages } from "../messages";

// UI text follows the admin language from the config, so the same wording is picked from the dictionary.
const t = testSite.createTranslator(seoMessages);

/**
 * Admin UI of the SEO extension (works regardless of config; regression guard). Collections, fields and tabs are found by role in the current config
 * (the example blog config uses `seoTitle`… in the `SEO` tab, the other-site config uses `metaTitle`… in the `Search` tab).
 */

// The panel asks the admin API nothing in these tests; the admin's fake fails a test that sends a request no route answers.
beforeEach(() => {
	fakeApi().install();
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
const tab = testSite.panelTabOf(collection, field(SEO_ROLES.title).name);

function renderPanel(form: EntryForm, onChange = vi.fn(), sources: SlotAction[] = []) {
	render(
		<SiteWrapper site={testSite}>
			<TooltipProvider>
				<AdminComponentsProvider components={SEO_ADMIN_COMPONENTS}>
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
							/>
						</EntryFormProvider>
					</SlotRegistryProvider>
				</AdminComponentsProvider>
			</TooltipProvider>
		</SiteWrapper>,
	);
	fireEvent.click(screen.getByRole("tab", { name: tab }));
	return onChange;
}

describe("SEO extension admin UI", () => {
	/** The properties list opens on the SEO tab; a property is found by its label. */
	const valueButton = async (label: string) => screen.findByRole("button", { name: new RegExp(`^${label}`) });

	it("SEO fields gather in their tab as a read list, with no preview boxes", async () => {
		const title = field(SEO_ROLES.title);
		renderPanel({ ...EMPTY_FORM, title: "Entry title", [title.name]: "Search value" });
		expect((await valueButton(title.field.label)).textContent).toBe("Search value");
		expect(
			screen.getByRole("button", { name: new RegExp(`^${field(SEO_ROLES.description).field.label}`) }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: new RegExp(`^${field(SEO_ROLES.image).field.label}`) }),
		).toBeInTheDocument();
		expect(screen.queryByRole("region", { name: /미리보기|preview/i })).toBeNull();
		expect(screen.queryAllByRole("textbox")).toEqual([]);
	});

	it("an empty value says what it follows: the title with its length, the summary, the default image", async () => {
		renderPanel({ ...EMPTY_FORM, title: "Entry title", ...(summaryField ? { [summaryField.name]: "Lead" } : {}) });
		const title = field(SEO_ROLES.title);
		const limit = title.field.kind === "text" ? (title.field.max ?? title.field.inputOptions?.limit) : undefined;
		expect((await valueButton(title.field.label)).textContent).toBe(`${t("same.title")} · 11/${limit}`);
		expect((await valueButton(field(SEO_ROLES.description).field.label)).textContent).toBe(t("same.description"));
		expect((await valueButton(field(SEO_ROLES.image).field.label)).textContent).toBe(t("same.image"));
		expect((await valueButton(field(SEO_ROLES.noindex).field.label)).textContent).toBe(t("option.index"));
	});

	it("an opened empty title shows the fallback as the hint and the character count", async () => {
		const title = field(SEO_ROLES.title);
		renderPanel({ ...EMPTY_FORM, title: "Entry title", ...(summaryField ? { [summaryField.name]: "Lead" } : {}) });
		fireEvent.click(await valueButton(title.field.label));
		const input = (await screen.findByRole("textbox", { name: title.field.label })) as HTMLInputElement;
		expect(input.placeholder).toBe("Entry title");
		const limit = title.field.kind === "text" ? (title.field.max ?? title.field.inputOptions?.limit) : undefined;
		expect(screen.getByText(`11/${limit}`)).toBeInTheDocument();
		if (summaryField) {
			fireEvent.keyDown(input, { key: "Escape" });
			fireEvent.click(await valueButton(field(SEO_ROLES.description).field.label));
			const description = (await screen.findByRole("textbox", {
				name: field(SEO_ROLES.description).field.label,
			})) as HTMLTextAreaElement;
			expect(description.placeholder).toBe("Lead");
		}
	});

	it("hide from search is a select: picking the hiding option writes `noindex`", async () => {
		const noindex = field(SEO_ROLES.noindex);
		const onChange = renderPanel({ ...EMPTY_FORM, title: "Entry" });
		fireEvent.click(await valueButton(noindex.field.label));
		pressOption(await screen.findByRole("option", { name: t("option.noindex") }));
		await waitFor(() => expect(onChange).toHaveBeenCalledWith({ [noindex.name]: "noindex" }));
	});

	it("actions next to the search title (AI and others) stay attached and receive the summary role value as `summary`", async () => {
		const inputs: Parameters<SlotAction["run"]>[0][] = [];
		const run = vi.fn<SlotAction["run"]>(async (input) => {
			inputs.push(input);
			return { kind: "text", text: "New" };
		});
		const onChange = renderPanel(
			{ ...EMPTY_FORM, title: "Entry", ...(summaryField ? { [summaryField.name]: "Lead" } : {}) },
			vi.fn(),
			[{ id: "t", label: "Suggest", apply: "replace", run }],
		);
		await valueButton(field(SEO_ROLES.title).field.label);
		const row = within(screen.getByRole("group", { name: field(SEO_ROLES.title).field.label }));
		fireEvent.click(row.getByRole("button", { name: /Fill/ }));
		await waitFor(() => expect(inputs).toHaveLength(1));
		expect(inputs[0]).toMatchObject({ title: "Entry", ...(summaryField ? { summary: "Lead" } : {}) });
		await waitFor(() => expect(onChange).toHaveBeenCalledWith({ [field(SEO_ROLES.title).name]: "New" }));
	});

	it("a collection without an SEO tab has a single default tab", () => {
		const plain = testSite.COLLECTIONS.find((name) => testSite.panelTabsOf(name).length === 1);
		if (!plain) return;
		render(
			<SiteProvider site={testSite}>
				<TooltipProvider>
					<AdminComponentsProvider components={SEO_ADMIN_COMPONENTS}>
						<EntryFormProvider value={{ collection: plain, form: { ...EMPTY_FORM, title: "Plain" }, setForm: vi.fn() }}>
							<InspectorPanel
								incomingReferences={[]}
								isLoadingIncomingReferences={false}
								onRefreshIncomingReferences={vi.fn()}
								onSlugChange={vi.fn()}
								onRegenerateSlug={vi.fn()}
							/>
						</EntryFormProvider>
					</AdminComponentsProvider>
				</TooltipProvider>
			</SiteProvider>,
		);
		expect(screen.getAllByRole("tab")).toHaveLength(1);
	});
});
