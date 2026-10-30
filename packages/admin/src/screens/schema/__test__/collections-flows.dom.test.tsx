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
import { schemaFieldsMessages } from "../fields.messages";
import { schemaMessages } from "../messages";
import { schemaReviewMessages } from "../review.messages";
import { SchemaSettings } from "../schema-screen";

// Flow 4 of the canvas, the collections of Settings: a new collection (steps 01-04 and 06), the basics tab, and deleting a collection (steps 15-18). Each walk
// checks what a screenshot cannot see: the roles and names of the parts, focus, which buttons are enabled, the list and its count, and the requests sent. How it
// looks is the visual stories' job.

const nav = createTestRouter();
const { render } = nav;
const t = testSite.createTranslator(schemaMessages);
const tCollection = testSite.createTranslator(schemaCollectionMessages);
const tFields = testSite.createTranslator(schemaFieldsMessages);
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

let requests: { method: string; url: string; body?: Record<string, unknown> }[];
/** What the server answers to the preview and to the save; a walk sets what it needs. */
let preview: Record<string, unknown>;
let saved: Record<string, unknown>;

const emptyPreview = {
	valid: true,
	issues: [],
	changed: true,
	impacts: [],
	decisions: [],
	transforms: [],
	problems: [],
	baseline: "applied",
	bodiesRead: 0,
};
const emptySaved = {
	saved: true,
	file: "monti.schema.ts",
	hash: "hash-2",
	transforms: [],
	entriesRewritten: 0,
	reloaded: true,
	conflicts: 0,
	dropped: [],
};

beforeEach(() => {
	vi.clearAllMocks();
	window.history.replaceState(null, "", "/admin/settings/collections?collection=post");
	requests = [];
	preview = emptyPreview;
	saved = emptySaved;
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: string, init?: RequestInit) => {
			const method = init?.method ?? "GET";
			const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
			requests.push({ method, url: input, body });
			if (input === "/api/monti/v1/schema" && method === "GET") return json(state);
			if (input === "/api/monti/v1/schema/preview") return json(preview);
			if (input === "/api/monti/v1/schema" && method === "PUT") return json(saved);
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

/** The count of the changes group in the title row. */
const hasChangeCount = (count: number) =>
	within(screen.getByTestId("save-bar")).queryByLabelText(t("bar.count", { count })) !== null;

describe("flow 4 · 새 컬렉션 (steps 01-04, 06)", () => {
	it("creates a collection from the sheet, adds a field to it and saves it", async () => {
		open();
		await screen.findByTestId("collection-nav-post");

		// 01: "+ 새 컬렉션" under the list opens a sheet (not a dialog in the middle) with focus in the name.
		expect(screen.queryByTestId("save-bar")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: t("collection.create") }));
		const sheet = await screen.findByRole("dialog", { name: tCollection("collection.createTitle") });
		const name = within(sheet).getByRole("textbox", { name: tCollection("collection.newName") });
		await waitFor(() => expect(globalThis.document.activeElement).toBe(name));
		expect((name as HTMLInputElement).required).toBe(true);
		const createButton = within(sheet).getByRole("button", { name: tCollection("collection.createConfirm") });
		expect((createButton as HTMLButtonElement).disabled).toBe(true);

		// The identifier follows the name, is read as a machine value and says it cannot be changed after the collection is made.
		fireEvent.change(name, { target: { value: "Notes" } });
		const identifier = within(sheet).getByRole("textbox", {
			name: new RegExp(`^${tCollection("collection.newId")}`),
		}) as HTMLInputElement;
		expect(identifier.value).toBe("notes");
		expect(within(sheet).getByRole("img", { name: tCollection("collection.newIdLocked") })).toBeInTheDocument();
		expect((createButton as HTMLButtonElement).disabled).toBe(false);

		// 02: an identifier that is taken shows the one error line, marks the field and keeps "만들기" off.
		fireEvent.change(identifier, { target: { value: "memo" } });
		expect(within(sheet).getAllByText(t("name.taken"))).toHaveLength(1);
		expect(identifier.getAttribute("aria-invalid")).toBe("true");
		expect((createButton as HTMLButtonElement).disabled).toBe(true);
		fireEvent.change(identifier, { target: { value: "note" } });
		expect(within(sheet).queryByText(t("name.taken"))).toBeNull();
		expect(identifier.getAttribute("aria-invalid")).toBeNull();
		expect((createButton as HTMLButtonElement).disabled).toBe(false);

		// The kind is a radio group with a small hint in each row; the public address is a switch with the middle of the address as the field.
		const kinds = within(sheet).getByRole("radiogroup", { name: tCollection("collection.kind") });
		const documentKind = within(kinds).getByRole("radio", { name: new RegExp(`^${t("collection.kindDocument")}`) });
		expect(documentKind.getAttribute("aria-checked")).toBe("true");
		expect(kinds.textContent).toContain(tCollection("collection.kindDocumentExplain"));
		expect(kinds.textContent).toContain(tCollection("collection.kindItemExplain"));
		expect(
			within(sheet)
				.getByRole("switch", { name: tCollection("collection.path") })
				.getAttribute("aria-checked"),
		).toBe("true");
		expect(
			(within(sheet).getByRole("textbox", { name: tCollection("collection.path") }) as HTMLInputElement).value,
		).toBe("notes");

		// 03: created, the sheet closes, the new collection is open on its fields (title and slug) and the title row counts one change.
		fireEvent.click(createButton);
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(screen.getByTestId("collection-nav-note").querySelector("[aria-current]")).toBeInTheDocument();
		const editor = screen.getByTestId("collection-note");
		expect(within(editor).getByTestId("field-title")).toBeInTheDocument();
		expect(within(editor).getByTestId("field-slug")).toBeInTheDocument();
		expect(hasChangeCount(1)).toBe(true);
		expect(
			within(screen.getByTestId("collection-nav-note")).getByRole("img", { name: t("changed") }),
		).toBeInTheDocument();

		// 04: "+ 필드 추가" opens the sheet of kinds, with the collection's name in its title and the basic and advanced tabs.
		fireEvent.click(within(editor).getByRole("button", { name: `+ ${tFields("field.add")}` }));
		const adding = await screen.findByRole("dialog", { name: new RegExp(tFields("field.addTitle")) });
		expect(adding.textContent).toContain("Notes");
		const kindList = within(adding).getByRole("listbox", { name: tFields("field.kind") });
		const kindNames = within(kindList)
			.getAllByRole("option")
			.map((option) => option.getAttribute("aria-label"));
		expect(kindNames).toEqual(
			["text", "select", "media", "relation"].map((kind) => tFields(`kind.${kind}` as "kind.text")),
		);
		const textKind = within(kindList).getByRole("option", { name: tFields("kind.text") });
		expect(textKind.getAttribute("aria-selected")).toBe("true");
		expect(
			within(adding)
				.getByRole("tab", { name: tFields("sheet.tabBasic") })
				.getAttribute("aria-selected"),
		).toBe("true");
		expect(within(adding).getByRole("tab", { name: tFields("sheet.tabAdvanced") })).toBeInTheDocument();

		// The add-field sheet marks no label with the red star (the board does not); the button stays off until the field is whole, and nothing says "optional".
		const label = within(adding).getByRole("textbox", { name: tFields("field.label") }) as HTMLInputElement;
		expect(label.labels?.[0]?.textContent).not.toContain("*");
		const nameBox = within(adding).getByRole("textbox", { name: tFields("field.name") }) as HTMLInputElement;
		expect(nameBox.labels?.[0]?.textContent).not.toContain("*");
		expect(adding.textContent).not.toContain("optional");
		expect(adding.textContent).not.toContain("선택");
		const addButton = within(adding).getByRole("button", { name: tFields("field.add") }) as HTMLButtonElement;
		expect(addButton.disabled).toBe(true);

		// A text field has the lines switch and the sizes; picking another kind swaps the settings.
		expect(within(adding).getByRole("switch", { name: tFields("field.multiline") })).toBeInTheDocument();
		fireEvent.click(within(kindList).getByRole("option", { name: tFields("kind.select") }));
		expect(within(adding).queryByRole("switch", { name: tFields("field.multiline") })).toBeNull();
		expect(within(adding).getByRole("group", { name: tFields("options.title") })).toBeInTheDocument();
		expect(within(adding).getByRole("switch", { name: tFields("field.optionFields") })).toBeInTheDocument();
		fireEvent.click(within(kindList).getByRole("option", { name: tFields("kind.relation") }));
		expect(within(adding).getByRole("combobox", { name: tFields("field.relationTo") })).toBeInTheDocument();
		expect(within(adding).getByRole("switch", { name: tFields("field.many") })).toBeInTheDocument();
		fireEvent.click(within(kindList).getByRole("option", { name: tFields("kind.text") }));
		expect(within(adding).getByRole("switch", { name: tFields("field.multiline") })).toBeInTheDocument();

		// Name it, make it required: the name follows the label until it is typed, and the summary line shows the field as it will be.
		fireEvent.change(label, { target: { value: "Summary" } });
		const fieldName = within(adding).getByRole("textbox", { name: tFields("field.name") }) as HTMLInputElement;
		expect(fieldName.value).toBe("summary");
		fireEvent.click(within(adding).getByRole("switch", { name: tFields("field.multiline") }));
		fireEvent.click(within(adding).getByRole("switch", { name: tFields("field.required") }));
		expect(adding.textContent).toContain(`summary · text · ${tFields("sum.multiline")}`);
		expect(addButton.disabled).toBe(false);
		fireEvent.click(addButton);
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(within(screen.getByTestId("collection-note")).getByTestId("field-summary")).toBeInTheDocument();
		// A new collection is one change, whatever it holds.
		expect(hasChangeCount(1)).toBe(true);

		// 06: saved, the file gets the collection with its address and its three fields.
		fireEvent.click(within(screen.getByTestId("save-bar")).getByRole("button", { name: t("bar.save") }));
		const review = await screen.findByRole("dialog");
		fireEvent.click(await within(review).findByRole("button", { name: tReview("review.save") }));
		await waitFor(() => expect(reload.reloadPage).toHaveBeenCalled());
		const put = requests.find((request) => request.method === "PUT");
		const schema = put?.body?.schema as {
			collections: Record<string, { path?: string; kind: string; fields: object }>;
		};
		expect(Object.keys(schema.collections)).toEqual(["post", "memo", "note"]);
		expect(schema.collections.note).toMatchObject({ kind: "document", path: "/notes/:slug" });
		expect(Object.keys(schema.collections.note?.fields ?? {})).toEqual(["title", "slug", "summary"]);
		// The title and slug a collection starts with are named in the admin's language.
		expect(schema.collections.note?.fields).toMatchObject({
			title: { kind: "text", label: tCollection("collection.titleFieldLabel") },
			slug: { kind: "slug", label: tCollection("collection.slugFieldLabel") },
			summary: { kind: "text", multiline: true, required: true },
		});
		expect(reload.rememberSaved).toHaveBeenCalled();
	});

	it("waits for an identifier when the name has no ASCII letters, and gives an item no public address", async () => {
		open();
		await screen.findByTestId("collection-nav-post");
		fireEvent.click(screen.getByRole("button", { name: t("collection.create") }));
		const sheet = await screen.findByRole("dialog", { name: tCollection("collection.createTitle") });
		const createButton = within(sheet).getByRole("button", { name: tCollection("collection.createConfirm") });
		fireEvent.change(within(sheet).getByRole("textbox", { name: tCollection("collection.newName") }), {
			target: { value: "태그" },
		});
		// No identifier can be made from the name yet: no error is shown, and it cannot be created.
		expect(within(sheet).queryByText(t("name.idEmpty"))).toBeNull();
		expect((createButton as HTMLButtonElement).disabled).toBe(true);
		fireEvent.change(within(sheet).getByRole("textbox", { name: new RegExp(`^${tCollection("collection.newId")}`) }), {
			target: { value: "tag" },
		});
		fireEvent.click(within(sheet).getByRole("radio", { name: new RegExp(`^${t("collection.kindItem")}`) }));
		expect(within(sheet).queryByRole("textbox", { name: tCollection("collection.path") })).toBeNull();
		fireEvent.click(createButton);
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		fireEvent.click(within(screen.getByTestId("save-bar")).getByRole("button", { name: t("bar.save") }));
		const review = await screen.findByRole("dialog");
		await within(review).findByRole("button", { name: tReview("review.save") });
		const body = lastPreview()?.body?.schema as { collections: Record<string, Record<string, unknown>> };
		expect(body.collections.tag).toMatchObject({ kind: "item", label: "태그" });
		expect(body.collections.tag?.path).toBeUndefined();
	});
});

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

/** Presses the delete button in the block of the open collection. */
const pressDelete = async () => {
	const block = await screen.findByTestId("collection-delete");
	fireEvent.click(within(block).getByRole("button", { name: tCollection("collection.delete") }));
	return block;
};

describe("flow 4 · 필드 시트", () => {
	it("renames a field on Save: the name is taken when the input is left, and the rename joins the changes as one", async () => {
		open();
		const editor = await screen.findByTestId("collection-post");
		fireEvent.click(within(editor).getByRole("tab", { name: new RegExp(`^${tCollection("collection.tabs.fields")}`) }));
		fireEvent.click(await within(editor).findByRole("button", { name: tFields("field.toggle", { name: "title" }) }));
		const sheet = await screen.findByRole("dialog");
		const name = within(sheet).getByRole("textbox", { name: tFields("field.name") });
		fireEvent.change(name, { target: { value: "heading" } });
		fireEvent.blur(name);
		fireEvent.click(within(sheet).getByRole("button", { name: tFields("sheet.save") }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(hasChangeCount(1)).toBe(true);
		fireEvent.click(within(screen.getByTestId("save-bar")).getByRole("button", { name: t("bar.list") }));
		expect(await screen.findByRole("menuitem", { name: /^Title/ })).toBeInTheDocument();
	});
});

describe("flow 4 · 컬렉션 지우기 (steps 15-18)", () => {
	beforeEach(() => {
		window.history.replaceState(null, "", "/admin/settings/collections?collection=memo");
		preview = {
			...emptyPreview,
			impacts: [removal],
			transforms: [{ id: "drop-memo", op: "dropCollection", collection: "memo" }],
		};
		saved = {
			...emptySaved,
			transforms: [{ id: "drop-memo", op: "dropCollection", collection: "memo" }],
			dropped: [{ collection: "memo", entries: 23, trashed: 2, translations: 0, folders: 2, addresses: 31 }],
		};
	});

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
		expect(screen.getByTestId("collection-nav-post").querySelector("[aria-current]")).toBeInTheDocument();
		expect(within(screen.getByTestId("collection-delete")).getByText("Post")).toBeInTheDocument();
		const bar = screen.getByTestId("save-bar");
		expect(within(bar).getByLabelText(t("bar.count", { count: 1 }))).toBeInTheDocument();

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
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: tExport("action.cancel") }));
		await waitFor(() =>
			expect(screen.queryByRole("dialog", { name: tExport("dialog.title.collection", { noun: "Memo" }) })).toBeNull(),
		);

		// 18: applied, the save names the collection to delete and the reviewed change; the page reloads with the toast that says what went.
		fireEvent.click(apply);
		await waitFor(() => expect(reload.reloadPage).toHaveBeenCalled());
		const put = requests.find((request) => request.method === "PUT");
		expect(put?.body).toMatchObject({ baseHash: "hash-1", dropCollections: ["memo"], acknowledged: [KEY] });
		expect(Object.keys((put?.body?.schema as { collections: object }).collections)).toEqual(["post"]);
		// The toast after the save says the save, not one of its changes.
		expect(reload.rememberSaved).toHaveBeenCalledWith(t("save.done"));
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
