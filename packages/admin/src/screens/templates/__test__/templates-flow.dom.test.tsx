import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { commonMessages } from "../../../lib/common.messages";
import { jsonResponse as json } from "../../../test/fetch";
import { createTestRouter } from "../../../test/router";
import { toast } from "../../../test/ui-toast";
import { AdminQueryProvider } from "../../shared/query-provider";
import { templatesMessages } from "../messages";
import { TemplateEditorScreen } from "../template-editor-screen";
import { editTemplateHref, newTemplateHref } from "../template-hrefs";
import { TemplatesScreen } from "../templates-screen";

// One test group per canvas flow of the Templates boards ("도구 · 템플릿" and "도구 · 템플릿 편집기"): the list, a row's menu, the editor page and its save.
// They check what a screenshot cannot: the requests a press sends, where it goes, what shows and hides, the names of the parts and the keys.

const nav = createTestRouter();
const { render } = nav;
vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);
// The body editor has its own tests. Here it is a title slot and one button that edits the body.
vi.mock("../../../editor/tiptap-editor", () => ({
	CmsEditor: ({
		doc,
		onChange,
		titleField,
	}: {
		doc: { content: unknown[] };
		onChange: (doc: unknown) => void;
		titleField?: React.ReactNode;
	}) => (
		<div>
			{titleField}
			<button
				type="button"
				onClick={() =>
					onChange({
						...doc,
						content: [
							...doc.content,
							{ type: "paragraph", id: "zzzz9999", content: [{ type: "text", text: "덧붙인 문단" }] },
						],
					})
				}
			>
				edit body
			</button>
		</div>
	),
}));

const t = testSite.createTranslator(templatesMessages);
const tc = testSite.createTranslator(commonMessages);

const DOC = {
	type: "doc",
	version: 3,
	content: [
		{ type: "heading", id: "abcd1234", attrs: { level: 2 }, content: [{ type: "text", text: "서론" }] },
		{ type: "paragraph", id: "bcde2345", content: [{ type: "text", text: "내용" }] },
		{ type: "heading", id: "cdef3456", attrs: { level: 2 }, content: [{ type: "text", text: "본론" }] },
	],
};
const template = (id: string, name: string, updatedAt: string, version = 1) => ({
	id,
	name,
	doc: DOC,
	version,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt,
});
const FIRST = template("a", "기본 글", "2026-10-20T03:00:00.000Z");
const SECOND = template("b", "책 리뷰", "2026-09-02T03:00:00.000Z");

let store: ReturnType<typeof template>[];
let fetchMock: ReturnType<typeof vi.fn>;
let conflict = false;

const bodyOf = (init?: RequestInit) => (init?.body ? JSON.parse(String(init.body)) : undefined);
/** The bodies sent with this method to this path (query left out). */
const sent = (method: string, path: string) =>
	fetchMock.mock.calls
		.filter(
			([input, init]) => String(input).split("?")[0] === `/api/monti/v1${path}` && (init?.method ?? "GET") === method,
		)
		.map(([, init]) => bodyOf(init as RequestInit));
const requested = (method: string, path: string) =>
	fetchMock.mock.calls.filter(
		([input, init]) => String(input).split("?")[0] === `/api/monti/v1${path}` && (init?.method ?? "GET") === method,
	);

beforeEach(() => {
	vi.clearAllMocks();
	window.localStorage.clear();
	conflict = false;
	store = [FIRST, SECOND];
	fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
		const [path = ""] = String(input).split("?");
		const method = init?.method ?? "GET";
		const body = bodyOf(init);
		if (path === "/api/monti/v1/templates" && method === "GET") return json({ items: store });
		if (path === "/api/monti/v1/templates" && method === "POST") {
			const created = { ...template("c", body.name, "2026-10-29T03:00:00.000Z"), doc: body.doc };
			store = [created, ...store];
			return json(created);
		}
		const id = path.match(/^\/api\/monti\/v1\/templates\/([^/]+)$/)?.[1];
		const found = store.find((item) => item.id === id);
		if (id && method === "GET")
			return found ? json(found) : json({ error: { code: "not_found", message: "없음" } }, 404);
		if (id && method === "PATCH") {
			if (conflict) return json({ error: { code: "conflict", message: "다른 곳에서 먼저 바뀌었어요." } }, 409);
			const saved = {
				...(found as typeof FIRST),
				name: body.name,
				doc: body.doc ?? found?.doc,
				version: (found?.version ?? 0) + 1,
			};
			store = store.map((item) => (item.id === id ? saved : item));
			return json(saved);
		}
		if (id && method === "DELETE") {
			store = store.filter((item) => item.id !== id);
			return json({});
		}
		return json({});
	});
	vi.stubGlobal("fetch", fetchMock);
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

describe("flow: templates · the list", () => {
	it("starts a new template from the header: it goes to the new template page", async () => {
		await renderList();
		fireEvent.click(screen.getByRole("button", { name: t("add") }));
		expect(nav.navigate).toHaveBeenCalledWith(newTemplateHref(testSite));
	});
});

describe("flow: templates · a row's menu", () => {
	const openMenu = async (name: string) => {
		fireEvent.click(within(rowOf(name)).getByRole("button", { name: t("row.more") }));
		return screen.findAllByRole("menuitem");
	};

	it("duplicates: one create request with the same body under a copy name, ids of its own, and the copy joins the list", async () => {
		await renderList();
		await openMenu(FIRST.name);
		fireEvent.click(screen.getByRole("menuitem", { name: t("row.duplicate") }));
		await waitFor(() => expect(sent("POST", "/templates")).toHaveLength(1));
		const [body] = sent("POST", "/templates");
		expect(body.name).toBe(t("copyName", { name: FIRST.name }));
		expect(body.doc.content.map((node: { type: string }) => node.type)).toEqual(DOC.content.map((node) => node.type));
		for (const block of body.doc.content) expect(DOC.content.map((node) => node.id)).not.toContain(block.id);
		await waitFor(() => expect(toast).toHaveBeenCalledWith(t("duplicate.done", { name: FIRST.name })));
		await screen.findByRole("link", { name: t("copyName", { name: FIRST.name }) });
	});

	it("deletes only after a question, with the version it saw, and the row goes", async () => {
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
		expect(String(requested("DELETE", `/templates/${FIRST.id}`)[0]?.[0])).toBe(
			`/api/monti/v1/templates/${FIRST.id}?expectedVersion=${FIRST.version}`,
		);
		await waitFor(() => expect(screen.queryByRole("link", { name: FIRST.name })).toBeNull());
		expect(toast).toHaveBeenCalledWith(t("delete.done", { name: FIRST.name }));
	});
});

describe("flow: templates · the editor page", () => {
	it("saves with ⌘S: one request with the name, the body and the version it saw; the status goes and a toast says saved", async () => {
		const name = await renderEditor(FIRST.id);
		await waitFor(() => expect(name.value).toBe(FIRST.name));
		fireEvent.change(name, { target: { value: "긴 글" } });
		fireEvent.click(screen.getByRole("button", { name: "edit body" }));
		pressSave();

		await waitFor(() => expect(sent("PATCH", `/templates/${FIRST.id}`)).toHaveLength(1));
		const [body] = sent("PATCH", `/templates/${FIRST.id}`);
		expect(body).toMatchObject({ name: "긴 글", expectedVersion: FIRST.version });
		expect(body.doc.content.at(-1).content[0].text).toBe("덧붙인 문단");
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

	it("keeps the changes and shows the conflict as a notice strip with a way to take the server's version", async () => {
		conflict = true;
		const name = await renderEditor(FIRST.id);
		await waitFor(() => expect(name.value).toBe(FIRST.name));
		fireEvent.change(name, { target: { value: "긴 글" } });
		pressSave();
		const strip = await screen.findByRole("alert");
		expect(within(strip).getByText(t("editor.conflict"))).toBeTruthy();
		expect(within(strip).getByText(t("editor.conflictMeta"))).toBeTruthy();
		// The strip, not a line under the name.
		expect(screen.queryByText("다른 곳에서 먼저 바뀌었어요.")).toBeNull();
		expect(screen.getByText(t("editor.unsaved"))).toBeTruthy();
		expect(name.value).toBe("긴 글");

		// The server's copy comes back and replaces the draft; the strip goes.
		store = [{ ...FIRST, name: "서버에서 고침", version: FIRST.version + 1 }, SECOND];
		fireEvent.click(within(strip).getByRole("button", { name: t("editor.loadServer") }));
		await waitFor(() => expect(name.value).toBe("서버에서 고침"));
		await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
		expect(screen.queryByText(t("editor.unsaved"))).toBeNull();
	});

	it("shows a failed load with the server's message and a retry, under the back link", async () => {
		store = [];
		render(
			<AdminQueryProvider>
				<TemplateEditorScreen id={FIRST.id} />
			</AdminQueryProvider>,
		);
		const alert = await screen.findByRole("alert");
		expect(alert.textContent).toContain("없음");
		expect(screen.getByRole("link", { name: t("editor.back") })).toBeTruthy();
		store = [FIRST, SECOND];
		fireEvent.click(within(alert).getByRole("button", { name: tc("retry") }));
		await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
	});

	it("asks before the back link throws unsaved changes away, and stays when told to", async () => {
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
	it("will not save without a name: it says so and sends nothing", async () => {
		await renderEditor();
		fireEvent.click(screen.getByRole("button", { name: "edit body" }));
		pressSave();
		await screen.findByText(t("editor.nameRequired"));
		expect(requested("POST", "/templates")).toHaveLength(0);
	});

	it("creates with ⌘S: one request with the name and the outline, then it moves to the page of the new template", async () => {
		const name = await renderEditor();
		fireEvent.change(name, { target: { value: "새 템플릿" } });
		expect(screen.getByText(t("editor.unsaved"))).toBeTruthy();
		pressSave();
		await waitFor(() => expect(sent("POST", "/templates")).toHaveLength(1));
		const [body] = sent("POST", "/templates");
		expect(body.name).toBe("새 템플릿");
		expect(body.doc.content.length).toBeGreaterThan(0);
		await waitFor(() => expect(nav.replace).toHaveBeenCalledWith(editTemplateHref(testSite, "c")));
		await waitFor(() => expect(toast).toHaveBeenCalledWith(tc("saved")));
	});
});
