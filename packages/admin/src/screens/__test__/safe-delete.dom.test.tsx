import type { FolderContents, FolderListItem, FolderTrashResult, ListEntriesItem } from "@monti-cms/core/site";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { commonMessages } from "../../lib/common.messages";
import { type FakeApi, fakeApi } from "../../test/fake-api";
import { createTestRouter } from "../../test/router";
import { toast } from "../../test/ui-toast";
import { bulkBarMessages } from "../entries/bulk-bar.messages";
import { EntryListScreen } from "../entry-list-screen";
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

/** A row of the list. */
const item = (id: string, fields: Partial<ListEntriesItem> = {}): ListEntriesItem => ({
	id,
	collection: "post",
	locale: "ko",
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
	collection: "post",
	parentId: null,
	name: "뉴스",
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
	nav = createTestRouter({ search: "collection=post" });
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
					collection: "post",
					name: "뉴스",
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
			const items = query.get("collection") === "post" ? server.posts : [];
			return { items, total: items.length };
		})
		.install();
});
afterEach(() => {
	cleanup();
	// A menu that was open when the test ended leaves the page behind it hidden from the roles of the next test.
	for (const element of document.body.querySelectorAll("[inert],[aria-hidden]")) {
		element.removeAttribute("inert");
		element.removeAttribute("aria-hidden");
	}
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
const lastToast = () => {
	const [message, options] = toast.mock.calls.at(-1) as [string, { action?: { label: string; onClick: () => void } }];
	return { message, action: options?.action };
};
const bulkBodies = () => api.sent("POST /v1/bulk").map((request) => request.body);

describe("flow: a folder of the list goes to the trash (T1)", () => {
	const openFolderMenu = async () => {
		await renderList();
		return contextMenu(await screen.findByRole("row", { name: /뉴스/ }));
	};

	it("moves a folder of drafts at once, and the toast's undo restores the folder", async () => {
		const items = await openFolderMenu();
		fireEvent.click(items.at(-1) as HTMLElement);

		await waitFor(() => expect(api.sent("DELETE /v1/folders/:id")).toHaveLength(1));
		expect(api.sent("DELETE /v1/folders/:id")[0]?.params.id).toBe("f1");
		expect(api.sent("DELETE /v1/folders/:id")[0]?.query.get("expectedVersion")).toBe("1");
		expect(screen.queryByRole("alertdialog")).toBeNull();
		await waitFor(() => expect(toast).toHaveBeenCalled());
		expect(lastToast().message).toBe(td("folder.done", { name: "뉴스", entries: 2 }));
		expect(lastToast().action?.label).toBe(td("undo"));

		await act(async () => lastToast().action?.onClick());
		await waitFor(() => expect(api.sent("POST /v1/trash/restore")).toHaveLength(1));
		expect(api.sent("POST /v1/trash/restore")[0]?.body).toEqual({ items: [{ type: "folder", id: "f1" }] });
	});

	it("asks first when the folder holds a published entry, and sends nothing when cancelled", async () => {
		server.contents = { entries: 2, published: 1, folders: 0, files: 0, filesInUse: 0 };
		const items = await openFolderMenu();
		fireEvent.click(items.at(-1) as HTMLElement);

		const dialog = await screen.findByRole("alertdialog", { name: td("folder.ask.title", { name: "뉴스" }) });
		expect(within(dialog).getByText(td("folder.ask.body", { entries: 2, published: 1 }))).toBeInTheDocument();
		fireEvent.click(within(dialog).getByRole("button", { name: tc("cancel") }));
		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
		expect(api.sent("DELETE /v1/folders/:id")).toHaveLength(0);
	});

	it("moves the folder once the question is confirmed", async () => {
		server.contents = { entries: 2, published: 1, folders: 0, files: 0, filesInUse: 0 };
		const items = await openFolderMenu();
		fireEvent.click(items.at(-1) as HTMLElement);
		const dialog = await screen.findByRole("alertdialog");
		fireEvent.click(within(dialog).getByRole("button", { name: td("trash.ask.confirm") }));
		await waitFor(() => expect(api.sent("DELETE /v1/folders/:id")).toHaveLength(1));
	});
});

describe("flow: rows go to the trash (T2)", () => {
	it("moves a draft at once, and the toast's undo restores it at the version the trash made", async () => {
		await renderList();
		const items = await contextMenu(row("가"));
		fireEvent.click(items.at(-1) as HTMLElement);

		await waitFor(() => expect(bulkBodies()).toHaveLength(1));
		expect(bulkBodies()[0]).toMatchObject({ op: "trash", items: [{ id: "가", expectedVersion: 3 }] });
		expect(screen.queryByRole("alertdialog")).toBeNull();
		await waitFor(() => expect(toast).toHaveBeenCalled());
		expect(lastToast().action?.label).toBe(td("undo"));

		await act(async () => lastToast().action?.onClick());
		await waitFor(() => expect(api.sent("POST /v1/trash/restore")).toHaveLength(1));
		expect(api.sent("POST /v1/trash/restore")[0]?.body).toEqual({
			items: [{ type: "entry", id: "가", expectedVersion: 4 }],
		});
	});

	it("moves a draft at once with the Delete key too", async () => {
		await renderList();
		fireEvent.keyDown(within(row("가")).getByRole("link", { name: "가" }), { key: "Delete" });
		await waitFor(() => expect(bulkBodies()).toHaveLength(1));
		expect(screen.queryByRole("alertdialog")).toBeNull();
	});

	it("asks for a published entry, and sends nothing when cancelled", async () => {
		server.posts = [item("가"), item("나", { status: "published" })];
		await renderList();
		fireEvent.click((await contextMenu(row("나"))).at(-1) as HTMLElement);

		const dialog = await screen.findByRole("alertdialog", { name: td("trash.ask.title") });
		fireEvent.click(within(dialog).getByRole("button", { name: tc("cancel") }));
		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
		expect(bulkBodies()).toHaveLength(0);
	});

	it("sends the move once the question is confirmed", async () => {
		server.posts = [item("나", { status: "published" })];
		await renderList();
		fireEvent.click((await contextMenu(row("나"))).at(-1) as HTMLElement);
		const dialog = await screen.findByRole("alertdialog");
		fireEvent.click(within(dialog).getByRole("button", { name: td("trash.ask.confirm") }));
		await waitFor(() => expect(bulkBodies()).toHaveLength(1));
		expect(bulkBodies()[0]).toMatchObject({ op: "trash", items: [{ id: "나", expectedVersion: 3 }] });
	});

	it("asks once for several rows when one is published, and counts the move in the toast", async () => {
		server.posts = [item("가"), item("나", { status: "published" }), item("다")];
		await renderList();
		fireEvent.click(screen.getByRole("checkbox", { name: /가/ }));
		fireEvent.click(screen.getByRole("checkbox", { name: /나/ }));
		await screen.findByRole("toolbar");
		fireEvent.click(screen.getByRole("button", { name: tBulkBar("more") }));
		fireEvent.click((await screen.findAllByRole("menuitem")).at(-1) as HTMLElement);

		const dialog = await screen.findByRole("alertdialog");
		fireEvent.click(within(dialog).getByRole("button", { name: td("trash.ask.confirm") }));
		await waitFor(() => expect(bulkBodies()).toHaveLength(1));
		expect(bulkBodies()[0].items).toHaveLength(2);
		await waitFor(() => expect(toast).toHaveBeenCalled());
		expect(lastToast().message).toBe(td("trash.done.count", { count: 2 }));
	});
});

describe("flow: moving rows to a folder can be undone", () => {
	it("puts the rows back in the folder they came from", async () => {
		server.posts = [item("가", { folderId: null }), item("나", { folderId: null })];
		await renderList();
		fireEvent.click(screen.getByRole("checkbox", { name: /가/ }));
		await screen.findByRole("toolbar");
		fireEvent.click(screen.getByRole("button", { name: tBulkBar("folder.move") }));
		fireEvent.click(await screen.findByRole("menuitem", { name: "뉴스" }));
		const dialog = await screen.findByRole("alertdialog");
		fireEvent.click(within(dialog).getAllByRole("button").at(-1) as HTMLElement);

		await waitFor(() => expect(bulkBodies()).toHaveLength(1));
		expect(bulkBodies()[0]).toMatchObject({ op: "folder.move", folderId: "f1" });
		await waitFor(() => expect(toast).toHaveBeenCalled());
		expect(lastToast().action?.label).toBe(td("undo"));

		await act(async () => lastToast().action?.onClick());
		await waitFor(() => expect(bulkBodies()).toHaveLength(2));
		expect(bulkBodies()[1]).toMatchObject({
			op: "folder.move",
			folderId: null,
			items: [{ id: "가", expectedVersion: 4 }],
		});
	});
});
