import { fieldSetsOf, placementsOf } from "@monti-cms/core/site";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { editorMessages } from "../../../editor/messages";
import { commonMessages } from "../../../lib/common.messages";
import { pressOption } from "../../../test/base-ui";
import { jsonResponse as json } from "../../../test/fetch";
import { createTestRouter } from "../../../test/router";
import { entriesMessages } from "../../entries/messages";
import { rememberScroll, takeScroll } from "../../settings/place";
import { SCHEMA_TABS, type SchemaTab } from "../../settings/tabs";
import { AdminQueryProvider } from "../../shared/query-provider";
import { INSPECTOR_PANEL_RESIZE } from "../../shared/side-panel";
import { schemaAdminMessages } from "../admin.messages";
import { schemaCollectionMessages } from "../collection.messages";
import { schemaFieldsMessages } from "../fields.messages";
import { schemaLocalesMessages } from "../locales.messages";
import { schemaMessages } from "../messages";
import { schemaReviewMessages } from "../review.messages";
import type { Obj } from "../schema-model";
import { SchemaSettings } from "../schema-screen";
import { schemaSiteMessages } from "../site.messages";

const nav = createTestRouter();
const { render } = nav;
const t = testSite.createTranslator(schemaMessages);
const te = testSite.createTranslator(editorMessages);
const tc = testSite.createTranslator(commonMessages);
const tSite = testSite.createTranslator(schemaSiteMessages);
const tLocales = testSite.createTranslator(schemaLocalesMessages);
const tCollection = testSite.createTranslator(schemaCollectionMessages);
const tFields = testSite.createTranslator(schemaFieldsMessages);
const tAdmin = testSite.createTranslator(schemaAdminMessages);
const tReview = testSite.createTranslator(schemaReviewMessages);

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ Toaster: () => null, toast }));
const reload = vi.hoisted(() => ({ reloadPage: vi.fn(), rememberSaved: vi.fn(), takeSavedMessage: vi.fn(() => null) }));
vi.mock("../reload", () => reload);

const schema = () => ({
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
	applied: { appliedAt: "2026-01-01T00:00:00.000Z" },
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
	window.history.replaceState(null, "", "/admin/settings/collections");
	state = screenState();
	previewAnswer = () => previewOf();
	saveAnswer = () => ({
		status: 200,
		body: {
			saved: true,
			file: "monti.schema.ts",
			hash: "hash-2",
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
	const [fileLine, setFileLine] = useState<HTMLElement | null>(null);
	return (
		<>
			<p ref={setFileLine} data-testid="file-line" />
			<div role="tablist">
				{SCHEMA_TABS.map((name) => (
					<button key={name} type="button" role="tab" aria-selected={tab === name} onClick={() => setTab(name)}>
						{name}
					</button>
				))}
			</div>
			<SchemaSettings tab={tab} fileSlot={fileLine} />
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
	fireEvent.click(screen.getAllByRole("combobox", { name: tFields("field.kind") }).at(-1) as HTMLElement);
	pressOption(await screen.findByRole("option", { name: optionName }));
}
/** Opens the dialog of the "Add field" button and fills the name (and kind). */
async function startAddingField(name: string, kindName?: string) {
	fireEvent.click(screen.getByRole("button", { name: tFields("field.add") }));
	const dialog = await screen.findByTestId("add-field-dialog");
	type(within(dialog).getByLabelText(tFields("field.newName")), name);
	if (kindName) await pickNewFieldKind(kindName);
	return dialog;
}
const confirmAdd = (dialog: HTMLElement) => fireEvent.click(within(dialog).getByRole("button", { name: tc("add") }));
/** The sheet of a field: opened by its row of the tree. */
async function openFieldSheet(field: string) {
	fireEvent.click(await screen.findByRole("button", { name: tFields("field.toggle", { name: field }) }));
	return screen.findByTestId("field-sheet");
}
const applySheet = async (sheet: HTMLElement) => {
	fireEvent.click(within(sheet).getByRole("button", { name: tc("apply") }));
	await waitFor(() => expect(screen.queryByTestId("field-sheet")).toBeNull());
};
const openTab = (name: "basics" | "fields" | "editor") =>
	fireEvent.click(screen.getByRole("tab", { name: tCollection(`collection.tabs.${name}`) }));
/** The name of the action that adds the SEO plugin's fields (the plugin's tab name differs between the site configs). */
const addSetName = () =>
	tFields("fields.addSet", { name: fieldSetsOf(testSite.plugins).find((set) => set.id === "seo")?.label ?? "SEO" });
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
		expect((screen.getByLabelText(tCollection("collection.label")) as HTMLInputElement).disabled).toBe(true);
		expect(review().disabled).toBe(true);
		expect(screen.queryByRole("button", { name: t("collection.create") })).toBeNull();
		expect(requests.every((request) => request.method === "GET")).toBe(true);
	});

	it("is read-only when the file holds code: it says the admin cannot rewrite it, names the line, and nothing can be reviewed", async () => {
		state = screenState({
			access: {
				writable: false,
				reason: "has_code",
				detail: "line 3: a spread `...`",
				issue: { code: "spread", params: {}, line: 3, column: 5 },
			},
			source: "site",
		});
		renderScreen();

		expect(await screen.findByTestId("schema-read-only")).toBeTruthy();
		expect(screen.getByText(t("readonly.hasCode"))).toBeTruthy();
		// The sentence is in the admin language, built from the issue's code (the server's English sentence is not shown).
		expect(screen.getByTestId("schema-code-detail").textContent).toBe(
			t("literal.line", { line: 3, message: t("literal.spread") }),
		);
		expect(t("readonly.hasCode")).toContain("monti.schema.ts");
		expect((screen.getByLabelText(tCollection("collection.label")) as HTMLInputElement).disabled).toBe(true);
		expect(review().disabled).toBe(true);
	});

	it("names the schema file alone in the header line, with the reason when it is read-only", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		expect(screen.getByTestId("file-line").textContent).toBe("monti.schema.ts");
		cleanup();

		state = screenState({ access: { writable: false, reason: "production" } });
		renderScreen();
		await screen.findByTestId("schema-read-only");
		expect(screen.getByTestId("file-line").textContent).toContain(t("readonly.short.production"));
	});

	it("keeps the open collection and its part across tabs and a reload, and puts the scroll back after a save", async () => {
		renderScreen();
		fireEvent.click(await screen.findByRole("button", { name: /^Tag/ }));
		await screen.findByTestId("collection-tag");
		openTab("fields");
		expect(window.location.search).toBe("?collection=tag&section=fields");

		// Another tab and back: the same collection and part.
		fireEvent.click(screen.getByRole("tab", { name: "site" }));
		fireEvent.click(screen.getByRole("tab", { name: "collections" }));
		await screen.findByTestId("collection-tag");
		expect(screen.getByRole("tab", { name: tCollection("collection.tabs.fields") }).getAttribute("aria-selected")).toBe(
			"true",
		);

		// A reload (a fresh render of the same address) lands in the same place, scrolled where it was.
		cleanup();
		rememberScroll(180);
		renderScreen();
		await screen.findByTestId("collection-tag");
		expect(screen.getByRole("tab", { name: tCollection("collection.tabs.fields") }).getAttribute("aria-selected")).toBe(
			"true",
		);
		expect((screen.getByTestId("schema-screen").querySelector(".overflow-y-auto") as HTMLElement).scrollTop).toBe(180);
	});

	it("remembers how far the page was scrolled when it saves, before the reload", async () => {
		renderScreen();
		type(await screen.findByLabelText(tCollection("collection.label")), "Article");
		(screen.getByTestId("schema-screen").querySelector(".overflow-y-auto") as HTMLElement).scrollTop = 75;
		fireEvent.click(review());
		await screen.findByTestId("review-summary");
		fireEvent.click(screen.getByRole("button", { name: tReview("review.save") }));
		await waitFor(() => expect(reload.reloadPage).toHaveBeenCalled());
		expect(takeScroll()).toBe(75);
	});

	it("has no tab for the file: its seed data and recorded transforms sit under the Admin tab", async () => {
		state = screenState({
			schema: { ...schema(), seed: { post: [] }, migrations: [{ id: "m1", op: "rename" }] },
		});
		renderScreen();
		await screen.findByTestId("collection-post");
		expect(screen.queryByRole("tab", { name: "file" })).toBeNull();
		fireEvent.click(screen.getByRole("tab", { name: "admin" }));
		expect(await screen.findByText("m1")).toBeTruthy();
		expect(screen.getByText(t("file.migrations"))).toBeTruthy();
		expect(screen.getByText("seed")).toBeTruthy();
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
		expect((screen.getByLabelText(tCollection("collection.label")) as HTMLInputElement).value).toBe("Post");
		expect((screen.getByRole("textbox", { name: tCollection("collection.path") }) as HTMLInputElement).value).toBe(
			"posts",
		);
		expect(review().disabled).toBe(true);
		fireEvent.click(screen.getByRole("button", { name: /^Tag/ }));
		expect(await screen.findByTestId("collection-tag")).toBeTruthy();
	});

	it("reorders collections by dragging a handle on each row, with no arrow buttons", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		const row = screen.getByTestId("collection-nav-tag");
		expect(within(row).getByRole("button", { name: t("collection.drag", { name: "Tag" }) })).toBeTruthy();
		// The handle and the row itself are the only buttons.
		expect(within(row).getAllByRole("button")).toHaveLength(2);
	});

	it("checks an edit before saving: the request carries the edited file, and the save sends the hash it started from", async () => {
		renderScreen();
		type(await screen.findByLabelText(tCollection("collection.label")), "Article");
		expect(review().disabled).toBe(false);
		fireEvent.click(review());

		await screen.findByTestId("review-summary");
		expect(lastPreview()?.body).toMatchObject({ schema: { collections: { post: { label: "Article" } } } });
		expect(screen.getByTestId("review-summary").textContent).not.toMatch(/version|버전/i);

		fireEvent.click(screen.getByRole("button", { name: tReview("review.save") }));
		await waitFor(() => expect(reload.reloadPage).toHaveBeenCalled());
		const put = requests.find((request) => request.method === "PUT");
		expect(put?.body).toMatchObject({ baseHash: "hash-1", schema: { collections: { post: { label: "Article" } } } });
		expect(reload.rememberSaved).toHaveBeenCalledWith(expect.not.stringMatching(/version|버전/i));
	});

	it("acknowledges the impacts the dialog showed: the save carries their keys", async () => {
		const impact = (key: string) => ({
			key,
			change: { kind: "field_removed", collection: "post", field: "summary", fieldKind: "text" },
			entries: 2,
			sample: [],
			consequence: "orphaned",
			checked: true,
		});
		const shown = ["field_removed:post:summary", "locale_removed:ko"];
		previewAnswer = () => previewOf({ impacts: shown.map(impact) });
		renderScreen();
		type(await screen.findByLabelText(tCollection("collection.label")), "Article");
		fireEvent.click(review());
		await screen.findByTestId("review-summary");

		fireEvent.click(screen.getByRole("button", { name: tReview("review.save") }));
		await waitFor(() => expect(requests.some((request) => request.method === "PUT")).toBe(true));
		const sent = requests.find((request) => request.method === "PUT")?.body?.acknowledged as string[];
		expect([...sent].sort()).toEqual([...shown].sort());
	});

	it("toggles collection folders on and off", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		const foldersSwitch = screen.getByRole("switch", { name: tCollection("collection.folders") });
		expect(foldersSwitch.getAttribute("aria-checked")).toBe("true");

		fireEvent.click(foldersSwitch);
		expect(foldersSwitch.getAttribute("aria-checked")).toBe("false");
		expect(review().disabled).toBe(false);
		fireEvent.click(review());

		await screen.findByTestId("review-summary");
		expect(lastPreview()?.body).toMatchObject({ schema: { collections: { post: { folders: false } } } });
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

	it("offers the SEO plugin's fields on the Fields tab until the collection has them, and adds them to the draft as plain fields", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		openTab("fields");
		await screen.findByTestId("fields-card");
		const seoName = addSetName();
		fireEvent.click(screen.getByRole("button", { name: seoName }));
		// The collection now has fields with the SEO roles, so the action goes away.
		await waitFor(() => expect(screen.queryByRole("button", { name: seoName })).toBeNull());
		fireEvent.click(review());
		await screen.findByTestId("review-summary");
		const fields = (lastPreview()?.body?.schema as { collections: { post: { fields: Record<string, unknown> } } })
			.collections.post.fields;
		expect(Object.keys(fields).slice(0, 4)).toEqual(["title", "slug", "summary", "status"]);
		expect(fields.seoTitle).toMatchObject({ kind: "text", role: "seoTitle", input: "seo-title" });
		expect(fields.seoPreview).toMatchObject({ kind: "view", view: "search" });
		// Plain data: nothing but JSON values reaches the file.
		expect(JSON.parse(JSON.stringify(fields))).toEqual(fields);
	});

	it("does not offer the SEO fields for a collection that already has them", async () => {
		state = screenState({
			schema: {
				...schema(),
				collections: {
					...schema().collections,
					post: {
						...schema().collections.post,
						fields: {
							...schema().collections.post.fields,
							metaTitle: { kind: "text", label: "Meta title", role: "seoTitle" },
						},
					},
				},
			},
		});
		renderScreen();
		await screen.findByTestId("collection-post");
		openTab("fields");
		await screen.findByTestId("fields-card");
		expect(screen.queryByRole("button", { name: addSetName() })).toBeNull();
	});

	it("refuses a field name that is taken or malformed", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		openTab("fields");
		await screen.findByTestId("fields-card");
		const dialog = await startAddingField("summary");
		expect((within(dialog).getByRole("button", { name: tc("add") }) as HTMLButtonElement).disabled).toBe(true);
		type(within(dialog).getByLabelText(tFields("field.newName")), "1bad");
		expect((within(dialog).getByRole("button", { name: tc("add") }) as HTMLButtonElement).disabled).toBe(true);
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
		expect(within(row("tagIds")).getByText(new RegExp(tFields("sum.ordered")))).toBeTruthy();
		expect(within(row("series")).getByText("← Series")).toBeTruthy();
		expect(within(row("cover")).getByText("media")).toBeTruthy();
		const policy = row("policy");
		expect(within(policy).getByText("one of")).toBeTruthy();
		expect(within(policy).getByText("normal | deprecated", { selector: "div" })).toBeTruthy();
		// Each option is a branch; the field of an option sits under it, and an option without fields says so.
		expect(within(policy).getByText('= "normal"')).toBeTruthy();
		expect(within(policy).getByText('= "deprecated"')).toBeTruthy();
		expect(within(policy).getByText(tFields("fields.noExtra"))).toBeTruthy();
		const branch = within(policy).getByTestId("field-replacementId");
		expect(within(branch).getByText("→ Post")).toBeTruthy();
		const order = [...policy.querySelectorAll("[data-testid^='field-'], span")]
			.map((node) => node.textContent)
			.filter((text) => text === '= "deprecated"' || text === "replacementId");
		expect(order).toEqual(['= "deprecated"', "replacementId"]);
		// A field of a branch opens in the same sheet.
		fireEvent.click(within(branch).getByRole("button", { name: tFields("field.toggle", { name: "replacementId" }) }));
		expect(await screen.findByTestId("field-sheet")).toBeTruthy();
	});

	it("opens the field in a sheet with its name read-only, and Cancel leaves the file as it was", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		openTab("fields");
		const sheet = await openFieldSheet("summary");
		expect(within(sheet).getByText(tFields("sheet.nameHint"))).toBeTruthy();
		expect(within(sheet).queryByRole("textbox", { name: tFields("sheet.name") })).toBeNull();
		type(within(sheet).getByLabelText(tFields("sheet.label")), "Teaser");
		fireEvent.click(within(sheet).getByRole("button", { name: tc("cancel") }));
		await waitFor(() => expect(screen.queryByTestId("field-sheet")).toBeNull());
		expect(review().disabled).toBe(true);
	});

	it("writes the edits of the sheet to the file only on Apply", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		openTab("fields");
		const sheet = await openFieldSheet("summary");
		type(within(sheet).getByLabelText(tFields("sheet.label")), "Teaser");
		fireEvent.click(within(sheet).getByRole("switch", { name: tFields("field.required") }));
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
		fireEvent.click(within(sheet).getByRole("switch", { name: tFields("field.isTitle") }));
		await applySheet(sheet);
		expect(within(screen.getByTestId("field-summary")).getByTestId("title-badge")).toBeTruthy();
		expect(within(screen.getByTestId("field-title")).queryByTestId("title-badge")).toBeNull();
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
		const value = within(sheet).getAllByLabelText(tFields("options.value"))[0] as HTMLElement;
		type(value, "idea");
		fireEvent.keyDown(value, { key: "Enter" });
		await applySheet(sheet);

		fireEvent.click(review());
		const decision = await screen.findByTestId("decision-field_removed:post:summary");
		expect(lastPreview()?.body?.renames).toEqual([
			{ kind: "option", collection: "post", field: "status", from: "draft", to: "idea" },
		]);
		expect(within(decision).getByText(tReview("review.entriesCount", { count: 3 }))).toBeTruthy();
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
		fireEvent.click(await screen.findByRole("button", { name: tReview("review.save") }));
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
		type(await screen.findByLabelText(tCollection("collection.label")), "Article");
		fireEvent.click(review());
		const list = await screen.findByTestId("schema-issues");
		expect(within(list).getByText("collections.post.fields.summary.max")).toBeTruthy();
		expect((screen.getByRole("button", { name: tReview("review.save") }) as HTMLButtonElement).disabled).toBe(true);
	});

	it("says when the file changed since it was opened", async () => {
		saveAnswer = () => ({ status: 409, body: { error: { code: "schema_conflict", message: "changed" } } });
		renderScreen();
		type(await screen.findByLabelText(tCollection("collection.label")), "Article");
		fireEvent.click(review());
		await screen.findByTestId("review-summary");
		fireEvent.click(screen.getByRole("button", { name: tReview("review.save") }));
		expect(await screen.findByText(tReview("save.conflict"))).toBeTruthy();
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

	it("ends the basics tab with the remove section, which says what removing does", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		expect(screen.getByText(tCollection("collection.dangerDescription"))).toBeTruthy();
		const sections = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
		expect(sections.at(-1)).toBe(tCollection("collection.dangerTitle"));
		const button = screen.getByRole("button", { name: t("collection.remove") });
		expect(button.closest("section")?.querySelector(".bg-monti-card")).toBeNull();
	});

	it("labels the allowed blocks and styles by name, and keeps the id as a hint", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		openTab("editor");
		const table = await screen.findByRole("checkbox", { name: te("toolbar.table") });
		expect(table).toBeTruthy();
		expect(screen.getByText(te("toolbar.table")).getAttribute("title")).toBe("table");
		expect(screen.queryByRole("checkbox", { name: "table" })).toBeNull();
		expect(screen.getByRole("checkbox", { name: te("toolbar.image") })).toBeTruthy();
		// A block without a dictionary label falls back to its definition's label, or its id.
		expect(screen.getByTitle("callout").textContent).toBe(testSite.BLOCK_BY_NAME.get("callout")?.label ?? "callout");
	});

	it("shows the editor tab only for a collection with a body", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		expect(screen.getByRole("tab", { name: tCollection("collection.tabs.editor") })).toBeTruthy();
		fireEvent.click(screen.getByRole("combobox", { name: tCollection("collection.kind") }));
		pressOption(await screen.findByRole("option", { name: t("collection.kindItem") }));
		expect(screen.queryByRole("tab", { name: tCollection("collection.tabs.editor") })).toBeNull();
	});

	it("limits the body of a collection to the blocks that are ticked", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		openTab("editor");
		// Everything is ticked at first; untick one.
		fireEvent.click(
			await screen
				.findByTitle("callout")
				.then((label) => within(label.parentElement as HTMLElement).getByRole("checkbox")),
		);
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

		const confirm = within(dialog).getByRole("button", {
			name: tCollection("collection.createConfirm"),
		}) as HTMLButtonElement;
		expect(confirm.disabled).toBe(true);
		// A name that is taken is refused with the reason.
		type(within(dialog).getByLabelText(tCollection("collection.newName")), "post");
		expect(within(dialog).getByText(t("name.taken"))).toBeTruthy();
		expect(confirm.disabled).toBe(true);

		type(within(dialog).getByLabelText(tCollection("collection.newName")), "note");
		expect(
			(within(dialog).getByRole("textbox", { name: tCollection("collection.path") }) as HTMLInputElement).value,
		).toBe("notes");
		// Each kind says what it is for.
		expect(within(dialog).getByText(tCollection("collection.kindDocumentExplain"))).toBeTruthy();
		expect(within(dialog).getByText(tCollection("collection.kindItemExplain"))).toBeTruthy();
		// Only the middle of the address is typed: the slash before it and `/:slug` after it are text.
		expect(within(dialog).getByText("/:slug")).toBeTruthy();
		// An address of the writer's own stays when the name changes.
		type(within(dialog).getByRole("textbox", { name: tCollection("collection.path") }), "ideas");
		type(within(dialog).getByLabelText(tCollection("collection.newName")), "notes");
		expect(
			(within(dialog).getByRole("textbox", { name: tCollection("collection.path") }) as HTMLInputElement).value,
		).toBe("ideas");

		fireEvent.click(confirm);
		await waitFor(() => expect(screen.queryByTestId("new-collection-dialog")).toBeNull());
		expect(await screen.findByTestId("collection-notes")).toBeTruthy();
		expect((screen.getByRole("textbox", { name: tCollection("collection.path") }) as HTMLInputElement).value).toBe(
			"ideas",
		);
		openTab("fields");
		expect(screen.getByTestId("field-title")).toBeTruthy();
		expect(screen.getByTestId("field-slug")).toBeTruthy();

		fireEvent.click(review());
		await screen.findByTestId("review-summary");
		const notes = (lastPreview()?.body?.schema as { collections: Record<string, Record<string, unknown>> }).collections
			.notes;
		expect(notes).toMatchObject({
			kind: "document",
			path: "/ideas/:slug",
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
		const name = within(dialog).getByLabelText(tCollection("collection.newName"));
		const id = () => (within(dialog).getByLabelText(tCollection("collection.newId")) as HTMLInputElement).value;
		const path = () =>
			`/${(within(dialog).getByRole("textbox", { name: tCollection("collection.path") }) as HTMLInputElement).value}/:slug`;

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
		const confirm = within(dialog).getByRole("button", {
			name: tCollection("collection.createConfirm"),
		}) as HTMLButtonElement;
		expect(confirm.disabled).toBe(true);
		type(within(dialog).getByLabelText(tCollection("collection.newId")), "memo");
		expect(path()).toBe("/memos/:slug");
		expect(confirm.disabled).toBe(false);

		// Once the address is edited it stops following the identifier.
		type(within(dialog).getByRole("textbox", { name: tCollection("collection.path") }), "my");
		type(within(dialog).getByLabelText(tCollection("collection.newId")), "memos");
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
		type(within(dialog).getByLabelText(tCollection("collection.newName")), "category");
		fireEvent.click(within(dialog).getByRole("radio", { name: new RegExp(t("collection.kindItem")) }));
		expect(within(dialog).queryByRole("textbox", { name: tCollection("collection.path") })).toBeNull();
		fireEvent.click(within(dialog).getByRole("button", { name: tCollection("collection.createConfirm") }));
		expect(await screen.findByTestId("collection-category")).toBeTruthy();
		expect(screen.queryByRole("textbox", { name: tCollection("collection.path") })).toBeNull();
	});

	it("cannot delete the title field, and the slug field only while the address does not use :slug", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		openTab("fields");
		const deleteOf = async (field: string) => {
			const sheet = await openFieldSheet(field);
			return {
				sheet,
				button: within(sheet).getByRole("button", { name: tFields("sheet.delete") }) as HTMLButtonElement,
			};
		};
		const close = async (sheet: HTMLElement) => {
			fireEvent.click(within(sheet).getByRole("button", { name: tc("cancel") }));
			await waitFor(() => expect(screen.queryByTestId("field-sheet")).toBeNull());
		};
		let opened = await deleteOf("title");
		expect(opened.button.disabled).toBe(true);
		expect(opened.button.getAttribute("title")).toBe(tFields("field.removeBlocked.title"));
		await close(opened.sheet);
		opened = await deleteOf("slug");
		expect(opened.button.disabled).toBe(true);
		expect(opened.button.getAttribute("title")).toBe(tFields("field.removeBlocked.slug"));
		await close(opened.sheet);
		opened = await deleteOf("summary");
		expect(opened.button.disabled).toBe(false);
		await close(opened.sheet);

		// Without :slug in the address the slug field can go.
		openTab("basics");
		fireEvent.click(screen.getByRole("switch", { name: tCollection("collection.path") }));
		openTab("fields");
		opened = await deleteOf("slug");
		expect(opened.button.disabled).toBe(false);
		fireEvent.click(opened.button);
		await waitFor(() => expect(screen.queryByTestId("field-slug")).toBeNull());
	});

	it("locks title and slug field kinds and options, shows role picker with descriptions", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		openTab("fields");

		// Title field sheet
		let sheet = await openFieldSheet("title");
		fireEvent.click(within(sheet).getByRole("tab", { name: tFields("sheet.tabAdvanced") }));
		const titleKindSelect = within(sheet).getByRole("combobox", { name: tFields("field.kind") }) as HTMLButtonElement;
		expect(titleKindSelect.disabled).toBe(true);
		expect(within(sheet).getByText(tFields("field.kindFixedTitleHint"))).toBeTruthy();
		const titleRoleSelect = within(sheet).getByRole("combobox", { name: tFields("field.role") }) as HTMLButtonElement;
		expect(titleRoleSelect.disabled).toBe(true);
		expect(within(sheet).getByText(tFields("field.roleFixedTitleHint"))).toBeTruthy();
		// No custom input or input options shown since no plugins register custom inputs and field has none
		expect(within(sheet).queryByLabelText(tFields("field.input"))).toBeNull();
		expect(within(sheet).queryByLabelText(tFields("field.inputOptions"))).toBeNull();
		fireEvent.click(within(sheet).getByRole("button", { name: tc("cancel") }));
		await waitFor(() => expect(screen.queryByTestId("field-sheet")).toBeNull());

		// Slug field sheet
		sheet = await openFieldSheet("slug");
		fireEvent.click(within(sheet).getByRole("tab", { name: tFields("sheet.tabAdvanced") }));
		const slugKindSelect = within(sheet).getByRole("combobox", { name: tFields("field.kind") }) as HTMLButtonElement;
		expect(slugKindSelect.disabled).toBe(true);
		expect(within(sheet).getByText(tFields("field.kindFixedSlugHint"))).toBeTruthy();
		// Slug has neither role nor custom input
		expect(within(sheet).queryByRole("combobox", { name: tFields("field.role") })).toBeNull();
		expect(within(sheet).queryByLabelText(tFields("field.input"))).toBeNull();
		fireEvent.click(within(sheet).getByRole("button", { name: tc("cancel") }));
		await waitFor(() => expect(screen.queryByTestId("field-sheet")).toBeNull());

		// Summary field sheet (regular text field)
		sheet = await openFieldSheet("summary");
		fireEvent.click(within(sheet).getByRole("tab", { name: tFields("sheet.tabAdvanced") }));
		const summaryKindSelect = within(sheet).getByRole("combobox", { name: tFields("field.kind") }) as HTMLButtonElement;
		expect(summaryKindSelect.disabled).toBe(false);
		const summaryRoleSelect = within(sheet).getByRole("combobox", { name: tFields("field.role") }) as HTMLButtonElement;
		expect(summaryRoleSelect.disabled).toBe(false);
		expect(within(sheet).queryByLabelText(tFields("field.input"))).toBeNull();
		fireEvent.click(within(sheet).getByRole("button", { name: tc("cancel") }));
		await waitFor(() => expect(screen.queryByTestId("field-sheet")).toBeNull());
	});

	it("gives the collections workspace all the width and keeps the form-like tabs at the readable width", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		const body = () => screen.getByTestId("schema-screen").querySelector("[class*='max-w-']") as HTMLElement;
		expect(body().className).toContain("max-w-none");
		fireEvent.click(screen.getByRole("tab", { name: "site" }));
		await screen.findByTestId("site-settings");
		expect(body().className).toContain("max-w-[1160px]");
	});

	it("splits a collection into tabs: Basics first, and the body limits in their own; list columns are not chosen here", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
		expect(tabs).toEqual(
			expect.arrayContaining(
				["basics", "fields", "editor"].map((name) => tCollection(`collection.tabs.${name as "basics"}`)),
			),
		);
		// List columns are chosen on the list screen, so there is no list tab here.
		expect(tabs).not.toContain("List");
		expect(tabs).not.toContain("목록");
		// Basics is open: the address is there, the settings of the other tabs are not.
		expect(screen.getByRole("textbox", { name: tCollection("collection.path") })).toBeTruthy();
		expect(screen.queryByText(tCollection("allowed.title"))).toBeNull();
		expect(screen.queryByTestId("field-title")).toBeNull();

		openTab("editor");
		expect(await screen.findByText(tCollection("allowed.title"))).toBeTruthy();
		// Everything is allowed by default: all 3 sections have "Allow all".
		expect(screen.getAllByText(tCollection("allowed.all"))).toHaveLength(3);
		expect(screen.queryByRole("textbox", { name: tCollection("collection.path") })).toBeNull();
	});

	describe("layout in the fields tree", () => {
		const defaultTabName = testSite.createTranslator(entriesMessages)("tab.default");
		/** The tab the SEO plugin of the site under test places its fields in. */
		const seoTab =
			placementsOf(testSite.plugins).find((placement) => placement.roles?.includes("seoTitle"))?.tab ?? "SEO";
		const savedPost = () =>
			(
				lastPreview()?.body?.schema as {
					collections: { post: { fields: Record<string, unknown>; layout?: unknown; defaultTab?: unknown } };
				}
			).collections.post;
		/** Moves a field with the row's move button: it opens a list of places. */
		const moveTo = async (field: string, destination: string) => {
			fireEvent.click(await screen.findByRole("button", { name: tFields("layout.move", { name: field }) }));
			const dialog = await screen.findByTestId("move-dialog");
			fireEvent.click(within(dialog).getByRole("button", { name: destination }));
		};
		beforeEach(() => window.localStorage.clear());
		const wideWindow = () =>
			vi.stubGlobal("matchMedia", (query: string) => ({
				matches: query.includes("1280"),
				media: query,
				addEventListener: () => {},
				removeEventListener: () => {},
			}));
		/** The labels in the preview, top to bottom: what the real panel draws and in what order. */
		const previewLabels = () =>
			Array.from(document.querySelectorAll('[data-testid="layout-preview"] label')).map((label) =>
				label.textContent?.trim(),
			);
		const openFields = async () => {
			renderScreen();
			await screen.findByTestId("collection-post");
			openTab("fields");
			await screen.findByTestId("fields-card");
		};

		it("deletes with a button on every row, named after the row, reorders by dragging, and keeps no menu", async () => {
			await openFields();
			expect(screen.queryByRole("button", { name: /^(Actions for|.* 작업$)/ })).toBeNull();
			expect(screen.getByRole("button", { name: tFields("fields.drag", { name: "slug" }) })).toBeTruthy();

			// Delete is a staged change: the row goes and the review has it.
			fireEvent.click(screen.getByRole("button", { name: t("row.remove", { name: "summary" }) }));
			await waitFor(() => expect(screen.queryByTestId("field-summary")).toBeNull());

			// A group has its handle and delete; a tab, which cannot be dragged, keeps its arrows.
			fireEvent.click(screen.getByRole("button", { name: tFields("layout.addGroup") }));
			fireEvent.click(screen.getByRole("button", { name: tFields("layout.addTab") }));
			await screen.findByTestId("tab-1");
			for (const label of [
				tFields("layout.dragGroup", { name: tFields("layout.newGroup") }),
				tFields("layout.removeGroup", { name: tFields("layout.newGroup") }),
				tFields("layout.upTab", { name: tFields("layout.newTab") }),
				tFields("layout.downTab", { name: tFields("layout.newTab") }),
				tFields("layout.removeTab", { name: tFields("layout.newTab") }),
			]) {
				expect(screen.getByRole("button", { name: label })).toBeTruthy();
			}
			fireEvent.click(
				screen.getByRole("button", { name: tFields("layout.removeTab", { name: tFields("layout.newTab") }) }),
			);
			await waitFor(() => expect(screen.queryByTestId("tab-1")).toBeNull());
		});

		it("adds a group, renames it in place, and saves the group with the order of the fields", async () => {
			await openFields();
			fireEvent.click(screen.getByRole("button", { name: tFields("layout.addGroup") }));
			const title = (await screen.findByDisplayValue(tFields("layout.newGroup"))) as HTMLInputElement;
			type(title, "Details");
			fireEvent.blur(title);
			await screen.findByDisplayValue("Details");

			await moveTo("summary", "Details");

			fireEvent.click(review());
			await screen.findByTestId("review-summary");
			const post = savedPost();
			expect(post.layout).toEqual([{ fields: ["slug", "status"] }, { group: "Details", fields: ["summary"] }]);
			// The grouped field comes first in the file; the title is pinned before everything.
			expect(Object.keys(post.fields)).toEqual(["title", "slug", "status", "summary"]);
		});

		it("collapses a group at first", async () => {
			await openFields();
			fireEvent.click(screen.getByRole("button", { name: tFields("layout.addGroup") }));
			await screen.findByDisplayValue(tFields("layout.newGroup"));
			fireEvent.click(
				await screen.findByRole("button", {
					name: tFields("layout.collapseToggle", { name: tFields("layout.newGroup") }),
				}),
			);
			expect(await screen.findByText(tFields("layout.collapsedMark"))).toBeTruthy();
			fireEvent.click(review());
			await screen.findByTestId("review-summary");
			expect(savedPost().layout).toEqual([
				{ fields: ["slug", "summary", "status"] },
				{ group: tFields("layout.newGroup"), fields: [], collapsed: true },
			]);
		});

		it("deletes a group, sending its fields back to no group", async () => {
			await openFields();
			fireEvent.click(screen.getByRole("button", { name: tFields("layout.addGroup") }));
			await screen.findByDisplayValue(tFields("layout.newGroup"));
			await moveTo("summary", tFields("layout.newGroup"));
			fireEvent.click(
				await screen.findByRole("button", {
					name: tFields("layout.removeGroup", { name: tFields("layout.newGroup") }),
				}),
			);
			await waitFor(() => expect(screen.queryByDisplayValue(tFields("layout.newGroup"))).toBeNull());
			fireEvent.click(review());
			await screen.findByTestId("review-summary");
			const post = savedPost();
			expect(post.layout).toBeUndefined();
			expect(Object.keys(post.fields)).toEqual(["title", "slug", "status", "summary"]);
		});

		it("shows the default tab by default, renames it, and moves a group into a new tab", async () => {
			await openFields();
			expect(screen.getByTestId("tab-0")).toBeTruthy();
			expect(screen.getByDisplayValue(defaultTabName)).toBeTruthy();

			// The default tab can be renamed.
			const defaultTabInput = screen.getByDisplayValue(defaultTabName) as HTMLInputElement;
			expect(defaultTabInput.disabled).toBe(false);
			type(defaultTabInput, "CustomTab");
			fireEvent.blur(defaultTabInput);
			await screen.findByDisplayValue("CustomTab");

			fireEvent.click(screen.getByRole("button", { name: tFields("layout.addGroup") }));
			await screen.findByDisplayValue(tFields("layout.newGroup"));
			fireEvent.click(screen.getByRole("button", { name: tFields("layout.addTab") }));
			await screen.findByTestId("tab-1");

			fireEvent.click(
				await screen.findByRole("button", { name: tFields("layout.moveGroup", { name: tFields("layout.newGroup") }) }),
			);
			fireEvent.click(
				within(await screen.findByTestId("move-dialog")).getByRole("button", { name: tFields("layout.newTab") }),
			);
			fireEvent.click(review());
			await screen.findByTestId("review-summary");
			expect(savedPost().defaultTab).toBe("CustomTab");
			expect(savedPost().layout).toEqual([
				{ group: tFields("layout.newGroup"), fields: [], tab: tFields("layout.newTab") },
			]);
		});

		it("marks the title as not in the properties panel and cannot move it into a group", async () => {
			await openFields();
			const row = screen.getByTestId("field-title");
			expect(within(row).getByText(tFields("layout.notInPanel"))).toBeTruthy();
			expect(within(row).getByText(tFields("layout.notInPanel")).getAttribute("title")).toBe(
				tFields("layout.notInPanel.title"),
			);
			expect(within(row).queryByRole("button", { name: tFields("layout.move", { name: "title" }) })).toBeNull();
		});

		it("shows a field a plugin placed inside its own tab, locked there", async () => {
			const withPlugin = schema();
			Object.assign(withPlugin.collections.post.fields, {
				seoTitle: { kind: "text", label: "SEO title", role: "seoTitle" },
			});
			state = screenState({ schema: withPlugin });
			await openFields();
			expect(screen.getByTestId("tab-1")).toBeTruthy();
			const seo = screen.getByTestId("field-seoTitle");
			expect(within(seo).getByText(tFields("layout.pluginPlaced"))).toBeTruthy();
			expect(within(seo).getByRole("button", { name: t("row.remove", { name: "seoTitle" }) })).toBeTruthy();
			// The tab is the plugin's: it cannot be renamed.
			expect((screen.getByDisplayValue(seoTab) as HTMLInputElement).disabled).toBe(true);
			// The plugin places it: it cannot be moved, only removed.
			expect(within(seo).queryByRole("button", { name: tFields("layout.move", { name: "seoTitle" }) })).toBeNull();
			expect(
				(within(seo).getByRole("button", { name: tFields("fields.drag", { name: "seoTitle" }) }) as HTMLButtonElement)
					.disabled,
			).toBe(true);
		});

		it("shows fields in no group where the panel draws them, and an unrelated move leaves them in place", async () => {
			const withRun = schema();
			(withRun.collections.post as Record<string, unknown>).layout = [
				{ fields: ["slug", "summary"] },
				{ group: "Classification", fields: ["status"] },
			];
			state = screenState({ schema: withRun });
			wideWindow();
			await openFields();
			const order = () =>
				Array.from(document.querySelectorAll('[data-testid^="field-"], [data-testid^="group-"]')).map((row) =>
					row.getAttribute("data-testid"),
				);
			// The tree lists the fields in no group first, then the group, as the panel does.
			expect(order().filter((id) => id !== "field-title")).toEqual([
				"field-slug",
				"field-summary",
				"group-0-1",
				"field-status",
			]);
			await screen.findByTestId("layout-preview");
			expect(previewLabels().slice(0, 2)).toEqual(["Address", "Summary"]);

			// Moving another field does not move them.
			await moveTo("status", tFields("layout.moveOut"));
			await waitFor(() => expect(order().filter((id) => id !== "field-title")[0]).toBe("field-slug"));
			expect(previewLabels().slice(0, 2)).toEqual(["Address", "Summary"]);
			fireEvent.click(review());
			await screen.findByTestId("review-summary");
			expect(savedPost().layout).toEqual([{ fields: ["slug", "summary"] }, { group: "Classification", fields: [] }]);
			vi.unstubAllGlobals();
		});

		it("previews the real panel beside the tree: the real inputs, the title left out, labelled as not saved", async () => {
			wideWindow();
			await openFields();
			const preview = await screen.findByTestId("layout-preview");
			expect(within(preview).getByText(tFields("layout.previewLabel"))).toBeTruthy();
			// The title is above the body, so the panel does not draw it.
			expect(within(preview).queryByLabelText(/^Title/)).toBeNull();
			// Real inputs of each kind work: a text box takes typing, a select opens its options.
			const summary = within(preview).getByLabelText("Summary") as HTMLTextAreaElement | HTMLInputElement;
			fireEvent.change(summary, { target: { value: "typed in the preview" } });
			expect((within(preview).getByLabelText("Summary") as HTMLInputElement).value).toBe("typed in the preview");
			fireEvent.click(within(preview).getByRole("combobox", { name: /Status/ }));
			pressOption(await screen.findByRole("option", { name: "Live" }));
			expect(within(preview).getByRole("combobox", { name: /Status/ }).textContent).toContain("Live");
			expect(within(preview).getAllByRole("tab").length).toBeGreaterThan(0);
			vi.unstubAllGlobals();
		});

		it("shows a conditional field's branch only for the chosen option, switches tabs, and writes nothing", async () => {
			const rich = schema();
			Object.assign(rich.collections.post.fields, {
				policy: {
					kind: "conditional",
					label: "Policy",
					discriminant: {
						kind: "select",
						label: "Policy",
						options: { normal: "Normal", deprecated: "Deprecated" },
						defaultValue: "normal",
					},
					values: { normal: {}, deprecated: { replacement: { kind: "text", label: "Replacement note" } } },
				},
				seoTitle: { kind: "text", label: "SEO title", role: "seoTitle" },
			});
			state = screenState({ schema: rich });
			wideWindow();
			await openFields();
			const preview = await screen.findByTestId("layout-preview");
			expect(within(preview).queryByLabelText("Replacement note")).toBeNull();
			fireEvent.click(within(preview).getByRole("combobox", { name: /Policy/ }));
			pressOption(await screen.findByRole("option", { name: "Deprecated" }));
			expect(await within(preview).findByLabelText("Replacement note")).toBeTruthy();
			fireEvent.click(within(preview).getByRole("combobox", { name: /Policy/ }));
			pressOption(await screen.findByRole("option", { name: "Normal" }));
			await waitFor(() => expect(within(preview).queryByLabelText("Replacement note")).toBeNull());

			// A plugin's own tab is a real tab of the panel.
			expect(within(preview).queryByLabelText("SEO title")).toBeNull();
			fireEvent.click(within(preview).getByRole("tab", { name: seoTab }));
			expect(await within(preview).findByLabelText("SEO title")).toBeTruthy();

			// Nothing typed or picked reached the server: only reads were made.
			expect(requests.filter((request) => request.method !== "GET")).toEqual([]);
			vi.unstubAllGlobals();
		});

		it("follows the draft without saving: a moved field shows in its group in the preview", async () => {
			wideWindow();
			await openFields();
			fireEvent.click(screen.getByRole("button", { name: tFields("layout.addGroup") }));
			fireEvent.click(screen.getByRole("button", { name: tFields("layout.addGroup") }));
			await moveTo("summary", tFields("layout.newGroup"));
			const group = await within(screen.getByTestId("layout-preview")).findByRole("region", {
				name: tFields("layout.newGroup"),
			});
			expect(within(group).getByLabelText("Summary")).toBeTruthy();
			expect(requests.filter((request) => request.method !== "GET")).toEqual([]);
			vi.unstubAllGlobals();
		});

		it("opens as wide as the entry editor's properties panel, and can be resized", async () => {
			wideWindow();
			await openFields();
			const side = await screen.findByTestId("layout-preview-side");
			const handle = within(side).getByRole("separator");
			expect(Number(handle.getAttribute("aria-valuenow"))).toBe(INSPECTOR_PANEL_RESIZE.defaultWidth);
			fireEvent.keyDown(handle, { key: "ArrowLeft", shiftKey: true });
			expect(Number(handle.getAttribute("aria-valuenow"))).toBe(INSPECTOR_PANEL_RESIZE.defaultWidth + 64);
			vi.unstubAllGlobals();
		});

		it("shows the settings column only while the tree card is wide enough, following its width", async () => {
			const observers: { callback: ResizeObserverCallback; element: Element | null }[] = [];
			vi.stubGlobal(
				"ResizeObserver",
				class {
					entry: { callback: ResizeObserverCallback; element: Element | null };
					constructor(callback: ResizeObserverCallback) {
						this.entry = { callback, element: null };
						observers.push(this.entry);
					}
					observe(element: Element) {
						this.entry.element = element;
					}
					unobserve() {}
					disconnect() {}
				},
			);
			await openFields();
			const card = await screen.findByTestId("fields-card");
			const resizeTo = (width: number) =>
				act(() => {
					for (const observer of observers) {
						if (observer.element === card) {
							observer.callback([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver);
						}
					}
				});
			const settingsHeader = () => within(card).getByText(tFields("fields.colSettings"));
			resizeTo(500);
			await waitFor(() => expect(settingsHeader().className).toContain("hidden"));
			expect(settingsHeader().className).not.toMatch(/(^|\s)block(\s|$)/);
			resizeTo(1400);
			await waitFor(() => expect(settingsHeader().className).toMatch(/(^|\s)block(\s|$)/));
			resizeTo(700);
			await waitFor(() => expect(settingsHeader().className).not.toMatch(/(^|\s)block(\s|$)/));
			vi.unstubAllGlobals();
		});

		it("caps the tree at a width that suits its columns, with the preview right beside it", async () => {
			wideWindow();
			await openFields();
			const side = await screen.findByTestId("layout-preview-side");
			const row = side.parentElement as HTMLElement;
			// The first column stops growing at the cap; the preview follows it, not the page edge.
			expect(row.className).toContain("grid-cols-[minmax(0,1000px)_var(--panel-width)]");
			expect(screen.getByTestId("fields-card").className).toContain("max-w-[1000px]");
			vi.unstubAllGlobals();
		});

		it("can be closed and opened again, and remembers it", async () => {
			wideWindow();
			await openFields();
			await screen.findByTestId("layout-preview");
			fireEvent.click(screen.getByRole("button", { name: tFields("layout.preview") }));
			await waitFor(() => expect(screen.queryByTestId("layout-preview")).toBeNull());
			cleanup();
			await openFields();
			expect(screen.queryByTestId("layout-preview")).toBeNull();
			fireEvent.click(screen.getByRole("button", { name: tFields("layout.preview") }));
			expect(await screen.findByTestId("layout-preview")).toBeTruthy();
			vi.unstubAllGlobals();
		});

		it("opens the preview in a side panel on a narrow window", async () => {
			await openFields();
			expect(screen.queryByTestId("layout-preview")).toBeNull();
			fireEvent.click(screen.getByRole("button", { name: tFields("layout.preview") }));
			const drawer = await screen.findByTestId("layout-preview-drawer");
			expect(within(drawer).getByTestId("layout-preview")).toBeTruthy();
			fireEvent.click(within(drawer).getByRole("button", { name: tFields("layout.previewClose") }));
			expect(screen.queryByTestId("layout-preview-drawer")).toBeNull();
		});

		it("cannot change the layout when the schema is read-only", async () => {
			state = screenState({ access: { writable: false, reason: "production" } });
			await openFields();
			expect((screen.getByRole("button", { name: tFields("layout.addGroup") }) as HTMLButtonElement).disabled).toBe(
				true,
			);
			expect((screen.getByRole("button", { name: tFields("layout.addTab") }) as HTMLButtonElement).disabled).toBe(true);
		});
	});

	it("adds a conditional field only once its options and a field are set", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		openTab("fields");
		await screen.findByTestId("fields-card");
		confirmAdd(await startAddingField("extra", tFields("kind.conditional")));

		const dialog = await screen.findByTestId("new-field-dialog");
		// Nothing is in the collection yet.
		expect(screen.queryByTestId("field-extra")).toBeNull();
		expect(within(dialog).getByText(tFields("field.needs.branches"))).toBeTruthy();
		const add = within(dialog).getByRole("button", { name: tc("add") }) as HTMLButtonElement;
		expect(add.disabled).toBe(true);

		// Add a field to the first option.
		const inputs = within(dialog).getAllByLabelText(tFields("field.newName"));
		type(inputs[0] as HTMLElement, "detail");
		fireEvent.click(within(dialog).getAllByRole("button", { name: tFields("field.add") })[0] as HTMLElement);
		await waitFor(() => expect(within(dialog).queryByText(tFields("field.needs.branches"))).toBeNull());
		expect(add.disabled).toBe(false);
		fireEvent.click(add);

		await waitFor(() => expect(screen.queryByTestId("new-field-dialog")).toBeNull());
		// The field exists, and its sheet is open; the tree lists the option and its field as a branch.
		await applySheet(await screen.findByTestId("field-sheet"));
		const row = await screen.findByTestId("field-extra");
		expect(within(row).getByText('= "a"')).toBeTruthy();
		expect(within(row).getByTestId("field-detail")).toBeTruthy();
		expect(within(row).getByText(tFields("fields.noExtra"))).toBeTruthy();
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
		confirmAdd(await startAddingField("related", tFields("kind.relation")));

		const dialog = await screen.findByTestId("new-field-dialog");
		expect(within(dialog).getByLabelText(tFields("field.relationTo"))).toBeTruthy();
		fireEvent.click(within(dialog).getByRole("button", { name: tc("cancel") }));
		await waitFor(() => expect(screen.queryByTestId("new-field-dialog")).toBeNull());
		expect(screen.queryByTestId("field-related")).toBeNull();
		expect(screen.queryByTestId("field-sheet")).toBeNull();
		expect(review().disabled).toBe(true);

		// Do it again and add it: the first collection is the target.
		confirmAdd(await startAddingField("related", tFields("kind.relation")));
		const again = await screen.findByTestId("new-field-dialog");
		fireEvent.click(within(again).getByRole("button", { name: tc("add") }));
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
		const label = await screen.findByLabelText(tCollection("collection.label"));
		type(label, "Article");
		fireEvent.click(screen.getByRole("button", { name: t("actions.discard") }));
		await act(async () => {
			fireEvent.click(await screen.findByRole("button", { name: tc("discard.confirm") }));
		});
		await waitFor(() =>
			expect((screen.getByLabelText(tCollection("collection.label")) as HTMLInputElement).value).toBe("Post"),
		);
	});
	/** Edits through the site or admin tab, then returns the file the review would send. */
	const openSettingsTab = async (name: "site" | "admin") => {
		renderScreen();
		await screen.findByTestId("collection-post");
		fireEvent.click(screen.getByRole("tab", { name }));
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
		type(screen.getByLabelText(tCollection("collection.label")), "Article");
		expect(review().textContent).toBe(t("actions.review"));
		expect(screen.getByText(t("header.pending", { count: 1 }))).toBeTruthy();
	});

	describe("languages tab", () => {
		const openLocales = async () => {
			renderScreen();
			await screen.findByTestId("collection-post");
			fireEvent.click(screen.getByRole("tab", { name: "locales" }));
			return screen.findByTestId("locales-content");
		};

		it("lists the content languages in one card with code, name, and default mark, and has a section for the default language and time zone", async () => {
			const content = await openLocales();
			const row = within(content).getByTestId("locale-en");
			expect(within(row).getByText("en")).toBeTruthy();
			expect(within(row).getByText("English")).toBeTruthy();
			expect(within(row).getByText(tLocales("locales.defaultBadge"))).toBeTruthy();
			expect(within(row).queryByText(/원어|Native/)).toBeNull();
			expect(within(content).getByText(tLocales("locales.count", { count: 1 }))).toBeTruthy();
			// Two sections, each with its title and description.
			expect(within(content).getByRole("heading", { name: tLocales("locales.contentTitle") })).toBeTruthy();
			const defaults = screen.getByTestId("locales-default");
			expect(within(defaults).getByRole("heading", { name: tLocales("locales.defaultTitle") })).toBeTruthy();
			expect(within(defaults).getByLabelText(tLocales("locales.timeZone"))).toBeTruthy();
		});

		it("adds a language from a small dialog, and the code of a saved language cannot be edited", async () => {
			const content = await openLocales();
			fireEvent.click(within(content).getByRole("button", { name: tLocales("locales.add") }));
			const dialog = await screen.findByTestId("locale-dialog");
			const add = within(dialog).getByRole("button", { name: tLocales("locales.add") }) as HTMLButtonElement;
			expect(add.disabled).toBe(true);
			type(within(dialog).getByLabelText(tLocales("locales.code")), "en");
			type(within(dialog).getByLabelText(tLocales("locales.name")), "Again");
			// The code is taken.
			expect(add.disabled).toBe(true);
			type(within(dialog).getByLabelText(tLocales("locales.code")), "fr");
			type(within(dialog).getByLabelText(tLocales("locales.name")), "Français");
			type(within(dialog).getByLabelText(tLocales("locales.label")), "French");
			expect(add.disabled).toBe(false);
			fireEvent.click(add);
			const row = await screen.findByTestId("locale-fr");
			expect(within(row).getByText("French")).toBeTruthy();
			expect(within(row).getByText(tLocales("locales.nativeName", { name: "Français" }))).toBeTruthy();

			fireEvent.click(within(row).getByRole("button", { name: tLocales("locales.editNamed", { name: "French" }) }));
			const edit = await screen.findByTestId("locale-dialog");
			expect((within(edit).getByLabelText(tLocales("locales.code")) as HTMLInputElement).disabled).toBe(true);
			fireEvent.click(within(edit).getByRole("button", { name: tc("cancel") }));

			fireEvent.click(review());
			await screen.findByTestId("review-summary");
			expect((lastPreview()?.body?.schema as { locales: unknown[] }).locales).toEqual([
				{ code: "en", name: "English" },
				{ code: "fr", name: "Français", label: "French" },
			]);
		});

		it("changes the default language and removes a language from the row menu", async () => {
			const content = await openLocales();
			const enRemoveInitial = within(screen.getByTestId("locale-en")).getByRole("button", {
				name: t("row.remove", { name: "en" }),
			}) as HTMLButtonElement;
			expect(enRemoveInitial.disabled).toBe(true);
			expect(enRemoveInitial.getAttribute("title")).toBe(tLocales("locales.removeBlockedDefault"));

			fireEvent.click(within(content).getByRole("button", { name: tLocales("locales.add") }));
			const dialog = await screen.findByTestId("locale-dialog");
			type(within(dialog).getByLabelText(tLocales("locales.code")), "ko");
			type(within(dialog).getByLabelText(tLocales("locales.name")), "한국어");
			fireEvent.click(within(dialog).getByRole("button", { name: tLocales("locales.add") }));
			await screen.findByTestId("locale-ko");
			fireEvent.click(screen.getByRole("combobox", { name: tLocales("locales.default") }));
			pressOption(await screen.findByRole("option", { name: "한국어 (ko)" }));
			const ko = screen.getByTestId("locale-ko");
			expect(within(ko).getByText(tLocales("locales.defaultBadge"))).toBeTruthy();
			expect(within(screen.getByTestId("locale-en")).queryByText(tLocales("locales.defaultBadge"))).toBeNull();

			const koRemove = within(ko).getByRole("button", { name: t("row.remove", { name: "ko" }) }) as HTMLButtonElement;
			expect(koRemove.disabled).toBe(true);
			expect(koRemove.getAttribute("title")).toBe(tLocales("locales.removeBlockedDefault"));

			const enRemove = within(screen.getByTestId("locale-en")).getByRole("button", {
				name: t("row.remove", { name: "en" }),
			}) as HTMLButtonElement;
			expect(enRemove.disabled).toBe(false);
			fireEvent.click(enRemove);
			await waitFor(() => expect(screen.queryByTestId("locale-en")).toBeNull());
		});

		it("has a handle to drag each language, and no arrow buttons", async () => {
			const content = await openLocales();
			fireEvent.click(within(content).getByRole("button", { name: tLocales("locales.add") }));
			const dialog = await screen.findByTestId("locale-dialog");
			type(within(dialog).getByLabelText(tLocales("locales.code")), "ko");
			type(within(dialog).getByLabelText(tLocales("locales.name")), "한국어");
			fireEvent.click(within(dialog).getByRole("button", { name: tLocales("locales.add") }));
			const ko = await screen.findByTestId("locale-ko");
			expect(within(ko).getByRole("button", { name: tLocales("locales.drag", { name: "한국어" }) })).toBeTruthy();
			expect(within(ko).queryByRole("button", { name: t("row.up", { name: "ko" }) })).toBeNull();
		});
	});

	it("groups the site and admin settings into titled sections instead of one long form", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		fireEvent.click(screen.getByRole("tab", { name: "site" }));
		const site = await screen.findByTestId("site-settings");
		for (const key of ["site.identityTitle", "site.previewTitle", "site.addressTitle"] as const) {
			expect(within(site).getByRole("heading", { name: tSite(key) })).toBeTruthy();
		}
		fireEvent.click(screen.getByRole("tab", { name: "admin" }));
		const admin = await screen.findByTestId("admin-settings");
		for (const key of ["admin.languageTitle", "admin.featuresTitle", "admin.addressTitle"] as const) {
			expect(within(admin).getByRole("heading", { name: tAdmin(key) })).toBeTruthy();
		}
	});

	it("edits the site settings: each control writes its own key under site", async () => {
		await openSettingsTab("site");
		type(await screen.findByLabelText(t("site.name")), "My blog");
		type(screen.getByLabelText(tSite("site.home")), "https://example.com");
		type(screen.getByLabelText(tSite("site.previewPath")), "/preview");
		type(screen.getByLabelText(tSite("site.previewParam")), "lang");
		type(screen.getByLabelText(tSite("site.alias.new")), "www.example.com");
		fireEvent.click(screen.getByRole("button", { name: tSite("site.alias.add") }));
		fireEvent.click(screen.getByRole("combobox", { name: tSite("site.localePrefix") }));
		pressOption(await screen.findByRole("option", { name: new RegExp(`^${tSite("site.prefix.always")}`) }));

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
		fireEvent.click(screen.getByRole("tab", { name: "admin" }));
		fireEvent.click(await screen.findByRole("switch", { name: tAdmin("admin.templates") }));
		fireEvent.click(review());
		const list = await screen.findByTestId("review-settings");
		expect(list.textContent).toContain('site.name: "Blog" -> "Journal"');
		expect(list.textContent).toContain(`admin.templates: ${tReview("review.unset")} -> false`);
	});

	it("puts the preview language in the path with a switch, and empties the site section when everything is cleared", async () => {
		state = screenState({ schema: { ...schema(), site: { name: "Blog" } } });
		await openSettingsTab("site");
		fireEvent.click(await screen.findByRole("switch", { name: tSite("site.previewInPath") }));
		type(screen.getByLabelText(t("site.name")), "");
		const file = await reviewedFile();
		expect(file.site).toEqual({ previewLocaleParam: false });
	});

	it("puts each prefix option's explanation and example in the option list", async () => {
		await openSettingsTab("site");
		const text = (mode: "except-default" | "always" | "never") =>
			tSite(`site.prefix.${mode}.text`, { default: "en", other: "fr" });

		fireEvent.click(await screen.findByRole("combobox", { name: tSite("site.localePrefix") }));
		for (const mode of ["except-default", "always", "never"] as const) {
			const option = await screen.findByRole("option", { name: new RegExp(`^${tSite(`site.prefix.${mode}`)}`) });
			expect(option.textContent).toContain(text(mode));
		}
	});

	it("shows the site URL read-only with where it comes from", async () => {
		state = screenState({ siteUrl: { url: "https://blog.example", from: "env" } });
		await openSettingsTab("site");
		const row = await screen.findByTestId("site-url");
		expect(row.textContent).toContain("https://blog.example");
		expect(row.textContent).toContain(tSite("site.url.env"));
		cleanup();
		state = screenState();
		await openSettingsTab("site");
		expect((await screen.findByTestId("site-url")).textContent).toContain(tSite("site.url.none"));
		expect(schemaSiteMessages.messages.en["site.url.none"]).toContain("set SITE_URL where you deploy");
	});

	it("edits the admin settings: the language is picked from the dictionaries and the switches write false", async () => {
		await openSettingsTab("admin");
		fireEvent.click(await screen.findByRole("combobox", { name: tAdmin("admin.locale") }));
		pressOption(await screen.findByRole("option", { name: /ko/ }));
		fireEvent.click(screen.getByRole("switch", { name: tAdmin("admin.templates") }));
		fireEvent.click(screen.getByRole("switch", { name: tAdmin("admin.translations") }));

		const file = await reviewedFile();
		expect(file.admin).toEqual({ locale: "ko", templates: false, translations: false });
	});

	it("turns an admin switch back on by removing its key", async () => {
		state = screenState({ schema: { ...schema(), admin: { templates: false } } });
		await openSettingsTab("admin");
		fireEvent.click(await screen.findByRole("switch", { name: tAdmin("admin.templates") }));
		const file = await reviewedFile();
		expect(file.admin).toBeUndefined();
	});

	it("shows admin.path read-only with how to change it", async () => {
		state = screenState({ schema: { ...schema(), admin: { path: "/studio" } } });
		await openSettingsTab("admin");
		expect((await screen.findByTestId("admin-path")).textContent).toBe("/studio");
		expect(screen.getByText(tAdmin("admin.pathNote"))).toBeTruthy();
		expect(schemaAdminMessages.messages.en["admin.pathNote"]).toBe(
			"Change it in monti.schema.ts and move the admin route folder.",
		);
		expect(screen.queryByLabelText(tAdmin("admin.path"), { selector: "input" })).toBeNull();
	});

	it("keeps the site and admin controls disabled when the screen is read-only", async () => {
		state = screenState({ access: { writable: false, reason: "production" } });
		await openSettingsTab("site");
		expect(((await screen.findByLabelText(t("site.name"))) as HTMLInputElement).disabled).toBe(true);
		expect(screen.queryByRole("button", { name: tSite("site.alias.add") })).toBeNull();
	});
});
