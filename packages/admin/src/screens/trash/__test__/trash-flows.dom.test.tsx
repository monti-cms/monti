import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { commonMessages } from "../../../lib/common.messages";
import { type FakeApi, fakeApi } from "../../../test/fake-api";
import { createTestRouter } from "../../../test/router";
import { toast } from "../../../test/ui-toast";
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
const tc = testSite.createTranslator(commonMessages);

const first = entry("first", "첫 번째 글", { slug: "first-post", locales: [testSite.DEFAULT_LOCALE, secondLocale] });
const ABOUT = "옛 소개 글";
const about = entry("about", ABOUT, { slug: "about-old", deletedAt: ago(7), everPublished: true });
const translation = entry("react-en", "React 19 migration", {
	isSource: false,
	locale: secondLocale,
	translationGroupId: "react",
	sourceTrashed: true,
	sourceTitle: "리액트 19 마이그레이션",
	deletedAt: ago(12),
});
const react = entry("react", "리액트 19 마이그레이션", { translationGroupId: "react", deletedAt: ago(14) });
/** An item that entries point at. */
const POINTED = "임시";
const tag = entry("pointed", POINTED, { collection: record, slug: "temp", deletedAt: ago(27), usages: 4 });
const series = folder("drafts", "시리즈 원고");
const image = media("img", "winter-01.jpg", { path: ["Blog Assets"] });
const episode1 = inside(entry("ep1", "시리즈 1화", { slug: "series-1", everPublished: true }), "시리즈 원고");
const episode2 = inside(entry("ep2", "시리즈 2화", { slug: "series-2" }), "시리즈 원고");

let backend: TrashBackend;
let api: FakeApi;

/** The titles of the four entries pointing at the item: three in use, the last in the trash. */
const pointingTitles = ["첫 번째 글", "발행 후 고친 글", "가을 사진 정리", "연습장"] as const;
const referrers = (collection: string) =>
	pointingTitles.map((title, i) => ({ entryId: `r${i + 1}`, title, collection, trashed: i === 3 }));

beforeEach(() => {
	vi.clearAllMocks();
	window.localStorage.clear();
	nav.setSearch("");
	backend = new TrashBackend([first, series, image, about, react, translation, tag], {
		[series.id]: [episode1, episode2],
	});
	backend.referrers = { [tag.id]: referrers(content) };
	api = backend
		.mount(fakeApi())
		// The rail's count of failed deliveries.
		.on("GET /v1/events", () => ({
			items: [],
			total: 0,
			counts: { pending: 0, delivering: 0, delivered: 0, failed: 0, dead: 0, dismissed: 0 },
		}))
		.install();
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
const listRequests = () => api.sent("GET /v1/trash").filter((request) => request.query.has("sort"));
const lastList = () => listRequests().at(-1)?.query as URLSearchParams;
const posted = (path: `/${string}`) => api.sent(`POST /v1${path}`).map((request) => request.body ?? {});
const row = (name: RegExp | string) => screen.getByRole("row", { name: new RegExp(name) });
/** Whether `text` says how many days are left (the trash keeps things 30 days). */
const saysDaysLeft = (text: string) =>
	Array.from({ length: 31 }, (_, count) => t("row.left", { count })).some((line) => text.includes(line));
/** A toast that carries an action with this label. */
const withAction = (label: string) => expect.objectContaining({ action: expect.objectContaining({ label }) });
/** The row's "more" button opens a menu with the permanent delete. */
const moreOf = (target: HTMLElement) => within(target).getByRole("button", { name: t("row.more") });

describe("flow: looking around the trash (T3)", () => {
	it("TRASH-B1 opens a folder to its inside and goes back up: trail, title, folder actions, the way up, and no dates", async () => {
		await renderTrash();
		fireEvent.click(within(row(/시리즈 원고/)).getByRole("button", { name: series.name }));
		await screen.findByRole("row", { name: /시리즈 1화/ });
		expect(lastList().get("folder")).toBe(series.id);
		expect(screen.getByRole("heading", { level: 1, name: series.name })).toBeInTheDocument();
		expect(
			within(screen.getByRole("navigation", { name: t("trail.label") })).getByRole("link", { name: t("trail.root") }),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: t("folder.restore") })).toBeInTheDocument();
		expect(screen.getAllByRole("button", { name: tc("lifecycle.deletePermanently") }).length).toBeGreaterThan(0);
		// The rows inside carry no day of their own, and there is no kind filter.
		expect(screen.getByText(new RegExp(t("row.left", { count: 30 })))).toBeInTheDocument(); // the folder's own line in the head
		expect(saysDaysLeft(row(/시리즈 1화/).textContent ?? "")).toBe(false);
		fireEvent.click(
			within(screen.getByRole("columnheader", { name: t("head.kind") })).getByRole("button", { name: t("head.kind") }),
		);
		expect(screen.queryByRole("menuitemcheckbox")).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: t("folder.up") }));
		await screen.findByRole("row", { name: /첫 번째 글/ });
		expect(lastList().has("folder")).toBe(false);
	});

	it("TRASH-R5 restores one entry from inside a folder: the request, then a toast that says the folder was made again, and 열기 goes to the editor", async () => {
		backend.onRestore = ({ items }) =>
			items.map((item) => ({ type: item.type, id: item.id, ok: true, recreated: true }));
		nav.setSearch(`folder=${series.id}`);
		render(
			<AdminQueryProvider>
				<TrashScreen />
			</AdminQueryProvider>,
		);
		await screen.findByRole("row", { name: /시리즈 2화/ });
		fireEvent.click(within(row(/시리즈 2화/)).getByRole("button", { name: tc("lifecycle.restore") }));
		await waitFor(() => expect(posted("/trash/restore")).toHaveLength(1));
		expect(posted("/trash/restore")[0]).toEqual({ items: [{ type: "entry", id: "ep2", expectedVersion: 3 }] });
		const recreated = t("restore.recreatedDraft", { folder: "시리즈 원고" });
		await waitFor(() => expect(toast).toHaveBeenCalledWith(recreated, withAction(t("restore.open"))));
		const [, options] = toast.mock.calls.find(([message]) => message === recreated) as [
			string,
			{ action: { onClick: () => void } },
		];
		options.action.onClick();
		expect(nav.navigate).toHaveBeenCalledWith(testSite.adminEntryEditHref("ep2"));
	});

	it("TRASH-B1 finds things inside folders too: the search is sent, it is not also a chip, and a result says which folder it was in", async () => {
		await renderTrash();
		fireEvent.click(screen.getByRole("button", { name: t("search") }));
		const box = screen.getByRole("searchbox", { name: t("search") });
		fireEvent.change(box, { target: { value: "2화" } });
		await waitFor(() => expect(lastList().get("q")).toBe("2화"));
		const found = await screen.findByRole("row", { name: /시리즈 2화/ });
		expect(found.textContent).toContain(t("meta.inFolder", { path: "시리즈 원고" }));
		// The words searched for show nowhere but in the result (the box holds them as its value).
		expect(screen.getAllByText(/2화/).every((element) => found.contains(element))).toBe(true);
		fireEvent.change(box, { target: { value: "" } });
		await waitFor(() => expect(lastList().has("q")).toBe(false));
	});

	it("TRASH-B1 opens a document in the editor from its title, and an item in a read-only panel named by it with what points at it", async () => {
		await renderTrash();
		const link = within(row(/옛 소개 글/)).getByRole("link", { name: ABOUT });
		expect(link.getAttribute("href")).toBe(testSite.adminEntryEditHref("about"));

		fireEvent.click(within(row(/임시/)).getByRole("button", { name: POINTED }));
		const panel = await screen.findByRole("complementary", { name: POINTED });
		expect(within(panel).getByText(t("panel.state", { left: t("row.left", { count: 3 }) }))).toBeInTheDocument();
		await within(panel).findByText(t("panel.pointing", { count: 4 }));
		expect(
			api
				.sent("GET /v1/entries/:id/relations")
				.some((request) => request.params.id === tag.id && request.query.get("includeTrashed") === "true"),
		).toBe(true);
		const pointing = within(panel).getAllByRole("link");
		expect(pointing.map((a) => a.textContent).sort()).toEqual([...pointingTitles].sort());
		expect(within(panel).getByRole("link", { name: pointingTitles[0] }).getAttribute("href")).toBe(
			testSite.adminEntryEditHref("r1"),
		);
		// The one in the trash says so.
		expect(
			within(panel).getByText(t("panel.inTrash", { collection: testSite.COLLECTION_DEFINITIONS[content].label })),
		).toBeInTheDocument();
		// The foot: permanent delete and restore.
		expect(within(panel).getByRole("button", { name: tc("lifecycle.deletePermanently") })).toBeInTheDocument();
		fireEvent.click(within(panel).getByRole("button", { name: tc("lifecycle.restore") }));
		await waitFor(() => expect(posted("/trash/restore")).toHaveLength(1));
		expect(posted("/trash/restore")[0]).toEqual({ items: [{ type: "entry", id: tag.id, expectedVersion: 3 }] });
		// An item comes back as it was: no "draft" in the toast.
		await waitFor(() => expect(toast).toHaveBeenCalledWith(t("restore.done"), {}));
	});
});

describe("flow: restoring (T4)", () => {
	it("TRASH-R1 restores a document from its row, and the row is gone once the list is read again", async () => {
		await renderTrash();
		fireEvent.click(within(row(/옛 소개 글/)).getByRole("button", { name: tc("lifecycle.restore") }));
		await waitFor(() => expect(screen.queryByRole("row", { name: /옛 소개 글/ })).toBeNull());
	});

	it("TRASH-R3 restores the original of a translation whose original is in the trash, found in the rows, and nothing else", async () => {
		await renderTrash();
		fireEvent.click(within(row(/React 19 migration/)).getByRole("button", { name: t("row.restoreOriginal") }));
		await waitFor(() => expect(posted("/trash/restore")).toHaveLength(1));
		expect(posted("/trash/restore")[0]).toEqual({ items: [{ type: "entry", id: "react", expectedVersion: 3 }] });
		await waitFor(() => expect(toast).toHaveBeenCalledWith(t("restore.draft"), expect.anything()));
	});

	it("TRASH-R3 asks the server for the original when it is not in the rows: the refused restore names it and that one is restored", async () => {
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

	it("TRASH-R8 says why a restore failed", async () => {
		backend.onRestore = ({ items }) =>
			items.map((item) => ({ type: item.type, id: item.id, ok: false, error: "slug_conflict" }));
		await renderTrash();
		fireEvent.click(within(row(/옛 소개 글/)).getByRole("button", { name: tc("lifecycle.restore") }));
		await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("옛 소개 글")));
	});
});

describe("flow: deleting for good (T5)", () => {
	it("TRASH-D10 asks first, names the kept address of what was published, and sends the delete once confirmed", async () => {
		await renderTrash();
		fireEvent.click(moreOf(row(/옛 소개 글/)));
		fireEvent.click(await screen.findByRole("menuitem", { name: tc("lifecycle.deletePermanently") }));
		const dialog = await screen.findByRole("alertdialog", { name: t("delete.title") });
		expect(within(dialog).getByText(/\/about-old/)).toBeInTheDocument();
		fireEvent.click(within(dialog).getByRole("button", { name: tc("cancel") }));
		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
		expect(posted("/trash/delete")).toHaveLength(0);

		fireEvent.click(moreOf(row(/첫 번째 글/)));
		fireEvent.click(await screen.findByRole("menuitem", { name: tc("lifecycle.deletePermanently") }));
		const plain = await screen.findByRole("alertdialog", { name: t("delete.title") });
		fireEvent.click(within(plain).getByRole("button", { name: tc("lifecycle.deletePermanently") }));
		await waitFor(() => expect(posted("/trash/delete")).toHaveLength(1));
		expect(posted("/trash/delete")[0]).toEqual({ items: [{ type: "entry", id: "first", expectedVersion: 3 }] });
	});

	it("TRASH-D2 blocks the delete while entries point at the item: unlink the ones in use, delete the ones in the trash together, and only then it is enabled", async () => {
		await renderTrash();
		fireEvent.click(moreOf(row(/임시/)));
		fireEvent.click(await screen.findByRole("menuitem", { name: tc("lifecycle.deletePermanently") }));
		const dialog = await screen.findByRole("alertdialog");
		const confirm = () => within(dialog).getByRole("button", { name: tc("lifecycle.deletePermanently") });
		await within(dialog).findByRole("button", { name: t("blocked.unlink") });
		expect(within(dialog).getByText(new RegExp(t("blocked.live", { count: 3 })))).toBeInTheDocument();
		expect(within(dialog).getByText(new RegExp(t("blocked.trashed", { count: 1 })))).toBeInTheDocument();
		expect(confirm().hasAttribute("disabled") || confirm().getAttribute("aria-disabled") === "true").toBe(true);

		fireEvent.click(within(dialog).getByRole("button", { name: t("blocked.unlink") }));
		await waitFor(() => expect(posted("/references/unlink")).toHaveLength(1));
		expect(posted("/references/unlink")[0]).toEqual({ targetIds: [tag.id] });
		// The line is done; the one in the trash is still open.
		await waitFor(() => expect(within(dialog).queryByRole("button", { name: t("blocked.unlink") })).toBeNull());

		fireEvent.click(within(dialog).getByRole("button", { name: t("blocked.together") }));
		await waitFor(() => expect(confirm().hasAttribute("disabled")).toBe(false));
		fireEvent.click(confirm());
		await waitFor(() => expect(posted("/trash/delete")).toHaveLength(1));
		// The entry in the trash goes first, so nothing points at the item when its turn comes.
		expect(posted("/trash/delete")[0].items.map((item: { id: string }) => item.id)).toEqual(["r4", tag.id]);
	});

	it("TRASH-D2 shows the blockers a refused delete names, with the same ways out", async () => {
		backend.top = backend.top.map((unit) =>
			unit.id === tag.id && unit.type === "entry" ? { ...unit, usages: 0 } : unit,
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

	it("TRASH-B4 replaces the head with the count, restore and permanent delete; restore sends both and the bar goes", async () => {
		await renderTrash();
		pick(/옛 소개 글/);
		pick(/첫 번째 글/);
		const bar = await screen.findByRole("toolbar", { name: t("bulk.label") });
		expect(
			within(bar)
				.getAllByRole("button")
				.map((button) => button.textContent)
				.sort(),
		).toEqual([tc("lifecycle.restore"), tc("lifecycle.deletePermanently"), t("bulk.clear")].sort());
		fireEvent.click(within(bar).getByRole("button", { name: tc("lifecycle.restore") }));
		await waitFor(() => expect(posted("/trash/restore")).toHaveLength(1));
		expect(
			posted("/trash/restore")[0]
				.items.map((item: { id: string }) => item.id)
				.sort(),
		).toEqual(["about", "first"]);
		await waitFor(() => expect(screen.queryByRole("toolbar")).toBeNull());
	});

	it("TRASH-D10 deletes the picked rows for good after asking once, and lets go of the pick", async () => {
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
});

describe("flow: emptying the trash (T7)", () => {
	it("TRASH-E5 asks how many go, sends the empty, tells what went and what stayed, and the kept row offers the permanent delete", async () => {
		backend.top = [first, about, tag];
		await renderTrash();
		fireEvent.click(screen.getByRole("button", { name: t("emptyAction") }));
		const dialog = await screen.findByRole("alertdialog", { name: t("empty.title") });
		expect(within(dialog).getByText(t("empty.text", { count: 3 }))).toBeInTheDocument();
		fireEvent.click(within(dialog).getByRole("button", { name: t("empty.confirm") }));
		await waitFor(() => expect(posted("/trash/empty")).toHaveLength(1));
		await waitFor(() => expect(toast).toHaveBeenCalledWith(t("empty.doneKept", { count: 2, kept: 1 })));
		const kept = await screen.findByRole("row", { name: /임시/ });
		expect(within(kept).getByRole("button", { name: tc("lifecycle.deletePermanently") })).toBeInTheDocument();
		expect(screen.queryByRole("row", { name: /첫 번째 글/ })).toBeNull();
	});

	it("TRASH-E5 says nothing was kept when everything went, and shows the empty trash with no actions", async () => {
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

	it("TRASH-E5 cancelling the question sends nothing", async () => {
		await renderTrash();
		fireEvent.click(screen.getByRole("button", { name: t("emptyAction") }));
		fireEvent.click(await within(await screen.findByRole("alertdialog")).findByRole("button", { name: tc("cancel") }));
		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
		expect(posted("/trash/empty")).toHaveLength(0);
	});
});
