import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { pressOption } from "../../../test/base-ui";
import { createTestRouter } from "../../../test/router";
import { SCHEMA_TABS, type SchemaTab } from "../../settings/tabs";
import { AdminQueryProvider } from "../../shared/query-provider";
import { schemaMessages } from "../messages";
import type { Obj } from "../schema-model";
import { SchemaSettings } from "../schema-screen";

const nav = createTestRouter();
const { render } = nav;
const t = testSite.createTranslator(schemaMessages);

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ Toaster: () => null, toast }));
const reload = vi.hoisted(() => ({ reloadPage: vi.fn(), rememberSaved: vi.fn(), takeSavedMessage: vi.fn(() => null) }));
vi.mock("../reload", () => reload);

const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

const schema = () => ({
	schemaVersion: 2,
	collections: {
		post: {
			label: "Post",
			kind: "document",
			path: "/posts/:slug",
			fields: {
				title: { kind: "text", label: "Title", required: true },
				slug: { kind: "slug", label: "Address", from: "title" },
				summary: { kind: "text", label: "Summary" },
				status: { kind: "select", label: "Status", options: { draft: "Draft", live: "Live" }, defaultValue: "draft" },
			},
		},
		tag: { label: "Tag", kind: "item", fields: { title: { kind: "text", label: "Title", required: true } } },
	},
	locales: [{ code: "en", name: "English" }],
	defaultLocale: "en",
});

const screenState = (over: Record<string, unknown> = {}) => ({
	access: { writable: true },
	file: "monti.schema.ts",
	hash: "hash-1",
	schema: schema(),
	source: "file",
	comments: false,
	issues: [],
	schemaVersion: 2,
	applied: { schemaVersion: 2, appliedAt: "2026-01-01T00:00:00.000Z" },
	codeCollections: [],
	vocabulary: { blocks: ["table", "image", "callout"], marks: ["bold", "italic"] },
	collections: ["post", "tag"],
	siteUrl: { url: null, from: "none" },
	...over,
});

const previewOf = (over: Record<string, unknown> = {}) => ({
	valid: true,
	issues: [],
	changed: true,
	impacts: [],
	decisions: [],
	transforms: [],
	problems: [],
	nextVersion: 3,
	currentVersion: 2,
	baseline: "applied",
	bodiesRead: 0,
	...over,
});

let state: Record<string, unknown>;
let previewAnswer: (body: Record<string, unknown>) => unknown;
let saveAnswer: (body: Record<string, unknown>) => { status: number; body: unknown };
let requests: { method: string; url: string; body?: Record<string, unknown> }[];

beforeEach(() => {
	vi.clearAllMocks();
	state = screenState();
	previewAnswer = () => previewOf();
	saveAnswer = () => ({
		status: 200,
		body: {
			saved: true,
			file: "monti.schema.ts",
			hash: "hash-2",
			schemaVersion: 3,
			transforms: [],
			entriesRewritten: 0,
			reloaded: true,
		},
	});
	requests = [];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: string, init?: RequestInit) => {
			const method = init?.method ?? "GET";
			const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
			requests.push({ method, url: input, body });
			if (input === "/api/monti/v1/schema" && method === "GET") return json(state);
			if (input === "/api/monti/v1/schema/preview" && method === "POST") return json(previewAnswer(body ?? {}));
			if (input === "/api/monti/v1/schema" && method === "PUT") {
				const answer = saveAnswer(body ?? {});
				return json(answer.body, answer.status);
			}
			throw new Error(`Unexpected fetch ${method} ${input}`);
		}),
	);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

/** Stands in for the Settings page: the schema editor and the buttons that move between its tabs (the page does this with links). */
function SchemaTabs() {
	const [tab, setTab] = useState<SchemaTab>("collections");
	return (
		<>
			<div role="tablist">
				{SCHEMA_TABS.map((name) => (
					<button key={name} type="button" role="tab" aria-selected={tab === name} onClick={() => setTab(name)}>
						{t(`tabs.${name}`)}
					</button>
				))}
			</div>
			<SchemaSettings tab={tab} />
		</>
	);
}

const renderScreen = () =>
	render(
		<AdminQueryProvider>
			<SchemaTabs />
		</AdminQueryProvider>,
	);

/** The review button: it reads "No changes" (and is off) until something is edited. */
const review = () =>
	screen.getByRole("button", {
		name: new RegExp(`^(${t("actions.review")}|${t("actions.noChanges")})$`),
	}) as HTMLButtonElement;
const type = (element: HTMLElement, value: string) => fireEvent.change(element, { target: { value } });
/** Picks the kind in the dialog that adds a field (the last "Kind" box on the screen). */
async function pickNewFieldKind(optionName: string) {
	fireEvent.click(screen.getAllByRole("combobox", { name: t("field.kind") }).at(-1) as HTMLElement);
	pressOption(await screen.findByRole("option", { name: optionName }));
}
/** Opens the dialog of the "Add field" button and fills the name (and kind). */
async function startAddingField(name: string, kindName?: string) {
	fireEvent.click(screen.getByRole("button", { name: t("field.add") }));
	const dialog = await screen.findByTestId("add-field-dialog");
	type(within(dialog).getByLabelText(t("field.newName")), name);
	if (kindName) await pickNewFieldKind(kindName);
	return dialog;
}
const confirmAdd = (dialog: HTMLElement) =>
	fireEvent.click(within(dialog).getByRole("button", { name: t("field.addConfirm") }));
/** The sheet of a field: opened by its row of the tree. */
async function openFieldSheet(field: string) {
	fireEvent.click(await screen.findByRole("button", { name: t("field.toggle", { name: field }) }));
	return screen.findByTestId("field-sheet");
}
const applySheet = async (sheet: HTMLElement) => {
	fireEvent.click(within(sheet).getByRole("button", { name: t("sheet.apply") }));
	await waitFor(() => expect(screen.queryByTestId("field-sheet")).toBeNull());
};
const openTab = (name: "basics" | "fields" | "list" | "advanced") =>
	fireEvent.click(screen.getByRole("tab", { name: t(`collection.tabs.${name}`) }));
const lastPreview = () => requests.filter((request) => request.url.endsWith("/preview")).at(-1);

describe("SchemaScreen", () => {
	it("is read-only in production: the reason is shown, nothing can be edited, and nothing can be reviewed", async () => {
		state = screenState({ access: { writable: false, reason: "production" } });
		renderScreen();

		expect(await screen.findByTestId("schema-read-only")).toBeTruthy();
		expect(screen.getByText(t("readonly.production"))).toBeTruthy();
		expect(schemaMessages.messages.en["readonly.production"]).toBe(
			"Settings are saved to monti.schema.ts. Change them on your computer (pnpm dev), then commit and deploy.",
		);
		expect((screen.getByLabelText(t("collection.label")) as HTMLInputElement).disabled).toBe(true);
		expect(review().disabled).toBe(true);
		expect(screen.queryByRole("button", { name: t("collection.create") })).toBeNull();
		expect(requests.every((request) => request.method === "GET")).toBe(true);
	});

	it("is read-only when the file holds code: it says the admin cannot rewrite it, names the line, and nothing can be reviewed", async () => {
		state = screenState({
			access: { writable: false, reason: "has_code", detail: "line 3: a spread `...`" },
			source: "site",
		});
		renderScreen();

		expect(await screen.findByTestId("schema-read-only")).toBeTruthy();
		expect(screen.getByText(t("readonly.hasCode"))).toBeTruthy();
		expect(screen.getByTestId("schema-code-detail").textContent).toBe("line 3: a spread `...`");
		expect(t("readonly.hasCode")).toContain("monti.schema.ts");
		expect((screen.getByLabelText(t("collection.label")) as HTMLInputElement).disabled).toBe(true);
		expect(review().disabled).toBe(true);
	});

	it("tells that saving drops the comments of a file that has them", async () => {
		state = screenState({ comments: true });
		renderScreen();
		expect(await screen.findByTestId("schema-comments-note")).toBeTruthy();
		expect(screen.getByText(t("comments.note"))).toBeTruthy();
	});

	it("shows the collections of the file and opens the editor of the first one", async () => {
		renderScreen();
		expect(await screen.findByTestId("collection-post")).toBeTruthy();
		expect((screen.getByLabelText(t("collection.label")) as HTMLInputElement).value).toBe("Post");
		expect((screen.getByLabelText(t("collection.path")) as HTMLInputElement).value).toBe("/posts/:slug");
		expect(review().disabled).toBe(true);
		fireEvent.click(screen.getByRole("button", { name: /^Tag/ }));
		expect(await screen.findByTestId("collection-tag")).toBeTruthy();
	});

	it("checks an edit before saving: the request carries the edited file, and the save sends the hash it started from", async () => {
		renderScreen();
		type(await screen.findByLabelText(t("collection.label")), "Article");
		expect(review().disabled).toBe(false);
		fireEvent.click(review());

		await screen.findByTestId("review-summary");
		expect(lastPreview()?.body).toMatchObject({ schema: { collections: { post: { label: "Article" } } } });
		expect(screen.getByTestId("review-summary").textContent).toContain("2");

		fireEvent.click(screen.getByRole("button", { name: t("review.save") }));
		await waitFor(() => expect(reload.reloadPage).toHaveBeenCalled());
		const put = requests.find((request) => request.method === "PUT");
		expect(put?.body).toMatchObject({ baseHash: "hash-1", schema: { collections: { post: { label: "Article" } } } });
		expect(reload.rememberSaved).toHaveBeenCalledWith(expect.stringContaining("3"));
	});

	it("adds a field in the file's format, after the others, and opens its sheet", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		openTab("fields");
		await screen.findByTestId("fields-card");
		confirmAdd(await startAddingField("rating"));
		const sheet = await screen.findByTestId("field-sheet");
		expect(within(sheet).getAllByText("rating").length).toBeGreaterThan(0);
		await applySheet(sheet);
		expect(await screen.findByTestId("field-rating")).toBeTruthy();
		fireEvent.click(review());
		await screen.findByTestId("review-summary");
		const fields = (lastPreview()?.body?.schema as { collections: { post: { fields: Record<string, unknown> } } })
			.collections.post.fields;
		expect(Object.keys(fields)).toEqual(["title", "slug", "summary", "status", "rating"]);
		expect(fields.rating).toEqual({ kind: "text", label: "Rating" });
	});

	it("refuses a field name that is taken or malformed", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		openTab("fields");
		await screen.findByTestId("fields-card");
		const dialog = await startAddingField("summary");
		expect((within(dialog).getByRole("button", { name: t("field.addConfirm") }) as HTMLButtonElement).disabled).toBe(
			true,
		);
		type(within(dialog).getByLabelText(t("field.newName")), "1bad");
		expect((within(dialog).getByRole("button", { name: t("field.addConfirm") }) as HTMLButtonElement).disabled).toBe(
			true,
		);
	});

	it("lists the fields as one tree: kind, required mark and settings per line, the title marked", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		openTab("fields");
		const card = await screen.findByTestId("fields-card");
		const row = (field: string) => within(card).getByTestId(`field-${field}`);
		expect(within(row("title")).getByText("text")).toBeTruthy();
		expect(within(row("title")).getByText("!")).toBeTruthy();
		expect(within(row("summary")).queryByText("!")).toBeNull();
		expect(within(row("slug")).getAllByText("slug")).toHaveLength(2);
		// A choice writes its options as the settings.
		expect(within(row("status")).getByText("draft | live")).toBeTruthy();
		// The field named `title` is the title until a field has the role.
		expect(within(row("title")).getByTestId("title-badge")).toBeTruthy();
		expect(within(row("summary")).queryByTestId("title-badge")).toBeNull();
		// No separate card per field: one card, one header with the count.
		expect(within(card).getByRole("heading", { level: 4 }).textContent).toContain("4");
	});

	it("writes relation, backlink, choice and conditional fields in the tree, with the conditional options as branches", async () => {
		const base = schema();
		base.collections.tag.label = "Tag";
		state = screenState({
			schema: {
				...base,
				collections: {
					...base.collections,
					series: { label: "Series", kind: "item", fields: { title: { kind: "text", label: "Title" } } },
					post: {
						...base.collections.post,
						fields: {
							...base.collections.post.fields,
							tagIds: { kind: "relation", label: "Tags", to: "tag", many: true, ordered: true },
							series: { kind: "backlink", label: "Series", from: "series", via: "itemIds" },
							cover: { kind: "media", label: "Cover" },
							policy: {
								kind: "conditional",
								label: "Policy",
								discriminant: {
									kind: "select",
									label: "Policy",
									options: { normal: "Normal", deprecated: "Deprecated" },
								},
								values: {
									normal: {},
									deprecated: { replacementId: { kind: "relation", label: "Replacement", to: "post" } },
								},
							},
						},
					},
				},
			},
		});
		renderScreen();
		await screen.findByTestId("collection-post");
		openTab("fields");
		const card = await screen.findByTestId("fields-card");
		const row = (field: string) => within(card).getByTestId(`field-${field}`);
		expect(within(row("tagIds")).getByText("→ Tag[]")).toBeTruthy();
		expect(within(row("tagIds")).getByText(new RegExp(t("sum.ordered")))).toBeTruthy();
		expect(within(row("series")).getByText("← Series")).toBeTruthy();
		expect(within(row("cover")).getByText("media")).toBeTruthy();
		const policy = row("policy");
		expect(within(policy).getByText("one of")).toBeTruthy();
		expect(within(policy).getByText("normal | deprecated", { selector: "div" })).toBeTruthy();
		// Each option is a branch; the field of an option sits under it, and an option without fields says so.
		expect(within(policy).getByText('= "normal"')).toBeTruthy();
		expect(within(policy).getByText('= "deprecated"')).toBeTruthy();
		expect(within(policy).getByText(t("fields.noExtra"))).toBeTruthy();
		const branch = within(policy).getByTestId("field-replacementId");
		expect(within(branch).getByText("→ Post")).toBeTruthy();
		const order = [...policy.querySelectorAll("[data-testid^='field-'], span")]
			.map((node) => node.textContent)
			.filter((text) => text === '= "deprecated"' || text === "replacementId");
		expect(order).toEqual(['= "deprecated"', "replacementId"]);
		// A field of a branch opens in the same sheet.
		fireEvent.click(within(branch).getByRole("button", { name: t("field.toggle", { name: "replacementId" }) }));
		expect(await screen.findByTestId("field-sheet")).toBeTruthy();
	});

	it("opens the field in a sheet with its name read-only, and Cancel leaves the file as it was", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		openTab("fields");
		const sheet = await openFieldSheet("summary");
		expect(within(sheet).getByText(t("sheet.nameHint"))).toBeTruthy();
		expect(within(sheet).queryByRole("textbox", { name: t("sheet.name") })).toBeNull();
		type(within(sheet).getByLabelText(t("sheet.label")), "Teaser");
		fireEvent.click(within(sheet).getByRole("button", { name: t("sheet.cancel") }));
		await waitFor(() => expect(screen.queryByTestId("field-sheet")).toBeNull());
		expect(review().disabled).toBe(true);
	});

	it("writes the edits of the sheet to the file only on Apply", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		openTab("fields");
		const sheet = await openFieldSheet("summary");
		type(within(sheet).getByLabelText(t("sheet.label")), "Teaser");
		fireEvent.click(within(sheet).getByRole("switch", { name: t("field.required") }));
		await applySheet(sheet);
		expect(review().disabled).toBe(false);
		fireEvent.click(review());
		await screen.findByTestId("review-summary");
		const fields = (lastPreview()?.body?.schema as { collections: { post: { fields: Record<string, Obj> } } })
			.collections.post.fields;
		expect(fields.summary).toMatchObject({ kind: "text", label: "Teaser", required: true });
	});

	it("moves the title to another text field with the switch", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		openTab("fields");
		const sheet = await openFieldSheet("summary");
		fireEvent.click(within(sheet).getByRole("switch", { name: t("field.isTitle") }));
		await applySheet(sheet);
		expect(within(screen.getByTestId("field-summary")).getByTestId("title-badge")).toBeTruthy();
		expect(within(screen.getByTestId("field-title")).queryByTestId("title-badge")).toBeNull();
	});

	it("changes the order from the row menu", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		openTab("fields");
		await screen.findByTestId("fields-card");
		fireEvent.click(screen.getByRole("button", { name: t("fields.menu", { name: "summary" }) }));
		fireEvent.click(await screen.findByRole("menuitem", { name: t("row.up", { name: "summary" }) }));
		fireEvent.click(review());
		await screen.findByTestId("review-summary");
		const fields = (lastPreview()?.body?.schema as { collections: { post: { fields: Record<string, unknown> } } })
			.collections.post.fields;
		expect(Object.keys(fields)).toEqual(["title", "summary", "slug", "status"]);
	});

	it("tells the server about a rename, and shows the choice of what happens to the stored values", async () => {
		previewAnswer = (body) => {
			const renamed = (body.renames as unknown[])?.length > 0;
			const decision = {
				key: "field_removed:post:summary",
				change: { kind: "field_removed", collection: "post", field: "summary", fieldKind: "text" },
				entries: 3,
				sample: [
					{
						id: "11111111-1111-4111-8111-111111111111",
						title: "Hello",
						collection: "post",
						locale: "en",
						status: "draft",
					},
				],
				suggestions: [
					{ op: "renameField", collection: "post", from: "summary", to: "excerpt" },
					{ op: "dropField", collection: "post", field: "summary" },
				],
				chosen: renamed ? { op: "renameField", collection: "post", from: "summary", to: "excerpt" } : null,
			};
			return previewOf({
				decisions: [decision],
				impacts: [
					{
						change: {
							kind: "field_renamed",
							collection: "post",
							from: "summary",
							to: "excerpt",
							handledBy: "v3-rename-post-summary",
						},
						key: "field_renamed:post:summary:summary:excerpt",
						entries: 3,
						sample: decision.sample,
						consequence: "transformed",
						checked: true,
					},
				],
				transforms: [
					{ id: "v3-rename-post-summary", op: "renameField", collection: "post", from: "summary", to: "excerpt" },
				],
			});
		};
		renderScreen();
		await screen.findByTestId("collection-post");
		openTab("fields");
		const sheet = await openFieldSheet("status");
		const value = within(sheet).getAllByLabelText(t("options.value"))[0] as HTMLElement;
		type(value, "idea");
		fireEvent.keyDown(value, { key: "Enter" });
		await applySheet(sheet);

		fireEvent.click(review());
		const decision = await screen.findByTestId("decision-field_removed:post:summary");
		expect(lastPreview()?.body?.renames).toEqual([
			{ kind: "option", collection: "post", field: "status", from: "draft", to: "idea" },
		]);
		expect(within(decision).getByText(t("review.entriesCount", { count: 3 }))).toBeTruthy();
		const radios = within(decision).getAllByRole("radio") as HTMLInputElement[];
		expect(radios).toHaveLength(3);
		// The server's pick (the rename) is the one selected.
		expect(radios.map((radio) => radio.checked)).toEqual([false, true, false]);
		// The sample links to the entry in the admin.
		const link = within(decision).getByRole("link", { name: "Hello" });
		expect(link.getAttribute("href")).toBe(testSite.adminEntryEditHref("11111111-1111-4111-8111-111111111111"));

		// Picking another way sends that pick, and the save carries it.
		fireEvent.click(radios[2] as HTMLInputElement);
		await waitFor(() => expect((lastPreview()?.body?.transforms as unknown[])?.length).toBe(1));
		expect(lastPreview()?.body?.transforms).toEqual([{ op: "dropField", collection: "post", field: "summary" }]);
		fireEvent.click(await screen.findByRole("button", { name: t("review.save") }));
		await waitFor(() => expect(requests.some((request) => request.method === "PUT")).toBe(true));
		expect(requests.find((request) => request.method === "PUT")?.body?.transforms).toEqual([
			{ op: "dropField", collection: "post", field: "summary" },
		]);
	});

	it("lists the problems of an edit with their JSON path, and does not allow saving", async () => {
		previewAnswer = () =>
			previewOf({
				valid: false,
				changed: false,
				issues: [{ path: "collections.post.fields.summary.max", message: "Too small: expected number to be >=1" }],
			});
		renderScreen();
		type(await screen.findByLabelText(t("collection.label")), "Article");
		fireEvent.click(review());
		const list = await screen.findByTestId("schema-issues");
		expect(within(list).getByText("collections.post.fields.summary.max")).toBeTruthy();
		expect((screen.getByRole("button", { name: t("review.save") }) as HTMLButtonElement).disabled).toBe(true);
	});

	it("says when the file changed since it was opened", async () => {
		saveAnswer = () => ({ status: 409, body: { code: "schema_conflict", message: "changed" } });
		renderScreen();
		type(await screen.findByLabelText(t("collection.label")), "Article");
		fireEvent.click(review());
		await screen.findByTestId("review-summary");
		fireEvent.click(screen.getByRole("button", { name: t("review.save") }));
		expect(await screen.findByText(t("save.conflict"))).toBeTruthy();
		expect(reload.reloadPage).not.toHaveBeenCalled();
	});

	it("shows the problems of a schema file that does not check, instead of the editor", async () => {
		state = screenState({
			schema: null,
			issues: [{ path: "collections.post.kind", message: "Invalid option" }],
			hash: "hash-9",
		});
		renderScreen();
		const alert = await screen.findByTestId("schema-file-invalid");
		expect(within(alert).getByText("collections.post.kind")).toBeTruthy();
		expect(screen.queryByTestId("collection-post")).toBeNull();
	});

	it("describes what removing does under the remove section, and keeps the name note on the basics tab", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		expect(screen.getByText(t("collection.nameHint"))).toBeTruthy();

		openTab("advanced");
		expect(await screen.findByText(t("collection.dangerDescription"))).toBeTruthy();
		expect(screen.queryByText(t("collection.nameHint"))).toBeNull();
		const button = screen.getByRole("button", { name: t("collection.remove") });
		expect(button.closest("section")?.querySelector(".bg-cms-card")).toBeNull();
	});

	it("limits the body of a collection to the blocks that are ticked", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		openTab("advanced");
		fireEvent.click(
			screen.getByRole("switch", { name: t("allowed.limit", { label: t("allowed.blocks").toLowerCase() }) }),
		);
		// Everything is ticked at first; untick one.
		fireEvent.click(await screen.findByRole("checkbox", { name: "callout" }));
		fireEvent.click(review());
		await screen.findByTestId("review-summary");
		const body = (lastPreview()?.body?.schema as { collections: { post: { body: unknown } } }).collections.post.body;
		expect(body).toEqual({ blocks: ["table", "image"] });
	});

	it("creates a collection from a dialog: title and slug come with it, the address follows the name, and the new collection is selected", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		expect(screen.queryByTestId("new-collection-dialog")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: t("collection.create") }));
		const dialog = await screen.findByTestId("new-collection-dialog");

		const confirm = within(dialog).getByRole("button", { name: t("collection.createConfirm") }) as HTMLButtonElement;
		expect(confirm.disabled).toBe(true);
		// A name that is taken is refused with the reason.
		type(within(dialog).getByLabelText(t("collection.newName")), "post");
		expect(within(dialog).getByText(t("name.taken"))).toBeTruthy();
		expect(confirm.disabled).toBe(true);

		type(within(dialog).getByLabelText(t("collection.newName")), "note");
		expect((within(dialog).getByLabelText(t("collection.path")) as HTMLInputElement).value).toBe("/notes/:slug");
		// Each kind says what it is for.
		expect(within(dialog).getByText(t("collection.kindDocumentExplain"))).toBeTruthy();
		expect(within(dialog).getByText(t("collection.kindItemExplain"))).toBeTruthy();
		// An address of the writer's own stays when the name changes; a wrong one is refused.
		type(within(dialog).getByLabelText(t("collection.path")), "/notes");
		expect(within(dialog).getByText(t("path.slug"))).toBeTruthy();
		expect(confirm.disabled).toBe(true);
		type(within(dialog).getByLabelText(t("collection.path")), "/notes/:slug");
		type(within(dialog).getByLabelText(t("collection.newName")), "notes");
		expect((within(dialog).getByLabelText(t("collection.path")) as HTMLInputElement).value).toBe("/notes/:slug");

		fireEvent.click(confirm);
		await waitFor(() => expect(screen.queryByTestId("new-collection-dialog")).toBeNull());
		expect(await screen.findByTestId("collection-notes")).toBeTruthy();
		expect((screen.getByLabelText(t("collection.path")) as HTMLInputElement).value).toBe("/notes/:slug");
		openTab("fields");
		expect(screen.getByTestId("field-title")).toBeTruthy();
		expect(screen.getByTestId("field-slug")).toBeTruthy();

		fireEvent.click(review());
		await screen.findByTestId("review-summary");
		const notes = (lastPreview()?.body?.schema as { collections: Record<string, Record<string, unknown>> }).collections
			.notes;
		expect(notes).toMatchObject({
			kind: "document",
			path: "/notes/:slug",
			fields: {
				title: { kind: "text", required: true, role: "title" },
				slug: { kind: "slug", required: true, from: "title" },
			},
		});
	});

	it("separates the display name from the identifier and pre-fills the address from the identifier", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		fireEvent.click(screen.getByRole("button", { name: t("collection.create") }));
		const dialog = await screen.findByTestId("new-collection-dialog");
		const name = within(dialog).getByLabelText(t("collection.newName"));
		const id = () => (within(dialog).getByLabelText(t("collection.newId")) as HTMLInputElement).value;
		const path = () => (within(dialog).getByLabelText(t("collection.path")) as HTMLInputElement).value;

		type(name, "Memo");
		expect([id(), path()]).toEqual(["memo", "/memos/:slug"]);
		type(name, "Blog posts");
		expect([id(), path()]).toEqual(["blog-posts", "/blog-posts/:slug"]);
		type(name, "Category");
		expect([id(), path()]).toEqual(["category", "/categories/:slug"]);

		// A Korean name has no identifier of its own: one must be typed.
		type(name, "메모");
		expect(id()).toBe("");
		expect(within(dialog).getByText(t("name.idEmpty"))).toBeTruthy();
		const confirm = within(dialog).getByRole("button", { name: t("collection.createConfirm") }) as HTMLButtonElement;
		expect(confirm.disabled).toBe(true);
		type(within(dialog).getByLabelText(t("collection.newId")), "memo");
		expect(path()).toBe("/memos/:slug");
		expect(confirm.disabled).toBe(false);

		// Once the address is edited it stops following the identifier.
		type(within(dialog).getByLabelText(t("collection.path")), "/my/:slug");
		type(within(dialog).getByLabelText(t("collection.newId")), "memos");
		expect(path()).toBe("/my/:slug");

		fireEvent.click(confirm);
		expect(await screen.findByTestId("collection-memos")).toBeTruthy();
		fireEvent.click(review());
		await screen.findByTestId("review-summary");
		const memos = (lastPreview()?.body?.schema as { collections: Record<string, Record<string, unknown>> }).collections
			.memos;
		expect(memos).toMatchObject({ label: "메모", path: "/my/:slug" });
	});

	it("leaves the address empty for an item collection", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		fireEvent.click(screen.getByRole("button", { name: t("collection.create") }));
		const dialog = await screen.findByTestId("new-collection-dialog");
		type(within(dialog).getByLabelText(t("collection.newName")), "category");
		fireEvent.click(within(dialog).getByRole("radio", { name: new RegExp(t("collection.kindItem")) }));
		expect((within(dialog).getByLabelText(t("collection.path")) as HTMLInputElement).value).toBe("");
		fireEvent.click(within(dialog).getByRole("button", { name: t("collection.createConfirm") }));
		expect(await screen.findByTestId("collection-category")).toBeTruthy();
		expect((screen.getByLabelText(t("collection.path")) as HTMLInputElement).value).toBe("");
	});

	it("cannot delete the title field, and the slug field only while the address does not use :slug", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		openTab("fields");
		const deleteOf = async (field: string) => {
			const sheet = await openFieldSheet(field);
			return {
				sheet,
				button: within(sheet).getByRole("button", { name: t("sheet.delete") }) as HTMLButtonElement,
			};
		};
		const close = async (sheet: HTMLElement) => {
			fireEvent.click(within(sheet).getByRole("button", { name: t("sheet.cancel") }));
			await waitFor(() => expect(screen.queryByTestId("field-sheet")).toBeNull());
		};
		let opened = await deleteOf("title");
		expect(opened.button.disabled).toBe(true);
		expect(opened.button.getAttribute("title")).toBe(t("field.removeBlocked.title"));
		await close(opened.sheet);
		opened = await deleteOf("slug");
		expect(opened.button.disabled).toBe(true);
		expect(opened.button.getAttribute("title")).toBe(t("field.removeBlocked.slug"));
		await close(opened.sheet);
		opened = await deleteOf("summary");
		expect(opened.button.disabled).toBe(false);
		await close(opened.sheet);

		// Without :slug in the address the slug field can go.
		openTab("basics");
		type(screen.getByLabelText(t("collection.path")), "");
		openTab("fields");
		opened = await deleteOf("slug");
		expect(opened.button.disabled).toBe(false);
		fireEvent.click(opened.button);
		await waitFor(() => expect(screen.queryByTestId("field-slug")).toBeNull());
	});

	it("splits a collection into tabs: Basics first, and the body limits and the list columns each in their own", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
		expect(tabs).toEqual(
			expect.arrayContaining(
				["basics", "fields", "list", "advanced"].map((name) => t(`collection.tabs.${name as "basics"}`)),
			),
		);
		// Basics is open: the address is there, the settings of the other tabs are not.
		expect(screen.getByLabelText(t("collection.path"))).toBeTruthy();
		expect(screen.queryByText(t("allowed.title"))).toBeNull();
		expect(screen.queryByText(t("list.custom"))).toBeNull();
		expect(screen.queryByTestId("field-title")).toBeNull();

		openTab("advanced");
		expect(await screen.findByText(t("allowed.title"))).toBeTruthy();
		expect(screen.getByText(t("allowed.hint"))).toBeTruthy();
		// Everything is allowed until a list is limited.
		expect(screen.getAllByText(t("allowed.everything"))).toHaveLength(3);
		expect(screen.queryByLabelText(t("collection.path"))).toBeNull();
	});

	it("previews the entry list with the chosen columns, with sample rows when there are no entries", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		openTab("list");
		const preview = await screen.findByTestId("list-preview");
		// The usual columns until the writer chooses their own.
		expect(within(preview).getAllByRole("columnheader")).toHaveLength(3);
		expect(await within(preview).findByText(t("list.previewSample"))).toBeTruthy();

		fireEvent.click(screen.getByRole("switch", { name: t("list.custom") }));
		// Choosing columns starts from the title; adding one shows its column at once.
		expect(within(screen.getByTestId("list-preview")).getAllByRole("columnheader")).toHaveLength(1);
		fireEvent.click(screen.getByRole("combobox", { name: t("names.add", { label: t("list.columns") }) }));
		pressOption(await screen.findByRole("option", { name: "summary" }));
		const headers = within(screen.getByTestId("list-preview")).getAllByRole("columnheader");
		expect(headers.map((cell) => cell.textContent)).toEqual(["Title", "Summary"]);
		// The sample rows carry values for the field.
		expect(within(screen.getByTestId("list-preview")).getByText("Summary 1")).toBeTruthy();

		// The choice is part of the one save.
		fireEvent.click(review());
		await screen.findByTestId("review-summary");
		const post = (lastPreview()?.body?.schema as { collections: { post: { list: unknown } } }).collections.post;
		expect(post.list).toEqual({ columns: ["title", "summary"] });
	});

	it("adds a conditional field only once its options and a field are set", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		openTab("fields");
		await screen.findByTestId("fields-card");
		confirmAdd(await startAddingField("extra", t("kind.conditional")));

		const dialog = await screen.findByTestId("new-field-dialog");
		// Nothing is in the collection yet.
		expect(screen.queryByTestId("field-extra")).toBeNull();
		expect(within(dialog).getByText(t("field.needs.branches"))).toBeTruthy();
		const add = within(dialog).getByRole("button", { name: t("field.addConfirm") }) as HTMLButtonElement;
		expect(add.disabled).toBe(true);

		// Add a field to the first option.
		const inputs = within(dialog).getAllByLabelText(t("field.newName"));
		type(inputs[0] as HTMLElement, "detail");
		fireEvent.click(within(dialog).getAllByRole("button", { name: t("field.add") })[0] as HTMLElement);
		await waitFor(() => expect(within(dialog).queryByText(t("field.needs.branches"))).toBeNull());
		expect(add.disabled).toBe(false);
		fireEvent.click(add);

		await waitFor(() => expect(screen.queryByTestId("new-field-dialog")).toBeNull());
		// The field exists, and its sheet is open; the tree lists the option and its field as a branch.
		await applySheet(await screen.findByTestId("field-sheet"));
		const row = await screen.findByTestId("field-extra");
		expect(within(row).getByText('= "a"')).toBeTruthy();
		expect(within(row).getByTestId("field-detail")).toBeTruthy();
		expect(within(row).getByText(t("fields.noExtra"))).toBeTruthy();
		fireEvent.click(review());
		await screen.findByTestId("review-summary");
		const fields = (lastPreview()?.body?.schema as { collections: { post: { fields: Record<string, Obj> } } })
			.collections.post.fields;
		expect(fields.extra).toMatchObject({ kind: "conditional", values: { a: { detail: { kind: "text" } } } });
	});

	it("adds a relation only once a target collection is chosen, and drops nothing in the file when the dialog is cancelled", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		openTab("fields");
		await screen.findByTestId("fields-card");
		confirmAdd(await startAddingField("related", t("kind.relation")));

		const dialog = await screen.findByTestId("new-field-dialog");
		expect(within(dialog).getByLabelText(t("field.relationTo"))).toBeTruthy();
		fireEvent.click(within(dialog).getByRole("button", { name: t("field.newCancel") }));
		await waitFor(() => expect(screen.queryByTestId("new-field-dialog")).toBeNull());
		expect(screen.queryByTestId("field-related")).toBeNull();
		expect(screen.queryByTestId("field-sheet")).toBeNull();
		expect(review().disabled).toBe(true);

		// Do it again and add it: the first collection is the target.
		confirmAdd(await startAddingField("related", t("kind.relation")));
		const again = await screen.findByTestId("new-field-dialog");
		fireEvent.click(within(again).getByRole("button", { name: t("field.addConfirm") }));
		await applySheet(await screen.findByTestId("field-sheet"));
		expect(await screen.findByTestId("field-related")).toBeTruthy();
		// The tree names the collection it points to.
		expect(within(screen.getByTestId("field-related")).getByText("→ Post")).toBeTruthy();
		fireEvent.click(review());
		await screen.findByTestId("review-summary");
		const fields = (lastPreview()?.body?.schema as { collections: { post: { fields: Record<string, Obj> } } })
			.collections.post.fields;
		expect(fields.related).toMatchObject({ kind: "relation", to: "post" });
	});

	it("discards the edits after a confirmation", async () => {
		renderScreen();
		const label = await screen.findByLabelText(t("collection.label"));
		type(label, "Article");
		fireEvent.click(screen.getByRole("button", { name: t("actions.discard") }));
		await act(async () => {
			fireEvent.click(await screen.findByRole("button", { name: t("discard.confirm") }));
		});
		await waitFor(() => expect((screen.getByLabelText(t("collection.label")) as HTMLInputElement).value).toBe("Post"));
	});
	/** Edits through the site or admin tab, then returns the file the review would send. */
	const openSettingsTab = async (name: "site" | "admin") => {
		renderScreen();
		await screen.findByTestId("collection-post");
		fireEvent.click(screen.getByRole("tab", { name: t(`tabs.${name}`) }));
	};
	const reviewedFile = async () => {
		fireEvent.click(review());
		await screen.findByTestId("review-summary");
		return lastPreview()?.body?.schema as Obj;
	};

	it("counts the unsaved changes next to the review button, which reads No changes until there is one", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		expect(review().textContent).toBe(t("actions.noChanges"));
		expect(screen.queryByText(t("header.pending", { count: 1 }))).toBeNull();
		type(screen.getByLabelText(t("collection.label")), "Article");
		expect(review().textContent).toBe(t("actions.review"));
		expect(screen.getByText(t("header.pending", { count: 1 }))).toBeTruthy();
	});

	describe("languages tab", () => {
		const openLocales = async () => {
			renderScreen();
			await screen.findByTestId("collection-post");
			fireEvent.click(screen.getByRole("tab", { name: t("tabs.locales") }));
			return screen.findByTestId("locales-content");
		};

		it("lists the content languages in one card with code, name, default mark and admin name, and has a section for the default language and time zone", async () => {
			const content = await openLocales();
			const row = within(content).getByTestId("locale-en");
			expect(within(row).getByText("en")).toBeTruthy();
			expect(within(row).getByText("English")).toBeTruthy();
			expect(within(row).getByText(t("locales.defaultBadge"))).toBeTruthy();
			expect(within(row).getByText(t("locales.adminName", { label: "English" }))).toBeTruthy();
			expect(within(content).getByText(t("locales.count", { count: 1 }))).toBeTruthy();
			// Two sections, each with its title and description.
			expect(within(content).getByRole("heading", { name: t("locales.contentTitle") })).toBeTruthy();
			const defaults = screen.getByTestId("locales-default");
			expect(within(defaults).getByRole("heading", { name: t("locales.defaultTitle") })).toBeTruthy();
			expect(within(defaults).getByLabelText(t("locales.timeZone"))).toBeTruthy();
			// The default language says what its addresses look like, with an example from the first collection address.
			expect(within(defaults).getByText(/\/posts\/hello/)).toBeTruthy();
		});

		it("adds a language from a small dialog, and the code of a saved language cannot be edited", async () => {
			const content = await openLocales();
			fireEvent.click(within(content).getByRole("button", { name: t("locales.add") }));
			const dialog = await screen.findByTestId("locale-dialog");
			const add = within(dialog).getByRole("button", { name: t("locales.add") }) as HTMLButtonElement;
			expect(add.disabled).toBe(true);
			type(within(dialog).getByLabelText(t("locales.code")), "en");
			type(within(dialog).getByLabelText(t("locales.name")), "Again");
			// The code is taken.
			expect(add.disabled).toBe(true);
			type(within(dialog).getByLabelText(t("locales.code")), "fr");
			type(within(dialog).getByLabelText(t("locales.name")), "Français");
			type(within(dialog).getByLabelText(t("locales.label")), "French");
			expect(add.disabled).toBe(false);
			fireEvent.click(add);
			const row = await screen.findByTestId("locale-fr");
			expect(within(row).getByText(t("locales.adminName", { label: "French" }))).toBeTruthy();

			fireEvent.click(within(row).getByRole("button", { name: t("locales.menu", { name: "Français" }) }));
			fireEvent.click(await screen.findByRole("menuitem", { name: t("locales.edit") }));
			const edit = await screen.findByTestId("locale-dialog");
			expect((within(edit).getByLabelText(t("locales.code")) as HTMLInputElement).disabled).toBe(true);
			fireEvent.click(within(edit).getByRole("button", { name: t("locales.cancel") }));

			fireEvent.click(review());
			await screen.findByTestId("review-summary");
			expect((lastPreview()?.body?.schema as { locales: unknown[] }).locales).toEqual([
				{ code: "en", name: "English" },
				{ code: "fr", name: "Français", label: "French" },
			]);
		});

		it("changes the default language and removes a language from the row menu", async () => {
			const content = await openLocales();
			fireEvent.click(within(content).getByRole("button", { name: t("locales.add") }));
			const dialog = await screen.findByTestId("locale-dialog");
			type(within(dialog).getByLabelText(t("locales.code")), "ko");
			type(within(dialog).getByLabelText(t("locales.name")), "한국어");
			fireEvent.click(within(dialog).getByRole("button", { name: t("locales.add") }));
			await screen.findByTestId("locale-ko");
			fireEvent.click(screen.getByRole("combobox", { name: t("locales.default") }));
			pressOption(await screen.findByRole("option", { name: "한국어 (ko)" }));
			const ko = screen.getByTestId("locale-ko");
			expect(within(ko).getByText(t("locales.defaultBadge"))).toBeTruthy();
			expect(within(screen.getByTestId("locale-en")).queryByText(t("locales.defaultBadge"))).toBeNull();
			fireEvent.click(
				within(screen.getByTestId("locale-en")).getByRole("button", { name: t("locales.menu", { name: "English" }) }),
			);
			fireEvent.click(await screen.findByRole("menuitem", { name: t("row.remove", { name: "en" }) }));
			await waitFor(() => expect(screen.queryByTestId("locale-en")).toBeNull());
		});
	});

	it("groups the site and admin settings into titled sections instead of one long form", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		fireEvent.click(screen.getByRole("tab", { name: t("tabs.site") }));
		const site = await screen.findByTestId("site-settings");
		for (const key of ["site.identityTitle", "site.previewTitle", "site.addressTitle"] as const) {
			expect(within(site).getByRole("heading", { name: t(key) })).toBeTruthy();
		}
		fireEvent.click(screen.getByRole("tab", { name: t("tabs.admin") }));
		const admin = await screen.findByTestId("admin-settings");
		for (const key of ["admin.languageTitle", "admin.featuresTitle", "admin.addressTitle"] as const) {
			expect(within(admin).getByRole("heading", { name: t(key) })).toBeTruthy();
		}
	});

	it("edits the site settings: each control writes its own key under site", async () => {
		await openSettingsTab("site");
		type(await screen.findByLabelText(t("site.name")), "My blog");
		type(screen.getByLabelText(t("site.home")), "https://example.com");
		type(screen.getByLabelText(t("site.previewPath")), "/preview");
		type(screen.getByLabelText(t("site.previewParam")), "lang");
		type(screen.getByLabelText(t("site.alias.new")), "www.example.com");
		fireEvent.click(screen.getByRole("button", { name: t("site.alias.add") }));
		fireEvent.click(screen.getByRole("combobox", { name: t("site.localePrefix") }));
		pressOption(await screen.findByRole("option", { name: t("site.prefix.always") }));

		const file = await reviewedFile();
		expect(file.site).toEqual({
			name: "My blog",
			home: "https://example.com",
			previewPath: "/preview",
			previewLocaleParam: "lang",
			localePrefix: "always",
			aliases: ["www.example.com"],
		});
	});

	it("lists the changed site and admin settings in the review, with the value before and after", async () => {
		state = screenState({ schema: { ...schema(), site: { name: "Blog" } } });
		await openSettingsTab("site");
		type(await screen.findByLabelText(t("site.name")), "Journal");
		fireEvent.click(screen.getByRole("tab", { name: t("tabs.admin") }));
		fireEvent.click(await screen.findByRole("switch", { name: t("admin.templates") }));
		fireEvent.click(review());
		const list = await screen.findByTestId("review-settings");
		expect(list.textContent).toContain('site.name: "Blog" -> "Journal"');
		expect(list.textContent).toContain(`admin.templates: ${t("review.unset")} -> false`);
	});

	it("puts the preview language in the path with a switch, and empties the site section when everything is cleared", async () => {
		state = screenState({ schema: { ...schema(), site: { name: "Blog" } } });
		await openSettingsTab("site");
		fireEvent.click(await screen.findByRole("switch", { name: t("site.previewInPath") }));
		type(screen.getByLabelText(t("site.name")), "");
		const file = await reviewedFile();
		expect(file.site).toEqual({ previewLocaleParam: false });
	});

	it("explains each language prefix option with an example address", async () => {
		await openSettingsTab("site");
		const list = await screen.findByTestId("locale-prefix-explanations");
		for (const mode of ["except-default", "always", "never"] as const) {
			expect(within(list).getByText(t(`site.prefix.${mode}.text`, { default: "en", other: "fr" }))).toBeTruthy();
		}
		expect(list.textContent).toContain("/posts/a");
		expect(list.textContent).toContain("/fr/posts/a");
	});

	it("shows the site URL read-only with where it comes from", async () => {
		state = screenState({ siteUrl: { url: "https://blog.example", from: "env" } });
		await openSettingsTab("site");
		const row = await screen.findByTestId("site-url");
		expect(row.textContent).toContain("https://blog.example");
		expect(row.textContent).toContain(t("site.url.env"));
		cleanup();
		state = screenState();
		await openSettingsTab("site");
		expect((await screen.findByTestId("site-url")).textContent).toContain(t("site.url.none"));
		expect(schemaMessages.messages.en["site.url.none"]).toContain("set SITE_URL where you deploy");
	});

	it("edits the admin settings: the language is picked from the dictionaries and the switches write false", async () => {
		await openSettingsTab("admin");
		fireEvent.click(await screen.findByRole("combobox", { name: t("admin.locale") }));
		pressOption(await screen.findByRole("option", { name: /ko/ }));
		fireEvent.click(screen.getByRole("switch", { name: t("admin.templates") }));
		fireEvent.click(screen.getByRole("switch", { name: t("admin.translations") }));

		const file = await reviewedFile();
		expect(file.admin).toEqual({ locale: "ko", templates: false, translations: false });
	});

	it("turns an admin switch back on by removing its key", async () => {
		state = screenState({ schema: { ...schema(), admin: { templates: false } } });
		await openSettingsTab("admin");
		fireEvent.click(await screen.findByRole("switch", { name: t("admin.templates") }));
		const file = await reviewedFile();
		expect(file.admin).toBeUndefined();
	});

	it("shows admin.path read-only with how to change it", async () => {
		state = screenState({ schema: { ...schema(), admin: { path: "/studio" } } });
		await openSettingsTab("admin");
		expect((await screen.findByTestId("admin-path")).textContent).toBe("/studio");
		expect(screen.getByText(t("admin.pathNote"))).toBeTruthy();
		expect(schemaMessages.messages.en["admin.pathNote"]).toBe(
			"Change it in monti.schema.ts and move the admin route folder.",
		);
		expect(screen.queryByLabelText(t("admin.path"), { selector: "input" })).toBeNull();
	});

	it("keeps the site and admin controls disabled when the screen is read-only", async () => {
		state = screenState({ access: { writable: false, reason: "production" } });
		await openSettingsTab("site");
		expect(((await screen.findByLabelText(t("site.name"))) as HTMLInputElement).disabled).toBe(true);
		expect(screen.queryByRole("button", { name: t("site.alias.add") })).toBeNull();
	});
});
