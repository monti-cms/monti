import { emptyStoredDocument } from "@monti-cms/core/document";
import type { Collection, ListEntriesItem } from "@monti-cms/core/site";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { commonMessages } from "../../lib/common.messages";
import { type FakeApi, fakeApi } from "../../test/fake-api";
import { docOf } from "../../test/mdx";
import { createTestRouter } from "../../test/router";
import { withSite } from "../../test/site";
import { EntryEditorShell } from "../entries/entry-editor-shell";
import { copyTitle, type EntryData } from "../entries/entry-form";
import { entriesMessages } from "../entries/messages";
import { EntryListScreen } from "../entry-list-screen";
import { columnLabel, columnsFor } from "../list-columns";
import { screensMessages } from "../messages";
import { RecordPanel } from "../record-panel";
import { AdminQueryProvider } from "../shared/query-provider";

/**
 * Admin screen checks that do not depend on settings (regression guard). Collection/field names and labels are not hard-coded but read from the current settings.
 * Runs against both the reference blog example config and another site's config (`vitest.othersite.config.ts`). Only the title field `title` is used by name.
 */

const t = testSite.createTranslator(screensMessages);
const tc = testSite.createTranslator(commonMessages);
const tEntries = testSite.createTranslator(entriesMessages);

const content: Collection = testSite.DEFAULT_COLLECTION;
const record = testSite.COLLECTIONS.find((name) => testSite.isItemCollection(name)) as Collection;
const titleLabel = (collection: Collection) => testSite.storedField(collection, "title")?.field.label ?? "";

const nav = createTestRouter();
const render = (ui: ReactElement) => nav.render(withSite(ui));
vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);
let listed: ListEntriesItem[] = [];
let api: FakeApi;

const item = (id: string, title: string): ListEntriesItem => ({
	id,
	collection: content,
	locale: testSite.DEFAULT_LOCALE,
	translationGroupId: id,
	title,
	slug: id,
	status: "draft",
	version: 1,
	folderId: null,
	relations: {},
	values: {},
	hasUnpublishedChanges: false,
	publishedAt: null,
	createdAt: new Date("2026-01-01T00:00:00Z"),
	updatedAt: new Date("2026-01-01T00:00:00Z"),
	deletedAt: null,
});

beforeEach(() => {
	vi.clearAllMocks();
	listed = [];
	api = fakeApi()
		.withEmptyRail()
		.on("GET /v1/preferences", () => ({}))
		.on("GET /v1/folders", () => [])
		.on("GET /v1/entries", ({ query }) => {
			const items = query.get("collection") === content ? listed : [];
			return { items, total: items.length };
		})
		.on("GET /v1/entries/:id/relations", () => ({ incomingReferences: [] }))
		.on("POST /v1/entries/:id/check", () => ({ issues: [], warnings: [] }))
		.install();
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("any site: list screen", () => {

	it("WRITE-W10 duplicates a row with a copy title made by the admin", async () => {
		nav.setSearch(`collection=${content}`);
		listed = [item("e1", "Alpha")];
		api.on("POST /v1/entries/:id/duplicate", () => ({
			entry: {
				id: "copy-1",
				collection: content,
				status: "draft" as const,
				version: 1,
				folderId: null,
				workingSlug: null,
				publishedSlug: null,
				working: { metadata: { title: copyTitle(testSite, content, "Alpha") }, doc: emptyStoredDocument() },
			},
			warnings: [],
		}));
		render(
			<AdminQueryProvider>
				<EntryListScreen />
			</AdminQueryProvider>,
		);
		const row = await screen.findByRole("row", { name: /Alpha/ });
		await act(async () => {
			fireEvent.contextMenu(row);
		});
		fireEvent.click(await screen.findByRole("menuitem", { name: tc("lifecycle.duplicate") }));
		await waitFor(() => expect(api.sent("POST /v1/entries/:id/duplicate")).toHaveLength(1));
		expect(api.sent("POST /v1/entries/:id/duplicate")[0]?.params.id).toBe("e1");
		expect(api.sent("POST /v1/entries/:id/duplicate")[0]?.body).toEqual({
			title: copyTitle(testSite, content, "Alpha"),
		});
		await waitFor(() => expect(nav.navigate).toHaveBeenCalledWith(testSite.adminEntryEditHref("copy-1")));
	});
});

describe("any site: copy title", () => {
	it("WRITE-W10 adds the copy suffix and stays within the title field's max", () => {
		expect(copyTitle(testSite, content, "Alpha")).toBe(`Alpha${tEntries("copy.suffix")}`);
		expect(copyTitle(testSite, content, "  ")).toBe(`${tc("untitled")}${tEntries("copy.suffix")}`);
		const field = testSite.storedField(content, "title")?.field;
		const max = field?.kind === "text" ? field.max : undefined;
		const long = copyTitle(testSite, content, "x".repeat(500));
		if (max === undefined) expect(long).toBe(`${"x".repeat(500)}${tEntries("copy.suffix")}`);
		else {
			expect(Array.from(long)).toHaveLength(max);
			expect(long.endsWith(tEntries("copy.suffix"))).toBe(true);
		}
	});
});

describe("any site: record panel", () => {
	it("WRITE-W6 creates a record from its title field alone", async () => {
		api.on("POST /v1/entries", () => ({
			entry: {
				id: "r1",
				collection: record,
				status: "published" as const,
				version: 1,
				folderId: null,
				workingSlug: null,
				publishedSlug: null,
				working: { metadata: {}, doc: emptyStoredDocument() },
			},
			warnings: [],
		}));
		const onSaved = vi.fn();
		render(<RecordPanel target={{ collection: record, id: null }} onClose={vi.fn()} onSaved={onSaved} />);
		const panel = screen.getByRole("complementary", {
			name: t("list.add", { label: testSite.schemaOf(record).label }),
		});
		fireEvent.change(within(panel).getByRole("textbox", { name: new RegExp(titleLabel(record)) }), {
			target: { value: "New record" },
		});
		fireEvent.click(within(panel).getByRole("button", { name: tc("save") }));
		await waitFor(() => expect(api.sent("POST /v1/entries")).toHaveLength(1));
		expect(api.sent("POST /v1/entries")[0]?.body).toEqual({
			collection: record,
			slug: null,
			metadata: { title: "New record" },
			doc: emptyStoredDocument(),
		});
		await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "r1" })));
	});
});

describe("any site: entry editor", () => {
	const entry: EntryData = {
		id: "entry-1",
		collection: content,
		locale: testSite.DEFAULT_LOCALE,
		translationGroupId: "entry-1",
		status: "draft",
		version: 4,
		folderId: null,
		workingSlug: "any-entry",
		publishedSlug: null,
		working: { metadata: { title: "Any title" }, doc: docOf("Body") },
	};

	it("WRITE-S1 opens an entry with the title field's label and saves only schema fields", async () => {
		api
			.on("GET /v1/entries/:id", () => entry)
			.on("PATCH /v1/entries/:id", ({ body }) => ({
				entry: { ...entry, version: 5, working: { metadata: body.metadata, doc: body.doc } },
				warnings: [],
			}));
		render(<EntryEditorShell mode="edit" initialEntryId="entry-1" adminId="u1" collection={content} />);
		const title = (await screen.findByRole("textbox", { name: titleLabel(content) })) as HTMLInputElement;
		await waitFor(() => expect(title.value).toBe("Any title"));
		// The first group's fields in the properties slot show as the config's labels.
		const first = testSite.schemaOf(content).layout?.[0]?.fields ?? [];
		for (const name of first) {
			const field = testSite.schemaOf(content).fields[name];
			if (!field || name === "title" || field.kind === "slug" || field.kind === "view") continue;
			expect(screen.getAllByText(field.label).length, name).toBeGreaterThan(0);
		}

		fireEvent.change(title, { target: { value: "Changed title" } });
		fireEvent.keyDown(window, { key: "s", metaKey: true });
		await waitFor(() => expect(api.sent("PATCH /v1/entries/:id")).toHaveLength(1));
		expect(api.sent("PATCH /v1/entries/:id")[0]?.params.id).toBe("entry-1");
		const body = api.sent("PATCH /v1/entries/:id")[0]?.body;
		expect(body.metadata.title).toBe("Changed title");
		const known = new Set(testSite.storedFields(content).map(({ name }) => name));
		for (const key of Object.keys(body.metadata)) expect(known.has(key), key).toBe(true);
	});
});
