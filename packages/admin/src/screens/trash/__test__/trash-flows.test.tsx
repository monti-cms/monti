import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { commonMessages } from "../../../lib/common.messages";
import { jsonResponse as json } from "../../../test/fetch";
import { createTestRouter } from "../../../test/router";
import { toast } from "../../../test/ui-toast";
import { screensMessages } from "../../messages";
import { AdminQueryProvider } from "../../shared/query-provider";
import { trashMessages } from "../messages";
import { TrashScreen } from "../trash-screen";
import { TrashBackend } from "./trash-backend";
import { ago, content, entry, folder, inside, media, record, secondLocale } from "./trash-fixtures";

// One test per flow of the Trash board (flow 5 of the canvas): looking around, restoring, deleting for good, picking several, and emptying. They check what a
// screenshot cannot: the requests a press sends, where it goes, what is enabled, the names of the parts and the keys.

const nav = createTestRouter();
const { render } = nav;
vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);

const t = testSite.createTranslator(trashMessages);
const ts = testSite.createTranslator(screensMessages);
const tc = testSite.createTranslator(commonMessages);

const first = entry("first", "첫 번째 글", { slug: "first-post", locales: [testSite.DEFAULT_LOCALE, secondLocale] });
const about = entry("about", "옛 소개 글", { slug: "about-old", deletedAt: ago(7), everPublished: true });
const translation = entry("react-en", "React 19 migration", {
	isSource: false,
	locale: secondLocale,
	translationGroupId: "react",
	sourceTrashed: true,
	sourceTitle: "리액트 19 마이그레이션",
	deletedAt: ago(12),
});
const react = entry("react", "리액트 19 마이그레이션", { translationGroupId: "react", deletedAt: ago(14) });
const tag = entry("tag", "임시", { collection: record, slug: "temp", deletedAt: ago(27), usages: 4 });
const series = folder("series", "시리즈 원고");
const image = media("img", "winter-01.jpg", { path: ["Blog Assets"] });
const episode1 = inside(entry("ep1", "시리즈 1화", { slug: "series-1", everPublished: true }), "시리즈 원고");
const episode2 = inside(entry("ep2", "시리즈 2화", { slug: "series-2" }), "시리즈 원고");

let backend: TrashBackend;
let fetchMock: ReturnType<typeof vi.fn>;

const referrers = (collection: string) => [
	{ entryId: "r1", title: "첫 번째 글", collection, trashed: false },
	{ entryId: "r2", title: "발행 후 고친 글", collection, trashed: false },
	{ entryId: "r3", title: "가을 사진 정리", collection, trashed: false },
	{ entryId: "r4", title: "연습장", collection, trashed: true },
];

beforeEach(() => {
	vi.clearAllMocks();
	window.localStorage.clear();
	nav.setSearch("");
	backend = new TrashBackend([first, series, image, about, react, translation, tag], { series: [episode1, episode2] });
	backend.referrers = { tag: referrers(content) };
	fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
		const url = new URL(input, "http://localhost");
		const body = init?.body ? JSON.parse(String(init.body)) : undefined;
		const answer = backend.handle(url, init?.method ?? "GET", body);
		return answer ? json(answer.body, answer.status) : json({});
	});
	vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const renderTrash = async () => {
	render(
		<AdminQueryProvider>
			<TrashScreen />
		</AdminQueryProvider>,
	);
	await screen.findByRole("row", { name: /첫 번째 글/ });
};
/** The requests of the screen's own list (it always says the order); the rail's count asks for the first page without one. */
const listRequests = () =>
	fetchMock.mock.calls
		.map(([input]) => new URL(String(input), "http://localhost"))
		.filter((url) => url.pathname === "/api/monti/v1/trash" && url.searchParams.has("sort"));
const lastList = () => listRequests().at(-1) as URL;
const posted = (path: string) =>
	fetchMock.mock.calls
		.filter(([input, init]) => String(input).split("?")[0] === `/api/monti/v1${path}` && init?.method === "POST")
		.map(([, init]) => ((init as RequestInit).body ? JSON.parse(String((init as RequestInit).body)) : {}));
const row = (name: RegExp | string) => screen.getByRole("row", { name: new RegExp(name) });
const openMenu = async (target: HTMLElement) => {
	await act(async () => {
		fireEvent.contextMenu(target);
	});
	return screen.findAllByRole("menuitem");
};
/** The row's "more" button opens a menu with the permanent delete. */
const moreOf = (target: HTMLElement) => within(target).getByRole("button", { name: t("row.more") });

describe("flow: looking around the trash (T3)", () => {
	it("has one head row, title, kind and day, and the rail counts the units", async () => {
		await renderTrash();
		const heads = screen.getAllByRole("columnheader").map((head) => head.textContent);
		expect(heads.slice(0, 3)).toEqual([t("head.title"), t("head.kind"), t("head.deletedAt")]);
		expect(screen.queryByRole("navigation", { name: /컬렉션|Collections/ })).toBeNull();
		const badge = await screen.findByLabelText(ts("sidebar.trashBadge", { count: backend.top.length }));
		expect(badge).toBeTruthy();
	});

	it("filters by kind from the kind column: several at once, the menu stays open, a chip shows them and its × lets them go", async () => {
		await renderTrash();
		const head = screen.getByRole("columnheader", { name: t("head.kind") });
		fireEvent.click(within(head).getByRole("button", { name: t("head.kind") }));
		const mediaName = t("kind.media");
		fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: new RegExp(mediaName) }));
		await waitFor(() => expect(lastList().searchParams.getAll("kind")).toEqual(["media"]));
		await screen.findByRole("row", { name: /winter-01/ });
		expect(screen.queryByRole("row", { name: /첫 번째 글/ })).toBeNull();
		// The menu is still open: a second kind is any of the two.
		const contentName = testSite.COLLECTION_DEFINITIONS[content].label;
		fireEvent.click(screen.getByRole("menuitemcheckbox", { name: new RegExp(contentName) }));
		await waitFor(() => expect(new Set(lastList().searchParams.getAll("kind"))).toEqual(new Set(["media", content])));
		await screen.findByRole("row", { name: /첫 번째 글/ });
		fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
		const chip = await screen.findByText(new RegExp(`^${t("kind.chip", { kinds: "" })}`));
		fireEvent.click(
			within(chip.closest("[data-slot=chip]") as HTMLElement).getByRole("button", { name: t("kind.clear") }),
		);
		await waitFor(() => expect(lastList().searchParams.getAll("kind")).toEqual([]));
	});

	it("sorts by the day it was discarded, newest first, and the head switches the order", async () => {
		await renderTrash();
		const head = screen.getByRole("columnheader", { name: t("head.deletedAt") });
		expect(head.getAttribute("aria-sort")).toBe("descending");
		expect(lastList().searchParams.get("sort")).toBe("desc");
		fireEvent.click(within(head).getByRole("button", { name: t("head.deletedAt") }));
		fireEvent.click(await screen.findByRole("menuitemradio", { name: ts("sort.date.asc") }));
		await waitFor(() => expect(lastList().searchParams.get("sort")).toBe("asc"));
		await waitFor(() =>
			expect(screen.getByRole("columnheader", { name: t("head.deletedAt") }).getAttribute("aria-sort")).toBe(
				"ascending",
			),
		);
	});

	it("gives a translation whose original is in the trash its own line instead of a language", async () => {
		await renderTrash();
		expect(
			within(row(/React 19 migration/)).getByText(t("row.sourceTrashed", { title: "리액트 19 마이그레이션" })),
		).toBeTruthy();
	});

	it("opens a folder to its inside and goes back up: trail, title, folder actions, the way up, and no dates", async () => {
		await renderTrash();
		fireEvent.click(within(row(/시리즈 원고/)).getByRole("button", { name: "시리즈 원고" }));
		await screen.findByRole("row", { name: /시리즈 1화/ });
		expect(lastList().searchParams.get("folder")).toBe("series");
		expect(screen.getByRole("heading", { level: 1, name: "시리즈 원고" })).toBeTruthy();
		expect(
			within(screen.getByRole("navigation", { name: t("trail.label") })).getByRole("link", { name: t("trail.root") }),
		).toBeTruthy();
		expect(screen.getByRole("button", { name: t("folder.restore") })).toBeTruthy();
		expect(screen.getAllByRole("button", { name: tc("lifecycle.deletePermanently") }).length).toBeGreaterThan(0);
		// The rows inside carry no day of their own, and there is no kind filter.
		expect(screen.getByText(new RegExp(t("row.left", { count: 30 })))).toBeTruthy(); // the folder's own line in the head
		expect(within(row(/시리즈 1화/)).queryByText(/버림|discarded/)).toBeNull();
		fireEvent.click(
			within(screen.getByRole("columnheader", { name: t("head.kind") })).getByRole("button", { name: t("head.kind") }),
		);
		expect(screen.queryByRole("menuitemcheckbox")).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: t("folder.up") }));
		await screen.findByRole("row", { name: /첫 번째 글/ });
		expect(lastList().searchParams.has("folder")).toBe(false);
	});

	it("restores one entry from inside a folder: the request, then a toast that says the folder was made again, and 열기 goes to the editor", async () => {
		backend.onRestore = ({ items }) =>
			items.map((item) => ({ type: item.type, id: item.id, ok: true, recreated: true }));
		nav.setSearch("folder=series");
		render(
			<AdminQueryProvider>
				<TrashScreen />
			</AdminQueryProvider>,
		);
		await screen.findByRole("row", { name: /시리즈 2화/ });
		fireEvent.click(within(row(/시리즈 2화/)).getByRole("button", { name: tc("lifecycle.restore") }));
		await waitFor(() => expect(posted("/trash/restore")).toHaveLength(1));
		expect(posted("/trash/restore")[0]).toEqual({ items: [{ type: "entry", id: "ep2", expectedVersion: 3 }] });
		await waitFor(() => expect(toast).toHaveBeenCalled());
		const [message, options] = toast.mock.calls[0] as [string, { action: { label: string; onClick: () => void } }];
		expect(message).toBe(t("restore.recreatedDraft", { folder: "시리즈 원고" }));
		expect(options.action.label).toBe(t("restore.open"));
		options.action.onClick();
		expect(nav.navigate).toHaveBeenCalledWith(testSite.adminEntryEditHref("ep2"));
	});

	it("finds things inside folders too: the search is sent, the chip says it, and a result says which folder it was in", async () => {
		await renderTrash();
		fireEvent.change(screen.getByLabelText(t("search")), { target: { value: "2화" } });
		await waitFor(() => expect(lastList().searchParams.get("q")).toBe("2화"), { timeout: 3000 });
		const found = await screen.findByRole("row", { name: /시리즈 2화/ });
		expect(found.textContent).toContain(t("meta.inFolder", { path: "시리즈 원고", meta: "" }));
		expect(screen.getByRole("button", { name: t("search.clear") })).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: t("search.clear") }));
		await waitFor(() => expect(lastList().searchParams.has("q")).toBe(false));
	});

	it("opens the menu on a right click with restore and permanent delete (Del), and restore sends the request", async () => {
		await renderTrash();
		const items = await openMenu(row(/옛 소개 글/));
		expect(items.map((item) => item.textContent)).toEqual([
			tc("lifecycle.restore"),
			`${tc("lifecycle.deletePermanently")}Del`,
		]);
		fireEvent.click(items[0] as HTMLElement);
		await waitFor(() => expect(posted("/trash/restore")).toHaveLength(1));
		expect(posted("/trash/restore")[0]).toEqual({ items: [{ type: "entry", id: "about", expectedVersion: 3 }] });
	});

	it("opens a document in the editor from its title, and an item in a read-only panel named by it with what points at it", async () => {
		await renderTrash();
		const link = within(row(/옛 소개 글/)).getByRole("link", { name: "옛 소개 글" });
		expect(link.getAttribute("href")).toBe(testSite.adminEntryEditHref("about"));

		fireEvent.click(within(row(/임시/)).getByRole("button", { name: "임시" }));
		const panel = await screen.findByRole("complementary", { name: "임시" });
		expect(within(panel).getByText(t("panel.state", { left: t("row.left", { count: 3 }) }))).toBeTruthy();
		await within(panel).findByText(t("panel.pointing", { count: 4 }));
		expect(
			fetchMock.mock.calls.some(([input]) => String(input).includes("/entries/tag/relations?includeTrashed=true")),
		).toBe(true);
		const pointing = within(panel).getAllByRole("link");
		expect(pointing.map((a) => a.textContent)).toEqual(["첫 번째 글", "발행 후 고친 글", "가을 사진 정리", "연습장"]);
		expect(pointing[0]?.getAttribute("href")).toBe(testSite.adminEntryEditHref("r1"));
		// The one in the trash says so.
		expect(
			within(panel).getByText(t("panel.inTrash", { collection: testSite.COLLECTION_DEFINITIONS[content].label })),
		).toBeTruthy();
		// The foot: permanent delete on the left, restore on the right.
		const foot = within(panel).getAllByRole("button").slice(-2);
		expect(foot.map((button) => button.textContent)).toEqual([
			tc("lifecycle.deletePermanently"),
			tc("lifecycle.restore"),
		]);
		fireEvent.click(foot[1] as HTMLElement);
		await waitFor(() => expect(posted("/trash/restore")).toHaveLength(1));
		expect(posted("/trash/restore")[0]).toEqual({ items: [{ type: "entry", id: "tag", expectedVersion: 3 }] });
		// An item comes back as it was: no "draft" in the toast.
		await waitFor(() => expect(toast).toHaveBeenCalledWith(t("restore.done"), {}));
	});

	it("opens a file in the same panel, with where it is used", async () => {
		await renderTrash();
		fireEvent.click(within(row(/winter-01/)).getByRole("button", { name: "winter-01.jpg" }));
		const panel = await screen.findByRole("complementary", { name: "winter-01.jpg" });
		expect(within(panel).getByText(t("panel.usedIn"))).toBeTruthy();
		expect(within(panel).getByText(t("panel.none"))).toBeTruthy();
		expect(within(panel).getByText("Blog Assets")).toBeTruthy();
		fireEvent.click(within(panel).getByRole("button", { name: tc("lifecycle.deletePermanently") }));
		const dialog = await screen.findByRole("alertdialog");
		expect(within(dialog).getByRole("button", { name: tc("lifecycle.deletePermanently") })).toBeTruthy();
	});
});

describe("flow: restoring (T4)", () => {
	it("tells that a document is a draft again and offers to open it", async () => {
		await renderTrash();
		fireEvent.click(within(row(/옛 소개 글/)).getByRole("button", { name: tc("lifecycle.restore") }));
		await waitFor(() => expect(toast).toHaveBeenCalled());
		const [message, options] = toast.mock.calls[0] as [string, { action: { label: string; onClick: () => void } }];
		expect(message).toBe(t("restore.draft"));
		expect(options.action.label).toBe(t("restore.open"));
		options.action.onClick();
		expect(nav.navigate).toHaveBeenCalledWith(testSite.adminEntryEditHref("about"));
		// The row is gone once the list is read again.
		await waitFor(() => expect(screen.queryByRole("row", { name: /옛 소개 글/ })).toBeNull());
	});

	it("restores the original of a translation whose original is in the trash, found in the rows, and nothing else", async () => {
		await renderTrash();
		fireEvent.click(within(row(/React 19 migration/)).getByRole("button", { name: t("row.restoreOriginal") }));
		await waitFor(() => expect(posted("/trash/restore")).toHaveLength(1));
		expect(posted("/trash/restore")[0]).toEqual({ items: [{ type: "entry", id: "react", expectedVersion: 3 }] });
		await waitFor(() => expect(toast).toHaveBeenCalledWith(t("restore.draft"), expect.anything()));
	});

	it("asks the server for the original when it is not in the rows: the refused restore names it and that one is restored", async () => {
		backend.top = backend.top.filter((unit) => unit.id !== "react");
		backend.onRestore = ({ items }) =>
			items[0]?.id === "react-en"
				? [{ type: "entry", id: "react-en", ok: false, error: "source_trashed", sourceId: "react" }]
				: undefined;
		await renderTrash();
		fireEvent.click(within(row(/React 19 migration/)).getByRole("button", { name: t("row.restoreOriginal") }));
		await waitFor(() => expect(posted("/trash/restore")).toHaveLength(2));
		expect(posted("/trash/restore")[1]?.items[0]).toMatchObject({ type: "entry", id: "react" });
	});

	it("says why a restore failed", async () => {
		backend.onRestore = ({ items }) =>
			items.map((item) => ({ type: item.type, id: item.id, ok: false, error: "slug_conflict" }));
		await renderTrash();
		fireEvent.click(within(row(/옛 소개 글/)).getByRole("button", { name: tc("lifecycle.restore") }));
		await waitFor(() => expect(toast.error).toHaveBeenCalled());
		expect(String(toast.error.mock.calls[0]?.[0])).toContain("옛 소개 글");
	});
});

describe("flow: deleting for good (T5)", () => {
	it("asks first, names the kept address only for what was published, and sends the delete once confirmed", async () => {
		await renderTrash();
		fireEvent.click(moreOf(row(/옛 소개 글/)));
		fireEvent.click(await screen.findByRole("menuitem", { name: tc("lifecycle.deletePermanently") }));
		const dialog = await screen.findByRole("alertdialog", { name: t("delete.title") });
		expect(within(dialog).getByText(/\/about-old/)).toBeTruthy();
		fireEvent.click(within(dialog).getByRole("button", { name: tc("cancel") }));
		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
		expect(posted("/trash/delete")).toHaveLength(0);

		// A draft that was never published keeps no address.
		fireEvent.click(moreOf(row(/첫 번째 글/)));
		fireEvent.click(await screen.findByRole("menuitem", { name: tc("lifecycle.deletePermanently") }));
		const plain = await screen.findByRole("alertdialog", { name: t("delete.title") });
		expect(within(plain).queryByText(/\/first-post/)).toBeNull();
		fireEvent.click(within(plain).getByRole("button", { name: tc("lifecycle.deletePermanently") }));
		await waitFor(() => expect(posted("/trash/delete")).toHaveLength(1));
		expect(posted("/trash/delete")[0]).toEqual({ items: [{ type: "entry", id: "first", expectedVersion: 3 }] });
	});

	it("asks for the Delete key on a row too", async () => {
		await renderTrash();
		fireEvent.keyDown(row(/옛 소개 글/), { key: "Delete" });
		await screen.findByRole("alertdialog", { name: t("delete.title") });
	});

	it("blocks the delete while entries point at the item: unlink the ones in use, delete the ones in the trash together, and only then it is enabled", async () => {
		await renderTrash();
		fireEvent.click(moreOf(row(/임시/)));
		fireEvent.click(await screen.findByRole("menuitem", { name: tc("lifecycle.deletePermanently") }));
		const dialog = await screen.findByRole("alertdialog");
		const confirm = () => within(dialog).getByRole("button", { name: tc("lifecycle.deletePermanently") });
		await within(dialog).findByRole("button", { name: t("blocked.unlink") });
		expect(within(dialog).getByText(new RegExp(t("blocked.live", { count: 3 })))).toBeTruthy();
		expect(within(dialog).getByText(new RegExp(t("blocked.trashed", { count: 1 })))).toBeTruthy();
		expect(confirm().hasAttribute("disabled") || confirm().getAttribute("aria-disabled") === "true").toBe(true);

		fireEvent.click(within(dialog).getByRole("button", { name: t("blocked.unlink") }));
		await waitFor(() => expect(posted("/references/unlink")).toHaveLength(1));
		expect(posted("/references/unlink")[0]).toEqual({ targetIds: ["tag"] });
		// The line is done; the one in the trash is still open.
		await waitFor(() => expect(within(dialog).queryByRole("button", { name: t("blocked.unlink") })).toBeNull());
		expect(confirm().hasAttribute("disabled") || confirm().getAttribute("aria-disabled") === "true").toBe(true);

		fireEvent.click(within(dialog).getByRole("button", { name: t("blocked.together") }));
		await waitFor(() => expect(confirm().hasAttribute("disabled")).toBe(false));
		fireEvent.click(confirm());
		await waitFor(() => expect(posted("/trash/delete")).toHaveLength(1));
		// The entry in the trash goes first, so nothing points at the item when its turn comes.
		expect(posted("/trash/delete")[0].items.map((item: { id: string }) => item.id)).toEqual(["r4", "tag"]);
	});

	it("shows the blockers a refused delete names, with the same ways out", async () => {
		backend.top = backend.top.map((unit) =>
			unit.id === "tag" && unit.type === "entry" ? { ...unit, usages: 0 } : unit,
		);
		backend.onDelete = ({ items }) =>
			items.map((item) => ({
				type: item.type,
				id: item.id,
				ok: false,
				error: "in_use",
				usages: [{ entryId: "r1", title: "첫 번째 글", collection: record, trashed: false }],
			}));
		await renderTrash();
		fireEvent.click(moreOf(row(/임시/)));
		fireEvent.click(await screen.findByRole("menuitem", { name: tc("lifecycle.deletePermanently") }));
		fireEvent.click(
			await within(await screen.findByRole("alertdialog")).findByRole("button", {
				name: tc("lifecycle.deletePermanently"),
			}),
		);
		const dialog = await screen.findByRole("alertdialog");
		await within(dialog).findByRole("button", { name: t("blocked.unlink") });
	});
});

describe("flow: several at once (T6)", () => {
	const pick = (name: RegExp) => fireEvent.click(within(row(name)).getByRole("checkbox", { name: t("row.select") }));

	it("replaces the head with the count, restore and permanent delete; restore sends both and the bar goes", async () => {
		await renderTrash();
		pick(/옛 소개 글/);
		pick(/첫 번째 글/);
		const bar = await screen.findByRole("toolbar", { name: t("bulk.label") });
		expect(
			within(bar)
				.getAllByRole("button")
				.map((button) => button.textContent),
		).toEqual([tc("lifecycle.restore"), tc("lifecycle.deletePermanently"), t("bulk.clear")]);
		fireEvent.click(within(bar).getByRole("button", { name: tc("lifecycle.restore") }));
		await waitFor(() => expect(posted("/trash/restore")).toHaveLength(1));
		expect(
			posted("/trash/restore")[0]
				.items.map((item: { id: string }) => item.id)
				.sort(),
		).toEqual(["about", "first"]);
		await waitFor(() => expect(screen.queryByRole("toolbar")).toBeNull());
	});

	it("deletes the picked rows for good after asking once, and lets go of the pick", async () => {
		await renderTrash();
		pick(/옛 소개 글/);
		pick(/첫 번째 글/);
		const bar = await screen.findByRole("toolbar");
		fireEvent.click(within(bar).getByRole("button", { name: tc("lifecycle.deletePermanently") }));
		const dialog = await screen.findByRole("alertdialog");
		fireEvent.click(within(dialog).getByRole("button", { name: tc("lifecycle.deletePermanently") }));
		await waitFor(() => expect(posted("/trash/delete")).toHaveLength(1));
		expect(posted("/trash/delete")[0].items).toHaveLength(2);
	});

	it("clears the pick, and the right-click menu of a picked row acts on all the picked rows", async () => {
		await renderTrash();
		pick(/옛 소개 글/);
		pick(/첫 번째 글/);
		const items = await openMenu(row(/옛 소개 글/));
		fireEvent.click(items[0] as HTMLElement);
		await waitFor(() => expect(posted("/trash/restore")).toHaveLength(1));
		expect(posted("/trash/restore")[0].items).toHaveLength(2);
	});

	it("picks the page from the select-all", async () => {
		await renderTrash();
		fireEvent.click(screen.getByRole("checkbox", { name: t("selectAll") }));
		await screen.findByText(t("bulk.count", { count: backend.top.length }));
		fireEvent.click(screen.getByRole("button", { name: t("bulk.clear") }));
		await waitFor(() => expect(screen.queryByRole("toolbar")).toBeNull());
	});
});

describe("flow: emptying the trash (T7)", () => {
	it("asks how many go, sends the empty, tells what went and what stayed, and the kept row says why and offers the permanent delete", async () => {
		backend.top = [first, about, tag];
		await renderTrash();
		fireEvent.click(screen.getByRole("button", { name: t("emptyAction") }));
		const dialog = await screen.findByRole("alertdialog", { name: t("empty.title") });
		expect(within(dialog).getByText(t("empty.text", { count: 3 }))).toBeTruthy();
		fireEvent.click(within(dialog).getByRole("button", { name: t("empty.confirm") }));
		await waitFor(() => expect(posted("/trash/empty")).toHaveLength(1));
		await waitFor(() => expect(toast).toHaveBeenCalledWith(t("empty.doneKept", { count: 2, kept: 1 })));
		const kept = await screen.findByRole("row", { name: /임시/ });
		expect(
			within(kept).getByText(
				new RegExp(t("meta.pointed", { meta: "x", count: 4 }).replace("x", "").trim().split("·").pop()?.trim() ?? "4"),
			),
		).toBeTruthy();
		expect(within(kept).queryByRole("button", { name: tc("lifecycle.restore") })).toBeNull();
		expect(within(kept).getByRole("button", { name: tc("lifecycle.deletePermanently") })).toBeTruthy();
		expect(screen.queryByRole("row", { name: /첫 번째 글/ })).toBeNull();
	});

	it("says nothing was kept when everything went, and shows the empty trash with no actions", async () => {
		backend.top = [first, about];
		await renderTrash();
		fireEvent.click(screen.getByRole("button", { name: t("emptyAction") }));
		fireEvent.click(
			await within(await screen.findByRole("alertdialog")).findByRole("button", { name: t("empty.confirm") }),
		);
		await waitFor(() => expect(toast).toHaveBeenCalledWith(t("empty.done", { count: 2 })));
		await screen.findByText(t("emptied"));
		expect(screen.queryByRole("button", { name: t("emptyAction") })).toBeNull();
		expect(screen.queryByLabelText(t("search"))).toBeNull();
		expect(screen.queryAllByRole("columnheader")).toHaveLength(0);
	});

	it("cancelling the question sends nothing", async () => {
		await renderTrash();
		fireEvent.click(screen.getByRole("button", { name: t("emptyAction") }));
		fireEvent.click(await within(await screen.findByRole("alertdialog")).findByRole("button", { name: tc("cancel") }));
		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
		expect(posted("/trash/empty")).toHaveLength(0);
	});
});
