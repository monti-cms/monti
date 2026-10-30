import { emptyStoredDocument } from "@monti-cms/core/document";
import type { FolderListItem, ListEntriesItem, PreferencesBody } from "@monti-cms/core/site";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import type { BulkItemResult, EntriesPage } from "../../api/entries";
import { commonMessages } from "../../lib/common.messages";
import { type FakeApi, failure, fakeApi, type SentRequest } from "../../test/fake-api";
import { createTestRouter } from "../../test/router";
import { siteWithFolders } from "../../test/site";
import { toast } from "../../test/ui-toast";
import type { EntryData } from "../entries/entry-form";
import { EntryListScreen } from "../entry-list-screen";
import { screensMessages } from "../messages";
import { AdminQueryProvider } from "../shared/query-provider";
import { ScreenContextProvider, useScreenContext } from "../shared/screen-context";

const tCommon = testSite.createTranslator(commonMessages);

/** Address bar. When `router.replace` changes it, the screen using `useSearchParams` is redrawn. */
const nav = createTestRouter();
const { render } = nav;
const _t = testSite.createTranslator(screensMessages);
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
	entryCount: 0,
};

/** Fake server. List requests read from `posts` and `trashed`; a test answers more routes with `api.on`. */
const server = {
	posts: [] as ListEntriesItem[],
	trashed: [] as ListEntriesItem[],
	folders: [] as FolderListItem[],
	preferences: {} as PreferencesBody,
};
let api: FakeApi;
/** What the list route answers from `server`. */
const listAnswer = ({ query }: SentRequest): EntriesPage => {
	const collection = query.get("collection");
	const trash = query.getAll("status").includes("trashed");
	const items = collection !== "post" ? [] : trash ? server.trashed : server.posts;
	return { items, total: items.length };
};

/** The requests for the list itself: the sidebar's trash count asks for the same collection with the trashed status. */
const entryRequests = () =>
	api
		.sent("GET /v1/entries")
		.map((request) => request.query)
		.filter((query) => query.get("collection") === "post" && !query.getAll("status").includes("trashed"));
/** The requests for the trash: the same list, asked for the trashed status. */
const _trashRequests = () =>
	api
		.sent("GET /v1/entries")
		.map((request) => request.query)
		.filter(
			(query) =>
				query.get("collection") === "post" && query.getAll("status").includes("trashed") && query.has("sortField"),
		);

beforeEach(() => {
	vi.clearAllMocks();
	nav.setSearch("collection=post");
	server.posts = [item("가"), item("나"), item("다")];
	server.trashed = [];
	server.folders = [];
	server.preferences = {};
	api = fakeApi()
		.withEmptyRail()
		.on("GET /v1/preferences", () => server.preferences)
		.on("PUT /v1/preferences", ({ body }) => ({ preferences: body }))
		.on("GET /v1/folders", () => server.folders)
		.on("GET /v1/entries", listAnswer)
		.install();
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
		expect(screen.getByText(testSite.schemaOf("post").path as string)).toBeInTheDocument();
	});
});

describe("list screen — list settings", () => {
	it("with no page size or sort in the address, requests with the saved settings", async () => {
		server.preferences = { collections: { post: { pageSize: 50, sort: { field: "title", direction: "asc" } } } };
		renderList();
		await screen.findByRole("row", { name: /가/ });

		await waitFor(() => {
			const last = entryRequests().at(-1);
			expect(last?.get("pageSize")).toBe("50");
			expect(last?.get("sortField")).toBe("title");
			expect(last?.get("sortDirection")).toBe("asc");
		});
	});

	it("requests the list once, with the saved sort, and not first with the defaults", async () => {
		server.preferences = { collections: { post: { pageSize: 50, sort: { field: "title", direction: "asc" } } } };
		renderList();
		await screen.findByRole("row", { name: /가/ });
		await new Promise((resolve) => setTimeout(resolve, 50));

		// The trash badge asks for trashed rows too; the list itself is the request with a sort.
		const listRequests = entryRequests().filter((query) => query.has("sortField"));
		expect(listRequests).toHaveLength(1);
		expect(listRequests[0]?.get("sortField")).toBe("title");
	});

	it("values written in the address take precedence over saved settings", async () => {
		nav.setSearch("collection=post&pageSize=100&sort=createdAt&dir=asc");
		server.preferences = { collections: { post: { pageSize: 50, sort: { field: "title", direction: "desc" } } } };
		renderList();
		await screen.findByRole("row", { name: /가/ });

		await waitFor(() => expect(entryRequests().at(-1)?.get("pageSize")).toBe("100"));
	});
});

describe("list screen — row menu and bulk actions", () => {
	it("the Delete key moves all selected draft rows to the trash at once", async () => {
		api.on("POST /v1/bulk", () => ({
			results: [
				{ id: "가", ok: true as const, version: 4 },
				{ id: "다", ok: true as const, version: 4 },
			],
		}));
		renderList();
		await screen.findByRole("row", { name: /가/ });
		fireEvent.click(screen.getByRole("checkbox", { name: "가 선택" }));
		fireEvent.click(screen.getByRole("checkbox", { name: "다 선택" }));

		fireEvent.keyDown(screen.getByRole("checkbox", { name: "다 선택" }), { key: "Delete" });

		await waitFor(() => expect(api.sent("POST /v1/bulk")).toHaveLength(1));
		expect(api.sent("POST /v1/bulk")[0]?.body.items.map((entry: { id: string }) => entry.id)).toEqual(["가", "다"]);
		expect(screen.queryByRole("alertdialog")).toBeNull();
	});

	it("actions are applied to the list first, and failed rows stay selected", async () => {
		let respond: (value: { results: BulkItemResult[] }) => void = () => {};
		api.on(
			"POST /v1/bulk",
			() =>
				new Promise((resolve) => {
					respond = resolve;
				}),
		);
		renderList();
		await screen.findByRole("row", { name: /가/ });
		fireEvent.click(screen.getByRole("checkbox", { name: "가 선택" }));
		fireEvent.click(screen.getByRole("checkbox", { name: "나 선택" }));
		await openRowMenu("가");
		fireEvent.click(screen.getByRole("menuitem", { name: "휴지통으로Del" }));

		// Two rows drop out before the response.
		await waitFor(() => expect(screen.queryByRole("row", { name: /가/ })).toBeNull());
		expect(screen.queryByRole("row", { name: /나/ })).toBeNull();

		// The server could only not move `나`. The refetched list still has `나`, and it is still selected.
		server.posts = [item("나"), item("다")];
		await act(async () =>
			respond({
				results: [
					{ id: "가", ok: true, version: 4 },
					{ id: "나", ok: false, error: "conflict" },
				],
			}),
		);

		await waitFor(() =>
			expect(screen.getByRole("checkbox", { name: "나 선택" }).getAttribute("aria-checked")).toBe("true"),
		);
		// The one that did move can still be taken back from the toast.
		expect(toast.error).toHaveBeenCalledWith(
			expect.stringContaining("1개는 휴지통으로했고 1개는 하지 못했어요."),
			expect.objectContaining({ action: expect.objectContaining({ label: "되돌리기" }) }),
		);
	});

	it("when it ends, successful rows are removed from the selection and only failed rows remain", async () => {
		api.on("POST /v1/bulk", () => ({
			results: [
				{ id: "가", ok: true as const, version: 4 },
				{ id: "나", ok: false as const, error: "conflict" },
			],
		}));
		renderList();
		await screen.findByRole("row", { name: /가/ });
		fireEvent.click(screen.getByRole("checkbox", { name: "가 선택" }));
		fireEvent.click(screen.getByRole("checkbox", { name: "나 선택" }));
		await openRowMenu("가");
		fireEvent.click(screen.getByRole("menuitem", { name: tCommon("lifecycle.archive") }));
		fireEvent.click(
			within(await screen.findByRole("alertdialog")).getByRole("button", { name: tCommon("lifecycle.archive") }),
		);

		await waitFor(() => expect(toast.error).toHaveBeenCalled());
		const checked = (title: string) =>
			screen.getByRole("checkbox", { name: `${title} 선택` }).getAttribute("aria-checked");
		await waitFor(() => expect(checked("가")).toBe("false"));
		expect(checked("나")).toBe("true");
	});

	it("if the request itself fails, the list is rolled back before refetching", async () => {
		let bulkFailed = false;
		api
			.on("POST /v1/bulk", () => {
				bulkFailed = true;
				return failure("internal_error", "서버 오류");
			})
			// The refetch after the failure never finishes. If the rows come back, it is thanks to the rollback.
			.on("GET /v1/entries", (request) => (bulkFailed ? new Promise<never>(() => {}) : listAnswer(request)));
		renderList();
		await screen.findByRole("row", { name: /가/ });
		await openRowMenu("가");
		fireEvent.click(screen.getByRole("menuitem", { name: "휴지통으로Del" }));

		await waitFor(() => expect(toast.error).toHaveBeenCalledWith("서버 오류"));
		expect(screen.getByRole("row", { name: /가/ })).toBeInTheDocument();
	});

	it("adding a post creates it in the current folder", async () => {
		nav.setSearch("collection=post&folder=f1");
		server.folders = [folder];
		renderList();
		await screen.findByRole("row", { name: /가/ });

		fireEvent.click(screen.getByRole("button", { name: _t("list.writeNew") }));

		expect(nav.navigate).toHaveBeenCalledWith("/admin/entries/new?collection=post&folder=f1");
	});
});

describe("list screen — a collection without folders", () => {
	/** The same list screen under a site where `post` has folders turned off. */
	const offNav = createTestRouter({ site: siteWithFolders("post", false) });
	const blankArea = () => screen.queryByTestId("list-blank-area");
	/** The sidebar counts folders of the other collections that use them; only this collection's folders are in question. */
	const folderRequests = () =>
		api.sent("GET /v1/folders").filter((request) => request.query.get("collection") === "post");
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
		expect(entryRequests().every((query) => !query.has("folderId"))).toBe(true);
	});
});

describe("taxonomy edit panel — unsaved changes", () => {
	const record = (id: string, title: string): EntryData => ({
		id,
		collection: "tag",
		status: "published",
		version: 1,
		folderId: null,
		workingSlug: id,
		publishedSlug: id,
		working: { metadata: { title }, doc: emptyStoredDocument() },
	});
	beforeEach(() => {
		nav.setSearch("collection=tag");
		const tags = [
			item("t1", { collection: "tag", title: "리액트", status: "published" }),
			item("t2", { collection: "tag", title: "뷰", status: "published" }),
		];
		const records: Record<string, EntryData> = { t1: record("t1", "리액트"), t2: record("t2", "뷰") };
		api
			.on("GET /v1/entries", (request) =>
				request.query.get("collection") === "tag" ? { items: tags, total: tags.length } : listAnswer(request),
			)
			.on("GET /v1/entries/:id", ({ params }) => records[params.id ?? ""] ?? failure("not_found"));
	});
	const panelName = () => screen.findByRole("textbox", { name: /이름/ }) as Promise<HTMLInputElement>;

	it("pressing another item after changes asks for confirmation, and discarding opens that item", async () => {
		renderList();
		fireEvent.click(await screen.findByRole("button", { name: "리액트" }));
		await waitFor(async () => expect((await panelName()).value).toBe("리액트"));
		fireEvent.change(await panelName(), { target: { value: "React!" } });

		fireEvent.click(screen.getByRole("button", { name: "뷰" }));
		const dialog = await screen.findByRole("alertdialog", { name: tCommon("discard.title") });
		// While the confirm dialog is up the panel is hidden but the changed values remain.
		expect(screen.getByDisplayValue("React!")).toBeInTheDocument();

		fireEvent.click(within(dialog).getByRole("button", { name: tCommon("discard.confirm") }));
		await waitFor(async () => expect((await panelName()).value).toBe("뷰"));
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
		expect(await screen.findByRole("alertdialog", { name: tCommon("discard.title") })).toBeInTheDocument();
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
