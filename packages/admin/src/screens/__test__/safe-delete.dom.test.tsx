import type { FolderContents, FolderListItem, FolderTrashResult, ListEntriesItem } from "@monti-cms/core/site";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contentCollection, defaultLocale } from "../../../../core/test/any-site";
import { testSite } from "../../../../core/test/site";
import { commonMessages } from "../../lib/common.messages";
import { type FakeApi, fakeApi } from "../../test/fake-api";
import { createTestRouter } from "../../test/router";
import { toast } from "../../test/ui-toast";
import { bulkBarMessages } from "../entries/bulk-bar.messages";
import { EntryListScreen } from "../entry-list-screen";
import { screensMessages } from "../messages";
import { deleteMessages } from "../shared/delete.messages";
import { AdminQueryProvider } from "../shared/query-provider";

const tBulkBar = testSite.createTranslator(bulkBarMessages);

// Flows T1 (a folder of the list goes to the trash) and T2 (rows go to the trash) of the safety epic: the list asks only when a published entry would
// leave the site, moves everything else at once, and every move carries an undo. A screenshot cannot show what is sent or which toast follows.

let nav: ReturnType<typeof createTestRouter>;
vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);

const td = testSite.createTranslator(deleteMessages);
const tc = testSite.createTranslator(commonMessages);
const ts = testSite.createTranslator(screensMessages);

const content = contentCollection;
/** The name of the folder the list holds. */
const FOLDER = "뉴스";

/** A row of the list. */
const item = (id: string, fields: Partial<ListEntriesItem> = {}): ListEntriesItem => ({
	id,
	collection: content,
	locale: defaultLocale,
	translationGroupId: id,
	title: id,
	slug: id,
	status: "draft",
	version: 3,
	folderId: null,
	relations: {},
	values: {},
	hasUnpublishedChanges: false,
	publishedAt: null,
	createdAt: new Date("2026-01-01T00:00:00Z"),
	updatedAt: new Date("2026-01-01T00:00:00Z"),
	deletedAt: null,
	...fields,
});

const folder: FolderListItem = {
	id: "f1",
	collection: content,
	parentId: null,
	name: FOLDER,
	position: 0,
	version: 1,
	entryCount: 2,
};

const server = {
	posts: [] as ListEntriesItem[],
	folders: [] as FolderListItem[],
	contents: { entries: 2, published: 0, folders: 0, files: 0, filesInUse: 0 } as FolderContents,
};
let api: FakeApi;

beforeEach(() => {
	vi.clearAllMocks();
	nav = createTestRouter({ search: `collection=${content}` });
	server.posts = [item("가"), item("나"), item("다")];
	server.folders = [folder];
	server.contents = { entries: 2, published: 0, folders: 0, files: 0, filesInUse: 0 };
	api = fakeApi()
		.withEmptyRail()
		.on("GET /v1/preferences", () => ({}))
		.on("GET /v1/folders", () => server.folders)
		.on("GET /v1/folders/:id/contents", () => server.contents)
		.on(
			"DELETE /v1/folders/:id",
			({ params }): FolderTrashResult => ({
				folder: {
					type: "folder",
					id: params.id ?? "",
					collection: content,
					name: FOLDER,
					version: 2,
					deletedAt: new Date("2026-01-02T00:00:00Z"),
					expiresAt: null,
					path: [],
					entries: server.contents.entries,
					folders: 0,
					files: 0,
				},
				entries: server.contents.entries,
				folders: 0,
				files: 0,
				kept: 0,
			}),
		)
		.on("POST /v1/trash/restore", () => ({ results: [] }))
		.on("POST /v1/bulk", ({ body }) => ({
			results: (body.items as { id: string; expectedVersion: number }[]).map((entry) => ({
				id: entry.id,
				ok: true as const,
				version: entry.expectedVersion + 1,
			})),
		}))
		.on("GET /v1/entries", ({ query }) => {
			const items = query.get("collection") === content ? server.posts : [];
			return { items, total: items.length };
		})
		.install();
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const renderList = async () => {
	nav.render(
		<AdminQueryProvider>
			<EntryListScreen />
		</AdminQueryProvider>,
	);
	await screen.findByRole("row", { name: new RegExp(server.posts[0]?.title ?? "") });
};
const row = (title: string) => screen.getByRole("row", { name: new RegExp(title) });
const contextMenu = async (element: HTMLElement) => {
	await act(async () => {
		fireEvent.contextMenu(element);
	});
	return screen.findAllByRole("menuitem");
};
/** What a toast carries when it offers to take the move back. */
const withUndo = expect.objectContaining({ action: expect.objectContaining({ label: td("undo") }) });
/** The undo of the toast that said `message`. */
const undoOf = (message: string) => {
	const call = toast.mock.calls.find(([text]) => text === message) as
		| [string, { action?: { onClick: () => void } }]
		| undefined;
	return call?.[1]?.action?.onClick;
};
/** The row menu's move to the trash: its name is the label and then its key. */
const trashItem = () => screen.getByRole("menuitem", { name: (name) => name.startsWith(tc("lifecycle.trash")) });
const bulkBodies = () => api.sent("POST /v1/bulk").map((request) => request.body);

describe("flow: a folder of the list goes to the trash (T1)", () => {
	const openFolderMenu = async () => {
		await renderList();
		return contextMenu(await screen.findByRole("row", { name: new RegExp(FOLDER) }));
	};

	it("TRASH-T6 moves a folder of drafts at once, and the toast's undo restores the folder", async () => {
		await openFolderMenu();
		fireEvent.click(screen.getByRole("menuitem", { name: td("folder.menu.delete") }));

		await waitFor(() => expect(api.sent("DELETE /v1/folders/:id")).toHaveLength(1));
		expect(api.sent("DELETE /v1/folders/:id")[0]?.params.id).toBe("f1");
		expect(api.sent("DELETE /v1/folders/:id")[0]?.query.get("expectedVersion")).toBe("1");
		expect(screen.queryByRole("alertdialog")).toBeNull();
		const done = td("folder.done", { name: FOLDER, entries: 2 });
		await waitFor(() => expect(toast).toHaveBeenCalledWith(done, withUndo));

		await act(async () => undoOf(done)?.());
		await waitFor(() => expect(api.sent("POST /v1/trash/restore")).toHaveLength(1));
		expect(api.sent("POST /v1/trash/restore")[0]?.body).toEqual({ items: [{ type: "folder", id: "f1" }] });
	});

	it("TRASH-T3 asks first when the folder holds a published entry, and sends nothing when cancelled", async () => {
		server.contents = { entries: 2, published: 1, folders: 0, files: 0, filesInUse: 0 };
		await openFolderMenu();
		fireEvent.click(screen.getByRole("menuitem", { name: td("folder.menu.delete") }));

		const dialog = await screen.findByRole("alertdialog", { name: td("folder.ask.title", { name: FOLDER }) });
		expect(within(dialog).getByText(td("folder.ask.body", { entries: 2, published: 1 }))).toBeInTheDocument();
		fireEvent.click(within(dialog).getByRole("button", { name: tc("cancel") }));
		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
		expect(api.sent("DELETE /v1/folders/:id")).toHaveLength(0);
	});

	it("TRASH-T3 moves the folder once the question is confirmed", async () => {
		server.contents = { entries: 2, published: 1, folders: 0, files: 0, filesInUse: 0 };
		await openFolderMenu();
		fireEvent.click(screen.getByRole("menuitem", { name: td("folder.menu.delete") }));
		const dialog = await screen.findByRole("alertdialog");
		fireEvent.click(within(dialog).getByRole("button", { name: td("trash.ask.confirm") }));
		await waitFor(() => expect(api.sent("DELETE /v1/folders/:id")).toHaveLength(1));
	});
});

describe("flow: rows go to the trash (T2)", () => {
	it("TRASH-T6 moves a draft at once, and the toast's undo restores it at the version the trash made", async () => {
		await renderList();
		await contextMenu(row("가"));
		fireEvent.click(trashItem());

		await waitFor(() => expect(bulkBodies()).toHaveLength(1));
		expect(bulkBodies()[0]).toMatchObject({ op: "trash", items: [{ id: "가", expectedVersion: 3 }] });
		expect(screen.queryByRole("alertdialog")).toBeNull();
		await waitFor(() => expect(toast).toHaveBeenCalledWith(td("trash.done"), withUndo));

		await act(async () => undoOf(td("trash.done"))?.());
		await waitFor(() => expect(api.sent("POST /v1/trash/restore")).toHaveLength(1));
		expect(api.sent("POST /v1/trash/restore")[0]?.body).toEqual({
			items: [{ type: "entry", id: "가", expectedVersion: 4 }],
		});
	});

	it("TRASH-T3 moves a draft at once with the Delete key too", async () => {
		await renderList();
		fireEvent.keyDown(within(row("가")).getByRole("link", { name: "가" }), { key: "Delete" });
		await waitFor(() => expect(bulkBodies()).toHaveLength(1));
		expect(screen.queryByRole("alertdialog")).toBeNull();
	});

	it("TRASH-T3 asks for a published entry, and sends nothing when cancelled", async () => {
		server.posts = [item("가"), item("나", { status: "published" })];
		await renderList();
		await contextMenu(row("나"));
		fireEvent.click(trashItem());

		const dialog = await screen.findByRole("alertdialog", { name: td("trash.ask.title") });
		fireEvent.click(within(dialog).getByRole("button", { name: tc("cancel") }));
		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
		expect(bulkBodies()).toHaveLength(0);
	});

	it("TRASH-T3 sends the move once the question is confirmed", async () => {
		server.posts = [item("나", { status: "published" })];
		await renderList();
		await contextMenu(row("나"));
		fireEvent.click(trashItem());
		const dialog = await screen.findByRole("alertdialog");
		fireEvent.click(within(dialog).getByRole("button", { name: td("trash.ask.confirm") }));
		await waitFor(() => expect(bulkBodies()).toHaveLength(1));
		expect(bulkBodies()[0]).toMatchObject({ op: "trash", items: [{ id: "나", expectedVersion: 3 }] });
	});

	it("TRASH-T3 asks once for several rows when one is published, and counts the move in the toast", async () => {
		server.posts = [item("가"), item("나", { status: "published" }), item("다")];
		await renderList();
		fireEvent.click(screen.getByRole("checkbox", { name: /가/ }));
		fireEvent.click(screen.getByRole("checkbox", { name: /나/ }));
		await screen.findByRole("toolbar");
		fireEvent.click(screen.getByRole("button", { name: tBulkBar("more") }));
		fireEvent.click(await screen.findByRole("menuitem", { name: tc("lifecycle.trash") }));

		const dialog = await screen.findByRole("alertdialog");
		fireEvent.click(within(dialog).getByRole("button", { name: td("trash.ask.confirm") }));
		await waitFor(() => expect(bulkBodies()).toHaveLength(1));
		expect(bulkBodies()[0].items).toHaveLength(2);
		await waitFor(() => expect(toast).toHaveBeenCalledWith(td("trash.done.count", { count: 2 }), withUndo));
	});
});

describe("flow: moving rows to a folder can be undone", () => {
	it("LIST-C7 puts the rows back in the folder they came from", async () => {
		server.posts = [item("가", { folderId: null }), item("나", { folderId: null })];
		await renderList();
		fireEvent.click(screen.getByRole("checkbox", { name: /가/ }));
		await screen.findByRole("toolbar");
		fireEvent.click(screen.getByRole("button", { name: tBulkBar("folder.move") }));
		fireEvent.click(await screen.findByRole("menuitem", { name: FOLDER }));
		const dialog = await screen.findByRole("alertdialog");
		fireEvent.click(within(dialog).getByRole("button", { name: tBulkBar("folder.move") }));

		await waitFor(() => expect(bulkBodies()).toHaveLength(1));
		expect(bulkBodies()[0]).toMatchObject({ op: "folder.move", folderId: "f1" });
		const moved = ts("bulk.success", { count: 1, label: tBulkBar("folder.move") });
		await waitFor(() => expect(toast).toHaveBeenCalledWith(moved, withUndo));

		await act(async () => undoOf(moved)?.());
		await waitFor(() => expect(bulkBodies()).toHaveLength(2));
		expect(bulkBodies()[1]).toMatchObject({
			op: "folder.move",
			folderId: null,
			items: [{ id: "가", expectedVersion: 4 }],
		});
	});
});
