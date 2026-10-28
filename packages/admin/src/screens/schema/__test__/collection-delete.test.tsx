import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { commonMessages } from "../../../lib/common.messages";
import { jsonResponse as json } from "../../../test/fetch";
import { createTestRouter } from "../../../test/router";
import { toast } from "../../../test/ui-toast";
import { exportMessages } from "../../export/messages";
import { AdminQueryProvider } from "../../shared/query-provider";
import { schemaCollectionMessages } from "../collection.messages";
import { schemaMessages } from "../messages";
import { schemaReviewMessages } from "../review.messages";
import { SchemaSettings } from "../schema-screen";

// Flow 4 of the canvas, steps 15 to 19: deleting a collection with its entries. One walk through it checks what a screenshot cannot see: the list, the
// count and the menu of changes, the toast, the requests and which buttons are enabled. How it looks is the visual stories' job.

const nav = createTestRouter();
const { render } = nav;
const t = testSite.createTranslator(schemaMessages);
const tCollection = testSite.createTranslator(schemaCollectionMessages);
const tReview = testSite.createTranslator(schemaReviewMessages);
const tc = testSite.createTranslator(commonMessages);
const tExport = testSite.createTranslator(exportMessages);

vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);
const reload = vi.hoisted(() => ({ reloadPage: vi.fn(), rememberSaved: vi.fn(), takeSavedMessage: vi.fn(() => null) }));
vi.mock("../reload", () => reload);

const field = (label: string) => ({ kind: "text", label });
const collection = (label: string) => ({
	label,
	kind: "document",
	path: `/${label.toLowerCase()}s/:slug`,
	fields: { title: { ...field("Title"), required: true }, slug: { kind: "slug", label: "Address", from: "title" } },
});

const state = {
	access: { writable: true },
	file: "monti.schema.ts",
	hash: "hash-1",
	schema: {
		collections: { post: collection("Post"), memo: collection("Memo") },
		locales: [{ code: "en", name: "English" }],
		defaultLocale: "en",
	},
	source: "file",
	comments: false,
	issues: [],
	applied: { appliedAt: "2026-01-01T00:00:00.000Z" },
	codeCollections: [],
	vocabulary: { blocks: [], marks: [] },
	collections: ["post", "memo"],
	footprints: { post: { entries: 148, trashed: 0, folders: 3 }, memo: { entries: 23, trashed: 2, folders: 2 } },
	siteUrl: { url: null, from: "none" },
};

const KEY = "collection_removed:memo";
const removal = {
	change: { kind: "collection_removed", collection: "memo", handledBy: "drop-memo" },
	key: KEY,
	entries: 23,
	sample: [],
	consequence: "deleted",
	checked: true,
	drop: {
		entries: 23,
		trashed: 2,
		translations: 0,
		folders: 2,
		addresses: 31,
		unlinked: {
			count: 4,
			sample: [{ id: "e-1", title: "First post", collection: "post", locale: "en", status: "published" }],
		},
		bodyLinks: 2,
	},
};

let requests: { method: string; url: string; body?: Record<string, unknown> }[];

beforeEach(() => {
	vi.clearAllMocks();
	window.history.replaceState(null, "", "/admin/settings/collections?collection=memo");
	requests = [];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: string, init?: RequestInit) => {
			const method = init?.method ?? "GET";
			const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
			requests.push({ method, url: input, body });
			if (input === "/api/monti/v1/schema" && method === "GET") return json(state);
			if (input === "/api/monti/v1/schema/preview")
				return json({
					valid: true,
					issues: [],
					changed: true,
					impacts: [removal],
					decisions: [],
					transforms: [{ id: "drop-memo", op: "dropCollection", collection: "memo" }],
					problems: [],
					baseline: "applied",
					bodiesRead: 0,
				});
			if (input === "/api/monti/v1/schema" && method === "PUT") {
				return json({
					saved: true,
					file: "monti.schema.ts",
					hash: "hash-2",
					transforms: [{ id: "drop-memo", op: "dropCollection", collection: "memo" }],
					entriesRewritten: 0,
					reloaded: true,
					conflicts: 0,
					dropped: [{ collection: "memo", entries: 23, trashed: 2, translations: 0, folders: 2, addresses: 31 }],
				});
			}
			throw new Error(`Unexpected fetch ${method} ${input}`);
		}),
	);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const lastPreview = () => requests.filter((request) => request.url.endsWith("/preview")).at(-1);
const inList = (name: string) => screen.queryByTestId(`collection-nav-${name}`) !== null;
const toastUndo = () =>
	(toast.mock.calls.at(-1) as [string, { action: { label: string; onClick: () => void } }])[1].action;

const open = () =>
	render(
		<AdminQueryProvider>
			<SchemaSettings tab="collections" />
		</AdminQueryProvider>,
	);

/** Presses the delete button in the block of the open collection. */
const pressDelete = async () => {
	const block = await screen.findByTestId("collection-delete");
	fireEvent.click(within(block).getByRole("button", { name: tCollection("collection.delete") }));
	return block;
};

describe("deleting a collection with its entries (flow 4, steps 15-19)", () => {
	it("takes it out of the list at once, brings it back from the changes menu or the toast, reviews what goes and deletes", async () => {
		open();

		// 15: the block at the bottom of the basics tab, with what the collection holds.
		const block = await screen.findByTestId("collection-delete");
		expect(block.textContent).toContain(
			tCollection("collection.count", { entries: 23, trashed: 2, folders: 2, kind: "document" }),
		);
		expect(inList("memo")).toBe(true);
		expect(screen.queryByTestId("save-bar")).toBeNull();

		// 16: pressed, the collection leaves the list at once and the editor shows the first one left; the changes count goes up.
		await pressDelete();
		expect(inList("memo")).toBe(false);
		expect(inList("post")).toBe(true);
		expect(screen.getByTestId("collection-nav-post").querySelector("[aria-current]")).not.toBeNull();
		expect(within(screen.getByTestId("collection-delete")).getByText("Post")).toBeTruthy();
		const bar = screen.getByTestId("save-bar");
		expect(within(bar).getByLabelText(t("bar.count", { count: 1 }))).toBeTruthy();

		// The toast says so and takes it back.
		expect(toast).toHaveBeenCalledTimes(1);
		const [message] = toast.mock.calls[0] as [string];
		expect(message).toBe(tCollection("collection.deleted", { name: "Memo" }));
		expect(toastUndo().label).toBe(tCollection("collection.deleteUndo"));

		// The menu of changes lists the collection with its tag, and its undo brings it back: nothing to save any more.
		fireEvent.click(within(bar).getByRole("button", { name: t("bar.list") }));
		const row = await screen.findByRole("menuitem", { name: new RegExp(`^Memo ${t("bar.removed")}`) });
		expect(row.textContent).toContain(t("bar.undo"));
		fireEvent.click(row);
		await waitFor(() => expect(inList("memo")).toBe(true));
		expect(screen.queryByTestId("save-bar")).toBeNull();

		// The toast's undo does the same.
		await pressDelete();
		expect(inList("memo")).toBe(false);
		toastUndo().onClick();
		await waitFor(() => expect(inList("memo")).toBe(true));
		expect(screen.queryByTestId("save-bar")).toBeNull();

		// 17: deleted again, saved: the review names what goes and what is cut, and it is sent without the collection.
		await pressDelete();
		fireEvent.click(within(screen.getByTestId("save-bar")).getByRole("button", { name: t("bar.save") }));
		const sheet = await screen.findByRole("dialog");
		const change = await within(sheet).findByTestId(`impact-${KEY}`);
		expect(lastPreview()?.body?.dropCollections).toEqual(["memo"]);
		expect(Object.keys((lastPreview()?.body?.schema as { collections: object }).collections)).toEqual(["post"]);
		// Nothing to resolve first: no button that cuts the links, no identifier to type, and the apply is on from the start.
		expect(within(sheet).queryByRole("button", { name: /연결 끊기|Unlink/ })).toBeNull();
		expect(within(sheet).queryByRole("textbox")).toBeNull();
		const apply = within(sheet).getByRole("button", { name: tReview("drop.apply") }) as HTMLButtonElement;
		expect(apply.disabled).toBe(false);
		// The links that point in are plain text with a link to the first entry; the copy to take first is the existing collection export.
		expect(change.textContent).toContain(tReview("drop.pointing", { count: 4 }));
		expect(change.textContent).toContain(tReview("drop.pointing.then"));
		fireEvent.click(within(change).getByRole("button", { name: tReview("drop.export") }));
		expect(
			await screen.findByRole("dialog", { name: tExport("dialog.title.collection", { noun: "Memo" }) }),
		).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: tExport("action.cancel") }));
		await waitFor(() =>
			expect(screen.queryByRole("dialog", { name: tExport("dialog.title.collection", { noun: "Memo" }) })).toBeNull(),
		);

		// 19: applied, the save names the collection to delete and the reviewed change; the page reloads with the toast that says what went.
		fireEvent.click(apply);
		await waitFor(() => expect(reload.reloadPage).toHaveBeenCalled());
		const put = requests.find((request) => request.method === "PUT");
		expect(put?.body).toMatchObject({ baseHash: "hash-1", dropCollections: ["memo"], acknowledged: [KEY] });
		expect(Object.keys((put?.body?.schema as { collections: object }).collections)).toEqual(["post"]);
		expect(reload.rememberSaved).toHaveBeenCalledWith(
			tCollection("save.dropped", { name: "Memo", count: 23, kind: "document" }),
		);
		// Nothing but the schema was sent: the links are cut by the apply, not by a request of the screen.
		expect(requests.some((request) => request.url.includes("/references/"))).toBe(false);
	});

	it("leaves the review without deleting anything: Cancel keeps the collection out of the list, and nothing is sent", async () => {
		open();
		await pressDelete();
		fireEvent.click(within(screen.getByTestId("save-bar")).getByRole("button", { name: t("bar.save") }));
		const sheet = await screen.findByRole("dialog");
		await within(sheet).findByTestId(`impact-${KEY}`);
		fireEvent.click(within(sheet).getByRole("button", { name: tc("cancel") }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(requests.some((request) => request.method === "PUT")).toBe(false);
		expect(inList("memo")).toBe(false);
	});
});
