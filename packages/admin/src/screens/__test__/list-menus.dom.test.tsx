import type { ListEntriesItem, PreferencesBody } from "@monti-cms/core/site";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import type { EntrySearchResponse, ListCountsResponse } from "../../api/entries";
import { commonMessages } from "../../lib/common.messages";
import { type FakeApi, fakeApi } from "../../test/fake-api";
import { createTestRouter } from "../../test/router";
import { toast } from "../../test/ui-toast";
import { bulkBarMessages } from "../entries/bulk-bar.messages";
import { EntryListScreen } from "../entry-list-screen";
import { screensMessages } from "../messages";
import { statusLabels } from "../shared/entry-status";
import { AdminQueryProvider } from "../shared/query-provider";

const tBulkBar = testSite.createTranslator(bulkBarMessages);

// One test per flow of the list's column menus (sort, filter by value, filter by date, hide and add columns), the page size, the select-and-act bar and the pager
// (flow 7 of the canvas and the main list board). They check what a screenshot cannot: what a press does to the address, the request and the saved settings.

const nav = createTestRouter();
const { render } = nav;
vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);

const t = testSite.createTranslator(screensMessages);
const tc = testSite.createTranslator(commonMessages);
const statusName = (status: "draft" | "published" | "archived") => statusLabels(testSite)[status];

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

const TAGS: EntrySearchResponse["items"] = [
	{ id: "t-react", title: "리액트", slug: "react", status: "published" },
	{ id: "t-next", title: "넥스트", slug: "next", status: "published" },
];

const server = {
	posts: [] as ListEntriesItem[],
	total: undefined as number | undefined,
	preferences: {} as PreferencesBody,
	counts: {} as Record<string, ListCountsResponse>,
};
let api: FakeApi;

beforeEach(() => {
	vi.clearAllMocks();
	nav.setSearch("collection=post");
	server.posts = [item("가"), item("나"), item("다")];
	server.total = undefined;
	server.preferences = {};
	server.counts = {
		tagIds: { total: 3, empty: 1, values: { "t-react": 2, "t-next": 0 } },
		translation: { total: 3, values: { none: 1, changed: 1, current: 1 } },
		status: { total: 148, values: { published: 101, editing: 3, draft: 41, archived: 3 } },
	};
	api = fakeApi()
		.withEmptyRail()
		.on("GET /v1/preferences", () => server.preferences)
		.on("PUT /v1/preferences", ({ body }) => ({ preferences: body }))
		.on("GET /v1/folders", () => [])
		.on("GET /v1/entries/counts", ({ query }) => {
			const key = query.get("field") ?? query.get("facet") ?? "";
			return server.counts[key] ?? { total: 0, values: {} };
		})
		.on("GET /v1/entries/search", ({ query }) => {
			const ids = query.getAll("id");
			const words = query.get("query") ?? "";
			return {
				items:
					ids.length > 0
						? TAGS.filter((tag) => ids.includes(tag.id))
						: TAGS.filter((tag) => tag.title?.includes(words)),
			};
		})
		.on("POST /v1/bulk", ({ body }) => {
			const input = body as {
				op: string;
				field?: string;
				ids?: string[];
				items: { id: string; expectedVersion: number }[];
			};
			// The server keeps what was changed, so the list read again after it says so.
			server.posts = server.posts.map((post) => {
				if (!input.items.some((entry) => entry.id === post.id) || !input.field) return post;
				const field = input.field;
				const held = post.relations[field] ?? [];
				const named = (id: string) => ({ id, title: TAGS.find((tag) => tag.id === id)?.title ?? id });
				const next =
					input.op === "relation.add"
						? [...held, ...(input.ids ?? []).filter((id) => !held.some((value) => value.id === id)).map(named)]
						: held.filter((value) => !(input.ids ?? []).includes(value.id));
				return { ...post, relations: { ...post.relations, [field]: next } };
			});
			return {
				results: input.items.map((entry) => ({ id: entry.id, ok: true as const, version: entry.expectedVersion + 1 })),
			};
		})
		.on("GET /v1/entries", ({ query }) => {
			const items = query.get("collection") === "post" ? server.posts : [];
			return { items, total: server.total ?? items.length };
		})
		.install();
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const listRequests = () =>
	api
		.sent("GET /v1/entries")
		.filter(
			(request) => request.query.get("collection") === "post" && !request.query.getAll("status").includes("trashed"),
		);
const lastList = () => listRequests().at(-1)?.query as URLSearchParams;
const saved = () => api.sent("PUT /v1/preferences").map((request) => request.body);

const renderList = async () => {
	render(
		<AdminQueryProvider>
			<EntryListScreen />
		</AdminQueryProvider>,
	);
	await screen.findByRole("row", { name: /가/ });
};

// A menu that is open makes the page behind it inert, so the head is looked up with `hidden`.
const headRow = () => screen.getAllByRole("rowgroup", { hidden: true })[0] as HTMLElement;
const head = () => within(headRow());
const names = () =>
	head()
		.getAllByRole("button")
		.map((button) => button.textContent);
/** Presses the name of a column in the head row, which opens its menu under it. */
const openColumn = (label: string) => fireEvent.click(head().getByRole("button", { name: label }));
const menuOpen = () => screen.queryAllByRole("menu").length > 0;
const menuClosed = () => waitFor(() => expect(screen.queryAllByRole("menu")).toHaveLength(0));
/** Escape closes the menu. */
const closeMenu = async () => {
	fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
	await menuClosed();
};
/** The pager's names come from the UI labels, English until a provider says otherwise. */
const PAGER = /Pagination|페이지 이동/;
const NEXT = /Next page|다음 페이지/;
const dotsIn = (column: string) =>
	within(headRow()).getByRole("columnheader", { name: column, hidden: true }).querySelectorAll("[data-slot=column-dot]")
		.length;

describe("flow: sort from a column's menu", () => {
	it("picks 'ascending' on the title, which applies it, closes the menu and is saved for the collection", async () => {
		await renderList();
		openColumn(t("column.title"));
		fireEvent.click(await screen.findByRole("menuitemradio", { name: t("sort.text.asc") }));
		await waitFor(() => expect(lastList().get("sortField")).toBe("title"));
		expect(lastList().get("sortDirection")).toBe("asc");
		await menuClosed();
		await waitFor(() =>
			expect(saved()).toEqual([{ collections: { post: { sort: { field: "title", direction: "asc" } } } }]),
		);
		// The sorted column shows it in the head.
		expect(
			head()
				.getByRole("columnheader", { name: t("column.title") })
				.getAttribute("aria-sort"),
		).toBe("ascending");
	});

	it("opens a column's menu from the keyboard too, with the arrow down on its name", async () => {
		await renderList();
		fireEvent.keyDown(head().getByRole("button", { name: t("column.title") }), { key: "ArrowDown" });
		await screen.findByRole("menuitemradio", { name: t("sort.text.asc") });
	});
});

describe("flow: columns and page size", () => {
	it("lists only the hidden columns under +, and picking one shows it and saves it", async () => {
		await renderList();
		fireEvent.click(head().getByRole("button", { name: t("column.add") }));
		const rows = await screen.findAllByRole("menuitem");
		const labels = rows.map((row) => row.textContent);
		// Plain rows: no checks, no heading. What is already in the head is not offered.
		expect(screen.queryByRole("menuitemcheckbox")).toBeNull();
		expect(labels).toContain(t("column.createdAt"));
		for (const shown of names()) expect(labels).not.toContain(shown);
		fireEvent.click(screen.getByRole("menuitem", { name: t("column.createdAt") }));
		await waitFor(() => expect(saved().at(-1)?.collections.post.columns.visibility).toMatchObject({ createdAt: true }));
		await head().findByRole("button", { name: t("column.createdAt") });
		// It is no longer offered.
		fireEvent.click(head().getByRole("button", { name: t("column.add") }));
		await screen.findAllByRole("menuitem");
		expect(screen.queryByRole("menuitem", { name: t("column.createdAt") })).toBeNull();
	});

	it("picks 50 per page from the footer, which applies it, closes the menu and is saved", async () => {
		await renderList();
		fireEvent.click(screen.getByRole("button", { name: t("list.pageSize") }));
		fireEvent.click(await screen.findByRole("menuitemradio", { name: t("list.pageSizeOption", { size: 50 }) }));
		await waitFor(() => expect(lastList().get("pageSize")).toBe("50"));
		await menuClosed();
		await waitFor(() => expect(saved().at(-1)).toEqual({ collections: { post: { pageSize: 50 } } }));
	});
});

describe("flow: filter by value", () => {
	it("ticks 'editing' and 'draft' on the status menu, which stays open, and the dot says it until they are unticked", async () => {
		await renderList();
		openColumn(t("column.status"));
		const editing = await screen.findByRole("menuitemcheckbox", { name: new RegExp(`^${t("filter.editing")}`) });
		// Each value shows how many rows are in it.
		expect(await within(editing).findByText("3")).toBeInTheDocument();
		fireEvent.click(editing);
		fireEvent.click(screen.getByRole("menuitemcheckbox", { name: new RegExp(`^${statusName("draft")}`) }));
		await waitFor(() => expect(lastList().getAll("status")).toEqual(["editing", "draft"]));
		expect(nav.search.getAll("status")).toEqual(["editing", "draft"]);
		expect(menuOpen()).toBe(true);
		expect(dotsIn(t("column.status"))).toBe(1);
		await closeMenu();
		expect(dotsIn(t("column.title"))).toBe(0);
		openColumn(t("column.status"));
		fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: new RegExp(`^${t("filter.editing")}`) }));
		fireEvent.click(screen.getByRole("menuitemcheckbox", { name: new RegExp(`^${statusName("draft")}`) }));
		await waitFor(() => expect(lastList().has("status")).toBe(false));
		expect(dotsIn(t("column.status"))).toBe(0);
	});

	it("narrows the items of a relation to what the search row types", async () => {
		await renderList();
		openColumn("태그");
		await screen.findByRole("menuitemcheckbox", { name: /^넥스트/ });
		fireEvent.change(await screen.findByRole("textbox", { name: t("listMenu.valueSearch", { label: "태그" }) }), {
			target: { value: "넥" },
		});
		await waitFor(() => expect(screen.queryByRole("menuitemcheckbox", { name: /^리액트/ })).toBeNull());
		expect(screen.getByRole("menuitemcheckbox", { name: /^넥스트/ })).toBeInTheDocument();
	});
});

describe("flow: filter by date", () => {
	/** Opens the updated date's menu and the calendar card of its "pick a period" row beside it, which leaves the menu open behind it. */
	const openCalendar = async () => {
		await renderList();
		openColumn(t("column.updatedAt"));
		fireEvent.keyDown(await screen.findByRole("menuitem", { name: t("listMenu.range") }), { key: "ArrowRight" });
		await screen.findByRole("grid");
	};
	const day = (n: string) =>
		within(screen.getByRole("grid"))
			.getAllByRole("button")
			.find((button) => button.textContent === n) as HTMLElement;

	// jsdom moves focus out of the card once the days re-render, which a browser does not; that the calendar stays open is checked by the UpdatedRangeSet story.
	it("picks a period on the calendar: the first day starts it, the second sets it, and the dot says it", async () => {
		await openCalendar();
		fireEvent.click(day("10"));
		expect(nav.search.has("updated")).toBe(false);
		fireEvent.click(day("20"));
		await waitFor(() => expect(nav.search.get("updated")).toMatch(/^\d{4}-\d{2}-10\.\.\d{4}-\d{2}-20$/));
		expect(lastList().get("updatedFrom")).not.toBeNull();
		expect(dotsIn(t("column.updatedAt"))).toBe(1);
	});
});

describe("flow: pick rows and act", () => {
	it("hangs a check on each row and a select-all on the head row, and the bar replaces the column names in the same place while rows are picked", async () => {
		nav.setSearch("collection=post&status=draft");
		await renderList();
		expect(screen.queryByRole("toolbar")).toBeNull();
		// The select-all is on the head row while nothing is picked.
		expect(head().getByRole("checkbox", { name: t("list.selectAll") })).toBeInTheDocument();
		const widths = () =>
			[...document.querySelectorAll("table colgroup col")].map((col) => (col as HTMLElement).style.width);
		const before = {
			widths: widths(),
			rows: screen.getAllByRole("row").length,
			groups: screen.getAllByRole("rowgroup").length,
		};
		fireEvent.click(screen.getByRole("checkbox", { name: t("list.rowSelect", { title: "가" }) }));
		fireEvent.click(screen.getByRole("checkbox", { name: t("list.rowSelect", { title: "나" }) }));
		const bar = await screen.findByRole("toolbar");
		expect(bar.getAttribute("aria-label")).toBe(
			testSite.createTranslator((await import("../entries/bulk-bar.messages")).bulkBarMessages)("count", { count: 2 }),
		);
		// It is the head row's place, one row of the same table, and the columns keep their widths: nothing below moves.
		expect(headRow().contains(bar)).toBe(true);
		expect(headRow().querySelectorAll("tr")).toHaveLength(1);
		expect(widths()).toEqual(before.widths);
		expect({ rows: screen.getAllByRole("row").length, groups: screen.getAllByRole("rowgroup").length }).toEqual({
			rows: before.rows,
			groups: before.groups,
		});
		expect(within(headRow()).queryByRole("columnheader", { name: t("column.title"), hidden: true })).toBeNull();
		expect(screen.queryByRole("button", { name: t("column.add") })).toBeNull();
		// The select-all moved onto the bar and shows that only some are picked.
		expect(screen.getAllByRole("checkbox", { name: t("list.selectAll") })).toHaveLength(1);
		expect(
			within(bar)
				.getByRole("checkbox", { name: t("list.selectAll") })
				.getAttribute("aria-checked"),
		).toBe("mixed");
	});

	it("picks every row of the page with the select-all, and lets go with 'clear selection', which brings the column names back", async () => {
		nav.setSearch("collection=post&status=draft");
		await renderList();
		fireEvent.click(screen.getByRole("checkbox", { name: t("list.selectAll") }));
		await screen.findByRole("toolbar");
		expect(screen.getByRole("checkbox", { name: t("list.selectAll") }).getAttribute("aria-checked")).toBe("true");
		fireEvent.click(
			screen.getByRole("button", {
				name: testSite.createTranslator((await import("../entries/bulk-bar.messages")).bulkBarMessages)("clear"),
			}),
		);
		await waitFor(() => expect(screen.queryByRole("toolbar")).toBeNull());
		expect(head().getByRole("button", { name: t("column.title") })).toBeInTheDocument();
		expect(dotsIn(t("column.status"))).toBe(1);
		expect(
			head()
				.getByRole("checkbox", { name: t("list.selectAll") })
				.getAttribute("aria-checked"),
		).toBe("false");
	});

	it("has no 'ask the assistant' action yet", async () => {
		await renderList();
		fireEvent.click(screen.getByRole("checkbox", { name: t("list.selectAll") }));
		await screen.findByRole("toolbar");
		expect(screen.queryByRole("button", { name: /요청/ })).toBeNull();
	});

	it("moves the picked draft rows to the trash from the menu at once, and the list is requested again", async () => {
		await renderList();
		fireEvent.click(screen.getByRole("checkbox", { name: t("list.rowSelect", { title: "가" }) }));
		await screen.findByRole("toolbar");
		fireEvent.click(screen.getByRole("button", { name: tBulkBar("more") }));
		const rows = await screen.findAllByRole("menuitem");
		expect(rows.at(-1)?.textContent).toBe(tc("lifecycle.trash"));
		const before = listRequests().length;
		fireEvent.click(rows.at(-1) as HTMLElement);
		await waitFor(() => expect(listRequests().length).toBeGreaterThan(before));
		expect(screen.queryByRole("alertdialog")).toBeNull();
	});
});

describe("flow: change the relations of the picked rows", () => {
	const tagged = (...ids: string[]) => ({
		tagIds: ids.map((id) => ({ id, title: TAGS.find((tag) => tag.id === id)?.title ?? id })),
	});
	const bulkCalls = () => api.sent("POST /v1/bulk").map((request) => request.body);
	const pickTwo = async () => {
		server.posts = [
			item("가", { relations: tagged("t-react", "t-next") }),
			item("나", { relations: tagged("t-react") }),
			item("다"),
		];
		await renderList();
		fireEvent.click(screen.getByRole("checkbox", { name: t("list.rowSelect", { title: "가" }) }));
		fireEvent.click(screen.getByRole("checkbox", { name: t("list.rowSelect", { title: "나" }) }));
		await screen.findByRole("toolbar");
	};

	it("adds a tag some picked rows hold to all of them from 바꾸기, keeps the rows picked and the menu open, and the box turns on", async () => {
		await pickTwo();
		fireEvent.click(screen.getByRole("button", { name: tBulkBar("change") }));
		fireEvent.keyDown(await screen.findByRole("menuitem", { name: "태그" }), { key: "ArrowRight" });
		const next = await screen.findByRole("menuitemcheckbox", { name: /^넥스트/ });
		expect(next.getAttribute("aria-checked")).toBe("mixed");
		fireEvent.click(next);
		await waitFor(() => expect(bulkCalls()).toHaveLength(1));
		expect(bulkCalls()[0]).toMatchObject({ op: "relation.add", field: "tagIds", ids: ["t-next"] });
		expect(bulkCalls()[0].items).toHaveLength(2);
		await waitFor(async () =>
			expect((await screen.findByRole("menuitemcheckbox", { name: /^넥스트/ })).getAttribute("aria-checked")).toBe(
				"true",
			),
		);
		// The box and the cells say it: no toast for a tick.
		expect(toast).not.toHaveBeenCalled();
		expect(toast.error).not.toHaveBeenCalled();
		// Still picked, still open: the next tick changes the same two rows.
		expect(screen.getByRole("toolbar")).toBeInTheDocument();
		expect(screen.getAllByRole("menu").length).toBeGreaterThan(0);
	});

	it("tells it when a change of a relation fails", async () => {
		await pickTwo();
		api.on("POST /v1/bulk", () => ({
			results: [
				{ id: "가", ok: false as const, error: "conflict" },
				{ id: "나", ok: false as const, error: "conflict" },
			],
		}));
		fireEvent.click(screen.getByRole("button", { name: tBulkBar("change") }));
		fireEvent.keyDown(await screen.findByRole("menuitem", { name: "태그" }), { key: "ArrowRight" });
		fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: /^넥스트/ }));
		await waitFor(() => expect(toast.error).toHaveBeenCalled());
	});

	it("shows the fields directly in the right-click menu of several picked rows, with no 바꾸기 level", async () => {
		await pickTwo();
		fireEvent.contextMenu(screen.getByRole("row", { name: /가/ }));
		const rows = await screen.findAllByRole("menuitem");
		const labels = rows.map((entry) => entry.textContent);
		expect(labels).toContain("카테고리");
		expect(labels).toContain("태그");
		expect(labels).not.toContain("바꾸기");
		fireEvent.keyDown(rows.find((entry) => entry.textContent === "태그") as HTMLElement, { key: "ArrowRight" });
		expect((await screen.findByRole("menuitemcheckbox", { name: /^넥스트/ })).getAttribute("aria-checked")).toBe(
			"mixed",
		);
	});
});

describe("flow: page through the list", () => {
	beforeEach(() => {
		server.total = 148;
	});

	it("goes to a page by its button and to the next one by 'next'", async () => {
		await renderList();
		const pager = await screen.findByRole("navigation", { name: PAGER });
		fireEvent.click(within(pager).getByRole("link", { name: "3" }));
		await waitFor(() => expect(lastList().get("page")).toBe("3"));
		expect(nav.search.get("page")).toBe("3");
		await waitFor(() =>
			expect(
				within(screen.getByRole("navigation", { name: PAGER }))
					.getByRole("link", { name: "3" })
					.getAttribute("aria-current"),
			).toBe("page"),
		);
		fireEvent.click(within(screen.getByRole("navigation", { name: PAGER })).getByRole("link", { name: NEXT }));
		await waitFor(() => expect(lastList().get("page")).toBe("4"));
	});
});
