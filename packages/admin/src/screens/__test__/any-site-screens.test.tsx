import { emptyStoredDocument } from "@monti-cms/core/document";
import type { Collection, ListEntriesItem } from "@monti-cms/core/site";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { commonMessages } from "../../lib/common.messages";
import { jsonResponse as json } from "../../test/fetch";
import { docOf } from "../../test/mdx";
import { createTestRouter } from "../../test/router";
import { withSite } from "../../test/site";
import { EntryEditorShell } from "../entries/entry-editor-shell";
import { copyTitle } from "../entries/entry-form";
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
const backup = vi.hoisted(() => ({ get: vi.fn(), remove: vi.fn(), save: vi.fn() }));
vi.mock("../entries/local-backup", async (importOriginal) => ({
	...(await importOriginal<typeof import("../entries/local-backup")>()),
	// The functions take the site as their last argument (its recovery database); these tests look at the key and the record only.
	getLocalBackup: (key: string) => backup.get(key),
	deleteLocalBackup: (key: string) => backup.remove(key),
	saveLocalBackup: (record: unknown) => backup.save(record),
}));
// The body editor is tested separately. Here only the place for the title slot is drawn.
vi.mock("../../editor/tiptap-editor", () => ({
	CmsEditor: ({ titleField, toolbarEnd }: { titleField?: React.ReactNode; toolbarEnd?: React.ReactNode }) => (
		<>
			<div role="toolbar" aria-label="서식 도구">
				{toolbarEnd}
			</div>
			{titleField}
		</>
	),
}));
vi.mock("../entries/ai-translate", () => ({
	useAiTranslate: () => ({ blockAction: null, toolbar: null, setEditor: () => {} }),
}));

type Handler = (url: URL, init: RequestInit | undefined) => unknown;
let handle: Handler = () => undefined;
let listed: ListEntriesItem[] = [];
let fetchMock: ReturnType<typeof vi.fn>;
const calls = (method: string, path: string) =>
	fetchMock.mock.calls.filter(
		([input, init]) => (init?.method ?? "GET") === method && String(input).split("?")[0] === path,
	);
const bodyOf = (call: unknown[] | undefined) => JSON.parse(String((call?.[1] as RequestInit | undefined)?.body));

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
	trashedAt: null,
});

beforeEach(() => {
	vi.clearAllMocks();
	backup.get.mockResolvedValue(null);
	backup.remove.mockResolvedValue(undefined);
	backup.save.mockResolvedValue(true);
	handle = () => undefined;
	listed = [];
	fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
		const url = new URL(input, "http://localhost");
		const handled = await handle(url, init);
		if (handled !== undefined) return handled;
		const method = init?.method ?? "GET";
		if (url.pathname === "/api/monti/v1/preferences") return json({});
		if (url.pathname === "/api/monti/v1/folders" && method === "GET") return json([]);
		if (url.pathname === "/api/monti/v1/entries" && method === "GET") {
			const items = url.searchParams.get("collection") === content ? listed : [];
			return json({ items, total: items.length });
		}
		if (url.pathname.endsWith("/relations")) return json({ incomingReferences: [] });
		throw new Error(`Unexpected fetch: ${method} ${input}`);
	});
	vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("any site: list screen", () => {
	it("shows the collection's rows under its configured list columns", async () => {
		nav.setSearch(`collection=${content}`);
		listed = [item("e1", "Alpha"), item("e2", "Beta")];
		render(
			<AdminQueryProvider>
				<EntryListScreen />
			</AdminQueryProvider>,
		);
		await screen.findByRole("row", { name: /Alpha/ });
		expect(screen.getByRole("row", { name: /Beta/ })).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: t("view.label") }));
		const viewDialog = await screen.findByRole("dialog");
		for (const column of columnsFor(testSite, content).defaults) {
			expect(within(viewDialog).getByRole("checkbox", { name: columnLabel(testSite, content, column) })).toBeTruthy();
		}
		// A collection of writing has the one "write a new post" button, whatever its label.
		expect(screen.getByRole("button", { name: t("list.writeNew") })).toBeTruthy();
	});

	it("duplicates a row with a copy title made by the admin", async () => {
		nav.setSearch(`collection=${content}`);
		listed = [item("e1", "Alpha")];
		handle = (url, init) =>
			url.pathname === "/api/monti/v1/entries/e1/duplicate" && init?.method === "POST"
				? json({ entry: { id: "copy-1" }, warnings: [] }, 201)
				: undefined;
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
		await waitFor(() => expect(calls("POST", "/api/monti/v1/entries/e1/duplicate")).toHaveLength(1));
		expect(bodyOf(calls("POST", "/api/monti/v1/entries/e1/duplicate")[0])).toEqual({
			title: copyTitle(testSite, content, "Alpha"),
		});
		await waitFor(() => expect(nav.navigate).toHaveBeenCalledWith(testSite.adminEntryEditHref("copy-1")));
	});
});

describe("any site: copy title", () => {
	it("adds the copy suffix and stays within the title field's max", () => {
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
	it("creates a record from its title field alone", async () => {
		handle = (url, init) =>
			url.pathname === "/api/monti/v1/entries" && init?.method === "POST"
				? json({
						entry: {
							id: "r1",
							collection: record,
							status: "published",
							version: 1,
							working: { metadata: {}, doc: emptyStoredDocument() },
						},
						warnings: [],
					})
				: undefined;
		const onSaved = vi.fn();
		render(<RecordPanel target={{ collection: record, id: null }} onClose={vi.fn()} onSaved={onSaved} />);
		const panel = screen.getByRole("complementary", {
			name: t("list.add", { label: testSite.schemaOf(record).label }),
		});
		fireEvent.change(within(panel).getByRole("textbox", { name: new RegExp(titleLabel(record)) }), {
			target: { value: "New record" },
		});
		fireEvent.click(within(panel).getByRole("button", { name: tc("save") }));
		await waitFor(() => expect(calls("POST", "/api/monti/v1/entries")).toHaveLength(1));
		expect(bodyOf(calls("POST", "/api/monti/v1/entries")[0])).toEqual({
			collection: record,
			slug: null,
			metadata: { title: "New record" },
			doc: emptyStoredDocument(),
		});
		await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "r1" })));
	});
});

describe("any site: entry editor", () => {
	const entry = {
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

	it("opens an entry with the title field's label and saves only schema fields", async () => {
		handle = (url, init) => {
			if (url.pathname !== "/api/monti/v1/entries/entry-1") return undefined;
			if (!init?.method) return json(entry);
			if (init.method === "PATCH") {
				const body = JSON.parse(String(init.body));
				return json({
					entry: { ...entry, version: 5, working: { metadata: body.metadata, doc: body.doc } },
					warnings: [],
				});
			}
			return undefined;
		};
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
		await waitFor(() => expect(calls("PATCH", "/api/monti/v1/entries/entry-1")).toHaveLength(1));
		const body = bodyOf(calls("PATCH", "/api/monti/v1/entries/entry-1")[0]);
		expect(body.metadata.title).toBe("Changed title");
		const known = new Set(testSite.storedFields(content).map(({ name }) => name));
		for (const key of Object.keys(body.metadata)) expect(known.has(key), key).toBe(true);
	});
});
