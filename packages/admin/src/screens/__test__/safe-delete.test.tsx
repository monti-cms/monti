import type { Folder, ListEntriesItem } from "@monti-cms/core/site";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { commonMessages } from "../../lib/common.messages";
import { jsonResponse as json } from "../../test/fetch";
import { createTestRouter } from "../../test/router";
import { toast } from "../../test/ui-toast";
import { EntryListScreen } from "../entry-list-screen";
import { deleteMessages } from "../shared/delete.messages";
import { AdminQueryProvider } from "../shared/query-provider";

// Flows T1 (a folder of the list goes to the trash) and T2 (rows go to the trash) of the safety epic: the list asks only when a published entry would
// leave the site, moves everything else at once, and every move carries an undo. A screenshot cannot show what is sent or which toast follows.

let nav: ReturnType<typeof createTestRouter>;
vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);

const td = testSite.createTranslator(deleteMessages);
const tc = testSite.createTranslator(commonMessages);

/** A row of the list. The trash time is `deletedAt`; the fixture is typed loosely so it holds before the core rename reaches this branch. */
const item = (id: string, fields: Record<string, unknown> = {}): ListEntriesItem =>
	({
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
	}) as unknown as ListEntriesItem;

const folder: Folder = { id: "f1", collection: "post", parentId: null, name: "뉴스", position: 0, version: 1 };

const server = {
	posts: [] as ListEntriesItem[],
	folders: [] as Folder[],
	contents: { entries: 2, published: 0, folders: 0, files: 0, filesInUse: 0 },
};
let fetchMock: ReturnType<typeof vi.fn>;

const calls = (method: string, path: string) =>
	fetchMock.mock.calls.filter(
		([input, init]) => (init?.method ?? "GET") === method && String(input).split("?")[0] === path,
	);
const bodyOf = (call: unknown[] | undefined) => JSON.parse(String((call?.[1] as RequestInit | undefined)?.body));

beforeEach(() => {
	vi.clearAllMocks();
	nav = createTestRouter({ search: "collection=post" });
	server.posts = [item("가"), item("나"), item("다")];
	server.folders = [folder];
	server.contents = { entries: 2, published: 0, folders: 0, files: 0, filesInUse: 0 };
	fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
		const url = new URL(input, "http://localhost");
		const method = init?.method ?? "GET";
		if (url.pathname === "/api/monti/v1/preferences") return json({});
		if (url.pathname === "/api/monti/v1/folders" && method === "GET") return json(server.folders);
		if (url.pathname === "/api/monti/v1/folders/f1/contents") return json(server.contents);
		if (url.pathname === "/api/monti/v1/folders/f1" && method === "DELETE") {
			return json({ folder: {}, entries: server.contents.entries, folders: 0, files: 0, kept: 0 });
		}
		if (url.pathname === "/api/monti/v1/trash/restore" && method === "POST") return json({ results: [] });
		if (url.pathname === "/api/monti/v1/bulk" && method === "POST") {
			const body = JSON.parse(String(init?.body)) as { items: { id: string; expectedVersion: number }[] };
			return json({
				results: body.items.map((entry) => ({ id: entry.id, ok: true, version: entry.expectedVersion + 1 })),
			});
		}
		if (url.pathname === "/api/monti/v1/entries" && method === "GET") {
			const items = url.searchParams.get("collection") === "post" ? server.posts : [];
			return json({ items, total: items.length });
		}
		throw new Error(`Unexpected fetch: ${method} ${input}`);
	});
	vi.stubGlobal("fetch", fetchMock);
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
const bulkBodies = () => calls("POST", "/api/monti/v1/bulk").map(bodyOf);

describe("flow: a folder of the list goes to the trash (T1)", () => {
	const openFolderMenu = async () => {
		await renderList();
		return contextMenu(await screen.findByRole("row", { name: /뉴스/ }));
	};

	it("offers open, rename, move and then 폴더 지우기, and no subfolder item", async () => {
		const items = await openFolderMenu();
		expect(items.map((menuItem) => menuItem.textContent)).toEqual([
			tc("open"),
			td("folder.menu.rename"),
			td("folder.menu.move"),
			td("folder.menu.delete"),
		]);
	});

	it("moves a folder of drafts at once, and the toast's undo restores the folder", async () => {
		const items = await openFolderMenu();
		fireEvent.click(items.at(-1) as HTMLElement);

		await waitFor(() => expect(calls("DELETE", "/api/monti/v1/folders/f1")).toHaveLength(1));
		expect(String(calls("DELETE", "/api/monti/v1/folders/f1")[0]?.[0])).toContain("expectedVersion=1");
		expect(screen.queryByRole("alertdialog")).toBeNull();
		await waitFor(() => expect(toast).toHaveBeenCalled());
		expect(lastToast().message).toBe(td("folder.done", { name: "뉴스", entries: 2 }));
		expect(lastToast().action?.label).toBe(td("undo"));

		await act(async () => lastToast().action?.onClick());
		await waitFor(() => expect(calls("POST", "/api/monti/v1/trash/restore")).toHaveLength(1));
		expect(bodyOf(calls("POST", "/api/monti/v1/trash/restore")[0])).toEqual({ items: [{ type: "folder", id: "f1" }] });
	});

	it("asks first when the folder holds a published entry, and sends nothing when cancelled", async () => {
		server.contents = { entries: 2, published: 1, folders: 0, files: 0, filesInUse: 0 };
		const items = await openFolderMenu();
		fireEvent.click(items.at(-1) as HTMLElement);

		const dialog = await screen.findByRole("alertdialog", { name: td("folder.ask.title", { name: "뉴스" }) });
		expect(within(dialog).getByText(td("folder.ask.body", { entries: 2, published: 1 }))).toBeTruthy();
		fireEvent.click(within(dialog).getByRole("button", { name: tc("cancel") }));
		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
		expect(calls("DELETE", "/api/monti/v1/folders/f1")).toHaveLength(0);
	});

	it("moves the folder once the question is confirmed", async () => {
		server.contents = { entries: 2, published: 1, folders: 0, files: 0, filesInUse: 0 };
		const items = await openFolderMenu();
		fireEvent.click(items.at(-1) as HTMLElement);
		const dialog = await screen.findByRole("alertdialog");
		fireEvent.click(within(dialog).getByRole("button", { name: td("trash.ask.confirm") }));
		await waitFor(() => expect(calls("DELETE", "/api/monti/v1/folders/f1")).toHaveLength(1));
	});

	it("moves a folder with the Delete key like the menu does", async () => {
		await renderList();
		const link = (await screen.findAllByRole("button", { name: "뉴스" })).at(-1) as HTMLElement;
		fireEvent.keyDown(link, { key: "Delete" });
		await waitFor(() => expect(calls("DELETE", "/api/monti/v1/folders/f1")).toHaveLength(1));
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
		expect(lastToast().message).toBe(td("trash.done"));
		expect(lastToast().action?.label).toBe(td("undo"));

		await act(async () => lastToast().action?.onClick());
		await waitFor(() => expect(calls("POST", "/api/monti/v1/trash/restore")).toHaveLength(1));
		expect(bodyOf(calls("POST", "/api/monti/v1/trash/restore")[0])).toEqual({
			items: [{ type: "entry", id: "가", expectedVersion: 4 }],
		});
	});

	it("moves a draft at once with the Delete key too", async () => {
		await renderList();
		fireEvent.keyDown(within(row("가")).getByRole("link", { name: "가" }), { key: "Delete" });
		await waitFor(() => expect(bulkBodies()).toHaveLength(1));
		expect(screen.queryByRole("alertdialog")).toBeNull();
	});

	it("asks for a published entry, naming the translation that goes with it, and sends nothing when cancelled", async () => {
		server.posts = [
			item("가"),
			item("나", {
				status: "published",
				translations: [
					{ id: "나", locale: "ko", status: "published", version: 3, isSource: true, hasUnpublishedChanges: false },
					{ id: "나-en", locale: "en", status: "draft", version: 1, isSource: false, hasUnpublishedChanges: false },
				],
			}),
		];
		await renderList();
		fireEvent.click((await contextMenu(row("나"))).at(-1) as HTMLElement);

		const dialog = await screen.findByRole("alertdialog", { name: td("trash.ask.title") });
		const languages = testSite.localeLabel("en");
		expect(
			within(dialog).getByText(`${td("trash.ask.one", { title: "나" })}${td("trash.ask.translations", { languages })}`),
		).toBeTruthy();
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
		fireEvent.click(screen.getByRole("button", { name: "더보기" }));
		fireEvent.click((await screen.findAllByRole("menuitem")).at(-1) as HTMLElement);

		const dialog = await screen.findByRole("alertdialog");
		expect(within(dialog).getByText(td("trash.ask.many", { count: 1 }))).toBeTruthy();
		fireEvent.click(within(dialog).getByRole("button", { name: td("trash.ask.confirm") }));
		await waitFor(() => expect(bulkBodies()).toHaveLength(1));
		expect(bulkBodies()[0].items).toHaveLength(2);
		await waitFor(() => expect(toast).toHaveBeenCalled());
		expect(lastToast().message).toBe(td("trash.done.count", { count: 2 }));
	});

	it("moves several drafts from the bar's ⋯ at once", async () => {
		await renderList();
		fireEvent.click(screen.getByRole("checkbox", { name: /가/ }));
		fireEvent.click(screen.getByRole("checkbox", { name: /나/ }));
		await screen.findByRole("toolbar");
		fireEvent.click(screen.getByRole("button", { name: "더보기" }));
		fireEvent.click((await screen.findAllByRole("menuitem")).at(-1) as HTMLElement);
		await waitFor(() => expect(bulkBodies()).toHaveLength(1));
		expect(screen.queryByRole("alertdialog")).toBeNull();
	});
});

describe("flow: moving rows to a folder can be undone", () => {
	it("puts the rows back in the folder they came from", async () => {
		server.posts = [item("가", { folderId: null }), item("나", { folderId: null })];
		await renderList();
		fireEvent.click(screen.getByRole("checkbox", { name: /가/ }));
		await screen.findByRole("toolbar");
		fireEvent.click(screen.getByRole("button", { name: "폴더로" }));
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
