import type { Folder, ListEntriesItem } from "@monti-cms/core/runtime";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestRouter } from "../../test/router";
import { AdminClientDashboard, AdminTrashDashboard } from "../admin-dashboard";
import { AdminQueryProvider } from "../shared/query-provider";

/** Address bar. When `router.replace` changes it, the screen using `useSearchParams` is redrawn. */
const nav = createTestRouter();
const { render } = nav;
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ Toaster: () => null, toast }));

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

const json = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data });
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

const entryRequests = () =>
	fetchMock.mock.calls
		.map(([input]) => new URL(String(input), "http://localhost"))
		.filter((url) => url.pathname === "/api/cms/v1/entries" && url.searchParams.get("collection") === "post");
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
		if (url.pathname === "/api/cms/v1/preferences") return json(method === "GET" ? server.preferences : {});
		if (url.pathname === "/api/cms/v1/folders" && method === "GET") return json(server.folders);
		if (url.pathname === "/api/cms/v1/entries" && method === "GET") {
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
			<AdminClientDashboard />
		</AdminQueryProvider>,
	);
const renderTrash = () =>
	render(
		<AdminQueryProvider>
			<AdminTrashDashboard />
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

	it("values written in the address take precedence over saved settings", async () => {
		nav.setSearch("collection=post&pageSize=100&sort=createdAt&dir=asc");
		server.preferences = { collections: { post: { pageSize: 50, sort: { field: "title", direction: "desc" } } } };
		renderList();
		await screen.findByRole("row", { name: /가/ });

		await waitFor(() => expect(entryRequests().at(-1)?.searchParams.get("pageSize")).toBe("100"));
	});

	it("changing the sort changes the address and saves to the collection settings", async () => {
		renderList();
		await screen.findByRole("row", { name: /가/ });

		fireEvent.click(screen.getByRole("button", { name: /^제목/ }));
		fireEvent.click(await screen.findByRole("button", { name: "오름차순" }));

		await waitFor(() => expect(calls("PUT", "/api/cms/v1/preferences")).toHaveLength(1));
		expect(bodyOf(calls("PUT", "/api/cms/v1/preferences")[0])).toEqual({
			collections: { post: { sort: { field: "title", direction: "asc" } } },
		});
		await waitFor(() => expect(entryRequests().at(-1)?.searchParams.get("sortField")).toBe("title"));
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
			url.pathname === "/api/cms/v1/bulk" && init?.method === "POST"
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

		await waitFor(() => expect(calls("POST", "/api/cms/v1/bulk")).toHaveLength(1));
		expect(bodyOf(calls("POST", "/api/cms/v1/bulk")[0])).toEqual({
			op: "archive",
			items: [
				{ id: "가", expectedVersion: 3 },
				{ id: "나", expectedVersion: 3 },
			],
		});
		await waitFor(() => expect(toast.success).toHaveBeenCalledWith("2개 항목을 보관했습니다."));
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
			url.pathname === "/api/cms/v1/bulk" && init?.method === "POST"
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
		expect(toast.error).toHaveBeenCalledWith("1개는 휴지통으로 이동했고 1개는 하지 못했습니다.", expect.anything());
	});

	it("when it ends, successful rows are removed from the selection and only failed rows remain", async () => {
		server.handle = (url, init) =>
			url.pathname === "/api/cms/v1/bulk" && init?.method === "POST"
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
			if (url.pathname === "/api/cms/v1/bulk" && init?.method === "POST") {
				bulkFailed = true;
				return json({ code: "internal", message: "서버 오류" }, 500);
			}
			// The refetch after the failure never finishes. If the rows come back, it is thanks to the rollback.
			if (bulkFailed && url.pathname === "/api/cms/v1/entries") return new Promise(() => {});
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

		fireEvent.click(screen.getByRole("button", { name: "게시글 추가" }));

		expect(nav.navigate).toHaveBeenCalledWith("/admin/entries/new?collection=post&folder=f1");
	});
});

describe("list screen — folders", () => {
	it("deleting the folder being viewed returns to the all view", async () => {
		nav.setSearch("collection=post&folder=f1");
		server.folders = [folder];
		server.handle = (url, init) => {
			if (url.pathname === "/api/cms/v1/folders/f1" && !init?.method) return json({ entryCount: 0, childFolders: [] });
			if (url.pathname === "/api/cms/v1/folders/f1" && init?.method === "DELETE") return json({});
			return undefined;
		};
		renderList();
		await screen.findByRole("row", { name: /가/ });

		fireEvent.click(screen.getByRole("button", { name: "'뉴스' 폴더 작업" }));
		fireEvent.click(await screen.findByRole("menuitem", { name: "삭제Del" }));
		const dialog = await screen.findByRole("alertdialog", { name: "'뉴스' 폴더 삭제" });
		await waitFor(() => expect(within(dialog).getByRole("button", { name: "삭제" })).toHaveProperty("disabled", false));
		fireEvent.click(within(dialog).getByRole("button", { name: "삭제" }));

		await waitFor(() => expect(nav.search.get("folder")).toBeNull());
		expect(calls("DELETE", "/api/cms/v1/folders/f1")).toHaveLength(1);
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

	it("restore requests per item and reports the result", async () => {
		server.trashed = [item("trashed-1", { title: "버린 글", status: "trashed" })];
		server.handle = (url, init) =>
			url.pathname === "/api/cms/v1/entries/trashed-1/restore" && init?.method === "POST" ? json({}) : undefined;
		renderTrash();
		await screen.findByRole("row", { name: /버린 글/ });

		fireEvent.click(within(row("버린 글")).getByRole("button", { name: "복원" }));

		await waitFor(() => expect(toast.success).toHaveBeenCalledWith("1개 항목을 복원했습니다."));
		expect(bodyOf(calls("POST", "/api/cms/v1/entries/trashed-1/restore")[0])).toEqual({ expectedVersion: 3 });
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
			if (url.pathname === "/api/cms/v1/entries" && url.searchParams.get("collection") === "tag" && !init?.method)
				return json({ items: tags, total: tags.length });
			if (url.pathname === "/api/cms/v1/entries/t1") return json(record("t1", "리액트"));
			if (url.pathname === "/api/cms/v1/entries/t2") return json(record("t2", "뷰"));
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
});
