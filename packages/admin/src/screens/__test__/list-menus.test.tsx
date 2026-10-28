import type { ListEntriesItem } from "@monti-cms/core/site";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { commonMessages } from "../../lib/common.messages";
import { jsonResponse as json } from "../../test/fetch";
import { createTestRouter } from "../../test/router";
import { toast } from "../../test/ui-toast";
import { EntryListScreen } from "../entry-list-screen";
import { screensMessages } from "../messages";
import { statusLabels } from "../shared/entry-status";
import { AdminQueryProvider } from "../shared/query-provider";

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

const TAGS = [
	{ id: "t-react", title: "리액트", slug: "react", status: "published" },
	{ id: "t-next", title: "넥스트", slug: "next", status: "published" },
];

const server = {
	posts: [] as ListEntriesItem[],
	total: undefined as number | undefined,
	preferences: {} as Record<string, unknown>,
	counts: {} as Record<string, unknown>,
};
let fetchMock: ReturnType<typeof vi.fn>;

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
	fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
		const url = new URL(input, "http://localhost");
		const method = init?.method ?? "GET";
		if (url.pathname === "/api/monti/v1/preferences") return json(method === "GET" ? server.preferences : {});
		if (url.pathname === "/api/monti/v1/folders") return json([]);
		if (url.pathname === "/api/monti/v1/entries/counts") {
			const key = url.searchParams.get("field") ?? url.searchParams.get("facet") ?? "";
			return json(server.counts[key] ?? { total: 0, values: {} });
		}
		if (url.pathname === "/api/monti/v1/entries/search") {
			const ids = url.searchParams.getAll("id");
			const query = url.searchParams.get("query") ?? "";
			return json({
				items:
					ids.length > 0 ? TAGS.filter((tag) => ids.includes(tag.id)) : TAGS.filter((tag) => tag.title.includes(query)),
			});
		}
		if (url.pathname === "/api/monti/v1/bulk" && method === "POST") {
			const body = JSON.parse(String(init?.body)) as {
				op: string;
				field?: string;
				ids?: string[];
				items: { id: string; expectedVersion: number }[];
			};
			// The server keeps what was changed, so the list read again after it says so.
			server.posts = server.posts.map((post) => {
				if (!body.items.some((entry) => entry.id === post.id) || !body.field) return post;
				const field = body.field;
				const held = post.relations[field] ?? [];
				const named = (id: string) => ({ id, title: TAGS.find((tag) => tag.id === id)?.title ?? id });
				const next =
					body.op === "relation.add"
						? [...held, ...(body.ids ?? []).filter((id) => !held.some((value) => value.id === id)).map(named)]
						: held.filter((value) => !(body.ids ?? []).includes(value.id));
				return { ...post, relations: { ...post.relations, [field]: next } };
			});
			return json({
				results: body.items.map((entry) => ({ id: entry.id, ok: true, version: entry.expectedVersion + 1 })),
			});
		}
		if (url.pathname === "/api/monti/v1/entries" && method === "GET") {
			const items = url.searchParams.get("collection") === "post" ? server.posts : [];
			return json({ items, total: server.total ?? items.length });
		}
		throw new Error(`Unexpected fetch: ${method} ${input}`);
	});
	vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const listRequests = () =>
	fetchMock.mock.calls
		.map(([input]) => new URL(String(input), "http://localhost"))
		.filter(
			(url) =>
				url.pathname === "/api/monti/v1/entries" &&
				url.searchParams.get("collection") === "post" &&
				!url.searchParams.getAll("status").includes("trashed"),
		);
const lastList = () => listRequests().at(-1) as URL;
const saved = () =>
	fetchMock.mock.calls
		.filter(([input, init]) => String(input) === "/api/monti/v1/preferences" && init?.method === "PUT")
		.map(([, init]) => JSON.parse(String((init as RequestInit).body)));

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
/** Turns a hidden column on from the + at the end of the head row. */
const addColumn = async (label: string) => {
	fireEvent.click(head().getByRole("button", { name: t("column.add") }));
	fireEvent.click(await screen.findByRole("menuitem", { name: label }));
	await head().findByRole("button", { name: label });
};
const menuOpen = () => screen.queryAllByRole("menu").length > 0;
const menuClosed = () => waitFor(() => expect(screen.queryAllByRole("menu")).toHaveLength(0));
/** Escape closes the menu; the chips row, held still while it was open, then shows the filters that are on. */
const closeMenu = async () => {
	fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
	await menuClosed();
};
/** The pager's names come from the UI labels, English until a provider says otherwise. */
const PAGER = /Pagination|페이지 이동/;
const NEXT = /Next page|다음 페이지/;
const PREVIOUS = /Previous page|이전 페이지/;
const chipNamed = (label: string) => screen.getByRole("button", { name: t("listMenu.chipRemove", { label }) });
const dotsIn = (column: string) =>
	within(headRow()).getByRole("columnheader", { name: column, hidden: true }).querySelectorAll("[data-slot=column-dot]")
		.length;

describe("flow: the list's head", () => {
	it("names the columns, the status first and the title after it, each a button, and no month column", async () => {
		await renderList();
		await screen.findAllByRole("columnheader");
		expect(names().slice(0, 2)).toEqual([t("column.status"), t("column.title")]);
		expect(screen.queryByText("10월")).toBeNull();
		// There is no tab row, Filter or View above the list: every name is the way to its menu.
		expect(screen.queryByRole("tab")).toBeNull();
		expect(screen.queryByRole("button", { name: /^(필터|보기|Filter|View)$/ })).toBeNull();
		for (const name of head().getAllByRole("button", { name: /./ })) {
			if (name.getAttribute("aria-label") !== t("column.add")) expect(name.getAttribute("aria-haspopup")).toBe("menu");
		}
	});

	it("has no chips row while nothing is filtered, and a chip for each filter that is on", async () => {
		await renderList();
		expect(document.querySelector("[data-slot=chip-row]")).toBeNull();
		cleanup();
		nav.setSearch("collection=post&status=draft&field=summary:empty");
		await renderList();
		expect(document.querySelector("[data-slot=chip-row]")).not.toBeNull();
		expect(chipNamed(`${t("column.status")}: ${statusName("draft")}`)).toBeTruthy();
	});
});

describe("flow: sort from a column's menu", () => {
	it("picks 'ascending' on the title, which applies it, closes the menu and is saved for the collection", async () => {
		await renderList();
		openColumn(t("column.title"));
		fireEvent.click(await screen.findByRole("menuitemradio", { name: t("sort.text.asc") }));
		await waitFor(() => expect(lastList().searchParams.get("sortField")).toBe("title"));
		expect(lastList().searchParams.get("sortDirection")).toBe("asc");
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

	it("puts the ✓ on the current order of a date, newest first for the updated date, and picks the other way", async () => {
		await renderList();
		openColumn(t("column.updatedAt"));
		const newest = await screen.findByRole("menuitemradio", { name: t("sort.date.desc") });
		expect(newest.getAttribute("aria-checked")).toBe("true");
		expect(screen.getByRole("menuitemradio", { name: t("sort.date.asc") }).getAttribute("aria-checked")).toBe("false");
		fireEvent.click(screen.getByRole("menuitemradio", { name: t("sort.date.asc") }));
		await waitFor(() => expect(lastList().searchParams.get("sortDirection")).toBe("asc"));
		expect(lastList().searchParams.get("sortField")).toBe("updatedAt");
	});

	it("has sort and hide on the title's menu and nothing to filter by, and hides no title", async () => {
		await renderList();
		openColumn(t("column.title"));
		await screen.findByRole("menuitemradio", { name: t("sort.text.asc") });
		expect(screen.queryByRole("menuitemcheckbox")).toBeNull();
		expect(screen.queryByRole("menuitem", { name: t("column.hide") })).toBeNull();
	});

	it("opens a column's menu from the keyboard too, with the arrow down on its name", async () => {
		await renderList();
		fireEvent.keyDown(head().getByRole("button", { name: t("column.title") }), { key: "ArrowDown" });
		await screen.findByRole("menuitemradio", { name: t("sort.text.asc") });
	});

	it("does not sort when a name is pressed: it opens the column's menu", async () => {
		await renderList();
		const before = listRequests().length;
		openColumn(t("column.title"));
		await screen.findByRole("menu");
		expect(listRequests().length).toBe(before);
		expect(menuOpen()).toBe(true);
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

	it("hides a column from its own menu, and saves it", async () => {
		await renderList();
		openColumn(t("column.locale"));
		fireEvent.click(await screen.findByRole("menuitem", { name: t("column.hide") }));
		await waitFor(() => expect(saved().at(-1)?.collections.post.columns.visibility).toMatchObject({ locale: false }));
		await waitFor(() => expect(head().queryByRole("button", { name: t("column.locale") })).toBeNull());
		// It is offered under + now.
		fireEvent.click(head().getByRole("button", { name: t("column.add") }));
		expect(await screen.findByRole("menuitem", { name: t("column.locale") })).toBeTruthy();
	});

	it("moves a column with Alt and the arrow keys on its name, and saves the order", async () => {
		await renderList();
		fireEvent.keyDown(await head().findByRole("button", { name: t("column.title") }), {
			key: "ArrowLeft",
			altKey: true,
		});
		await waitFor(() => {
			const order = saved().at(-1)?.collections.post.columns.order as string[];
			expect(order.indexOf("title")).toBeLessThan(order.indexOf("status"));
		});
		// The keys moved the column; they opened nothing.
		expect(menuOpen()).toBe(false);
	});

	it("lifts a column's name, shows the new order in the head and the rows while it moves, and saves it when let go", async () => {
		// jsdom lays nothing out: each head cell is 100px wide, placed by its order in the row.
		const box = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
			this: HTMLElement,
		) {
			const left =
				[...(this.parentElement?.children ?? [])].filter((cell) => cell.tagName === this.tagName).indexOf(this) * 100;
			return { left, right: left + 100, top: 0, bottom: 40, width: 100, height: 40, x: left, y: 0 } as DOMRect;
		});
		try {
			await renderList();
			await screen.findAllByRole("columnheader");
			const cell = (name: string) => head().getByRole("columnheader", { name });
			const centre = (name: string) => cell(name).getBoundingClientRect().left + 50;
			const from = centre(t("column.updatedAt"));
			const to = centre(t("column.title"));
			fireEvent.pointerDown(cell(t("column.updatedAt")), { button: 0, pointerId: 1, clientX: from });
			fireEvent.pointerMove(cell(t("column.updatedAt")), { pointerId: 1, clientX: from - 10 });
			fireEvent.pointerMove(cell(t("column.updatedAt")), { pointerId: 1, clientX: to });
			// While held, the head already shows it before the title, and nothing is saved yet.
			expect(names().indexOf(t("column.updatedAt"))).toBeLessThan(names().indexOf(t("column.title")));
			const savesBefore = saved().length;
			fireEvent.pointerUp(cell(t("column.updatedAt")), { pointerId: 1, clientX: to });
			await waitFor(() => expect(saved().length).toBeGreaterThan(savesBefore));
			const order = saved().at(-1)?.collections.post.columns.order as string[];
			expect(order.indexOf("updatedAt")).toBeLessThan(order.indexOf("title"));
			// The press that ended a drag opened no menu and sorted nothing.
			expect(menuOpen()).toBe(false);
			expect(lastList().searchParams.get("sortDirection")).not.toBe("asc");
		} finally {
			box.mockRestore();
		}
	});

	it("picks 50 per page from the footer, which applies it, closes the menu and is saved", async () => {
		await renderList();
		fireEvent.click(screen.getByRole("button", { name: t("list.pageSize") }));
		fireEvent.click(await screen.findByRole("menuitemradio", { name: t("list.pageSizeOption", { size: 50 }) }));
		await waitFor(() => expect(lastList().searchParams.get("pageSize")).toBe("50"));
		await menuClosed();
		await waitFor(() => expect(saved().at(-1)).toEqual({ collections: { post: { pageSize: 50 } } }));
	});
});

describe("flow: filter by value", () => {
	it("ticks 'editing' and 'draft' on the status menu, which stays open, and the chip and the dot say it until the chip's × takes it off", async () => {
		await renderList();
		openColumn(t("column.status"));
		const editing = await screen.findByRole("menuitemcheckbox", { name: new RegExp(`^${t("filter.editing")}`) });
		// Each value shows how many rows are in it.
		expect(await within(editing).findByText("3")).toBeTruthy();
		fireEvent.click(editing);
		fireEvent.click(screen.getByRole("menuitemcheckbox", { name: new RegExp(`^${statusName("draft")}`) }));
		await waitFor(() => expect(lastList().searchParams.getAll("status")).toEqual(["editing", "draft"]));
		expect(nav.search.getAll("status")).toEqual(["editing", "draft"]);
		expect(menuOpen()).toBe(true);
		expect(dotsIn(t("column.status"))).toBe(1);
		await closeMenu();
		const chip = chipNamed(`${t("column.status")}: ${t("filter.editing")}, ${statusName("draft")}`);
		expect(dotsIn(t("column.title"))).toBe(0);
		fireEvent.click(chip.querySelector("button") ?? chip);
		await waitFor(() => expect(lastList().searchParams.has("status")).toBe(false));
		expect(dotsIn(t("column.status"))).toBe(0);
	});

	it("holds the chips row still while a column menu is open, so ticking one value after another never moves the menu, and shows the chips once it closes", async () => {
		await renderList();
		const chipRow = () => document.querySelector("[data-slot=chip-row]");
		openColumn(t("column.status"));
		fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: new RegExp(`^${statusName("draft")}`) }));
		await waitFor(() => expect(lastList().searchParams.getAll("status")).toEqual(["draft"]));
		// The filter is on, the dot and the ✓ say so, but no row has appeared above the head.
		expect(chipRow()).toBeNull();
		expect(dotsIn(t("column.status"))).toBe(1);
		const editing = screen.getByRole("menuitemcheckbox", { name: new RegExp(`^${t("filter.editing")}`) });
		fireEvent.click(editing);
		await waitFor(() => expect(lastList().searchParams.getAll("status")).toEqual(["draft", "editing"]));
		expect(chipRow()).toBeNull();
		expect(
			screen
				.getByRole("menuitemcheckbox", { name: new RegExp(`^${statusName("draft")}`) })
				.getAttribute("aria-checked"),
		).toBe("true");
		expect(
			screen
				.getByRole("menuitemcheckbox", { name: new RegExp(`^${t("filter.editing")}`) })
				.getAttribute("aria-checked"),
		).toBe("true");
		await closeMenu();
		expect(chipNamed(`${t("column.status")}: ${t("filter.editing")}, ${statusName("draft")}`)).toBeTruthy();
	});

	it("keeps the chips it had while a menu is open when the last filter is cleared from it, and drops them when it closes", async () => {
		nav.setSearch("collection=post&status=draft");
		await renderList();
		openColumn(t("column.status"));
		fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: new RegExp(`^${statusName("draft")}`) }));
		await waitFor(() => expect(lastList().searchParams.has("status")).toBe(false));
		expect(document.querySelector("[data-slot=chip-row]")).not.toBeNull();
		await closeMenu();
		await waitFor(() => expect(document.querySelector("[data-slot=chip-row]")).toBeNull());
	});

	it("ticks none and a tag on the tag menu, narrows the list to them, shows one chip and takes it off with its ×", async () => {
		await renderList();
		openColumn("태그");
		const react = await screen.findByRole("menuitemcheckbox", { name: /^리액트/ });
		expect(await within(react).findByText("2")).toBeTruthy();
		fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: new RegExp(`^${t("listMenu.none")}`) }));
		fireEvent.click(react);
		await waitFor(() => expect(lastList().searchParams.getAll("field")).toEqual(["tagIds:empty", "tagIds:is:t-react"]));
		expect(menuOpen()).toBe(true);
		expect(nav.search.getAll("field")).toEqual(["tagIds:empty", "tagIds:is:t-react"]);
		expect(dotsIn("태그")).toBe(1);
		await closeMenu();
		fireEvent.click(
			await screen.findByRole("button", { name: t("listMenu.chipRemove", { label: "태그: 없음, 리액트" }) }),
		);
		await waitFor(() => expect(lastList().searchParams.has("field")).toBe(false));
	});

	it("narrows the items of a relation to what the search row types", async () => {
		await renderList();
		openColumn("태그");
		await screen.findByRole("menuitemcheckbox", { name: /^넥스트/ });
		fireEvent.change(await screen.findByRole("textbox", { name: t("listMenu.valueSearch", { label: "태그" }) }), {
			target: { value: "넥" },
		});
		await waitFor(() => expect(screen.queryByRole("menuitemcheckbox", { name: /^리액트/ })).toBeNull());
		expect(screen.getByRole("menuitemcheckbox", { name: /^넥스트/ })).toBeTruthy();
	});

	it("ORs the values of one column and ANDs the columns: status and tag are both in the request", async () => {
		await renderList();
		openColumn(t("column.status"));
		fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: new RegExp(`^${statusName("draft")}`) }));
		await closeMenu();
		openColumn("태그");
		fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: /^리액트/ }));
		await waitFor(() => expect(lastList().searchParams.getAll("field")).toEqual(["tagIds:is:t-react"]));
		expect(lastList().searchParams.getAll("status")).toEqual(["draft"]);
		await closeMenu();
		expect(screen.getAllByRole("button", { name: /지우기|Remove/ })).toHaveLength(2);
	});

	it("sets the translation state from the language menu, under the languages, and the chip says it", async () => {
		await renderList();
		openColumn(t("column.locale"));
		const changed = await screen.findByRole("menuitemcheckbox", {
			name: new RegExp(`^${t("listMenu.translationChanged")}`),
		});
		expect(await within(changed).findByText("1")).toBeTruthy();
		fireEvent.click(changed);
		await waitFor(() => expect(lastList().searchParams.getAll("translation")).toEqual(["changed"]));
		expect(dotsIn(t("column.locale"))).toBe(1);
		fireEvent.click(
			await screen.findByRole("menuitemcheckbox", { name: testSite.localeLabel(testSite.LOCALES[0] as string) }),
		);
		await waitFor(() => expect(lastList().searchParams.getAll("locale")).toEqual([testSite.LOCALES[0]]));
		await closeMenu();
		expect(chipNamed(`${t("listMenu.translation")}: ${t("listMenu.translationChanged")}`)).toBeTruthy();
	});

	it("filters a text column by 'empty' alone, after it is turned on with +", async () => {
		await renderList();
		await addColumn("요약");
		openColumn("요약");
		const rows = await screen.findAllByRole("menuitemcheckbox");
		expect(rows.map((row) => row.textContent?.replace(/\d+$/, ""))).toEqual([t("listMenu.empty")]);
		fireEvent.click(rows[0] as HTMLElement);
		await waitFor(() => expect(lastList().searchParams.getAll("field")).toEqual(["summary:empty"]));
		expect(dotsIn("요약")).toBe(1);
		await closeMenu();
		expect(chipNamed(t("listMenu.chipEmpty", { label: "요약" }))).toBeTruthy();
	});

	it("filters a select by its options, with 'none' first", async () => {
		await renderList();
		await addColumn("정책");
		openColumn("정책");
		const rows = await screen.findAllByRole("menuitemcheckbox");
		expect(rows[0]?.textContent).toContain(t("listMenu.none"));
		fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: /^지원 중단/ }));
		await waitFor(() => expect(lastList().searchParams.getAll("field")).toEqual(["policy:is:deprecated"]));
		await closeMenu();
		expect(chipNamed("정책: 지원 중단")).toBeTruthy();
	});

	it("has nothing to filter by on the address column, only sort and hide", async () => {
		await renderList();
		await addColumn(t("column.slug"));
		openColumn(t("column.slug"));
		await screen.findByRole("menuitemradio", { name: t("sort.text.asc") });
		expect(screen.queryByRole("menuitemcheckbox")).toBeNull();
		expect(screen.getByRole("menuitem", { name: t("column.hide") })).toBeTruthy();
	});
});

describe("flow: filter by date", () => {
	it("picks 'last 30 days' on the updated date, which leaves the menu open with a ✓ on it, and shows a chip and a dot", async () => {
		await renderList();
		openColumn(t("column.updatedAt"));
		fireEvent.click(await screen.findByRole("menuitemradio", { name: t("listMenu.last30") }));
		await waitFor(() => expect(lastList().searchParams.get("updatedFrom")).not.toBeNull());
		const { searchParams } = lastList();
		const days =
			(Date.parse(searchParams.get("updatedTo") as string) - Date.parse(searchParams.get("updatedFrom") as string)) /
			86_400_000;
		expect(Math.round(days)).toBe(30);
		expect(nav.search.get("updated")).toBe("last30");
		expect(dotsIn(t("column.updatedAt"))).toBe(1);
		// The menu stays, with the pick ticked, for the next filter.
		expect(menuOpen()).toBe(true);
		const radio = await screen.findByRole("menuitemradio", { name: t("listMenu.last30") });
		await waitFor(() => expect(radio.getAttribute("aria-checked")).toBe("true"));
		expect(screen.getByRole("menuitemradio", { name: t("listMenu.today") }).getAttribute("aria-checked")).toBe("false");
		await closeMenu();
		expect(chipNamed(`${t("listMenu.updated")}: ${t("listMenu.last30")}`)).toBeTruthy();
	});

	it("filters the created date once its column is on, as it does the updated date", async () => {
		await renderList();
		await addColumn(t("column.createdAt"));
		openColumn(t("column.createdAt"));
		fireEvent.click(await screen.findByRole("menuitemradio", { name: t("listMenu.last7") }));
		await waitFor(() => expect(lastList().searchParams.get("createdFrom")).not.toBeNull());
		expect(lastList().searchParams.has("updatedFrom")).toBe(false);
		expect(nav.search.get("created")).toBe("last7");
		await closeMenu();
		expect(chipNamed(`${t("listMenu.created")}: ${t("listMenu.last7")}`)).toBeTruthy();
	});

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

	it("opens a calendar beside the date menu from the 'pick a period' row, which stays open behind it", async () => {
		await openCalendar();
		expect(screen.getAllByRole("menu").length).toBeGreaterThanOrEqual(2);
		expect(screen.getByRole("menuitem", { name: t("listMenu.range") })).toBeTruthy();
	});

	// jsdom moves focus out of the card once the days re-render, which a browser does not; that the calendar stays open is checked by the UpdatedRangeSet story.
	it("picks a period on the calendar: the first day starts it, the second sets it, and a chip says it", async () => {
		await openCalendar();
		fireEvent.click(day("10"));
		expect(nav.search.has("updated")).toBe(false);
		fireEvent.click(day("20"));
		await waitFor(() => expect(nav.search.get("updated")).toMatch(/^\d{4}-\d{2}-10\.\.\d{4}-\d{2}-20$/));
		expect(lastList().searchParams.get("updatedFrom")).not.toBeNull();
		expect(
			await screen.findByRole("button", { name: new RegExp(`${t("listMenu.updated")}: \\d\\d\\. 10 – \\d\\d\\. 20`) }),
		).toBeTruthy();
	});

	it("takes the same day twice as that one day", async () => {
		await openCalendar();
		fireEvent.click(day("10"));
		fireEvent.click(day("10"));
		await waitFor(() => expect(nav.search.get("updated")).toMatch(/^(\d{4}-\d{2}-10)\.\.\1$/));
	});
});

describe("flow: pick rows and act", () => {
	it("hangs a check on each row and a select-all on the head row, and the bar replaces the column names in the same place while rows are picked", async () => {
		nav.setSearch("collection=post&status=draft");
		await renderList();
		expect(screen.queryByRole("toolbar")).toBeNull();
		// The select-all is on the head row while nothing is picked.
		expect(head().getByRole("checkbox", { name: t("list.selectAll") })).toBeTruthy();
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
		// The chips row above stays, and the select-all moved onto the bar and shows that only some are picked.
		expect(chipNamed(`${t("column.status")}: ${statusName("draft")}`)).toBeTruthy();
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
		expect(head().getByRole("button", { name: t("column.title") })).toBeTruthy();
		expect(chipNamed(`${t("column.status")}: ${statusName("draft")}`)).toBeTruthy();
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
		fireEvent.click(screen.getByRole("button", { name: "더보기" }));
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
	const bulkCalls = () =>
		fetchMock.mock.calls
			.filter(([input, init]) => String(input) === "/api/monti/v1/bulk" && init?.method === "POST")
			.map(([, init]) => JSON.parse(String((init as RequestInit).body)));
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
		fireEvent.click(screen.getByRole("button", { name: "바꾸기" }));
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
		expect(screen.getByRole("toolbar")).toBeTruthy();
		expect(screen.getAllByRole("menu").length).toBeGreaterThan(0);
	});

	it("tells it when a change of a relation fails", async () => {
		await pickTwo();
		const before = fetchMock.getMockImplementation() as (input: string, init?: RequestInit) => Promise<unknown>;
		fetchMock.mockImplementation(async (input: string, init?: RequestInit) =>
			String(input) === "/api/monti/v1/bulk" && init?.method === "POST"
				? json({
						results: [
							{ id: "가", ok: false, error: "conflict" },
							{ id: "나", ok: false, error: "conflict" },
						],
					})
				: before(input, init),
		);
		fireEvent.click(screen.getByRole("button", { name: "바꾸기" }));
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

	it("shows the range and the page buttons, with the first page current and the way back dimmed", async () => {
		await renderList();
		const pager = await screen.findByRole("navigation", { name: PAGER });
		expect(within(pager).getByRole("link", { name: "1" }).getAttribute("aria-current")).toBe("page");
		expect(
			within(pager)
				.getAllByRole("link")
				.map((link) => link.textContent)
				.filter((text) => /^\d+$/.test(text ?? "")),
		).toEqual(["1", "2", "3", "4", "5", "6"]);
		expect(within(pager).getByRole("link", { name: PREVIOUS }).getAttribute("aria-disabled")).toBe("true");
		expect(screen.getByText("1–25 / 148")).toBeTruthy();
	});

	it("goes to a page by its button and to the next one by 'next'", async () => {
		await renderList();
		const pager = await screen.findByRole("navigation", { name: PAGER });
		fireEvent.click(within(pager).getByRole("link", { name: "3" }));
		await waitFor(() => expect(lastList().searchParams.get("page")).toBe("3"));
		expect(nav.search.get("page")).toBe("3");
		await waitFor(() =>
			expect(
				within(screen.getByRole("navigation", { name: PAGER }))
					.getByRole("link", { name: "3" })
					.getAttribute("aria-current"),
			).toBe("page"),
		);
		fireEvent.click(within(screen.getByRole("navigation", { name: PAGER })).getByRole("link", { name: NEXT }));
		await waitFor(() => expect(lastList().searchParams.get("page")).toBe("4"));
	});

	it("draws no pager when everything fits on one page", async () => {
		server.total = 3;
		await renderList();
		expect(screen.queryByRole("navigation", { name: PAGER })).toBeNull();
	});
});
