import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { commonMessages } from "../../../lib/common.messages";
import { jsonResponse as json } from "../../../test/fetch";
import { createTestRouter } from "../../../test/router";
import { AdminQueryProvider } from "../../shared/query-provider";
import { schemaCollectionMessages } from "../collection.messages";
import { schemaMessages } from "../messages";
import { schemaReviewMessages } from "../review.messages";
import { SchemaSettings } from "../schema-screen";

// Flow 4 of the canvas, steps 15 to 19: deleting a collection with its entries. One walk through it checks what a screenshot cannot see: the requests, which
// buttons are enabled, the names of what is pressed and where the focus stays. How it looks is the visual stories' job.

const nav = createTestRouter();
const { render } = nav;
const t = testSite.createTranslator(schemaMessages);
const tCollection = testSite.createTranslator(schemaCollectionMessages);
const tReview = testSite.createTranslator(schemaReviewMessages);
const tc = testSite.createTranslator(commonMessages);

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
const removal = (blockers: number) => ({
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
			count: blockers,
			sample: blockers
				? [{ id: "e-1", title: "First post", collection: "post", locale: "en", status: "published" }]
				: [],
		},
		bodyLinks: 2,
	},
});

let blockers: number;
let requests: { method: string; url: string; body?: Record<string, unknown> }[];

beforeEach(() => {
	vi.clearAllMocks();
	window.history.replaceState(null, "", "/admin/settings/collections?collection=memo");
	blockers = 4;
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
					impacts: [removal(blockers)],
					decisions: [],
					transforms: [{ id: "drop-memo", op: "dropCollection", collection: "memo" }],
					problems: [],
					baseline: "applied",
					bodiesRead: 0,
				});
			if (input === "/api/monti/v1/references/unlink") {
				blockers = 0;
				return json({ entries: 4 });
			}
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

describe("deleting a collection with its entries (flow 4, steps 15-19)", () => {
	it("strikes it until saved and takes it back, then reviews it, unlinks what points at it, asks for the identifier and deletes", async () => {
		render(
			<AdminQueryProvider>
				<SchemaSettings tab="collections" />
			</AdminQueryProvider>,
		);

		// 15: the block at the bottom of the basics tab, with what the collection holds.
		const block = await screen.findByTestId("collection-delete");
		expect(block.textContent).toContain(
			tCollection("collection.count", { entries: 23, trashed: 2, folders: 2, kind: "document" }),
		);
		expect(screen.getByTestId("collection-nav-memo").querySelector("[data-removed]")).toBeNull();
		expect(screen.queryByTestId("save-bar")).toBeNull();

		// 16: pressed, it is struck in the block and in the list; the same place now holds the button that takes it back, and the focus stays on it.
		const press = within(block).getByRole("button", { name: tCollection("collection.delete") });
		press.focus();
		fireEvent.click(press);
		const undo = within(block).getByRole("button", { name: tCollection("collection.deleteUndo") });
		expect(within(block).queryByRole("button", { name: tCollection("collection.delete") })).toBeNull();
		expect(screen.getByTestId("collection-nav-memo").querySelector("[data-removed]")).not.toBeNull();
		expect(screen.getByTestId("save-bar")).toBeTruthy();
		expect(document.activeElement).toBe(undo);

		// Undo puts everything back as it was saved: nothing to save any more.
		fireEvent.click(undo);
		expect(within(block).getByRole("button", { name: tCollection("collection.delete") })).toBeTruthy();
		expect(screen.getByTestId("collection-nav-memo").querySelector("[data-removed]")).toBeNull();
		expect(screen.queryByTestId("save-bar")).toBeNull();

		// 17: deleted again, saved: the review names what goes and what still points at it. The check is told the collection is deleted with its entries and is sent without it.
		fireEvent.click(within(block).getByRole("button", { name: tCollection("collection.delete") }));
		fireEvent.click(within(screen.getByTestId("save-bar")).getByRole("button", { name: t("bar.save") }));
		const sheet = await screen.findByRole("dialog");
		const change = await within(sheet).findByTestId(`impact-${KEY}`);
		expect(lastPreview()?.body?.dropCollections).toEqual(["memo"]);
		expect(Object.keys((lastPreview()?.body?.schema as { collections: object }).collections)).toEqual(["post"]);
		const apply = within(sheet).getByRole("button", { name: tReview("drop.apply") }) as HTMLButtonElement;
		expect(apply.disabled).toBe(true);
		const identifier = within(change).getByLabelText(tReview("drop.confirm")) as HTMLInputElement;
		expect(identifier.placeholder).toBe("memo");

		// Typing the identifier is not enough while something points at the collection.
		fireEvent.change(identifier, { target: { value: "memo" } });
		expect(apply.disabled).toBe(true);

		// 연결 끊기: one request for the collection, then the review is read again and the line says it is done.
		const before = requests.filter((request) => request.url.endsWith("/preview")).length;
		fireEvent.click(within(change).getByRole("button", { name: tReview("drop.unlink") }));
		await waitFor(() => expect(within(change).getByText(tReview("drop.unlinked"))).toBeTruthy());
		expect(requests.find((request) => request.url === "/api/monti/v1/references/unlink")).toMatchObject({
			method: "POST",
			body: { collection: "memo" },
		});
		expect(requests.filter((request) => request.url.endsWith("/preview")).length).toBeGreaterThan(before);
		expect(within(change).queryByRole("button", { name: tReview("drop.unlink") })).toBeNull();

		// 18: the button turns on only for the identifier exactly as it is written.
		for (const wrong of ["mem", "Memo", "memo ", ""]) {
			fireEvent.change(identifier, { target: { value: wrong } });
			expect(apply.disabled).toBe(true);
		}
		fireEvent.change(identifier, { target: { value: "memo" } });
		await waitFor(() => expect(apply.disabled).toBe(false));

		// 19: applied, the save names the collection to delete and the reviewed change; the page reloads with the toast that says what went.
		fireEvent.click(apply);
		await waitFor(() => expect(reload.reloadPage).toHaveBeenCalled());
		const put = requests.find((request) => request.method === "PUT");
		expect(put?.body).toMatchObject({ baseHash: "hash-1", dropCollections: ["memo"], acknowledged: [KEY] });
		expect(Object.keys((put?.body?.schema as { collections: object }).collections)).toEqual(["post"]);
		expect(reload.rememberSaved).toHaveBeenCalledWith(
			tCollection("save.dropped", { name: "Memo", count: 23, kind: "document" }),
		);
	});

	it("leaves the review without deleting anything: Cancel keeps the collection struck, and nothing is sent", async () => {
		render(
			<AdminQueryProvider>
				<SchemaSettings tab="collections" />
			</AdminQueryProvider>,
		);
		const block = await screen.findByTestId("collection-delete");
		fireEvent.click(within(block).getByRole("button", { name: tCollection("collection.delete") }));
		fireEvent.click(within(screen.getByTestId("save-bar")).getByRole("button", { name: t("bar.save") }));
		const sheet = await screen.findByRole("dialog");
		await within(sheet).findByTestId(`impact-${KEY}`);
		fireEvent.click(within(sheet).getByRole("button", { name: tc("cancel") }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(requests.some((request) => request.method === "PUT")).toBe(false);
		expect(screen.getByTestId("collection-nav-memo").querySelector("[data-removed]")).not.toBeNull();
	});
});
