import type { Folder, ListEntriesItem } from "@monti-cms/core/site";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { jsonResponse as json } from "../../test/fetch";
import { createTestRouter } from "../../test/router";
import { siteWithFolders } from "../../test/site";
import { toast } from "../../test/ui-toast";
import { EntryListScreen, TrashScreen } from "../entry-list-screen";
import { screensMessages } from "../messages";
import { AdminQueryProvider } from "../shared/query-provider";
import { ScreenContextProvider, useScreenContext } from "../shared/screen-context";

/** Address bar. When `router.replace` changes it, the screen using `useSearchParams` is redrawn. */
const nav = createTestRouter();
const { render } = nav;
const t = testSite.createTranslator(screensMessages);
vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);

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
	trashedAt: null,
	...fields,
});
const folder: Folder = { id: "f1", collection: "post", parentId: null, name: "뉴스", position: 0, version: 1 };

type Handler = (url: URL, init: RequestInit | undefined) => unknown;

/** Fake server. List requests read from `posts` and `trashed`, and tests accept more requests through `handle`. */
const server = {
	posts: [] as ListEntriesItem[],
	trashed: [] as ListEntriesItem[],
	folders: [] as Folder[],
	preferences: {} as Record<string, unknown>,
	handle: (() => undefined) as Handler,
};
let fetchMock: ReturnType<typeof vi.fn>;

/** The requests for the list itself: the sidebar's trash count asks for the same collection with the trashed status. */
const entryRequests = () =>
	fetchMock.mock.calls
		.map(([input]) => new URL(String(input), "http://localhost"))
		.filter(
			(url) =>
				url.pathname === "/api/monti/v1/entries" &&
				url.searchParams.get("collection") === "post" &&
				!url.searchParams.getAll("status").includes("trashed"),
		);
/** The requests for the trash: the same list, asked for the trashed status. */
const trashRequests = () =>
	fetchMock.mock.calls
		.map(([input]) => new URL(String(input), "http://localhost"))
		.filter(
			(url) =>
				url.pathname === "/api/monti/v1/entries" &&
				url.searchParams.get("collection") === "post" &&
				url.searchParams.getAll("status").includes("trashed") &&
				url.searchParams.has("sortField"),
		);
const calls = (method: string, path: string) =>
	fetchMock.mock.calls.filter(
		([input, init]) => (init?.method ?? "GET") === method && String(input).split("?")[0] === path,
	);
const bodyOf = (call: unknown[] | undefined) => JSON.parse(String((call?.[1] as RequestInit | undefined)?.body));

beforeEach(() => {
	vi.clearAllMocks();
	nav.setSearch("collection=post");
	server.posts = [item("가"), item("나"), item("다")];
	server.trashed = [];
	server.folders = [];
	server.preferences = {};
	server.handle = () => undefined;
	fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
		const url = new URL(input, "http://localhost");
		const handled = await server.handle(url, init);
		if (handled !== undefined) return handled;
		const method = init?.method ?? "GET";
		if (url.pathname === "/api/monti/v1/preferences") return json(method === "GET" ? server.preferences : {});
		if (url.pathname === "/api/monti/v1/folders" && method === "GET") return json(server.folders);
		if (url.pathname === "/api/monti/v1/entries" && method === "GET") {
			const collection = url.searchParams.get("collection");
			const trash = url.searchParams.getAll("status").includes("trashed");
			const items = collection !== "post" ? [] : trash ? server.trashed : server.posts;
			return json({ items, total: items.length });
		}
		throw new Error(`Unexpected fetch: ${method} ${input}`);
	});
	vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const renderList = () =>
	render(
		<AdminQueryProvider>
			<EntryListScreen />
		</AdminQueryProvider>,
	);
const renderTrash = () =>
	render(
		<AdminQueryProvider>
			<TrashScreen />
		</AdminQueryProvider>,
	);
const row = (title: string) => screen.getByRole("row", { name: new RegExp(title) });
const openRowMenu = async (title: string) => {
	await act(async () => {
		fireEvent.contextMenu(row(title));
	});
	return screen.findAllByRole("menuitem");
};
const menuLabels = (items: HTMLElement[]) => items.map((menuItem) => menuItem.textContent);

describe("list screen — title row", () => {
	it("shows the title and, for a collection with a public route, its address rule beside it", async () => {
		renderList();
		await screen.findByRole("row", { name: /가/ });

		const heading = screen.getByRole("heading", { level: 1 });
		expect(heading.textContent).toBe(testSite.COLLECTION_DEFINITIONS.post.label);
		expect(screen.getByText(testSite.schemaOf("post").path as string)).toBeTruthy();
	});

	it("has one title, whatever the list is doing", async () => {
		renderList();
		await screen.findByRole("row", { name: /가/ });
		expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
	});

	it("shows no address rule for a collection without a public route", async () => {
		nav.setSearch("collection=tag");
		renderList();
		await screen.findByRole("heading", { level: 1 });

		expect(testSite.schemaOf("tag").path).toBeUndefined();
		const heading = screen.getByRole("heading", { level: 1 });
		expect(heading.textContent).toBe(testSite.COLLECTION_DEFINITIONS.tag.label);
		expect(heading.nextElementSibling?.matches("span.font-mono")).not.toBe(true);
	});
});

describe("list screen — list settings", () => {
	it("with no page size or sort in the address, requests with the saved settings", async () => {
		server.preferences = { collections: { post: { pageSize: 50, sort: { field: "title", direction: "asc" } } } };
		renderList();
		await screen.findByRole("row", { name: /가/ });

		await waitFor(() => {
			const last = entryRequests().at(-1);
			expect(last?.searchParams.get("pageSize")).toBe("50");
			expect(last?.searchParams.get("sortField")).toBe("title");
			expect(last?.searchParams.get("sortDirection")).toBe("asc");
		});
	});

	it("requests the list once, with the saved sort, and not first with the defaults", async () => {
		server.preferences = { collections: { post: { pageSize: 50, sort: { field: "title", direction: "asc" } } } };
		renderList();
		await screen.findByRole("row", { name: /가/ });
		await new Promise((resolve) => setTimeout(resolve, 50));

		// The trash badge asks for trashed rows too; the list itself is the request with a sort.
		const listRequests = entryRequests().filter((url) => url.searchParams.has("sortField"));
		expect(listRequests).toHaveLength(1);
		expect(listRequests[0]?.searchParams.get("sortField")).toBe("title");
	});

	it("values written in the address take precedence over saved settings", async () => {
		nav.setSearch("collection=post&pageSize=100&sort=createdAt&dir=asc");
		server.preferences = { collections: { post: { pageSize: 50, sort: { field: "title", direction: "desc" } } } };
		renderList();
		await screen.findByRole("row", { name: /가/ });

		await waitFor(() => expect(entryRequests().at(-1)?.searchParams.get("pageSize")).toBe("100"));
	});
});

describe("list screen — row menu and bulk actions", () => {
	it("the menu of an unselected row targets just that row", async () => {
		renderList();
		await screen.findByRole("row", { name: /가/ });

		const items = await openRowMenu("가");
		expect(menuLabels(items)).toContain("열기");
		expect(screen.queryByText(/개 항목/)).toBeNull();
	});

	it("opening the menu of a selected row with several rows selected targets all selected rows", async () => {
		server.handle = (url, init) =>
			url.pathname === "/api/monti/v1/bulk" && init?.method === "POST"
				? json({ results: bodyOf([url, init]).items.map(({ id }: { id: string }) => ({ id, ok: true, version: 4 })) })
				: undefined;
		renderList();
		await screen.findByRole("row", { name: /가/ });
		fireEvent.click(screen.getByRole("checkbox", { name: "가 선택" }));
		fireEvent.click(screen.getByRole("checkbox", { name: "나 선택" }));

		const items = await openRowMenu("나");
		expect(screen.getByText("2개 항목")).toBeTruthy();
		expect(menuLabels(items)).not.toContain("열기");
		fireEvent.click(screen.getByRole("menuitem", { name: "보관" }));
		fireEvent.click(
			within(await screen.findByRole("alertdialog", { name: "보관" })).getByRole("button", { name: "보관" }),
		);

		await waitFor(() => expect(calls("POST", "/api/monti/v1/bulk")).toHaveLength(1));
		expect(bodyOf(calls("POST", "/api/monti/v1/bulk")[0])).toEqual({
			op: "archive",
			items: [
				{ id: "가", expectedVersion: 3 },
				{ id: "나", expectedVersion: 3 },
			],
		});
		await waitFor(() => expect(toast).toHaveBeenCalledWith("2개 항목을 보관했어요."));
	});

	it("the Delete key asks whether to move all selected rows to trash", async () => {
		renderList();
		await screen.findByRole("row", { name: /가/ });
		fireEvent.click(screen.getByRole("checkbox", { name: "가 선택" }));
		fireEvent.click(screen.getByRole("checkbox", { name: "다 선택" }));

		fireEvent.keyDown(screen.getByRole("checkbox", { name: "다 선택" }), { key: "Delete" });

		expect(await screen.findByRole("alertdialog", { name: "휴지통으로 이동" })).toBeTruthy();
	});

	it("actions are applied to the list first, and failed rows stay selected", async () => {
		let respond: (value: unknown) => void = () => {};
		server.handle = (url, init) =>
			url.pathname === "/api/monti/v1/bulk" && init?.method === "POST"
				? new Promise((resolve) => {
						respond = resolve;
					})
				: undefined;
		renderList();
		await screen.findByRole("row", { name: /가/ });
		fireEvent.click(screen.getByRole("checkbox", { name: "가 선택" }));
		fireEvent.click(screen.getByRole("checkbox", { name: "나 선택" }));
		await openRowMenu("가");
		fireEvent.click(screen.getByRole("menuitem", { name: "휴지통으로 이동Del" }));
		fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "휴지통으로 이동" }));

		// Two rows drop out before the response.
		await waitFor(() => expect(screen.queryByRole("row", { name: /가/ })).toBeNull());
		expect(screen.queryByRole("row", { name: /나/ })).toBeNull();

		// The server could only not move `나`. The refetched list still has `나`, and it is still selected.
		server.posts = [item("나"), item("다")];
		await act(async () =>
			respond(
				json({
					results: [
						{ id: "가", ok: true, version: 4 },
						{ id: "나", ok: false, error: "conflict" },
					],
				}),
			),
		);

		await waitFor(() =>
			expect(screen.getByRole("checkbox", { name: "나 선택" }).getAttribute("aria-checked")).toBe("true"),
		);
		expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("1개는 휴지통으로 이동했고 1개는 하지 못했어요."));
	});

	it("when it ends, successful rows are removed from the selection and only failed rows remain", async () => {
		server.handle = (url, init) =>
			url.pathname === "/api/monti/v1/bulk" && init?.method === "POST"
				? json({
						results: [
							{ id: "가", ok: true, version: 4 },
							{ id: "나", ok: false, error: "conflict" },
						],
					})
				: undefined;
		renderList();
		await screen.findByRole("row", { name: /가/ });
		fireEvent.click(screen.getByRole("checkbox", { name: "가 선택" }));
		fireEvent.click(screen.getByRole("checkbox", { name: "나 선택" }));
		await openRowMenu("가");
		fireEvent.click(screen.getByRole("menuitem", { name: "보관" }));
		fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "보관" }));

		await waitFor(() => expect(toast.error).toHaveBeenCalled());
		const checked = (title: string) =>
			screen.getByRole("checkbox", { name: `${title} 선택` }).getAttribute("aria-checked");
		await waitFor(() => expect(checked("가")).toBe("false"));
		expect(checked("나")).toBe("true");
	});

	it("if the request itself fails, the list is rolled back before refetching", async () => {
		let bulkFailed = false;
		server.handle = (url, init) => {
			if (url.pathname === "/api/monti/v1/bulk" && init?.method === "POST") {
				bulkFailed = true;
				return json({ error: { code: "internal", message: "서버 오류" } }, 500);
			}
			// The refetch after the failure never finishes. If the rows come back, it is thanks to the rollback.
			if (bulkFailed && url.pathname === "/api/monti/v1/entries") return new Promise(() => {});
			return undefined;
		};
		renderList();
		await screen.findByRole("row", { name: /가/ });
		await openRowMenu("가");
		fireEvent.click(screen.getByRole("menuitem", { name: "휴지통으로 이동Del" }));
		fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "휴지통으로 이동" }));

		await waitFor(() => expect(toast.error).toHaveBeenCalledWith("서버 오류"));
		expect(screen.getByRole("row", { name: /가/ })).toBeTruthy();
	});

	it("adding a post creates it in the current folder", async () => {
		nav.setSearch("collection=post&folder=f1");
		server.folders = [folder];
		renderList();
		await screen.findByRole("row", { name: /가/ });

		fireEvent.click(screen.getByRole("button", { name: "새 글 쓰기" }));

		expect(nav.navigate).toHaveBeenCalledWith("/admin/entries/new?collection=post&folder=f1");
	});
});

describe("list screen — a collection without folders", () => {
	/** The same list screen under a site where `post` has folders turned off. */
	const offNav = createTestRouter({ site: siteWithFolders("post", false) });
	const blankArea = () => screen.queryByTestId("list-blank-area");
	/** The sidebar counts folders of the other collections that use them; only this collection's folders are in question. */
	const folderRequests = () =>
		fetchMock.mock.calls.filter(([input]) => {
			const url = new URL(String(input), "http://localhost");
			return url.pathname.endsWith("/v1/folders") && url.searchParams.get("collection") === "post";
		});
	const openBlankMenu = async () => {
		await act(async () => {
			fireEvent.contextMenu(blankArea() as HTMLElement);
		});
		return menuLabels(await screen.findAllByRole("menuitem"));
	};
	const renderOff = () => {
		offNav.setSearch("collection=post");
		return offNav.render(
			<AdminQueryProvider>
				<EntryListScreen />
			</AdminQueryProvider>,
		);
	};

	it("offers no Add folder in the blank-area menu, where a collection with folders does", async () => {
		server.folders = [folder];
		renderList();
		await screen.findByRole("row", { name: /가/ });
		expect(await openBlankMenu()).toContain("폴더 추가");
		cleanup();

		renderOff();
		await screen.findByRole("row", { name: /가/ });
		const labels = await openBlankMenu();
		expect(labels.length).toBeGreaterThan(0);
		expect(labels).not.toContain("폴더 추가");
	});

	it("offers no Move to folder in a row menu, where a collection with folders does", async () => {
		server.folders = [folder];
		renderList();
		await screen.findByRole("row", { name: /가/ });
		expect(menuLabels(await openRowMenu("가"))).toContain("폴더로 이동");
		cleanup();

		renderOff();
		await screen.findByRole("row", { name: /가/ });
		expect(menuLabels(await openRowMenu("가"))).not.toContain("폴더로 이동");
	});

	it("never requests folders, and ignores a ?folder= left in the address", async () => {
		offNav.setSearch("collection=post&folder=f1");
		offNav.render(
			<AdminQueryProvider>
				<EntryListScreen />
			</AdminQueryProvider>,
		);
		await screen.findByRole("row", { name: /가/ });
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(folderRequests()).toHaveLength(0);
		expect(entryRequests().length).toBeGreaterThan(0);
		expect(entryRequests().every((url) => !url.searchParams.has("folderId"))).toBe(true);
	});

	it("requests folders for a collection with folders", async () => {
		renderList();
		await screen.findByRole("row", { name: /가/ });
		await waitFor(() => expect(folderRequests().length).toBeGreaterThan(0));
	});
});

describe("trash screen", () => {
	it("requests only trash items and the menu has only restore and permanent delete", async () => {
		server.trashed = [item("버린 글", { status: "trashed" })];
		renderTrash();
		await screen.findByRole("row", { name: /버린 글/ });

		expect(entryRequests().every((url) => url.searchParams.getAll("status").includes("trashed"))).toBe(true);
		expect(menuLabels(await openRowMenu("버린 글"))).toEqual(["복원", "영구 삭제Del"]);
	});

	it("lists the title and the day it was trashed, sorted by that day with the last one first, and the collection tabs stay", async () => {
		server.trashed = [item("버린 글", { status: "trashed", trashedAt: new Date("2026-10-15T00:00:00Z") })];
		server.preferences = { collections: { post: { sort: { field: "title", direction: "asc" } } } };
		renderTrash();
		await screen.findByRole("row", { name: /버린 글/ });

		const head = within(screen.getAllByRole("rowgroup")[0] as HTMLElement);
		expect(head.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
			t("column.title"),
			t("column.trashedAt"),
		]);
		expect(head.getByRole("columnheader", { name: t("column.trashedAt") }).getAttribute("aria-sort")).toBe(
			"descending",
		);
		// What the list was sorted by is not the trash's order, and there are no columns to add.
		const last = trashRequests().at(-1);
		expect(last?.searchParams.get("sortField")).toBe("trashedAt");
		expect(last?.searchParams.get("sortDirection")).toBe("desc");
		expect(head.queryByRole("button", { name: t("column.add") })).toBeNull();
		expect(within(row("버린 글")).getByText("10. 15")).toBeTruthy();
		expect(screen.getAllByRole("tab").length).toBeGreaterThan(1);
		// No page of the trash shows the list's filter or view controls.
		expect(screen.queryByRole("button", { name: /^(필터|보기)$/ })).toBeNull();
	});

	it("keeps the trash's sort out of the list's saved settings", async () => {
		server.trashed = [item("버린 글", { status: "trashed" })];
		renderTrash();
		await screen.findByRole("row", { name: /버린 글/ });
		fireEvent.click(
			within(screen.getAllByRole("rowgroup")[0] as HTMLElement).getByRole("button", { name: t("column.title") }),
		);
		fireEvent.click(await screen.findByRole("menuitemradio", { name: t("sort.text.asc") }));
		await waitFor(() => expect(trashRequests().at(-1)?.searchParams.get("sortField")).toBe("title"));
		expect(calls("PUT", "/api/monti/v1/preferences")).toHaveLength(0);
	});

	it("restore requests per item and reports the result", async () => {
		server.trashed = [item("trashed-1", { title: "버린 글", status: "trashed" })];
		server.handle = (url, init) =>
			url.pathname === "/api/monti/v1/entries/trashed-1/restore" && init?.method === "POST" ? json({}) : undefined;
		renderTrash();
		await screen.findByRole("row", { name: /버린 글/ });

		fireEvent.click(within(row("버린 글")).getByRole("button", { name: "복원" }));

		await waitFor(() => expect(toast).toHaveBeenCalledWith("1개 항목을 복원했어요."));
		expect(bodyOf(calls("POST", "/api/monti/v1/entries/trashed-1/restore")[0])).toEqual({ expectedVersion: 3 });
	});
});

describe("taxonomy edit panel — unsaved changes", () => {
	const record = (id: string, title: string) => ({
		id,
		collection: "tag",
		status: "published",
		version: 1,
		folderId: null,
		workingSlug: id,
		publishedSlug: id,
		working: { metadata: { title }, mdx: "" },
	});
	beforeEach(() => {
		nav.setSearch("collection=tag");
		const tags = [
			item("t1", { collection: "tag", title: "리액트", status: "published" }),
			item("t2", { collection: "tag", title: "뷰", status: "published" }),
		];
		server.handle = (url, init) => {
			if (url.pathname === "/api/monti/v1/entries" && url.searchParams.get("collection") === "tag" && !init?.method)
				return json({ items: tags, total: tags.length });
			if (url.pathname === "/api/monti/v1/entries/t1") return json(record("t1", "리액트"));
			if (url.pathname === "/api/monti/v1/entries/t2") return json(record("t2", "뷰"));
			return undefined;
		};
	});
	const panelName = () => screen.findByRole("textbox", { name: /이름/ }) as Promise<HTMLInputElement>;

	it("if nothing was changed, opens another item right away and marks the open row", async () => {
		renderList();
		fireEvent.click(await screen.findByRole("button", { name: "리액트" }));
		await waitFor(async () => expect((await panelName()).value).toBe("리액트"));
		expect(row("리액트").getAttribute("aria-current")).toBe("true");
		fireEvent.click(screen.getByRole("button", { name: "뷰" }));
		await waitFor(async () => expect((await panelName()).value).toBe("뷰"));
		expect(screen.queryByRole("alertdialog")).toBeNull();
		expect(row("뷰").getAttribute("aria-current")).toBe("true");
		expect(row("리액트").getAttribute("aria-current")).toBeNull();
	});

	it("pressing another item after changes asks for confirmation, and discarding opens that item", async () => {
		renderList();
		fireEvent.click(await screen.findByRole("button", { name: "리액트" }));
		await waitFor(async () => expect((await panelName()).value).toBe("리액트"));
		fireEvent.change(await panelName(), { target: { value: "React!" } });

		fireEvent.click(screen.getByRole("button", { name: "뷰" }));
		const dialog = await screen.findByRole("alertdialog", { name: "저장하지 않은 내용" });
		// While the confirm dialog is up the panel is hidden but the changed values remain.
		expect(screen.getByDisplayValue("React!")).toBeTruthy();

		fireEvent.click(within(dialog).getByRole("button", { name: "버리기" }));
		await waitFor(async () => expect((await panelName()).value).toBe("뷰"));
	});

	it("trying to create a new item after changes also asks for confirmation", async () => {
		renderList();
		fireEvent.click(await screen.findByRole("button", { name: "리액트" }));
		await waitFor(async () => expect((await panelName()).value).toBe("리액트"));
		fireEvent.change(await panelName(), { target: { value: "React!" } });

		fireEvent.click(screen.getByRole("button", { name: "태그 추가" }));
		expect(await screen.findByRole("alertdialog", { name: "저장하지 않은 내용" })).toBeTruthy();
	});

	it("a link that leaves the list asks first while the panel has changes", async () => {
		render(
			<AdminQueryProvider>
				<a href="/studio/events">elsewhere</a>
				<EntryListScreen />
			</AdminQueryProvider>,
		);
		fireEvent.click(await screen.findByRole("button", { name: "리액트" }));
		await waitFor(async () => expect((await panelName()).value).toBe("리액트"));
		fireEvent.change(await panelName(), { target: { value: "React!" } });

		fireEvent.click(screen.getByRole("link", { name: "elsewhere" }));
		expect(await screen.findByRole("alertdialog", { name: "저장하지 않은 내용" })).toBeTruthy();
	});

	it("moving to another collection closes the panel", async () => {
		renderList();
		fireEvent.click(await screen.findByRole("button", { name: "리액트" }));
		await waitFor(async () => expect((await panelName()).value).toBe("리액트"));

		act(() => nav.setSearch("collection=post"));
		await waitFor(() => expect(screen.queryByRole("textbox", { name: /이름/ })).toBeNull());
	});
});

describe("list screen — screen context", () => {
	/** What a side panel reads about where the admin is. */
	function Where() {
		return <output aria-label="where">{JSON.stringify(useScreenContext())}</output>;
	}
	const whereIs = () => JSON.parse(screen.getByLabelText("where").textContent ?? "{}");
	const renderWithContext = () =>
		render(
			<ScreenContextProvider>
				<Where />
				<AdminQueryProvider>
					<EntryListScreen />
				</AdminQueryProvider>
			</ScreenContextProvider>,
		);

	it("publishes the collection and the selected rows, and publishes none when the selection is cleared", async () => {
		renderWithContext();
		await screen.findByRole("row", { name: /가/ });
		await waitFor(() => expect(whereIs()).toMatchObject({ screen: "entries", collection: "post" }));
		expect(whereIs().selectedIds).toEqual([]);

		fireEvent.click(screen.getByRole("checkbox", { name: "가 선택" }));
		fireEvent.click(screen.getByRole("checkbox", { name: "다 선택" }));
		await waitFor(() => expect(whereIs().selectedIds).toEqual(["가", "다"]));

		fireEvent.click(screen.getByRole("checkbox", { name: "가 선택" }));
		await waitFor(() => expect(whereIs().selectedIds).toEqual(["다"]));
		fireEvent.click(screen.getByRole("checkbox", { name: "다 선택" }));
		await waitFor(() => expect(whereIs().selectedIds).toEqual([]));
	});
});
