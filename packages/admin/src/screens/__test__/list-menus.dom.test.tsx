import type { ListEntriesItem, PreferencesBody } from "@monti-cms/core/site";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contentCollection, defaultLocale } from "../../../../core/test/any-site";
import { testSite } from "../../../../core/test/site";
import type { EntrySearchResponse, ListCountsResponse } from "../../api/entries";
import { type FakeApi, fakeApi } from "../../test/fake-api";
import { createTestRouter } from "../../test/router";
import { toast } from "../../test/ui-toast";
import { AdminUiLabels } from "../../ui/labels";
import { describeBulkFailure } from "../entries/bulk-bar";
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
const statusName = (status: "draft" | "published" | "archived") => statusLabels(testSite)[status];

const content = contentCollection;
/** A relation field of the collection that holds several items, which the bar and the row menu tick on and off. */
const many = (() => {
	const found = testSite
		.storedFields(content)
		.find(({ field, when }) => field.kind === "relation" && field.many === true && !when);
	if (!found) throw new Error(`${content} has no relation field that holds several items`);
	return { name: found.name, label: found.field.label };
})();

const item = (id: string, fields: Partial<ListEntriesItem> = {}): ListEntriesItem => ({
	id,
	collection: content,
	locale: defaultLocale,
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

/** The items the relation field can hold, by their titles. */
const REACT = "리액트";
const NEXT = "넥스트";
const TAGS: EntrySearchResponse["items"] = [
	{ id: "t-react", title: REACT, slug: "react", status: "published" },
	{ id: "t-next", title: NEXT, slug: "next", status: "published" },
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
	nav.setSearch(`collection=${content}`);
	server.posts = [item("가"), item("나"), item("다")];
	server.total = undefined;
	server.preferences = {};
	server.counts = {
		[many.name]: { total: 3, empty: 1, values: { "t-react": 2, "t-next": 0 } },
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
			const items = query.get("collection") === content ? server.posts : [];
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
			(request) => request.query.get("collection") === content && !request.query.getAll("status").includes("trashed"),
		);
const lastList = () => listRequests().at(-1)?.query as URLSearchParams;

const renderList = async () => {
	render(
		<AdminUiLabels>
			<AdminQueryProvider>
				<EntryListScreen />
			</AdminQueryProvider>
		</AdminUiLabels>,
	);
	await screen.findByRole("row", { name: /가/ });
};

// A menu that is open makes the page behind it inert, so the head is looked up with `hidden`.
const headRow = () => screen.getAllByRole("rowgroup", { hidden: true })[0] as HTMLElement;
const head = () => within(headRow());
/** Presses the name of a column in the head row, which opens its menu under it. */
const openColumn = (label: string) => fireEvent.click(head().getByRole("button", { name: label }));
const menuOpen = () => screen.queryAllByRole("menu").length > 0;
const menuClosed = () => waitFor(() => expect(screen.queryAllByRole("menu")).toHaveLength(0));
/** Escape closes the menu. */
const closeMenu = async () => {
	fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
	await menuClosed();
};
/** A name that starts with `text` (a count may follow it). */
const startsWith = (text: string) => (name: string) => name.startsWith(text);
/** A value of the open menu, by the start of its name (the count follows it). */
const valueBox = (label: string) => screen.getByRole("menuitemcheckbox", { name: new RegExp(`^${label}`) });

describe("flow: filter by value", () => {
	it("LIST-F2 ticks 'editing' and 'draft' on the status menu, which stays open with them ticked, until they are unticked", async () => {
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
		expect(valueBox(t("filter.editing")).getAttribute("aria-checked")).toBe("true");
		expect(valueBox(statusName("draft")).getAttribute("aria-checked")).toBe("true");
		await closeMenu();
		openColumn(t("column.status"));
		fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: new RegExp(`^${t("filter.editing")}`) }));
		fireEvent.click(screen.getByRole("menuitemcheckbox", { name: new RegExp(`^${statusName("draft")}`) }));
		await waitFor(() => expect(lastList().has("status")).toBe(false));
		expect(valueBox(t("filter.editing")).getAttribute("aria-checked")).toBe("false");
		expect(valueBox(statusName("draft")).getAttribute("aria-checked")).toBe("false");
	});

	it("LIST-F7 narrows the items of a relation to what the search row types", async () => {
		await renderList();
		openColumn(many.label);
		await screen.findByRole("menuitemcheckbox", { name: startsWith(NEXT) });
		fireEvent.change(await screen.findByRole("textbox", { name: t("listMenu.valueSearch", { label: many.label }) }), {
			target: { value: NEXT.slice(0, 1) },
		});
		await waitFor(() => expect(screen.queryByRole("menuitemcheckbox", { name: startsWith(REACT) })).toBeNull());
		expect(screen.getByRole("menuitemcheckbox", { name: startsWith(NEXT) })).toBeInTheDocument();
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
	it("LIST-F4 picks a period on the calendar: the first day starts it, the second sets it", async () => {
		await openCalendar();
		fireEvent.click(day("10"));
		expect(nav.search.has("updated")).toBe(false);
		fireEvent.click(day("20"));
		await waitFor(() => expect(nav.search.get("updated")).toMatch(/^\d{4}-\d{2}-10\.\.\d{4}-\d{2}-20$/));
		expect(lastList().get("updatedFrom")).not.toBeNull();
	});
});

describe("flow: pick rows and act", () => {
	it("LIST-C5 picks every row of the page with the select-all, and lets go with 'clear selection', which brings the column names back", async () => {
		nav.setSearch(`collection=${content}&status=draft`);
		await renderList();
		fireEvent.click(screen.getByRole("checkbox", { name: t("list.selectAll") }));
		await screen.findByRole("toolbar");
		expect(screen.getByRole("checkbox", { name: t("list.selectAll") }).getAttribute("aria-checked")).toBe("true");
		fireEvent.click(
			screen.getByRole("button", {
				name: tBulkBar("clear"),
			}),
		);
		await waitFor(() => expect(screen.queryByRole("toolbar")).toBeNull());
		expect(head().getByRole("button", { name: t("column.title") })).toBeInTheDocument();
		// Letting go of the rows keeps the filter.
		expect(nav.search.getAll("status")).toEqual(["draft"]);
		expect(
			head()
				.getByRole("checkbox", { name: t("list.selectAll") })
				.getAttribute("aria-checked"),
		).toBe("false");
	});
});

describe("flow: change the relations of the picked rows", () => {
	const tagged = (...ids: string[]) => ({
		[many.name]: ids.map((id) => ({ id, title: TAGS.find((tag) => tag.id === id)?.title ?? id })),
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

	it("LIST-C4 adds an item some picked rows hold to all of them from the change menu, keeps the rows picked and the menu open, and the box turns on", async () => {
		await pickTwo();
		fireEvent.click(screen.getByRole("button", { name: tBulkBar("change") }));
		fireEvent.keyDown(await screen.findByRole("menuitem", { name: many.label }), { key: "ArrowRight" });
		const next = await screen.findByRole("menuitemcheckbox", { name: startsWith(NEXT) });
		expect(next.getAttribute("aria-checked")).toBe("mixed");
		fireEvent.click(next);
		await waitFor(() => expect(bulkCalls()).toHaveLength(1));
		expect(bulkCalls()[0]).toMatchObject({ op: "relation.add", field: many.name, ids: ["t-next"] });
		expect(bulkCalls()[0].items).toHaveLength(2);
		await waitFor(async () =>
			expect(
				(await screen.findByRole("menuitemcheckbox", { name: startsWith(NEXT) })).getAttribute("aria-checked"),
			).toBe("true"),
		);
		// Still picked, still open: the next tick changes the same two rows.
		expect(screen.getByRole("toolbar")).toBeInTheDocument();
		expect(screen.getAllByRole("menu").length).toBeGreaterThan(0);
	});

	it("LIST-C2 tells it when a change of a relation fails", async () => {
		await pickTwo();
		api.on("POST /v1/bulk", () => ({
			results: [
				{ id: "가", ok: false as const, error: "conflict" },
				{ id: "나", ok: false as const, error: "conflict" },
			],
		}));
		fireEvent.click(screen.getByRole("button", { name: tBulkBar("change") }));
		fireEvent.keyDown(await screen.findByRole("menuitem", { name: many.label }), { key: "ArrowRight" });
		fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: startsWith(NEXT) }));
		const reason = describeBulkFailure(testSite, { id: "가", ok: false, error: "conflict" });
		await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining(reason)));
	});

	it("LIST-C4 opens a field from the right-click menu of several picked rows, with what the picked rows hold", async () => {
		await pickTwo();
		fireEvent.contextMenu(screen.getByRole("row", { name: /가/ }));
		fireEvent.keyDown(await screen.findByRole("menuitem", { name: many.label }), { key: "ArrowRight" });
		expect((await screen.findByRole("menuitemcheckbox", { name: startsWith(NEXT) })).getAttribute("aria-checked")).toBe(
			"mixed",
		);
	});
});
