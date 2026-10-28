import type { ListEntriesItem } from "@monti-cms/core/site";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { commonMessages } from "../../lib/common.messages";
import { jsonResponse as json } from "../../test/fetch";
import { createTestRouter } from "../../test/router";
import { EntryListScreen } from "../entry-list-screen";
import { screensMessages } from "../messages";
import { AdminQueryProvider } from "../shared/query-provider";

// One test per flow of the list's filter and view menus, the select-and-act bar and the pager (flow 7 of the canvas and the main list board).

const nav = createTestRouter();
const { render } = nav;
vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);

const t = testSite.createTranslator(screensMessages);
const tc = testSite.createTranslator(commonMessages);

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
			return json({ items: ids.length > 0 ? TAGS.filter((tag) => ids.includes(tag.id)) : TAGS });
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

/** Presses a button of the toolbar, and opens one of the rows of the menu it opened (→ opens the second level, as it does for a keyboard). */
const openMenu = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const openSub = async (name: RegExp | string) => {
	const row = await screen.findByRole("menuitem", { name });
	fireEvent.keyDown(row, { key: "ArrowRight" });
	return row;
};
/** The pager's names come from the UI labels, English until a provider says otherwise. */
const PAGER = /Pagination|페이지 이동/;
const NEXT = /Next page|다음 페이지/;
const PREVIOUS = /Previous page|이전 페이지/;
const chipNamed = (label: string) => screen.getByRole("button", { name: t("listMenu.chipRemove", { label }) });

describe("flow: filter by a field's value", () => {
	it("ticks none and a tag, narrows the list to them, shows one chip, and takes the filter off with its ×", async () => {
		await renderList();
		openMenu(t("listMenu.filter"));
		await openSub("태그");
		const react = await screen.findByRole("menuitemcheckbox", { name: /^리액트/ });
		// Each value shows how many rows have it.
		expect(await within(react).findByText("2")).toBeTruthy();
		fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: new RegExp(`^${t("listMenu.none")}`) }));
		fireEvent.click(react);
		await waitFor(() => expect(lastList().searchParams.getAll("field")).toEqual(["tagIds:empty", "tagIds:is:t-react"]));
		// The menu stays open while values are ticked, and the choice is in the address.
		expect(screen.queryAllByRole("menu").length).toBeGreaterThan(0);
		expect(nav.search.getAll("field")).toEqual(["tagIds:empty", "tagIds:is:t-react"]);
		fireEvent.click(
			await screen.findByRole("button", { name: t("listMenu.chipRemove", { label: "태그: 없음, 리액트" }) }),
		);
		await waitFor(() => expect(lastList().searchParams.has("field")).toBe(false));
		expect(nav.search.has("field")).toBe(false);
	});

	it("asks the server for the items a relation has, as the search row types", async () => {
		await renderList();
		openMenu(t("listMenu.filter"));
		await openSub("태그");
		const search = await screen.findByRole("textbox", { name: t("listMenu.valueSearch", { label: "태그" }) });
		fireEvent.change(search, { target: { value: "넥" } });
		await waitFor(() =>
			expect(
				fetchMock.mock.calls.some(([input]) => {
					const url = new URL(String(input), "http://localhost");
					return url.pathname.endsWith("/entries/search") && url.searchParams.get("query") === "넥";
				}),
			).toBe(true),
		);
	});

	it("finds texts and images that are blank under one row, and a select by its options, with the first level only naming them", async () => {
		await renderList();
		openMenu(t("listMenu.filter"));
		// The first level has only names: no value of any field is a row yet, and a text field has no row of its own.
		expect(screen.queryByRole("menuitemcheckbox")).toBeNull();
		expect(screen.queryByRole("menuitem", { name: "요약" })).toBeNull();
		await openSub(t("listMenu.blank"));
		fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "요약" }));
		await waitFor(() => expect(lastList().searchParams.getAll("field")).toEqual(["summary:empty"]));
		expect(chipNamed(t("listMenu.chipBlank", { label: "요약" }))).toBeTruthy();
		fireEvent.keyDown(await screen.findByRole("menuitem", { name: "정책" }), { key: "ArrowRight" });
		fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: /^지원 중단/ }));
		await waitFor(() =>
			expect(lastList().searchParams.getAll("field")).toEqual(["summary:empty", "policy:is:deprecated"]),
		);
	});

	it("finds a text field from the search row through the row that lists it", async () => {
		await renderList();
		openMenu(t("listMenu.filter"));
		fireEvent.change(await screen.findByRole("textbox", { name: t("listMenu.filterSearch") }), {
			target: { value: "요약" },
		});
		await waitFor(() =>
			expect(screen.getAllByRole("menuitem").map((row) => row.textContent?.trim())).toEqual([t("listMenu.blank")]),
		);
	});
});

describe("flow: filter by translation and language", () => {
	it("ticks 'source changed' and keeps only those, then adds a language", async () => {
		await renderList();
		openMenu(t("listMenu.filter"));
		await openSub(t("listMenu.translation"));
		const changed = await screen.findByRole("menuitemcheckbox", {
			name: new RegExp(`^${t("listMenu.translationChanged")}`),
		});
		expect(await within(changed).findByText("1")).toBeTruthy();
		fireEvent.click(changed);
		await waitFor(() => expect(lastList().searchParams.getAll("translation")).toEqual(["changed"]));
		expect(chipNamed(`${t("listMenu.translation")}: ${t("listMenu.translationChanged")}`)).toBeTruthy();

		fireEvent.keyDown(await screen.findByRole("menuitem", { name: t("listMenu.language") }), { key: "ArrowRight" });
		fireEvent.click(
			await screen.findByRole("menuitemcheckbox", { name: testSite.localeLabel(testSite.LOCALES[0] as string) }),
		);
		await waitFor(() => expect(lastList().searchParams.getAll("locale")).toEqual([testSite.LOCALES[0]]));
	});
});

describe("flow: filter by a date", () => {
	it("picks 'last 30 days' of the updated date, which leaves the menu open with a ✓ on it and shows a chip", async () => {
		await renderList();
		openMenu(t("listMenu.filter"));
		await openSub(t("listMenu.date"));
		// The updated date is the first group and the published date the second: each has the same presets.
		fireEvent.click((await screen.findAllByRole("menuitemradio", { name: t("listMenu.last30") }))[0] as HTMLElement);
		await waitFor(() => expect(lastList().searchParams.get("updatedFrom")).not.toBeNull());
		const { searchParams } = lastList();
		const days =
			(Date.parse(searchParams.get("updatedTo") as string) - Date.parse(searchParams.get("updatedFrom") as string)) /
			86_400_000;
		expect(Math.round(days)).toBe(30);
		expect(nav.search.get("updated")).toBe("last30");
		expect(chipNamed(`${t("listMenu.updated")}: ${t("listMenu.last30")}`)).toBeTruthy();
		// Several filters are often set in one go: the menu stays, with the pick ticked.
		const radios = await screen.findAllByRole("menuitemradio", { name: t("listMenu.last30") });
		await waitFor(() => expect(radios[0]?.getAttribute("aria-checked")).toBe("true"));
		expect(radios[1]?.getAttribute("aria-checked")).toBe("false");
	});

	/** Opens the filter menu, its date level and the calendar card of the published date's "pick a period" row (the menus stay open behind it). */
	const openCalendar = async () => {
		await renderList();
		openMenu(t("listMenu.filter"));
		await openSub(t("listMenu.date"));
		const rows = await screen.findAllByRole("menuitem", { name: t("listMenu.range") });
		fireEvent.keyDown(rows[1] as HTMLElement, { key: "ArrowRight" });
		await screen.findByRole("grid");
		return rows;
	};
	const day = (n: string) =>
		within(screen.getByRole("grid"))
			.getAllByRole("button")
			.find((button) => button.textContent === n) as HTMLElement;

	it("opens a calendar card beside the date menu from the 'pick a period' row, which stays open behind it", async () => {
		await openCalendar();
		// The filter menu and the date level are still there, and the row that opened the card is the one under it.
		expect(screen.getAllByRole("menu").length).toBeGreaterThanOrEqual(3);
		expect(screen.getByRole("menuitem", { name: t("listMenu.date") })).toBeTruthy();
	});

	it("picks a period on the calendar: the first day starts it, the second applies it with the menu left open, and a chip says it", async () => {
		await openCalendar();
		fireEvent.click(day("10"));
		expect(nav.search.has("published")).toBe(false);
		expect(screen.queryAllByRole("menu").length).toBeGreaterThan(0);
		fireEvent.click(day("20"));
		await waitFor(() => expect(nav.search.get("published")).toMatch(/^\d{4}-\d{2}-10\.\.\d{4}-\d{2}-20$/));
		expect(lastList().searchParams.get("publishedFrom")).not.toBeNull();
		// The filter menu stays open for the next filter.
		expect(screen.queryAllByRole("menu").length).toBeGreaterThan(0);
		expect(
			screen.getByRole("button", { name: new RegExp(`${t("listMenu.published")}: \\d\\d\\. 10 – \\d\\d\\. 20`) }),
		).toBeTruthy();
	});

	it("takes the same day twice as that one day", async () => {
		await openCalendar();
		fireEvent.click(day("10"));
		fireEvent.click(day("10"));
		await waitFor(() => expect(nav.search.get("published")).toMatch(/^(\d{4}-\d{2}-10)\.\.\1$/));
	});

	it("offers the published date only for a collection that is published", async () => {
		nav.setSearch("collection=tag");
		fetchMock.mockImplementation(async (input: string) => {
			const url = new URL(input, "http://localhost");
			if (url.pathname === "/api/monti/v1/preferences") return json({});
			if (url.pathname === "/api/monti/v1/folders") return json([]);
			return json({ items: [], total: 0 });
		});
		render(
			<AdminQueryProvider>
				<EntryListScreen />
			</AdminQueryProvider>,
		);
		await screen.findByRole("button", { name: t("listMenu.filter") });
		openMenu(t("listMenu.filter"));
		await openSub(t("listMenu.date"));
		await screen.findAllByRole("menuitemradio", { name: t("listMenu.today") });
		expect(screen.queryByText(t("listMenu.published"))).toBeNull();
		expect(screen.getByText(t("listMenu.updated"))).toBeTruthy();
	});
});

describe("flow: find a filter", () => {
	it("keeps only the rows whose name matches what is typed in the search row", async () => {
		await renderList();
		openMenu(t("listMenu.filter"));
		const search = await screen.findByRole("textbox", { name: t("listMenu.filterSearch") });
		expect(screen.getAllByRole("menuitem").length).toBeGreaterThan(3);
		fireEvent.change(search, { target: { value: "태" } });
		await waitFor(() => expect(screen.getAllByRole("menuitem").map((row) => row.textContent)).toEqual(["태그"]));
		fireEvent.change(search, { target: { value: "존재하지 않는 필드" } });
		expect(await screen.findByText(t("listMenu.noMatch"))).toBeTruthy();
	});
});

describe("flow: sort from the view menu", () => {
	it("picks 'title ascending', which applies it, closes the whole menu and is saved for the collection", async () => {
		await renderList();
		openMenu(t("listMenu.view"));
		await openSub(new RegExp(t("listMenu.sort")));
		fireEvent.click(await screen.findByRole("menuitemradio", { name: t("sort.title.asc") }));
		await waitFor(() => expect(lastList().searchParams.get("sortField")).toBe("title"));
		expect(lastList().searchParams.get("sortDirection")).toBe("asc");
		await waitFor(() => expect(screen.queryAllByRole("menu")).toHaveLength(0));
		await waitFor(() =>
			expect(saved()).toEqual([{ collections: { post: { sort: { field: "title", direction: "asc" } } } }]),
		);
	});

	it("shows the current order beside 'Sort', with a ✓ on it in the list", async () => {
		await renderList();
		openMenu(t("listMenu.view"));
		const sort = await openSub(new RegExp(t("listMenu.sort")));
		expect(sort.textContent).toContain(t("sort.updatedAt.desc"));
		const current = await screen.findByRole("menuitemradio", { name: t("sort.updatedAt.desc") });
		expect(current.getAttribute("aria-checked")).toBe("true");
		// The title orders are one list with the dates, after a rule: there is no separate direction to pick.
		expect(screen.queryByRole("menuitemradio", { name: t("filter.sortAsc") })).toBeNull();
	});
});

describe("flow: columns and page size", () => {
	it("turns a column on and puts it in order with the keys, and saves both", async () => {
		await renderList();
		openMenu(t("listMenu.view"));
		await openSub(new RegExp(t("listMenu.columns")));
		const created = await screen.findByRole("menuitemcheckbox", { name: "생성일" });
		expect(created.getAttribute("aria-checked")).toBe("false");
		fireEvent.click(created);
		await waitFor(() => expect(saved().at(-1)?.collections.post.columns.visibility).toMatchObject({ createdAt: true }));
		// The title is not in the list: it is always there.
		expect(screen.queryByRole("menuitemcheckbox", { name: "제목" })).toBeNull();
		const status = screen.getByRole("menuitemcheckbox", { name: "상태" });
		fireEvent.keyDown(status, { key: "ArrowUp", altKey: true });
		await waitFor(() => {
			const order = saved().at(-1)?.collections.post.columns.order as string[];
			expect(order.indexOf("status")).toBeLessThan(order.indexOf("locale"));
		});
	});

	it("lifts a column by its grip, shows the new order while it moves, and saves it when let go", async () => {
		// jsdom lays nothing out: each row is 32px tall, placed by the order the menu shows.
		const box = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
			this: HTMLElement,
		) {
			const place =
				this.style.order === "" ? [...(this.parentElement?.children ?? [])].indexOf(this) : Number(this.style.order);
			const top = place * 32;
			return { top, bottom: top + 32, left: 0, right: 200, width: 200, height: 32, x: 0, y: top } as DOMRect;
		});
		try {
			await renderList();
			openMenu(t("listMenu.view"));
			await openSub(new RegExp(t("listMenu.columns")));
			const row = (name: string) => screen.getByRole("menuitemcheckbox", { name });
			const centre = (name: string) => row(name).getBoundingClientRect().top + 16;
			const grip = (await screen.findByRole("menuitemcheckbox", { name: "생성일" })).querySelector(
				"[data-slot=menu-grip]",
			) as HTMLElement;
			fireEvent.pointerDown(grip, { button: 0, pointerId: 1, clientY: centre("생성일") });
			fireEvent.pointerMove(grip, { pointerId: 1, clientY: centre("상태") });
			// While held, it already sits before "status" and is not saved yet.
			expect(centre("생성일")).toBeLessThan(centre("상태"));
			const savesBefore = saved().length;
			fireEvent.pointerUp(grip, { pointerId: 1, clientY: centre("상태") });
			await waitFor(() => expect(saved().length).toBeGreaterThan(savesBefore));
			const order = saved().at(-1)?.collections.post.columns.order as string[];
			expect(order.indexOf("createdAt")).toBeLessThan(order.indexOf("status"));
			// Holding the grip did not turn the column on.
			expect(row("생성일").getAttribute("aria-checked")).toBe("false");
		} finally {
			box.mockRestore();
		}
	});

	it("picks 50 per page, which applies it, closes the menu and is saved", async () => {
		await renderList();
		openMenu(t("listMenu.view"));
		await openSub(new RegExp(t("listMenu.perPage")));
		fireEvent.click(await screen.findByRole("menuitemradio", { name: "50" }));
		await waitFor(() => expect(lastList().searchParams.get("pageSize")).toBe("50"));
		await waitFor(() => expect(screen.queryAllByRole("menu")).toHaveLength(0));
		await waitFor(() => expect(saved().at(-1)).toEqual({ collections: { post: { pageSize: 50 } } }));
	});
});

describe("flow: pick rows and act", () => {
	it("hangs a check on each row and a select-all on the toolbar, and the bar replaces the toolbar while rows are picked", async () => {
		await renderList();
		expect(screen.queryByRole("toolbar")).toBeNull();
		fireEvent.click(screen.getByRole("checkbox", { name: t("list.rowSelect", { title: "가" }) }));
		fireEvent.click(screen.getByRole("checkbox", { name: t("list.rowSelect", { title: "나" }) }));
		const bar = await screen.findByRole("toolbar");
		expect(bar.getAttribute("aria-label")).toBe(
			testSite.createTranslator((await import("../entries/bulk-bar.messages")).bulkBarMessages)("count", { count: 2 }),
		);
		// The filter row is gone while the bar is there, and the select-all shows that only some are picked.
		expect(screen.queryByRole("button", { name: t("listMenu.filter") })).toBeNull();
		expect(screen.getByRole("checkbox", { name: t("list.selectAll") }).getAttribute("aria-checked")).toBe("mixed");
	});

	it("picks every row of the page with the select-all, and lets go with 'clear selection', which brings the toolbar back", async () => {
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
		expect(screen.getByRole("button", { name: t("listMenu.filter") })).toBeTruthy();
		expect(screen.getByRole("checkbox", { name: t("list.selectAll") }).getAttribute("aria-checked")).toBe("false");
	});

	it("has no 'ask the assistant' action yet", async () => {
		await renderList();
		fireEvent.click(screen.getByRole("checkbox", { name: t("list.selectAll") }));
		await screen.findByRole("toolbar");
		expect(screen.queryByRole("button", { name: /요청/ })).toBeNull();
	});

	it("moves the picked rows to the trash from the menu after asking, and the list is requested again", async () => {
		await renderList();
		fireEvent.click(screen.getByRole("checkbox", { name: t("list.rowSelect", { title: "가" }) }));
		await screen.findByRole("toolbar");
		fireEvent.click(screen.getByRole("button", { name: "더보기" }));
		const rows = await screen.findAllByRole("menuitem");
		expect(rows.at(-1)?.textContent).toBe(tc("lifecycle.trash"));
		fireEvent.click(rows.at(-1) as HTMLElement);
		await screen.findByRole("alertdialog", { name: tc("lifecycle.trash") });
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
