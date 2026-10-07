import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { createTestRouter } from "../../../test/router";
import { AdminQueryProvider } from "../../shared/query-provider";
import { schemaMessages } from "../messages";
import { SchemaScreen } from "../schema-screen";

const nav = createTestRouter();
const { render } = nav;
const t = testSite.createTranslator(schemaMessages);

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ Toaster: () => null, toast }));
vi.mock("../../admin-sidebar", () => ({ AdminSidebar: () => null }));
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
	file: "monti.schema.json",
	hash: "hash-1",
	schema: schema(),
	source: "file",
	issues: [],
	schemaVersion: 2,
	applied: { schemaVersion: 2, appliedAt: "2026-01-01T00:00:00.000Z" },
	codeCollections: [],
	vocabulary: { blocks: ["table", "image", "callout"], marks: ["bold", "italic"] },
	collections: ["post", "tag"],
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
			file: "monti.schema.json",
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
			if (input === "/api/cms/v1/schema" && method === "GET") return json(state);
			if (input === "/api/cms/v1/schema/preview" && method === "POST") return json(previewAnswer(body ?? {}));
			if (input === "/api/cms/v1/schema" && method === "PUT") {
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

const renderScreen = () =>
	render(
		<AdminQueryProvider>
			<SchemaScreen />
		</AdminQueryProvider>,
	);

const review = () => screen.getByRole("button", { name: t("actions.review") }) as HTMLButtonElement;
const type = (element: HTMLElement, value: string) => fireEvent.change(element, { target: { value } });
const lastPreview = () => requests.filter((request) => request.url.endsWith("/preview")).at(-1);

describe("SchemaScreen", () => {
	it("is read-only in production: the reason is shown, nothing can be edited, and nothing can be reviewed", async () => {
		state = screenState({ access: { writable: false, reason: "production" } });
		renderScreen();

		expect(await screen.findByTestId("schema-read-only")).toBeTruthy();
		expect(screen.getByText(t("readonly.production"))).toBeTruthy();
		expect((screen.getByLabelText(t("collection.label")) as HTMLInputElement).disabled).toBe(true);
		expect(review().disabled).toBe(true);
		expect(screen.queryByTestId("add-collection")).toBeNull();
		expect(requests.every((request) => request.method === "GET")).toBe(true);
	});

	it("shows the collections of the file and opens the editor of the first one", async () => {
		renderScreen();
		expect(await screen.findByTestId("collection-post")).toBeTruthy();
		expect((screen.getByLabelText(t("collection.label")) as HTMLInputElement).value).toBe("Post");
		expect((screen.getByLabelText(t("collection.path")) as HTMLInputElement).value).toBe("/posts/:slug");
		expect(review().disabled).toBe(true);
		fireEvent.click(screen.getByRole("button", { name: "Tag" }));
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

	it("adds a field in the file's format, after the others", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
		type(screen.getByLabelText(t("field.newName")), "rating");
		fireEvent.click(screen.getByRole("button", { name: t("field.add") }));
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
		type(screen.getByLabelText(t("field.newName")), "summary");
		expect((screen.getByRole("button", { name: t("field.add") }) as HTMLButtonElement).disabled).toBe(true);
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
		fireEvent.click(await screen.findByRole("button", { name: t("field.toggle", { name: "summary" }) }));
		const name = within(screen.getByTestId("field-summary")).getByLabelText(t("field.name"));
		type(name, "excerpt");
		fireEvent.keyDown(name, { key: "Enter" });
		expect(await screen.findByTestId("field-excerpt")).toBeTruthy();

		fireEvent.click(review());
		const decision = await screen.findByTestId("decision-field_removed:post:summary");
		expect(lastPreview()?.body?.renames).toEqual([
			{ kind: "field", collection: "post", from: "summary", to: "excerpt" },
		]);
		expect(within(decision).getByText(t("review.entriesCount", { count: 3 }))).toBeTruthy();
		const radios = within(decision).getAllByRole("radio") as HTMLInputElement[];
		expect(radios).toHaveLength(3);
		// The server's pick (the rename) is the one selected.
		expect(radios.map((radio) => radio.checked)).toEqual([false, true, false]);
		// The sample links to the entry in the admin.
		const link = within(decision).getByRole("link", { name: "Hello" });
		expect(link.getAttribute("href")).toBe("/admin/entries/11111111-1111-4111-8111-111111111111/edit");

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

	it("limits the body of a collection to the blocks that are ticked", async () => {
		renderScreen();
		await screen.findByTestId("collection-post");
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
});
