import type { FolderContents, FolderListItem, FolderTrashResult, ListEntriesItem } from "@monti-cms/core/site";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { type FakeApi, failure, fakeApi } from "../../test/fake-api";
import { createTestRouter } from "../../test/router";
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
const postsLabel = testSite.COLLECTION_DEFINITIONS.post.label;

const folder = (id: string, name: string, parentId: string | null = null, version = 1): FolderListItem => ({
	id,
	collection: "post",
	parentId,
	name,
	position: 0,
	version,
	entryCount: 0,
});

const item = (id: string, folderId: string | null = null): ListEntriesItem => ({
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
});

const NEWS = folder("f1", "뉴스");
const SERIES = folder("f2", "연재", "f1");

const server = {
	posts: [] as ListEntriesItem[],
	folders: [] as FolderListItem[],
	contents: { entries: 2, published: 0, folders: 0, files: 0, filesInUse: 0 } as FolderContents,
	/** Whether a folder write is refused, as the server refuses a name already taken in the same place. */
	refuseWrites: false,
};
let api: FakeApi;

const entryQueries = () => api.sent("GET /v1/entries").map((request) => request.query);
const lastEntryQuery = () => entryQueries().at(-1) as URLSearchParams;

beforeEach(() => {
	vi.clearAllMocks();
	nav = createTestRouter({ search: "collection=post" });
	server.posts = [item("가"), item("나")];
	server.folders = [NEWS, SERIES];
	server.contents = { entries: 2, published: 0, folders: 0, files: 0, filesInUse: 0 };
	server.refuseWrites = false;
	api = fakeApi()
		.withEmptyRail()
		.on("GET /v1/preferences", () => ({}))
		.on("GET /v1/folders", () => server.folders)
		.on("POST /v1/folders", ({ body }) => {
			if (server.refuseWrites) return failure("folder_name_conflict");
			const input = body as { collection: string; name: string; parentId: string | null };
			const created = { ...folder("new", input.name, input.parentId), collection: input.collection };
			server.folders = [...server.folders, created];
			return created;
		})
		.on("GET /v1/folders/:id/contents", () => server.contents)
		.on("PATCH /v1/folders/:id", ({ params, body }) => {
			if (server.refuseWrites) return failure("folder_name_conflict");
			const input = body as { name?: string };
			server.folders = server.folders.map((entry) =>
				entry.id === params.id ? { ...entry, name: input.name ?? entry.name, version: entry.version + 1 } : entry,
			);
			return server.folders.find((entry) => entry.id === params.id);
		})
		.on("DELETE /v1/folders/:id", ({ params }): FolderTrashResult => {
			const gone = server.folders.find((entry) => entry.id === params.id);
			server.folders = server.folders.filter((entry) => entry.id !== params.id);
			return {
				folder: gone
					? {
							type: "folder",
							id: gone.id,
							collection: gone.collection,
							name: gone.name,
							version: gone.version + 1,
							deletedAt: new Date("2026-01-02T00:00:00Z"),
							expiresAt: null,
							path: [],
							entries: server.contents.entries,
							folders: 0,
							files: 0,
						}
					: null,
				entries: server.contents.entries,
				folders: 0,
				files: 0,
				kept: 0,
			};
		})
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
		it("creates the folder with the typed name and its parent on Enter, and the row becomes a folder", async () => {
			await renderList();
			pressAddFolder();
			type(nameField(), "원고");
			press(nameField(), "Enter");

			await waitFor(() => expect(api.sent("POST /v1/folders")).toHaveLength(1));
			expect(api.sent("POST /v1/folders")[0]?.body).toEqual({ collection: "post", name: "원고", parentId: null });
			await waitFor(() => expect(screen.queryByRole("textbox", NAME_FIELD)).toBeNull());
			// Focus is on the new folder, and no notice repeats what the row shows.
			await waitFor(() => expect(document.activeElement).toBe(folderLink("원고")));
			expect(toast).not.toHaveBeenCalled();
		});

		it("tells the person when the server refuses the name, and the row goes", async () => {
			await renderList();
			server.refuseWrites = true;
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

			await waitFor(() => expect(api.sent("POST /v1/folders")).toHaveLength(1));
			expect(api.sent("POST /v1/folders")[0]?.body).toMatchObject({ name: tf("folder.newName"), parentId: "f1" });
		});
	});

	describe("step 02: inside a folder, a path and the way up", () => {
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

		it("goes up one folder from the 상위 폴더로 row", async () => {
			nav.setSearch("collection=post&folder=f2");
			await renderList();
			fireEvent.click(screen.getByRole("button", { name: ts("list.folderUp") }));
			expect(nav.replace).toHaveBeenLastCalledWith(expect.stringContaining("folder=f1"), expect.anything());

			fireEvent.click(screen.getByRole("button", { name: ts("list.folderUp") }));
			expect(nav.replace).toHaveBeenLastCalledWith(expect.not.stringContaining("folder="), expect.anything());
		});

		it("opens a folder from its row", async () => {
			await renderList();
			fireEvent.click(folderLink("뉴스"));
			expect(nav.replace).toHaveBeenLastCalledWith(expect.stringContaining("folder=f1"), expect.anything());
		});
	});

	describe("step 03: a search inside a folder looks here, and can widen to all folders", () => {
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
	});

	describe("steps 04–06: the folder row's menu, rename in place, delete", () => {
		const openMenu = async () => contextMenu(folderRow(/뉴스/));

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
			await waitFor(() => expect(api.sent("PATCH /v1/folders/:id")).toHaveLength(1));
			expect(api.sent("PATCH /v1/folders/:id")[0]?.params.id).toBe("f1");
			expect(api.sent("PATCH /v1/folders/:id")[0]?.body).toEqual({ name: "속보", expectedVersion: 1 });
			// The row shows the new name as a folder again, with focus on it.
			await waitFor(() => expect(document.activeElement).toBe(folderLink("속보")));
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
			await waitFor(() => expect(api.sent("GET /v1/folders").length).toBeGreaterThan(0));
		};

		it("returns to the folder it was in when it was a subfolder", async () => {
			nav.setSearch("collection=post&folder=f2");
			await renderProbe();
			fireEvent.click(screen.getByRole("button", { name: "delete viewed" }));
			await waitFor(() => expect(screen.getByLabelText("viewing").textContent).toBe("f1"));
		});
	});
});
