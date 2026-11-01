import type { StoredDocument } from "@monti-cms/core/document";
import type { BodyTemplate } from "@monti-cms/core/site";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { editorMessages } from "../../../editor/messages";
import { commonMessages } from "../../../lib/common.messages";
import { type FakeApi, failure, fakeApi } from "../../../test/fake-api";
import { createTestRouter } from "../../../test/router";
import { toast } from "../../../test/ui-toast";
import { AdminQueryProvider } from "../../shared/query-provider";
import { templatesMessages } from "../messages";
import { TemplateEditorScreen } from "../template-editor-screen";
import { editTemplateHref } from "../template-hrefs";
import { TemplatesScreen } from "../templates-screen";

// One test group per canvas flow of the Templates boards ("도구 · 템플릿" and "도구 · 템플릿 편집기"): the list, a row's menu, the editor page and its save.
// They check what a screenshot cannot: the requests a press sends, where it goes, what shows and hides, the names of the parts and the keys.

const nav = createTestRouter();
const { render } = nav;
vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);
const t = testSite.createTranslator(templatesMessages);
const tc = testSite.createTranslator(commonMessages);
const te = testSite.createTranslator(editorMessages);

/** What the person writes at the end of the body. */
const ADDED = "덧붙인 문단";
/**
 * Edits the body in the real editor: a paragraph at its end, through the editor's own commands, as typing would end (jsdom has no layout for
 * ProseMirror's input handling). The editor has its own tests; here it is only the source of a body change.
 */
const editBody = () => {
	const surface = screen.getByLabelText(te("toolbar.editorLabel")) as HTMLElement & { editor?: Editor };
	if (!surface.editor) throw new Error("the body surface has no editor");
	const { editor } = surface;
	act(() => {
		editor.commands.insertContentAt(editor.state.doc.content.size, {
			type: "paragraph",
			content: [{ type: "text", text: ADDED }],
		});
	});
};

const DOC: StoredDocument = {
	type: "doc",
	version: 3,
	content: [
		{ type: "heading", id: "abcd1234", attrs: { level: 2 }, content: [{ type: "text", text: "서론" }] },
		{ type: "paragraph", id: "bcde2345", content: [{ type: "text", text: "내용" }] },
		{ type: "heading", id: "cdef3456", attrs: { level: 2 }, content: [{ type: "text", text: "본론" }] },
	],
};
// The client reads the dates as `Date`s; the answer sends them as ISO strings, as the server's JSON does.
const template = (id: string, name: string, updatedAt: string, version = 1): BodyTemplate => ({
	id,
	name,
	doc: DOC,
	version,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	updatedAt: new Date(updatedAt),
});
const FIRST = template("a", "기본 글", "2026-10-20T03:00:00.000Z");
const SECOND = template("b", "책 리뷰", "2026-09-02T03:00:00.000Z");

let store: BodyTemplate[];
let api: FakeApi;
let conflict = false;
/** What the server says when the template changed elsewhere first. */
const SERVER_CONFLICT = "다른 곳에서 먼저 바뀌었어요.";

type Method = "GET" | "POST" | "PATCH" | "DELETE";
const requested = (method: Method, path: `/${string}`) => api.sent(`${method} /v1${path}`);
/** The bodies sent with this method to this path (query left out). */
const sent = (method: Method, path: `/${string}`) => requested(method, path).map((request) => request.body);

beforeEach(() => {
	vi.clearAllMocks();
	window.localStorage.clear();
	conflict = false;
	store = [FIRST, SECOND];
	api = fakeApi()
		// The rail's counts: the trash and the failed deliveries.
		.on("GET /v1/trash", () => ({ items: [], total: 0, kinds: {} }))
		.on("GET /v1/events", () => ({
			items: [],
			total: 0,
			counts: { pending: 0, delivering: 0, delivered: 0, failed: 0, dead: 0, dismissed: 0 },
		}))
		.on("GET /v1/templates", () => ({ items: store }))
		.on("POST /v1/templates", ({ body }) => {
			const created = { ...template("c", body.name, "2026-10-29T03:00:00.000Z"), doc: body.doc };
			store = [created, ...store];
			return created;
		})
		.on(
			"GET /v1/templates/:id",
			({ params }) => store.find((item) => item.id === params.id) ?? failure("not_found", "없음"),
		)
		.on("PATCH /v1/templates/:id", ({ params, body }) => {
			if (conflict) return failure("conflict", SERVER_CONFLICT);
			const found = store.find((item) => item.id === params.id);
			const saved = {
				...(found as BodyTemplate),
				name: body.name,
				doc: body.doc ?? found?.doc,
				version: (found?.version ?? 0) + 1,
			};
			store = store.map((item) => (item.id === params.id ? saved : item));
			return saved;
		})
		// Not in `AdminRoutes`: `deleteTemplate` reads no body, and the server answers 204.
		.on("DELETE /v1/templates/:id", ({ params }) => {
			store = store.filter((item) => item.id !== params.id);
			return undefined;
		})
		.install();
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const renderList = async () => {
	render(
		<AdminQueryProvider>
			<TemplatesScreen />
		</AdminQueryProvider>,
	);
	await screen.findByRole("link", { name: FIRST.name });
};
const renderEditor = async (id?: string) => {
	render(
		<AdminQueryProvider>
			<TemplateEditorScreen id={id} />
		</AdminQueryProvider>,
	);
	return screen.findByRole("textbox", { name: t("editor.nameLabel") }) as Promise<HTMLInputElement>;
};
const rowOf = (name: string) => screen.getByRole("row", { name: new RegExp(name) });
const saveButton = () => screen.queryByRole("button", { name: new RegExp(`^${tc("save")}`) });
const pressSave = () => {
	act(() => {
		fireEvent.keyDown(window, { key: "s", metaKey: true });
	});
};

describe("flow: templates · a row's menu", () => {
	const openMenu = async (name: string) => {
		fireEvent.click(within(rowOf(name)).getByRole("button", { name: t("row.more") }));
		return screen.findAllByRole("menuitem");
	};

	it("TPL-L2 duplicates: one create request under a copy name, and the copy joins the list", async () => {
		await renderList();
		await openMenu(FIRST.name);
		fireEvent.click(screen.getByRole("menuitem", { name: t("row.duplicate") }));
		await waitFor(() => expect(sent("POST", "/templates")).toHaveLength(1));
		const [body] = sent("POST", "/templates");
		expect(body.name).toBe(t("copyName", { name: FIRST.name }));
		await waitFor(() => expect(toast).toHaveBeenCalledWith(t("duplicate.done", { name: FIRST.name })));
		await screen.findByRole("link", { name: t("copyName", { name: FIRST.name }) });
	});

	it("TPL-L2 deletes only after a question, with the version it saw, and the row goes", async () => {
		await renderList();
		await openMenu(FIRST.name);
		fireEvent.click(screen.getByRole("menuitem", { name: t("row.delete") }));
		const dialog = await screen.findByRole("alertdialog", { name: t("delete.title") });
		expect(requested("DELETE", `/templates/${FIRST.id}`)).toHaveLength(0);
		// Cancel leaves everything as it was.
		fireEvent.click(within(dialog).getByRole("button", { name: tc("cancel") }));
		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
		expect(requested("DELETE", `/templates/${FIRST.id}`)).toHaveLength(0);

		await openMenu(FIRST.name);
		fireEvent.click(screen.getByRole("menuitem", { name: t("row.delete") }));
		const again = await screen.findByRole("alertdialog", { name: t("delete.title") });
		fireEvent.click(within(again).getByRole("button", { name: tc("delete") }));
		await waitFor(() => expect(requested("DELETE", `/templates/${FIRST.id}`)).toHaveLength(1));
		const [deleted] = requested("DELETE", `/templates/${FIRST.id}`);
		expect(`${deleted?.path}?${deleted?.query}`).toBe(`/v1/templates/${FIRST.id}?expectedVersion=${FIRST.version}`);
		await waitFor(() => expect(screen.queryByRole("link", { name: FIRST.name })).toBeNull());
		expect(toast).toHaveBeenCalledWith(t("delete.done", { name: FIRST.name }));
	});
});

describe("flow: templates · the editor page", () => {
	it("TPL-E1 saves with ⌘S: one request with the name, the body and the version it saw; the status goes and a toast says saved", async () => {
		const name = await renderEditor(FIRST.id);
		await waitFor(() => expect(name.value).toBe(FIRST.name));
		fireEvent.change(name, { target: { value: "긴 글" } });
		editBody();
		pressSave();

		await waitFor(() => expect(sent("PATCH", `/templates/${FIRST.id}`)).toHaveLength(1));
		const [body] = sent("PATCH", `/templates/${FIRST.id}`);
		expect(body).toMatchObject({ name: "긴 글", expectedVersion: FIRST.version });
		expect(body.doc.content.at(-1).content[0].text).toBe(ADDED);
		expect(body).not.toHaveProperty("mdx");
		await waitFor(() => expect(toast).toHaveBeenCalledWith(tc("saved")));
		await waitFor(() => expect(screen.queryByText(t("editor.unsaved"))).toBeNull());
		expect((screen.getByRole("textbox", { name: t("editor.nameLabel") }) as HTMLInputElement).value).toBe("긴 글");
		// A second save asks for the new version.
		fireEvent.change(screen.getByRole("textbox", { name: t("editor.nameLabel") }), { target: { value: "더 긴 글" } });
		fireEvent.click(saveButton() as HTMLElement);
		await waitFor(() => expect(sent("PATCH", `/templates/${FIRST.id}`)).toHaveLength(2));
		expect(sent("PATCH", `/templates/${FIRST.id}`)[1]).toMatchObject({
			name: "더 긴 글",
			expectedVersion: FIRST.version + 1,
		});
	});

	it("TPL-E1 keeps the changes and shows the conflict as a notice strip with a way to take the server's version", async () => {
		conflict = true;
		const name = await renderEditor(FIRST.id);
		await waitFor(() => expect(name.value).toBe(FIRST.name));
		fireEvent.change(name, { target: { value: "긴 글" } });
		pressSave();
		const strip = await screen.findByRole("alert");
		expect(within(strip).getByText(t("editor.conflict"))).toBeInTheDocument();
		expect(within(strip).getByText(t("editor.conflictMeta"))).toBeInTheDocument();
		// The strip, not a line under the name.
		expect(screen.queryByText(SERVER_CONFLICT)).toBeNull();
		expect(screen.getByText(t("editor.unsaved"))).toBeInTheDocument();
		expect(name.value).toBe("긴 글");

		// The server's copy comes back and replaces the draft; the strip goes.
		store = [{ ...FIRST, name: "서버에서 고침", version: FIRST.version + 1 }, SECOND];
		fireEvent.click(within(strip).getByRole("button", { name: t("editor.loadServer") }));
		await waitFor(() => expect(name.value).toBe("서버에서 고침"));
		await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
		expect(screen.queryByText(t("editor.unsaved"))).toBeNull();
	});

	it("WRITE-S6 asks before the back link throws unsaved changes away, and stays when told to", async () => {
		const name = await renderEditor(FIRST.id);
		await waitFor(() => expect(name.value).toBe(FIRST.name));
		fireEvent.change(name, { target: { value: "긴 글" } });
		fireEvent.click(screen.getByRole("link", { name: t("editor.back") }));
		const dialog = await screen.findByRole("alertdialog", { name: tc("discard.title") });
		fireEvent.click(within(dialog).getByRole("button", { name: tc("cancel") }));
		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
		expect((screen.getByRole("textbox", { name: t("editor.nameLabel") }) as HTMLInputElement).value).toBe("긴 글");
	});
});

describe("flow: templates · a new template", () => {
	it("TPL-N1 will not save without a name: it says so and sends nothing", async () => {
		await renderEditor();
		editBody();
		pressSave();
		await screen.findByText(t("editor.nameRequired"));
		expect(requested("POST", "/templates")).toHaveLength(0);
	});

	it("TPL-N1 creates with ⌘S: one request with the name and the outline, then it moves to the page of the new template", async () => {
		const name = await renderEditor();
		fireEvent.change(name, { target: { value: "새 템플릿" } });
		expect(screen.getByText(t("editor.unsaved"))).toBeInTheDocument();
		pressSave();
		await waitFor(() => expect(sent("POST", "/templates")).toHaveLength(1));
		const [body] = sent("POST", "/templates");
		expect(body.name).toBe("새 템플릿");
		expect(body.doc.content.length).toBeGreaterThan(0);
		await waitFor(() => expect(nav.replace).toHaveBeenCalledWith(editTemplateHref(testSite, "c")));
		await waitFor(() => expect(toast).toHaveBeenCalledWith(tc("saved")));
	});
});
