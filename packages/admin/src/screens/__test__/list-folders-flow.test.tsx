import type { Folder, ListEntriesItem } from "@monti-cms/core/site";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { commonMessages } from "../../lib/common.messages";
import { jsonResponse as json } from "../../test/fetch";
import { createTestRouter } from "../../test/router";
import { siteWithFolders } from "../../test/site";
import { toast } from "../../test/ui-toast";
import { EntryListScreen } from "../entry-list-screen";
import { screensMessages } from "../messages";
import { deleteMessages } from "../shared/delete.messages";
import { sharedMessages } from "../shared/messages";
import { AdminQueryProvider } from "../shared/query-provider";
import { useEntryList } from "../use-entry-list";

// Flow 5 of the canvas, row "목록의 폴더" (steps 01–06): adding a folder in the list where it will stand, opening one (path, the way up), searching inside
// one, and renaming or deleting it from its row. A screenshot cannot show which request a key sends, where focus lands, or what a role is called.

let nav: ReturnType<typeof createTestRouter>;
vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);

const ts = testSite.createTranslator(screensMessages);
const tf = testSite.createTranslator(sharedMessages);
const td = testSite.createTranslator(deleteMessages);
const tc = testSite.createTranslator(commonMessages);
const postsLabel = testSite.COLLECTION_DEFINITIONS.post.label;

const folder = (id: string, name: string, parentId: string | null = null, version = 1): Folder => ({
	id,
	collection: "post",
	parentId,
	name,
	position: 0,
	version,
});

const item = (id: string, folderId: string | null = null): ListEntriesItem =>
	({
		id,
		collection: "post",
		locale: "ko",
		translationGroupId: id,
		title: id,
		slug: id,
		status: "draft",
		version: 3,
		folderId,
		relations: {},
		values: {},
		hasUnpublishedChanges: false,
		publishedAt: null,
		createdAt: new Date("2026-01-01T00:00:00Z"),
		updatedAt: new Date("2026-01-01T00:00:00Z"),
		deletedAt: null,
	}) as unknown as ListEntriesItem;

const NEWS = folder("f1", "뉴스");
const SERIES = folder("f2", "연재", "f1");

const server = {
	posts: [] as ListEntriesItem[],
	folders: [] as Folder[],
	contents: { entries: 2, published: 0, folders: 0, files: 0, filesInUse: 0 },
	/** What a folder write answers: a status of 400 or more makes it fail. */
	writeStatus: 200,
};
let fetchMock: ReturnType<typeof vi.fn>;

const calls = (method: string, path: string) =>
	fetchMock.mock.calls.filter(
		([input, init]) => (init?.method ?? "GET") === method && String(input).split("?")[0] === path,
	);
const bodyOf = (call: unknown[] | undefined) => JSON.parse(String((call?.[1] as RequestInit | undefined)?.body));
const FOLDERS = "/api/monti/v1/folders";
const entryQueries = () =>
	calls("GET", "/api/monti/v1/entries").map(([input]) => new URL(String(input), "http://x").searchParams);
const lastEntryQuery = () => entryQueries().at(-1) as URLSearchParams;

beforeEach(() => {
	vi.clearAllMocks();
	nav = createTestRouter({ search: "collection=post" });
	server.posts = [item("가"), item("나")];
	server.folders = [NEWS, SERIES];
	server.contents = { entries: 2, published: 0, folders: 0, files: 0, filesInUse: 0 };
	server.writeStatus = 200;
	fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
		const url = new URL(input, "http://localhost");
		const method = init?.method ?? "GET";
		const path = url.pathname;
		if (path === "/api/monti/v1/preferences") return json({});
		if (path === FOLDERS && method === "GET") return json(server.folders);
		if (path === FOLDERS && method === "POST") {
			if (server.writeStatus >= 400) return json({ error: { code: "conflict" } }, server.writeStatus);
			const body = JSON.parse(String(init?.body)) as { collection: string; name: string; parentId: string | null };
			const created = { ...folder("new", body.name, body.parentId), collection: body.collection };
			server.folders = [...server.folders, created];
			return json(created);
		}
		if (path.startsWith(`${FOLDERS}/`) && path.endsWith("/contents")) return json(server.contents);
		if (path.startsWith(`${FOLDERS}/`) && method === "PATCH") {
			if (server.writeStatus >= 400) return json({ error: { code: "conflict" } }, server.writeStatus);
			const id = path.split("/").at(-1);
			const body = JSON.parse(String(init?.body)) as { name?: string };
			server.folders = server.folders.map((entry) =>
				entry.id === id ? { ...entry, name: body.name ?? entry.name, version: entry.version + 1 } : entry,
			);
			return json(server.folders.find((entry) => entry.id === id));
		}
		if (path.startsWith(`${FOLDERS}/`) && method === "DELETE") {
			const id = path.split("/").at(-1);
			server.folders = server.folders.filter((entry) => entry.id !== id);
			return json({ folder: {}, entries: server.contents.entries, folders: 0, files: 0, kept: 0 });
		}
		if (path === "/api/monti/v1/entries" && method === "GET") {
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

const renderList = async (router = nav) => {
	router.render(
		<AdminQueryProvider>
			<EntryListScreen />
		</AdminQueryProvider>,
	);
	await screen.findByRole("row", { name: /가/ });
};
const addFolderButton = () => screen.getByRole("button", { name: ts("list.addFolder") });
/** Pressing the button the way a pointer does: it takes focus, and the browser gives that focus back to it when the field closes. */
const pressAddFolder = () => {
	addFolderButton().focus();
	fireEvent.click(addFolderButton());
};
const NAME_FIELD = { name: tf("folder.nameLabel") };
const nameField = () => screen.getByRole("textbox", NAME_FIELD) as HTMLInputElement;
const folderRow = (name: RegExp) => screen.getByRole("row", { name });
const folderLink = (name: string) => within(folderRow(new RegExp(name))).getByRole("button", { name });
const type = (field: HTMLElement, text: string) => fireEvent.change(field, { target: { value: text } });
const press = (field: HTMLElement, key: string) => fireEvent.keyDown(field, { key });
const contextMenu = async (element: HTMLElement) => {
	await act(async () => {
		fireEvent.contextMenu(element);
	});
	return screen.findAllByRole("menuitem");
};
const menuItem = (items: HTMLElement[], label: string) =>
	items.find((entry) => entry.textContent === label) as HTMLElement;
const follows = (first: Node, second: Node) =>
	Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
const scopeGroup = () => screen.getByRole("group", { name: ts("toolbar.scope") });
const scopeButton = (name: string) => within(scopeGroup()).getByRole("button", { name });

describe("flow: folders in the list (steps 01–06)", () => {
	describe("step 01: + 폴더 puts a new folder row at the top, name selected", () => {
		it("opens a row with a focused field holding the whole default name selected, and no dialog", async () => {
			await renderList();
			pressAddFolder();

			const field = nameField();
			expect(document.activeElement).toBe(field);
			expect(field.value).toBe(tf("folder.newName"));
			expect([field.selectionStart, field.selectionEnd]).toEqual([0, field.value.length]);
			expect(screen.queryByRole("dialog")).toBeNull();
			// At the top: before the folder that is already there.
			expect(follows(field, folderRow(/뉴스/))).toBe(true);
			expect(calls("POST", FOLDERS)).toHaveLength(0);
		});

		it("creates the folder with the typed name and its parent on Enter, and the row becomes a folder", async () => {
			await renderList();
			pressAddFolder();
			type(nameField(), "원고");
			press(nameField(), "Enter");

			await waitFor(() => expect(calls("POST", FOLDERS)).toHaveLength(1));
			expect(bodyOf(calls("POST", FOLDERS)[0])).toEqual({ collection: "post", name: "원고", parentId: null });
			await waitFor(() => expect(screen.queryByRole("textbox", NAME_FIELD)).toBeNull());
			// Focus is on the new folder, and no notice repeats what the row shows.
			await waitFor(() => expect(document.activeElement).toBe(folderLink("원고")));
			expect(toast).not.toHaveBeenCalled();
		});

		it("sends nothing on Escape, removes the row, and puts focus back on + 폴더", async () => {
			await renderList();
			pressAddFolder();
			type(nameField(), "원고");
			press(nameField(), "Escape");

			expect(screen.queryByRole("textbox", NAME_FIELD)).toBeNull();
			expect(calls("POST", FOLDERS)).toHaveLength(0);
			await waitFor(() => expect(document.activeElement).toBe(addFolderButton()));
		});

		it("sends nothing for an empty name", async () => {
			await renderList();
			pressAddFolder();
			type(nameField(), "   ");
			press(nameField(), "Enter");

			await waitFor(() => expect(screen.queryByRole("textbox", NAME_FIELD)).toBeNull());
			expect(calls("POST", FOLDERS)).toHaveLength(0);
		});

		it("tells the person when the server refuses the name, and the row goes", async () => {
			await renderList();
			server.writeStatus = 409;
			pressAddFolder();
			press(nameField(), "Enter");

			await waitFor(() => expect(toast.error).toHaveBeenCalled());
			expect(screen.queryByRole("textbox", NAME_FIELD)).toBeNull();
		});

		it("adds the folder inside the folder being viewed, after the way up", async () => {
			nav.setSearch("collection=post&folder=f1");
			await renderList();
			pressAddFolder();
			expect(follows(screen.getByRole("button", { name: ts("list.folderUp") }), nameField())).toBe(true);
			press(nameField(), "Enter");

			await waitFor(() => expect(calls("POST", FOLDERS)).toHaveLength(1));
			expect(bodyOf(calls("POST", FOLDERS)[0])).toMatchObject({ name: tf("folder.newName"), parentId: "f1" });
		});

		it("clears a search first, so the new row has the folder rows to stand in", async () => {
			nav.setSearch("collection=post&search=가");
			await renderList();
			pressAddFolder();

			await waitFor(() => expect(nameField()).toBeTruthy());
			expect(nav.search.get("search")).toBeNull();
		});

		it("is a blank-area menu item too, and starts the same row", async () => {
			await renderList();
			const items = await contextMenu(screen.getByTestId("list-blank-area"));
			fireEvent.click(menuItem(items, tc("addFolder")));
			expect(await screen.findByRole("textbox", NAME_FIELD)).toBeTruthy();
			expect(screen.queryByRole("dialog")).toBeNull();
		});

		it("is not offered where the collection has no folders", async () => {
			const off = createTestRouter({ search: "collection=post", site: siteWithFolders("post", false) });
			await renderList(off);
			expect(screen.queryByRole("button", { name: ts("list.addFolder") })).toBeNull();
		});
	});

	describe("step 02: inside a folder, a path and the way up", () => {
		it("names the folder as the title, shows the path above it, and has no title suffix", async () => {
			nav.setSearch("collection=post&folder=f1");
			await renderList();

			expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("뉴스");
			const path = screen.getByRole("navigation", { name: ts("list.trail") });
			expect(path.textContent).toContain("/");
			expect(lastEntryQuery().get("folderId")).toBe("f1");

			fireEvent.click(within(path).getByRole("button", { name: postsLabel }));
			expect(nav.replace).toHaveBeenLastCalledWith(expect.not.stringContaining("folder="), expect.anything());
		});

		it("shows every folder on the way in the path, each a way back", async () => {
			nav.setSearch("collection=post&folder=f2");
			await renderList();

			expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("연재");
			const path = screen.getByRole("navigation", { name: ts("list.trail") });
			expect(
				within(path)
					.getAllByRole("button")
					.map((entry) => entry.textContent),
			).toEqual([postsLabel, "뉴스"]);
			fireEvent.click(within(path).getByRole("button", { name: "뉴스" }));
			expect(nav.replace).toHaveBeenLastCalledWith(expect.stringContaining("folder=f1"), expect.anything());
		});

		it("has no path at the top level", async () => {
			await renderList();
			expect(screen.queryByRole("navigation", { name: ts("list.trail") })).toBeNull();
			expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(postsLabel);
		});

		it("goes up one folder from the 상위 폴더로 row", async () => {
			nav.setSearch("collection=post&folder=f2");
			await renderList();
			fireEvent.click(screen.getByRole("button", { name: ts("list.folderUp") }));
			expect(nav.replace).toHaveBeenLastCalledWith(expect.stringContaining("folder=f1"), expect.anything());

			fireEvent.click(screen.getByRole("button", { name: ts("list.folderUp") }));
			expect(nav.replace).toHaveBeenLastCalledWith(expect.not.stringContaining("folder="), expect.anything());
		});

		it("opens a folder from the rail, and the rail marks the open one", async () => {
			await renderList();
			const rail = screen.getByRole("list", { name: ts("sidebar.folderTree", { label: postsLabel }) });
			fireEvent.click(within(rail).getByRole("button", { name: /뉴스/ }));
			expect(nav.replace).toHaveBeenLastCalledWith(expect.stringContaining("folder=f1"), expect.anything());
			await waitFor(() => expect(lastEntryQuery().get("folderId")).toBe("f1"));
			expect(within(rail).getByRole("button", { name: /뉴스/ }).getAttribute("aria-current")).toBe("true");
			expect(within(rail).getByRole("button", { name: /연재/ }).getAttribute("aria-current")).toBeNull();
		});

		it("opens a folder from its row", async () => {
			await renderList();
			fireEvent.click(folderLink("뉴스"));
			expect(nav.replace).toHaveBeenLastCalledWith(expect.stringContaining("folder=f1"), expect.anything());
		});
	});

	describe("step 03: a search inside a folder looks here, and can widen to all folders", () => {
		it("searches the folder and the folders below it, and offers the choice of where", async () => {
			nav.setSearch("collection=post&folder=f1&search=저장소");
			await renderList();

			const query = lastEntryQuery();
			expect([query.get("folderId"), query.get("includeDescendants"), query.get("search")]).toEqual([
				"f1",
				"true",
				"저장소",
			]);
			expect(scopeButton("뉴스").getAttribute("aria-pressed")).toBe("true");
			expect(scopeButton(ts("toolbar.scopeAll")).getAttribute("aria-pressed")).toBe("false");
			// The way up and the folder rows are not part of a search.
			expect(screen.queryByRole("button", { name: ts("list.folderUp") })).toBeNull();
		});

		it("widens to every folder, asks the server for no folder, and keeps the words", async () => {
			nav.setSearch("collection=post&folder=f1&search=저장소");
			await renderList();
			fireEvent.click(scopeButton(ts("toolbar.scopeAll")));

			expect(nav.search.get("scope")).toBe("all");
			expect(nav.search.get("folder")).toBe("f1");
			await waitFor(() => expect(lastEntryQuery().has("folderId")).toBe(false));
			expect(lastEntryQuery().get("search")).toBe("저장소");
			expect(lastEntryQuery().has("includeDescendants")).toBe(false);
			expect(scopeButton(ts("toolbar.scopeAll")).getAttribute("aria-pressed")).toBe("true");

			// And back to the folder.
			fireEvent.click(scopeButton("뉴스"));
			expect(nav.search.get("scope")).toBeNull();
			await waitFor(() => expect(lastEntryQuery().get("folderId")).toBe("f1"));
		});

		it("appears when the words are typed in a folder, and goes with them", async () => {
			nav.setSearch("collection=post&folder=f1");
			await renderList();
			expect(screen.queryByRole("group", { name: ts("toolbar.scope") })).toBeNull();

			fireEvent.click(screen.getByRole("button", { name: ts("toolbar.search") }));
			fireEvent.change(screen.getByRole("searchbox"), { target: { value: "저장소" } });
			await waitFor(() => expect(nav.search.get("search")).toBe("저장소"));
			expect(await screen.findByRole("group", { name: ts("toolbar.scope") })).toBeTruthy();

			nav.setSearch("collection=post&folder=f1");
			await waitFor(() => expect(screen.queryByRole("group", { name: ts("toolbar.scope") })).toBeNull());
		});

		it("has no choice at the top level, where a search already looks everywhere", async () => {
			nav.setSearch("collection=post&search=저장소");
			await renderList();
			expect(screen.queryByRole("group", { name: ts("toolbar.scope") })).toBeNull();
			expect(lastEntryQuery().has("folderId")).toBe(false);
		});

		it("forgets the widening once the words are cleared, so the next search starts in the folder", async () => {
			nav.setSearch("collection=post&folder=f1&search=저장소&scope=all");
			await renderList();
			const buttons = within(screen.getByRole("search")).getAllByRole("button");
			fireEvent.click(buttons.at(-1) as HTMLElement);

			await waitFor(() => expect(nav.search.get("search")).toBeNull());
			expect(nav.search.get("scope")).toBeNull();
		});
	});

	describe("steps 04–06: the folder row's menu, rename in place, delete", () => {
		const openMenu = async () => contextMenu(folderRow(/뉴스/));

		it("offers open, rename, move to and delete folder, in that order", async () => {
			await renderList();
			const items = await openMenu();
			expect(items.map((entry) => entry.textContent)).toEqual([
				tc("open"),
				td("folder.menu.rename"),
				td("folder.menu.move"),
				td("folder.menu.delete"),
			]);
		});

		it("renames in place: the name becomes a selected field, Enter sends the new name with the version", async () => {
			await renderList();
			const items = await openMenu();
			fireEvent.click(menuItem(items, td("folder.menu.rename")));

			const field = await screen.findByRole("textbox", NAME_FIELD);
			expect(document.activeElement).toBe(field);
			const input = field as HTMLInputElement;
			expect([input.value, input.selectionStart, input.selectionEnd]).toEqual(["뉴스", 0, 2]);
			expect(screen.queryByRole("dialog")).toBeNull();

			type(field, "속보");
			press(field, "Enter");
			await waitFor(() => expect(calls("PATCH", `${FOLDERS}/f1`)).toHaveLength(1));
			expect(bodyOf(calls("PATCH", `${FOLDERS}/f1`)[0])).toEqual({ name: "속보", expectedVersion: 1 });
			// The row shows the new name as a folder again, with focus on it.
			await waitFor(() => expect(document.activeElement).toBe(folderLink("속보")));
		});

		it("sends nothing for the same name, an empty one or Escape; focus goes back to the folder", async () => {
			await renderList();
			const rename = async () => {
				fireEvent.keyDown(folderLink("뉴스"), { key: "F2" });
				return screen.findByRole("textbox", NAME_FIELD);
			};
			let field = await rename();
			press(field, "Enter");
			await waitFor(() => expect(screen.queryByRole("textbox", NAME_FIELD)).toBeNull());
			await waitFor(() => expect(document.activeElement).toBe(folderLink("뉴스")));

			field = await rename();
			type(field, " ");
			press(field, "Enter");
			await waitFor(() => expect(screen.queryByRole("textbox", NAME_FIELD)).toBeNull());

			field = await rename();
			type(field, "속보");
			press(field, "Escape");
			expect(screen.queryByRole("textbox", NAME_FIELD)).toBeNull();
			await waitFor(() => expect(document.activeElement).toBe(folderLink("뉴스")));
			expect(calls("PATCH", `${FOLDERS}/f1`)).toHaveLength(0);
		});

		it("tells the person when the server refuses the new name, and the old name stays", async () => {
			await renderList();
			fireEvent.keyDown(folderLink("뉴스"), { key: "F2" });
			const field = await screen.findByRole("textbox", NAME_FIELD);
			server.writeStatus = 409;
			type(field, "연재");
			press(field, "Enter");

			await waitFor(() => expect(toast.error).toHaveBeenCalled());
			await waitFor(() => expect(folderLink("뉴스")).toBeTruthy());
		});

		it("asks first when a published post is inside; cancelling sends nothing and puts focus back on the folder", async () => {
			server.contents = { entries: 2, published: 1, folders: 0, files: 0, filesInUse: 0 };
			await renderList();
			const link = folderLink("뉴스");
			link.focus();
			fireEvent.keyDown(link, { key: "Delete" });

			const dialog = await screen.findByRole("alertdialog", { name: td("folder.ask.title", { name: "뉴스" }) });
			fireEvent.click(within(dialog).getByRole("button", { name: tc("cancel") }));
			await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
			expect(calls("DELETE", `${FOLDERS}/f1`)).toHaveLength(0);
			await waitFor(() => expect(document.activeElement).toBe(folderLink("뉴스")));
		});

		it("moves a folder of drafts to the trash at once, with an undo in the notice", async () => {
			await renderList();
			const items = await openMenu();
			fireEvent.click(menuItem(items, td("folder.menu.delete")));

			await waitFor(() => expect(calls("DELETE", `${FOLDERS}/f1`)).toHaveLength(1));
			expect(screen.queryByRole("alertdialog")).toBeNull();
			await waitFor(() => expect(toast).toHaveBeenCalled());
			const [message, options] = toast.mock.calls.at(-1) as [string, { action?: { label: string } }];
			expect(message).toBe(td("folder.done", { name: "뉴스", entries: 2 }));
			expect(options.action?.label).toBe(td("undo"));
		});

		it("offers the other folders to move to, and not the folder itself or what is inside it", async () => {
			server.folders = [NEWS, SERIES, folder("f3", "기록")];
			await renderList();
			const items = await openMenu();
			fireEvent.click(menuItem(items, td("folder.menu.move")));
			const labels = (await screen.findAllByRole("menuitem")).map((entry) => entry.textContent);
			expect(labels).toContain("기록");
			expect(labels).not.toContain("연재");
		});
	});

	describe("the folder being viewed goes to the trash", () => {
		/** The list's own state and folder actions without the screen: no row of the screen deletes the folder it shows, so a stand-in presses it. */
		function Probe() {
			const list = useEntryList();
			const viewed = list.folders?.list.find((entry) => entry.id === list.state.folder);
			return (
				<>
					<output aria-label="viewing">{list.state.folder}</output>
					<button type="button" onClick={() => viewed && void list.folders?.actions.requestDelete(viewed)}>
						delete viewed
					</button>
				</>
			);
		}
		const renderProbe = async () => {
			nav.render(
				<AdminQueryProvider>
					<Probe />
				</AdminQueryProvider>,
			);
			await screen.findByRole("button", { name: "delete viewed" });
			await waitFor(() => expect(calls("GET", FOLDERS).length).toBeGreaterThan(0));
		};

		it("returns to the all view", async () => {
			nav.setSearch("collection=post&folder=f1");
			await renderProbe();
			expect(screen.getByLabelText("viewing").textContent).toBe("f1");
			fireEvent.click(screen.getByRole("button", { name: "delete viewed" }));

			await waitFor(() => expect(screen.getByLabelText("viewing").textContent).toBe("all"));
			expect(calls("DELETE", `${FOLDERS}/f1`)).toHaveLength(1);
		});

		it("returns to the folder it was in when it was a subfolder", async () => {
			nav.setSearch("collection=post&folder=f2");
			await renderProbe();
			fireEvent.click(screen.getByRole("button", { name: "delete viewed" }));
			await waitFor(() => expect(screen.getByLabelText("viewing").textContent).toBe("f1"));
		});
	});

	describe("the rail's folder lines (carried over from the old sidebar tests)", () => {
		it("lists the folders under the open collection as named buttons, with the subfolders of the open path", async () => {
			nav.setSearch("collection=post&folder=f1");
			await renderList();
			const rail = screen.getByRole("list", { name: ts("sidebar.folderTree", { label: postsLabel }) });
			expect(
				within(rail)
					.getAllByRole("button")
					.map((entry) => entry.textContent?.replace(/\d+$/, "")),
			).toEqual(["뉴스", "연재"]);
		});

		it("is navigation only: Delete and F2 on a rail folder change nothing", async () => {
			await renderList();
			const rail = screen.getByRole("list", { name: ts("sidebar.folderTree", { label: postsLabel }) });
			const line = within(rail).getByRole("button", { name: /뉴스/ });
			fireEvent.keyDown(line, { key: "Delete" });
			fireEvent.keyDown(line, { key: "F2" });
			expect(calls("DELETE", `${FOLDERS}/f1`)).toHaveLength(0);
			expect(screen.queryByRole("textbox", NAME_FIELD)).toBeNull();
		});
	});
});
