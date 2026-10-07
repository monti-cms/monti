import { emptyStoredDocument, type StoredDocument, unparsedDocument, withoutBlockIds } from "@monti-cms/core/document";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import {
	CmsAdminComponentsProvider,
	type SourcePanelProps,
	type SourcePanelRegistration,
} from "../../../admin-components";
import { docOf } from "../../../test/mdx";
import { createTestRouter } from "../../../test/router";
import { withSite } from "../../__test__/site-wrapper";
import { EntryEditorShell } from "../entry-editor-shell";
import { EMPTY_FORM, formFingerprint, formFromEntry } from "../entry-form";

const { getLocalBackup, deleteLocalBackup, saveLocalBackup, success, warning, message, error } = vi.hoisted(() => ({
	getLocalBackup: vi.fn(),
	deleteLocalBackup: vi.fn(),
	saveLocalBackup: vi.fn(),
	success: vi.fn(),
	warning: vi.fn(),
	message: vi.fn(),
	error: vi.fn(),
}));
vi.mock("../local-backup", async (importOriginal) => ({
	...(await importOriginal<typeof import("../local-backup")>()),
	getLocalBackup,
	deleteLocalBackup,
	saveLocalBackup,
}));
vi.mock("../../../editor/tiptap-editor", async () => {
	const React = await import("react");
	const { Editor } = await import("@tiptap/core");
	const { testSite: site } = await import("../../../../../core/test/site");
	const { buildEditorExtensions } =
		await vi.importActual<typeof import("../../../editor/extensions")>("../../../editor/extensions");
	const { storedToTiptap } = await vi.importActual<typeof import("../../../editor/tiptap-content")>(
		"../../../editor/tiptap-content",
	);
	/** A real editor without a page behind it, holding the stored document, reported through `onEditor` (going to a block by its id). */
	const useHeadlessEditor = (
		doc: StoredDocument | undefined,
		onEditor: ((editor: import("@tiptap/core").Editor | null) => void) | undefined,
	) => {
		React.useEffect(() => {
			if (!doc || !onEditor) return;
			const editor = new Editor({ extensions: buildEditorExtensions(site), content: storedToTiptap(site, doc) });
			mockEditor.current = editor;
			onEditor(editor);
			return () => {
				onEditor(null);
				editor.destroy();
			};
		}, [doc, onEditor]);
	};
	return {
		CmsEditor: (props: {
			editable?: boolean;
			titleField?: React.ReactNode;
			toolbarEnd?: React.ReactNode;
			toolbarAside?: React.ReactNode;
			sourceView?: React.ReactNode;
			doc?: StoredDocument;
			onEditor?: (editor: import("@tiptap/core").Editor | null) => void;
		}) => <MockEditor {...props} useHeadlessEditor={useHeadlessEditor} />,
	};
});
const { mockEditor } = vi.hoisted(() => ({ mockEditor: { current: null as import("@tiptap/core").Editor | null } }));
function MockEditor({
	editable,
	titleField,
	toolbarEnd,
	toolbarAside,
	sourceView,
	doc,
	onEditor,
	useHeadlessEditor,
}: {
	editable?: boolean;
	titleField?: React.ReactNode;
	toolbarEnd?: React.ReactNode;
	toolbarAside?: React.ReactNode;
	sourceView?: React.ReactNode;
	doc?: StoredDocument;
	onEditor?: (editor: import("@tiptap/core").Editor | null) => void;
	useHeadlessEditor: (
		doc: StoredDocument | undefined,
		onEditor: ((editor: import("@tiptap/core").Editor | null) => void) | undefined,
	) => void;
}) {
	// The shell passes a new `onEditor` on every render; keep the first so the headless editor is made once per document.
	const [stableOnEditor] = useState(() => onEditor);
	useHeadlessEditor(doc, stableOnEditor);
	return (
		<>
			<div role="toolbar" aria-label="서식 도구">
				{toolbarEnd}
				{toolbarAside}
			</div>
			{titleField}
			{sourceView ?? <textarea aria-label="시각 본문" readOnly={editable === false} />}
			<div className="ProseMirror" data-testid="mock-editor-body">
				<p>번역 첫 문단</p>
				<p>번역 둘째 문단</p>
			</div>
		</>
	);
}
vi.mock("sonner", () => ({ Toaster: () => null, toast: { success, warning, message, error } }));
// AI translation is tested separately (ai-translate.test.ts). Edit screen tests must not make an AI feature list request.
vi.mock("../ai-translate", () => ({
	useAiTranslate: () => ({ blockAction: null, toolbar: null, setEditor: () => {} }),
}));
const testRouter = createTestRouter();
const { render } = testRouter;

const ADMIN = "u1";
const entry = {
	id: "entry-1",
	collection: "post",
	status: "draft",
	version: 4,
	folderId: null,
	workingSlug: "test",
	publishedSlug: null,
	working: { metadata: { title: "테스트", categoryId: "cat-1", summary: "요약" }, doc: docOf("첫째 줄\n둘째 줄") },
};

const json = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data });
type Handler = (input: string, init?: RequestInit) => unknown;
let fetchMock: ReturnType<typeof vi.fn>;

/** Adds per-test handling to the common responses (lists, usages). */
function serve(handler: Handler, current: unknown = entry) {
	fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
		const handled = await handler(input, init);
		if (handled !== undefined) return handled;
		if (input.startsWith("/api/cms/v1/entries?")) return json({ items: [], total: 0 });
		if (input.endsWith("/relations")) return json({ incomingReferences: [] });
		if (input === "/api/cms/v1/entries/entry-1" && !init?.method) return json(current);
		throw new Error(`Unexpected fetch: ${init?.method ?? "GET"} ${input}`);
	});
}

const methodCalls = (method: string, suffix = "") =>
	fetchMock.mock.calls.filter(([input, init]) => init?.method === method && String(input).endsWith(suffix));

const SOURCE_LABEL = "원문 보기";
const blockText = (block: StoredDocument["content"][number]): string =>
	(block.content ?? []).map((node) => ("text" in node ? String(node.text) : "")).join("");
/** A source panel with no notation of its own: it shows the body's plain text and which block it was asked to focus. */
const asked: string[] = [];
const TextPanel = ({ doc, focusBlock, readOnly }: SourcePanelProps) => {
	if (focusBlock) asked.push(focusBlock);
	return (
		<div>
			<output aria-label="패널 본문">{doc.content.map(blockText).join("\n\n")}</output>
			<output aria-label="포커스">{focusBlock ?? "-"}</output>
			<output aria-label="읽기 전용">{String(readOnly)}</output>
		</div>
	);
};
const TEXT_PANEL: SourcePanelRegistration = { format: "text", label: SOURCE_LABEL, Panel: TextPanel };

/** The edit screen as the admin layout renders it, with a fake source panel registered (the admin knows no text notation). */
const renderShell = (ui: React.ReactElement, sourcePanels: SourcePanelRegistration[] = [TEXT_PANEL]) =>
	render(withSite(<CmsAdminComponentsProvider components={{ sourcePanels }}>{ui}</CmsAdminComponentsProvider>));
const renderEdit = () => renderShell(<EntryEditorShell mode="edit" initialEntryId="entry-1" adminId={ADMIN} />);
const editorTitle = () => screen.findByRole("textbox", { name: "제목" });

beforeEach(() => {
	asked.length = 0;
	vi.clearAllMocks();
	getLocalBackup.mockResolvedValue(null);
	deleteLocalBackup.mockResolvedValue(undefined);
	saveLocalBackup.mockResolvedValue(true);
	fetchMock = vi.fn();
	serve(() => undefined);
	vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("entry editor shell", () => {
	it("keeps edits in the browser until Save is clicked", async () => {
		serve((_input, init) => {
			if (init?.method === "PATCH") {
				const body = JSON.parse(String(init.body));
				return json({
					...entry,
					version: 5,
					working: { metadata: body.metadata, doc: body.doc },
				});
			}
		});
		renderEdit();
		fireEvent.change(await editorTitle(), { target: { value: "로컬에서 수정" } });
		// The recovery copy is kept after input pauses (interval is in the entry editor store test). Here, leaving the screen writes it right away.
		expect(saveLocalBackup).not.toHaveBeenCalled();
		window.dispatchEvent(new Event("pagehide"));
		await waitFor(() =>
			expect(saveLocalBackup).toHaveBeenCalledWith(expect.objectContaining({ key: `${ADMIN}:entry-1` })),
		);
		expect(screen.getByLabelText("저장 전 변경사항")).toBeTruthy();
		vi.useFakeTimers();
		await act(async () => vi.advanceTimersByTimeAsync(11_000));
		vi.useRealTimers();
		expect(methodCalls("PATCH")).toHaveLength(0);
		fireEvent.click(screen.getByRole("button", { name: "저장" }));
		await waitFor(() => expect(methodCalls("PATCH")).toHaveLength(1));
		await waitFor(() => expect(screen.getByLabelText("서버에 저장됨")).toBeTruthy());
		expect(JSON.parse(String(methodCalls("PATCH")[0]?.[1]?.body)).metadata.title).toBe("로컬에서 수정");
	});

	it("writes the waiting browser backup right away when the page is left", async () => {
		renderEdit();
		fireEvent.change(await editorTitle(), { target: { value: "떠나기 전 수정" } });
		expect(saveLocalBackup).not.toHaveBeenCalled();
		window.dispatchEvent(new Event("pagehide"));
		await waitFor(() =>
			expect(saveLocalBackup).toHaveBeenCalledWith(
				expect.objectContaining({ snapshot: expect.objectContaining({ title: "떠나기 전 수정" }) }),
			),
		);
	});

	it("saves even when a Korean composition never reports its end", async () => {
		serve((_input, init) => {
			if (init?.method === "PATCH") {
				const body = JSON.parse(String(init.body));
				return json({
					...entry,
					version: 5,
					working: { metadata: body.metadata, doc: body.doc },
				});
			}
		});
		renderEdit();
		const title = await editorTitle();
		fireEvent.change(title, { target: { value: "조합 중 수정" } });
		// The input that started composition vanished without an end signal.
		fireEvent.compositionStart(title);
		fireEvent.click(screen.getByRole("button", { name: "저장" }));
		await waitFor(() => expect(methodCalls("PATCH")).toHaveLength(1), { timeout: 3000 });
		await waitFor(() => expect(success).toHaveBeenCalledWith("저장했습니다."));
	});

	it("shows why an explicit save failed instead of doing nothing", async () => {
		serve((_input, init) => {
			if (init?.method === "PATCH") return json({ code: "invalid_input", message: "제목이 너무 깁니다." }, 400);
		});
		renderEdit();
		fireEvent.change(await editorTitle(), { target: { value: "실패할 수정" } });
		fireEvent.click(screen.getByRole("button", { name: "저장" }));
		await waitFor(() => expect(error).toHaveBeenCalledWith(expect.stringContaining("제목이 너무 깁니다.")));
	});

	it("saves pending changes before opening the preview", async () => {
		const opened = { opener: {}, location: { href: "" }, close: vi.fn() };
		const open = vi.spyOn(window, "open").mockReturnValue(opened as unknown as Window);
		serve((_input, init) => {
			if (init?.method === "PATCH") {
				const body = JSON.parse(String(init.body));
				return json({
					...entry,
					version: 5,
					working: { metadata: body.metadata, doc: body.doc },
				});
			}
		});
		renderEdit();
		fireEvent.change(await editorTitle(), { target: { value: "미리보기 전 수정" } });
		fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: "미리보기" }));
		await waitFor(() => expect(methodCalls("PATCH")).toHaveLength(1));
		await waitFor(() => expect(opened.location.href).toBe("/preview/posts/test"));
		open.mockRestore();
	});

	it("creates a new entry only after an explicit Save", async () => {
		serve((input, init) => {
			if (input === "/api/cms/v1/entries" && init?.method === "POST") {
				const body = JSON.parse(String(init.body));
				return json(
					{
						...entry,
						id: "created-entry",
						version: 1,
						workingSlug: body.slug,
						working: { metadata: body.metadata, doc: body.doc },
					},
					201,
				);
			}
		});
		renderShell(<EntryEditorShell mode="new" adminId={ADMIN} collection="post" />);
		fireEvent.change(await editorTitle(), { target: { value: "새 글" } });
		// The recovery copy is kept after input pauses (interval is in the entry editor store test). Here, leaving the screen writes it right away.
		expect(saveLocalBackup).not.toHaveBeenCalled();
		window.dispatchEvent(new Event("pagehide"));
		await waitFor(() =>
			expect(saveLocalBackup).toHaveBeenCalledWith(expect.objectContaining({ key: `${ADMIN}:new:post` })),
		);
		vi.useFakeTimers();
		await act(async () => vi.advanceTimersByTimeAsync(11_000));
		vi.useRealTimers();
		expect(methodCalls("POST", "/api/cms/v1/entries")).toHaveLength(0);
		fireEvent.click(screen.getByRole("button", { name: "저장" }));
		await waitFor(() => expect(methodCalls("POST", "/api/cms/v1/entries")).toHaveLength(1));
		await waitFor(() => expect(deleteLocalBackup).toHaveBeenCalledWith(`${ADMIN}:new:post`));
		expect(window.location.pathname).toBe("/admin/entries/created-entry/edit");
	});

	it("creates and publishes a local new entry when Publish is clicked", async () => {
		serve((input, init) => {
			if (input === "/api/cms/v1/entries" && init?.method === "POST") {
				const body = JSON.parse(String(init.body));
				return json({
					...entry,
					id: "published-entry",
					collection: "memo",
					version: 1,
					workingSlug: body.slug,
					working: { metadata: body.metadata, doc: body.doc },
				});
			}
			if (input === "/api/cms/v1/entries/published-entry/publish" && init?.method === "POST") {
				return json({ ...entry, id: "published-entry", collection: "memo", status: "published", version: 2 });
			}
		});
		renderShell(<EntryEditorShell mode="new" adminId={ADMIN} collection="memo" />);
		fireEvent.change(await editorTitle(), { target: { value: "바로 발행" } });
		window.dispatchEvent(new Event("pagehide"));
		await waitFor(() => expect(saveLocalBackup).toHaveBeenCalled());
		expect(methodCalls("POST", "/api/cms/v1/entries")).toHaveLength(0);
		fireEvent.click(screen.getByRole("button", { name: "발행" }));
		await waitFor(() => expect(methodCalls("POST", "/publish")).toHaveLength(1));
		expect(methodCalls("POST", "/api/cms/v1/entries")).toHaveLength(1);
		expect(JSON.parse(String(methodCalls("POST", "/publish")[0]?.[1]?.body))).toEqual({ expectedVersion: 1 });
	});

	it("has no publish date input and publishes with only the version", async () => {
		serve((input) => {
			if (input.endsWith("/publish")) return json({ ...entry, version: 5, status: "published", warnings: [] });
		});
		renderEdit();
		await editorTitle();
		// The server sets the publish date on first publish. It is not edited in the properties panel.
		expect(screen.queryByLabelText(/^발행일/)).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "발행" }));

		await waitFor(() => expect(methodCalls("POST", "/publish")).toHaveLength(1));
		expect(JSON.parse(String(methodCalls("POST", "/publish")[0]?.[1]?.body))).toEqual({ expectedVersion: 4 });
	});

	it("republishes with today's date only from the publish menu of an already published entry", async () => {
		const published = { ...entry, status: "published", publishedAt: "2024-01-01T00:00:00.000Z" };
		serve((input) => {
			if (input.endsWith("/publish")) return json({ ...published, version: 5, warnings: [] });
		}, published);
		renderEdit();
		await editorTitle();
		fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: "발행 방식" }));
		fireEvent.click(await screen.findByRole("menuitem", { name: "오늘 날짜로 다시 발행" }));

		await waitFor(() => expect(methodCalls("POST", "/publish")).toHaveLength(1));
		expect(JSON.parse(String(methodCalls("POST", "/publish")[0]?.[1]?.body))).toEqual({
			expectedVersion: 4,
			resetPublishedAt: true,
		});
	});

	it("shows a plain publish button when no extension adds a publish option and the entry was never published", async () => {
		renderEdit();
		await editorTitle();
		expect(screen.getByRole("button", { name: "발행" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "발행 방식" })).toBeNull();
	});

	it("offers a same-version browser backup and deletes it when the server copy is kept", async () => {
		const server = formFromEntry(testSite, entry as never);
		getLocalBackup.mockResolvedValue({
			key: `${ADMIN}:entry-1`,
			entryId: "entry-1",
			baseVersion: 4,
			baseFingerprint: formFingerprint(testSite, server),
			localFingerprint: formFingerprint(testSite, { ...server, title: "수정" }),
			snapshot: { ...server, title: "수정" },
			changeSeq: 1,
			savedAt: Date.now(),
		});
		renderEdit();
		const dialog = await screen.findByRole("dialog", { name: "저장하지 않은 편집이 있습니다" });
		expect(within(dialog).getByRole("button", { name: "임시 저장본 불러오기" })).toBeTruthy();
		fireEvent.click(within(dialog).getByRole("button", { name: "서버 저장본 열기" }));
		await waitFor(() => expect(deleteLocalBackup).toHaveBeenCalledWith(`${ADMIN}:entry-1`));
	});

	it("warns that loading a backup made before the server changed overwrites it", async () => {
		const server = formFromEntry(testSite, entry as never);
		getLocalBackup.mockResolvedValue({
			key: `${ADMIN}:entry-1`,
			entryId: "entry-1",
			baseVersion: 3,
			baseFingerprint: "old",
			localFingerprint: formFingerprint(testSite, { ...server, doc: docOf("브라우저 본문") }),
			snapshot: { ...server, doc: docOf("브라우저 본문") },
			changeSeq: 1,
			savedAt: Date.now(),
		});
		renderEdit();
		const dialog = await screen.findByRole("dialog", { name: "저장하지 않은 편집이 있습니다" });
		expect(within(dialog).getByText(/서버 내용을 덮어씁니다/)).toBeTruthy();
		expect(within(dialog).queryByText("브라우저 본문")).toBeNull();
		fireEvent.click(within(dialog).getByRole("button", { name: "임시 저장본 불러오기" }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});

	it("binds field issues and moves issues in the body to the source text, at the block they are in", async () => {
		const body = docOf("첫째 문단\n\n둘째 문단\n");
		serve(
			(input) =>
				input.endsWith("/publish")
					? json(
							{
								code: "publish_validation_failed",
								issues: [
									{ code: "missing_field", path: "title", message: "제목" },
									{ code: "mdx_error", path: "body", position: { blockId: body.content[1]?.id } },
								],
							},
							422,
						)
					: undefined,
			{ ...entry, working: { ...entry.working, doc: body } },
		);
		renderEdit();
		await screen.findByDisplayValue("요약");
		fireEvent.click(screen.getByRole("button", { name: "발행" }));
		await screen.findByRole("list", { name: "발행 검증 문제" });
		const title = await editorTitle();
		expect(title.getAttribute("aria-invalid")).toBe("true");
		expect(title.getAttribute("aria-describedby")).toBe("cms-title-error");
		expect(screen.getAllByRole("textbox", { name: "제목" })).toHaveLength(1);
		fireEvent.click(screen.getByRole("button", { name: /제목을 입력하세요/ }));
		await waitFor(() => expect(document.activeElement).toBe(title));
		// In source mode, the panel is asked to focus the block the issue is in.
		fireEvent.click(screen.getByRole("button", { name: SOURCE_LABEL }));
		await screen.findByLabelText("패널 본문");
		fireEvent.click(screen.getByRole("button", { name: /MDX 본문 구문을 확인하세요/ }));
		await waitFor(() => expect(asked).toContain(body.content[1]?.id));
	});

	it("goes to the issue's block in the visual editor, and to the block in source mode when the editor does not have it", async () => {
		const doc = docOf("첫째 문단\n\n둘째 문단\n");
		const second = doc.content[1]?.id;
		let blockId = second;
		serve(
			(input) =>
				input.endsWith("/publish")
					? json(
							{
								code: "publish_validation_failed",
								issues: [{ code: "mdx_error", path: "body", position: { blockId } }],
							},
							422,
						)
					: undefined,
			{ ...entry, working: { ...entry.working, doc } },
		);
		renderEdit();
		await screen.findByDisplayValue("요약");
		await screen.findByLabelText("시각 본문");
		fireEvent.click(screen.getByRole("button", { name: "발행" }));
		await screen.findByRole("list", { name: "발행 검증 문제" });

		await waitFor(() => expect(mockEditor.current).not.toBeNull());
		fireEvent.click(screen.getByRole("button", { name: /MDX 본문 구문을 확인하세요/ }));
		await waitFor(() => expect(mockEditor.current?.state.selection.$from.parent.textContent).toBe("둘째 문단"));
		expect(screen.queryByLabelText("패널 본문")).toBeNull();

		blockId = "zzzzzzzz";
		fireEvent.click(screen.getByRole("button", { name: "발행" }));
		await waitFor(() => expect(methodCalls("POST").length).toBeGreaterThanOrEqual(2));
		fireEvent.click(await screen.findByRole("button", { name: /MDX 본문 구문을 확인하세요/ }));
		expect(await screen.findByLabelText("패널 본문")).toBeTruthy();
	});

	it("opens a body that cannot be read in source mode and does not allow the visual editor (no silent overwrite)", async () => {
		serve(() => undefined, {
			...entry,
			working: { ...entry.working, doc: unparsedDocument("본문 <Callout>닫히지 않음") },
		});
		// The visual editor must never mount on a body it cannot read, not even for a frame: watch every DOM change instead of
		// checking the end state only.
		let visualEditorMounted = false;
		const watcher = new MutationObserver(() => {
			if (document.querySelector('[aria-label="시각 본문"]')) visualEditorMounted = true;
		});
		watcher.observe(document.body, { childList: true, subtree: true });
		renderEdit();
		// The body opens after the deferred analysis of the loaded text.
		const source = await screen.findByLabelText("패널 본문");
		watcher.disconnect();
		expect(visualEditorMounted).toBe(false);
		expect(source).toBeTruthy();
		expect((await editorTitle()).getAttribute("value")).toBe("테스트");
		expect(screen.queryByLabelText("시각 본문")).toBeNull();
		const toggle = screen.getByRole("button", { name: SOURCE_LABEL }) as HTMLButtonElement;
		expect(toggle.getAttribute("aria-pressed")).toBe("true");
		expect(toggle.disabled).toBe(true);
		expect(screen.getByText(/원문 모드로만 편집합니다/)).toBeTruthy();
	});

	it("switches only the body to the source panel and keeps the toolbar and title", async () => {
		renderEdit();
		await screen.findByLabelText("시각 본문");
		const toggle = screen.getByRole("button", { name: SOURCE_LABEL });
		fireEvent.click(toggle);
		const source = await screen.findByLabelText("패널 본문");
		expect(source.textContent).toBe("첫째 줄\n둘째 줄");
		expect(screen.queryByLabelText("시각 본문")).toBeNull();
		expect((await editorTitle()).getAttribute("value")).toBe("테스트");
		expect(screen.getByRole("button", { name: "템플릿" })).toBeTruthy();
		fireEvent.click(toggle);
		expect(await screen.findByLabelText("시각 본문")).toBeTruthy();
		expect(screen.queryByLabelText("패널 본문")).toBeNull();
	});

	describe("the source toggle is the source panel slot", () => {
		/** A panel that is not the MDX one: it shows how many blocks the body has and lets a test hand a body back. */
		const focused: string[] = [];
		const FakePanel = ({ doc, onChange, focusBlock, readOnly }: SourcePanelProps) => {
			if (focusBlock) focused.push(focusBlock);
			return (
				<div>
					<output aria-label="블록 수">{doc.content.length}</output>
					<output aria-label="포커스">{focusBlock ?? "-"}</output>
					<output aria-label="읽기 전용">{String(readOnly)}</output>
					<button
						type="button"
						onClick={() => onChange(docOf("패널에서 쓴 본문\n\n둘째\n"), [{ code: "mdx_error", message: "문제" }])}
					>
						패널에서 고침
					</button>
				</div>
			);
		};
		beforeEach(() => {
			focused.length = 0;
		});
		const withPanels = (panels: SourcePanelRegistration[]) => {
			renderShell(<EntryEditorShell mode="edit" initialEntryId="entry-1" adminId={ADMIN} />, panels);
		};

		it("shows no toggle when no panel is registered, and the other toolbar tools stay", async () => {
			render(<EntryEditorShell mode="edit" initialEntryId="entry-1" adminId={ADMIN} />);
			await screen.findByLabelText("시각 본문");
			const toolbar = screen.getByRole("toolbar", { name: "서식 도구" });
			expect(within(toolbar).queryByRole("button", { name: SOURCE_LABEL })).toBeNull();
			expect(within(toolbar).getByRole("button", { name: "템플릿" })).toBeTruthy();
		});

		it("shows the toggle of the registered panel under its label, and opens that panel on the body", async () => {
			withPanels([{ format: "custom", label: "내 원문 보기", Panel: FakePanel }]);
			await screen.findByLabelText("시각 본문");
			expect(screen.queryByRole("button", { name: "MDX 원문" })).toBeNull();
			fireEvent.click(screen.getByRole("button", { name: "내 원문 보기" }));
			expect((await screen.findByLabelText("블록 수")).textContent).toBe("1");
			expect(screen.queryByLabelText("시각 본문")).toBeNull();
			expect(screen.getByLabelText("읽기 전용").textContent).toBe("false");
		});

		it("takes the body the panel hands back as the body, which the next save sends", async () => {
			serve((_input, init) => {
				if (init?.method === "PATCH") return json({ ...entry, version: 5 });
			});
			withPanels([{ format: "custom", label: "내 원문 보기", Panel: FakePanel }]);
			await screen.findByLabelText("시각 본문");
			fireEvent.click(screen.getByRole("button", { name: "내 원문 보기" }));
			fireEvent.click(await screen.findByRole("button", { name: "패널에서 고침" }));
			expect(screen.getByLabelText("저장 전 변경사항")).toBeTruthy();
			fireEvent.click(screen.getByRole("button", { name: "저장" }));
			await waitFor(() => expect(methodCalls("PATCH")).toHaveLength(1));
			const sent = JSON.parse(String(methodCalls("PATCH")[0]?.[1]?.body)) as { doc: StoredDocument };
			expect(sent.doc.content.map((block) => block.type)).toEqual(["paragraph", "paragraph"]);
			expect(JSON.stringify(sent.doc)).toContain("패널에서 쓴 본문");
		});

		it("uses the first registered panel when there are several", async () => {
			withPanels([
				{ format: "a", label: "첫 패널", Panel: FakePanel },
				{ format: "b", label: "둘째 패널", Panel: FakePanel },
			]);
			await screen.findByLabelText("시각 본문");
			expect(screen.getByRole("button", { name: "첫 패널" })).toBeTruthy();
			expect(screen.queryByRole("button", { name: "둘째 패널" })).toBeNull();
		});

		it("opens a body that could not be read in the panel, and shows the visual editor's box when there is none", async () => {
			serve(() => undefined, { ...entry, working: { ...entry.working, doc: unparsedDocument("본문 <Callout>") } });
			withPanels([{ format: "custom", label: "내 원문 보기", Panel: FakePanel }]);
			expect(await screen.findByLabelText("블록 수")).toBeTruthy();
			expect(screen.queryByLabelText("시각 본문")).toBeNull();
			cleanup();

			serve(() => undefined, { ...entry, working: { ...entry.working, doc: unparsedDocument("본문 <Callout>") } });
			render(<EntryEditorShell mode="edit" initialEntryId="entry-1" adminId={ADMIN} />);
			await screen.findByLabelText("시각 본문");
			// There is no panel to edit it in, so no note that says to.
			expect(screen.queryByText(/원문 모드로만 편집합니다/)).toBeNull();
		});

		it("tells the panel which block an issue is in", async () => {
			const body = docOf("첫째 문단\n\n둘째 문단\n");
			serve(
				(input) =>
					input.endsWith("/publish")
						? json(
								{
									code: "publish_validation_failed",
									issues: [{ code: "mdx_error", path: "body", position: { blockId: body.content[1]?.id } }],
								},
								422,
							)
						: undefined,
				{ ...entry, working: { ...entry.working, doc: body } },
			);
			withPanels([{ format: "custom", label: "내 원문 보기", Panel: FakePanel }]);
			await screen.findByDisplayValue("요약");
			fireEvent.click(screen.getByRole("button", { name: "내 원문 보기" }));
			await screen.findByLabelText("블록 수");
			fireEvent.click(screen.getByRole("button", { name: "발행" }));
			await screen.findByRole("list", { name: "발행 검증 문제" });
			fireEvent.click(screen.getByRole("button", { name: /MDX 본문 구문을 확인하세요/ }));
			// The panel is asked for that block, once; the screen does not keep asking.
			await waitFor(() => expect(focused).toEqual([body.content[1]?.id]));
			await waitFor(() => expect(screen.getByLabelText("포커스").textContent).toBe("-"));
		});
	});

	it("keeps the editor usable at narrow widths and opens the inspector on field errors", async () => {
		vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
		serve((input) =>
			input.endsWith("/publish")
				? json({ issues: [{ code: "missing_field", path: "categoryId", message: "카테고리" }] }, 422)
				: undefined,
		);
		renderEdit();
		await screen.findByRole("button", { name: "발행" });
		expect(await editorTitle()).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "발행" }));
		fireEvent.click(await screen.findByRole("button", { name: /카테고리를 입력하세요/ }));
		const category = await screen.findByRole("combobox", { name: /카테고리/ });
		await waitFor(() => expect(document.activeElement).toBe(category));
		expect(screen.getByLabelText("시각 본문").closest("[inert]")).toBeTruthy();
	});

	it("adds categories and tags through the add panel, prefilled with the typed name", async () => {
		serve((input, init) => {
			if (init?.method === "PATCH") return json({ ...entry, version: 5 });
			if (input === "/api/cms/v1/entries" && init?.method === "POST") {
				const data = JSON.parse(String(init.body));
				return json(
					{
						id: data.collection === "category" ? "cat-2" : "tag-2",
						workingSlug: "slug",
						publishedSlug: "slug",
						working: { metadata: data.metadata, doc: emptyStoredDocument() },
					},
					201,
				);
			}
		});
		renderEdit();
		// Searching for a name that does not exist shows `Add 'name'` at the end of the list; pressing it opens the add sheet with the name filled in.
		const saveIn = async (label: string) => {
			const panel = await screen.findByRole("complementary", { name: label }, { timeout: 10_000 });
			fireEvent.click(within(panel).getByRole("button", { name: "저장" }));
			await waitFor(() => expect(screen.queryByRole("complementary", { name: label })).toBeNull(), {
				timeout: 10_000,
			});
		};
		/**
		 * Enters a query and presses the `Add 'name'` item. Base UI opens the list only for real input (an input event with `inputType`).
		 * When several test files run together, input entered before the field is ready can vanish, so it is entered again until the item shows.
		 */
		const typeAndPickAdd = async (field: string, text: string) => {
			const input = (await screen.findByRole("combobox", { name: field })) as HTMLInputElement;
			const option = await waitFor(
				() => {
					if (!screen.queryByRole("option", { name: `'${text}' 추가` })) {
						fireEvent.input(input, { target: { value: text }, inputType: "insertText" });
					}
					return screen.getByRole("option", { name: `'${text}' 추가` });
				},
				{ timeout: 10_000, interval: 200 },
			);
			fireEvent.click(option);
			return input;
		};
		const category = await typeAndPickAdd("카테고리", "새 카테고리");
		await saveIn("카테고리 추가");
		await waitFor(() => expect(category.value).toBe("새 카테고리"), { timeout: 10_000 });
		await typeAndPickAdd("태그", "새 태그");
		await saveIn("태그 추가");
		await waitFor(() => expect(screen.getAllByText("새 태그").length).toBeGreaterThan(0), { timeout: 10_000 });
		const creations = methodCalls("POST", "/api/cms/v1/entries").map(([, init]) => JSON.parse(String(init?.body)));
		expect(creations).toMatchObject([
			{ collection: "category", metadata: { title: "새 카테고리" }, doc: emptyStoredDocument() },
			{ collection: "tag", metadata: { title: "새 태그" }, doc: emptyStoredDocument() },
		]);
	}, 30_000);

	it("stops publishing after an autosave conflict and offers copy, reload and overwrite", async () => {
		serve((input, init) => {
			if (init?.method === "PATCH") return json({ code: "conflict", serverVersion: 9 }, 409);
			if (input.endsWith("/publish")) throw new Error("Publish must not run after conflict");
		});
		renderEdit();
		fireEvent.change(await editorTitle(), { target: { value: "로컬 수정" } });
		fireEvent.click(screen.getByRole("button", { name: "발행" }));
		const dialog = await screen.findByRole("dialog", { name: /편집 충돌/ });
		expect(within(dialog).getAllByRole("button", { name: "본문 복사" })).toHaveLength(2);
		expect(within(dialog).getByRole("button", { name: "다시 불러오기" })).toBeTruthy();
		expect(within(dialog).getByRole("button", { name: "내 내용으로 덮어쓰기" })).toBeTruthy();
		expect(methodCalls("POST", "/publish")).toHaveLength(0);
	});

	describe("resolving an edit conflict in place", () => {
		const newer = {
			...entry,
			version: 9,
			working: { ...entry.working, metadata: { ...entry.working.metadata, title: "서버 최신 제목" } },
		};
		/** Someone else saved version 9 while this screen holds version 4; the first save meets the conflict. */
		async function conflicted() {
			let server: typeof entry = { ...entry };
			serve((input, init) => {
				if (input === "/api/cms/v1/entries/entry-1" && !init?.method) return json(server);
				if (init?.method === "PATCH") {
					const body = JSON.parse(String(init.body));
					if (body.expectedVersion !== server.version)
						return json({ code: "conflict", serverVersion: server.version }, 409);
					server = {
						...server,
						version: server.version + 1,
						working: { ...server.working, metadata: body.metadata, doc: body.doc },
					};
					return json(server);
				}
			});
			renderEdit();
			fireEvent.change(await editorTitle(), { target: { value: "로컬 수정" } });
			server = newer;
			fireEvent.click(screen.getByRole("button", { name: "저장" }));
			return { dialog: await screen.findByRole("dialog", { name: /편집 충돌/ }), server: () => server };
		}

		it("loads the server version without reloading the page", async () => {
			const { dialog } = await conflicted();
			expect(screen.getByLabelText("충돌")).toBeTruthy();
			fireEvent.click(within(dialog).getByRole("button", { name: "다시 불러오기" }));
			await waitFor(() => expect(screen.queryByRole("dialog", { name: /편집 충돌/ })).toBeNull());
			await waitFor(async () => expect(((await editorTitle()) as HTMLInputElement).value).toBe("서버 최신 제목"));
			expect(screen.getByLabelText("서버에 저장됨")).toBeTruthy();
			// The local copy was dropped with the local changes, so a reopen does not offer it again.
			expect(deleteLocalBackup).toHaveBeenCalledWith(`${ADMIN}:entry-1`);
			expect(methodCalls("PATCH")).toHaveLength(1);
		});

		it("overwrites the server version with mine after asking once more, at the server's version", async () => {
			const { dialog, server } = await conflicted();
			fireEvent.click(within(dialog).getByRole("button", { name: "내 내용으로 덮어쓰기" }));
			fireEvent.click(await screen.findByRole("button", { name: "덮어쓰기" }));
			await waitFor(() => expect(methodCalls("PATCH")).toHaveLength(2));
			expect(JSON.parse(String(methodCalls("PATCH")[1]?.[1]?.body))).toMatchObject({
				expectedVersion: 9,
				metadata: expect.objectContaining({ title: "로컬 수정" }),
			});
			await waitFor(() => expect(screen.queryByRole("dialog", { name: /편집 충돌/ })).toBeNull());
			await waitFor(() => expect(screen.getByLabelText("서버에 저장됨")).toBeTruthy());
			expect(server().version).toBe(10);
		});

		it("closing the dialog only hides it: the editor stays in conflict and keeps what was typed", async () => {
			const { dialog } = await conflicted();
			fireEvent.click(within(dialog).getAllByRole("button", { name: "닫기" })[0] as HTMLElement);
			await waitFor(() => expect(screen.queryByRole("dialog", { name: /편집 충돌/ })).toBeNull());
			expect(screen.getByLabelText("충돌")).toBeTruthy();
			expect(((await editorTitle()) as HTMLInputElement).value).toBe("로컬 수정");
		});
	});

	it("reports offline, server and expired-session failures and keeps a browser backup", async () => {
		const failures: unknown[] = [
			new TypeError("offline"),
			json({ message: "server error" }, 500),
			json({ code: "unauthorized" }, 401),
		];
		serve((_input, init) => {
			if (init?.method !== "PATCH") return undefined;
			const failure = failures.shift();
			if (failure instanceof Error) throw failure;
			return failure;
		});
		renderEdit();
		const title = await editorTitle();
		const expected = ["브라우저에만 임시 저장됨", "브라우저에만 임시 저장됨", "세션 만료 — 다시 로그인하세요"];
		for (const [index, value] of ["오프라인 수정", "서버 오류 수정", "세션 만료 수정"].entries()) {
			fireEvent.change(title, { target: { value } });
			fireEvent.keyDown(window, { key: "s", metaKey: true });
			await waitFor(() => expect(methodCalls("PATCH").length).toBeGreaterThanOrEqual(index + 1), { timeout: 4000 });
			await waitFor(() => expect(screen.getByText(expected[index] as string)).toBeTruthy());
		}
		expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "새 창에서 로그인" })).toBeTruthy();
		expect(saveLocalBackup).toHaveBeenLastCalledWith(
			expect.objectContaining({
				key: `${ADMIN}:entry-1`,
				snapshot: expect.objectContaining({ title: "세션 만료 수정", summary: "요약" }),
			}),
		);
	});

	it("drops a backup that already matches the server after a lost save response", async () => {
		let server = { ...entry };
		let backup: unknown;
		saveLocalBackup.mockImplementation(async (record) => {
			backup = record;
			return true;
		});
		serve((input, init) => {
			if (input === "/api/cms/v1/entries/entry-1" && !init?.method) return json(server);
			if (init?.method === "PATCH") {
				const body = JSON.parse(String(init.body));
				// Only the title changed, so the body text the server holds is the one it had.
				server = { ...server, version: 5, working: { ...server.working, metadata: body.metadata } };
				throw new TypeError("committed, response lost");
			}
		});
		const first = renderEdit();
		fireEvent.change(await editorTitle(), { target: { value: "응답 유실 수정" } });
		fireEvent.keyDown(window, { key: "s", ctrlKey: true });
		await waitFor(() => expect(methodCalls("PATCH")).toHaveLength(1));
		first.unmount();

		getLocalBackup.mockResolvedValue(backup);
		renderEdit();
		await waitFor(() => expect(screen.getAllByDisplayValue("응답 유실 수정").length).toBeGreaterThan(0));
		await waitFor(() => expect(deleteLocalBackup).toHaveBeenCalledWith(`${ADMIN}:entry-1`));
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(methodCalls("PATCH")).toHaveLength(1);
	});

	it("fills an empty post summary from the body before publishing", async () => {
		serve(
			(input, init) => {
				if (init?.method === "PATCH") return json({ ...entry, version: 5 });
				if (input.endsWith("/publish")) return json({ ...entry, version: 6, status: "published", warnings: [] });
			},
			{
				...entry,
				working: { metadata: { title: "테스트", categoryId: "cat-1" }, doc: docOf("## 소개\n\n**본문** 첫 문장.") },
			},
		);
		renderEdit();
		await screen.findByRole("textbox", { name: "요약" });
		expect(screen.queryByText(/비워 두면 발행할 때 본문에서 만듭니다/)).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "발행" }));
		await waitFor(() => expect(methodCalls("POST", "/publish")).toHaveLength(1));
		expect(JSON.parse(String(methodCalls("PATCH")[0]?.[1]?.body)).metadata.summary).toBe("소개 본문 첫 문장.");
	});

	it("does not publish when a body-filled field has nothing to fill from, naming the field", async () => {
		serve(() => undefined, {
			...entry,
			working: { metadata: { title: "테스트", categoryId: "cat-1" }, doc: docOf("```js\nonly();\n```") },
		});
		renderEdit();
		await screen.findByRole("textbox", { name: "요약" });
		fireEvent.click(screen.getByRole("button", { name: "발행" }));
		await waitFor(() => expect(error).toHaveBeenCalledWith("요약을 만들 본문이 없습니다. 직접 입력하세요."));
		expect(methodCalls("POST", "/publish")).toHaveLength(0);
	});

	it("shows trashed entries read-only with restore and permanent delete", async () => {
		serve(() => undefined, { ...entry, status: "trashed" });
		renderEdit();
		const banner = await screen.findByRole("region", { name: "휴지통" });
		const toolbar = screen.getByRole("banner");
		expect(within(toolbar).getByRole("button", { name: "복원" })).toBeTruthy();
		fireEvent.click(within(toolbar).getByRole("button", { name: "더보기" }));
		expect(screen.getByRole("menuitem", { name: "영구 삭제" })).toBeTruthy();
		expect(within(banner).queryByRole("button")).toBeNull();
		expect((screen.getByLabelText("시각 본문") as HTMLTextAreaElement).readOnly).toBe(true);
	});

	it("keeps frequent actions in the toolbar and moves lifecycle actions to the more menu", async () => {
		renderEdit();
		await screen.findByRole("button", { name: "더보기" });
		const toolbar = screen.getByRole("banner");
		expect(within(toolbar).queryByRole("button", { name: "MDX 원문" })).toBeNull();
		expect(
			within(screen.getByRole("toolbar", { name: "서식 도구" })).getByRole("button", { name: SOURCE_LABEL }),
		).toBeTruthy();
		expect(within(toolbar).getByRole("link", { name: "미리보기" })).toBeTruthy();
		fireEvent.click(within(toolbar).getByRole("button", { name: "더보기" }));
		expect(screen.getByRole("menuitem", { name: "복제" })).toBeTruthy();
		expect(screen.getByRole("menuitem", { name: "휴지통으로 이동" })).toBeTruthy();
		fireEvent.click(screen.getByRole("menuitem", { name: "보관" }));
		expect(screen.getByRole("alertdialog", { name: "보관" })).toBeTruthy();
	});

	it("opens and closes the inspector from the top bar toggle and its close button", async () => {
		renderEdit();
		const close = await screen.findByRole("button", { name: "닫기" });
		const toggle = within(screen.getByRole("banner")).getByRole("button", { name: "속성" });
		expect(toggle.getAttribute("aria-pressed")).toBe("true");
		expect(screen.getByRole("tab", { name: "속성" })).toBeTruthy();
		fireEvent.click(close);
		expect(screen.queryByRole("tab", { name: "속성" })).toBeNull();
		expect(toggle.getAttribute("aria-pressed")).toBe("false");
		fireEvent.click(toggle);
		expect(screen.getByRole("tab", { name: "속성" })).toBeTruthy();
	});

	it("shows the unarchive action in the toolbar for archived entries", async () => {
		serve(() => undefined, { ...entry, status: "archived" });
		renderEdit();
		const unarchive = await screen.findByRole("button", { name: "보관 해제" });
		expect(within(screen.getByRole("banner")).getByRole("button", { name: "보관 해제" })).toBe(unarchive);
		expect(screen.queryByRole("button", { name: "발행" })).toBeNull();
		expect(screen.queryByRole("region", { name: "보관됨" })).toBeNull();
	});

	it("unarchives and restores at once without asking", async () => {
		for (const [status, action, label, message] of [
			["archived", "unarchive", "보관 해제", "보관을 해제했습니다."],
			["trashed", "restore", "복원", "복원했습니다."],
		] as const) {
			serve(
				(input, init) => {
					if (input.endsWith(`/${action}`) && init?.method === "POST") return json({ ...entry, version: 5 });
				},
				{ ...entry, status },
			);
			renderEdit();
			await editorTitle();
			fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: label }));
			expect(screen.queryByRole("alertdialog")).toBeNull();
			await waitFor(() => expect(methodCalls("POST", `/${action}`)).toHaveLength(1));
			await waitFor(() => expect(success).toHaveBeenCalledWith(message));
			cleanup();
		}
	});

	it("reports header action failures as a toast", async () => {
		serve((input, init) => {
			if (input.endsWith("/publish") && init?.method === "POST") return json({ message: "서버 오류" }, 500);
		});
		renderEdit();
		await editorTitle();
		fireEvent.click(screen.getByRole("button", { name: "발행" }));
		await waitFor(() => expect(error).toHaveBeenCalled());
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("offers save once, in the header, not again in the more menu", async () => {
		renderEdit();
		await editorTitle();
		expect(within(screen.getByRole("banner")).getByRole("button", { name: "저장" })).toBeTruthy();
		fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: "더보기" }));
		expect(screen.getByRole("menuitem", { name: "복제" })).toBeTruthy();
		expect(screen.queryByRole("menuitem", { name: /저장/ })).toBeNull();
	});

	it("sends record collections to their explicit-save form", async () => {
		serve(() => undefined, { ...entry, collection: "tag" });
		renderEdit();
		// An item collection opens that item in the small form on the list.
		await waitFor(() => expect(testRouter.replace).toHaveBeenCalledWith(`/admin?collection=tag&open=${entry.id}`));
		expect(EMPTY_FORM.title).toBe("");
	});
});

describe("templates", () => {
	const templates = { items: [{ id: "t1", name: "회고", doc: docOf("## 회고") }] };
	const sourceText = () => {
		fireEvent.click(
			within(screen.getByRole("toolbar", { name: "서식 도구" })).getByRole("button", { name: SOURCE_LABEL }),
		);
		return screen.getByLabelText("패널 본문").textContent;
	};

	it("inserts the chosen template right away into an empty body", async () => {
		serve((input) => (input === "/api/cms/v1/templates" ? json(templates) : undefined), {
			...entry,
			working: { ...entry.working, doc: emptyStoredDocument() },
		});
		renderEdit();
		await editorTitle();
		fireEvent.click(screen.getByRole("button", { name: "템플릿" }));
		fireEvent.click(await screen.findByRole("menuitem", { name: "회고" }));

		expect(screen.queryByRole("alertdialog", { name: "템플릿 적용" })).toBeNull();
		expect(sourceText()).toBe("회고");
	});

	it("asks before replacing existing body text, and replaces only when applied", async () => {
		serve((input) => (input === "/api/cms/v1/templates" ? json(templates) : undefined));
		renderEdit();
		await editorTitle();
		fireEvent.click(screen.getByRole("button", { name: "템플릿" }));
		fireEvent.click(await screen.findByRole("menuitem", { name: "회고" }));

		const dialog = await screen.findByRole("alertdialog", { name: "템플릿 적용" });
		expect(dialog.textContent).toContain("회고");
		fireEvent.click(within(dialog).getByRole("button", { name: "적용" }));

		await waitFor(() => expect(screen.queryByRole("alertdialog", { name: "템플릿 적용" })).toBeNull());
		expect(sourceText()).toBe("회고");
	});

	it("applies a template as a copy with new block ids, and saves it as a document", async () => {
		const template = {
			id: "t1",
			name: "회고",
			doc: {
				type: "doc",
				version: 3,
				content: [
					{ type: "heading", id: "tpl00001", attrs: { level: 2 }, content: [{ type: "text", text: "회고" }] },
					{ type: "paragraph", id: "tpl00002", content: [{ type: "text", text: "배운 점" }] },
				],
			},
		};
		const before = JSON.stringify(template.doc);
		serve(
			(input, init) => {
				if (input === "/api/cms/v1/templates") return json({ items: [template] });
				if (init?.method === "PATCH") return json({ ...entry, version: 5 });
			},
			{ ...entry, working: { ...entry.working, doc: emptyStoredDocument() } },
		);
		renderEdit();
		await editorTitle();
		fireEvent.click(screen.getByRole("button", { name: "템플릿" }));
		fireEvent.click(await screen.findByRole("menuitem", { name: "회고" }));
		fireEvent.keyDown(window, { key: "s", ctrlKey: true });
		await waitFor(() => expect(methodCalls("PATCH")).toHaveLength(1));

		const sent = JSON.parse(String(methodCalls("PATCH")[0]?.[1]?.body)) as {
			doc: { content: { type: string; id?: string }[] };
		};
		expect(sent).not.toHaveProperty("mdx");
		expect(sent.doc.content.map((block) => block.type)).toEqual(["heading", "paragraph"]);
		for (const block of sent.doc.content) {
			expect(block.id).toMatch(/^[0-9a-z]{8}$/);
			// Ids are unique within a body: the template's own are not copied into the entry.
			expect(["tpl00001", "tpl00002"]).not.toContain(block.id);
		}
		expect(new Set(sent.doc.content.map((block) => block.id)).size).toBe(2);
		// The template itself is untouched.
		expect(JSON.stringify(template.doc)).toBe(before);
	});

	it("says so when there are no templates", async () => {
		serve((input) => (input === "/api/cms/v1/templates" ? json({ items: [] }) : undefined));
		renderEdit();
		await editorTitle();
		fireEvent.click(screen.getByRole("button", { name: "템플릿" }));

		expect(await screen.findByRole("menuitem", { name: "템플릿이 없습니다." })).toBeTruthy();
	});
});

describe("language tabs", () => {
	const member = (id: string, locale: string, status: string, isSource: boolean) => ({
		id,
		locale,
		status,
		isSource,
		title: "테스트",
		workingSlug: "test",
	});
	const source = {
		...entry,
		locale: "ko",
		translationGroupId: "entry-1",
		translations: [member("entry-1", "ko", "published", true), member("entry-en", "en", "draft", false)],
	};
	const translation = { ...source, id: "entry-en", locale: "en", status: "draft" };
	it("shows one tab per member above the title and marks the current one", async () => {
		serve(() => undefined, source);
		renderEdit();
		const nav = await screen.findByRole("navigation", { name: "언어" });
		const current = within(nav).getByRole("button", { name: "한국어 원문 · 발행됨" });
		expect(current.getAttribute("aria-current")).toBe("page");
		const other = within(nav).getByRole("button", { name: "영어 · 초안" });
		expect(other.getAttribute("aria-current")).toBeNull();
		expect(within(nav).getByRole("button", { name: "일본어 번역본 추가" })).toBeTruthy();
		expect(within(nav).queryByRole("button", { name: "번역본 메뉴" })).toBeNull();
		const title = await editorTitle();
		expect(nav.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it("moves to another language by its tab", async () => {
		serve(() => undefined, source);
		renderEdit();
		fireEvent.click(await screen.findByRole("button", { name: "영어 · 초안" }));
		expect(testRouter.navigate).toHaveBeenCalledWith("/admin/entries/entry-en/edit");
	});

	it("creates a translation from the missing-language button and opens it", async () => {
		serve((input, init) => {
			if (input === "/api/cms/v1/entries/entry-1/translations" && init?.method === "POST") {
				return json({ id: "entry-ja" }, 201);
			}
		}, source);
		renderEdit();
		fireEvent.click(await screen.findByRole("button", { name: "일본어 번역본 추가" }));
		await waitFor(() => expect(testRouter.navigate).toHaveBeenCalledWith("/admin/entries/entry-ja/edit"));
		expect(JSON.parse(String(methodCalls("POST", "/translations")[0]?.[1]?.body))).toEqual({ locale: "ja" });
		expect(success).toHaveBeenCalledWith("일본어 번역본을 만들었습니다.");
	});

	it("blocks translation creation while there are unsaved changes", async () => {
		serve(() => undefined, source);
		renderEdit();
		fireEvent.change(await editorTitle(), { target: { value: "저장 전" } });
		fireEvent.click(screen.getByRole("button", { name: "일본어 번역본 추가" }));
		await waitFor(() => expect(error).toHaveBeenCalled());
		expect(methodCalls("POST", "/translations")).toHaveLength(0);
	});

	it("trashes a translation from its tab menu and goes back to the source", async () => {
		serve((input, init) => {
			if (input === "/api/cms/v1/entries/entry-en" && !init?.method) return json(translation);
			if (input === "/api/cms/v1/entries/entry-en/trash" && init?.method === "POST") {
				return json({ ...translation, status: "trashed" });
			}
		}, translation);
		renderShell(<EntryEditorShell mode="edit" initialEntryId="entry-en" adminId={ADMIN} />);
		const nav = await screen.findByRole("navigation", { name: "언어" });
		expect(within(nav).getByRole("button", { name: "영어 · 초안" }).getAttribute("aria-current")).toBe("page");
		fireEvent.click(within(nav).getByRole("button", { name: "번역본 메뉴" }));
		fireEvent.click(screen.getByRole("menuitem", { name: "휴지통으로 이동" }));
		const dialog = screen.getByRole("alertdialog", { name: "휴지통으로 이동" });
		expect(within(dialog).queryByText(/함께/)).toBeNull();
		fireEvent.click(within(dialog).getByRole("button", { name: "휴지통으로 이동" }));
		await waitFor(() => expect(methodCalls("POST", "/entry-en/trash")).toHaveLength(1));
		await waitFor(() => expect(testRouter.navigate).toHaveBeenCalledWith("/admin/entries/entry-1/edit"));
	});

	it("does not offer duplicate on a translation", async () => {
		serve((input, init) => {
			if (input === "/api/cms/v1/entries/entry-en" && !init?.method) return json(translation);
		}, translation);
		renderShell(<EntryEditorShell mode="edit" initialEntryId="entry-en" adminId={ADMIN} />);
		await screen.findByRole("navigation", { name: "언어" });
		fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: "더보기" }));
		expect(screen.getByRole("menuitem", { name: "휴지통으로 이동" })).toBeTruthy();
		expect(screen.queryByRole("menuitem", { name: "복제" })).toBeNull();
	});

	it("tells that translations go along when trashing or archiving the source", async () => {
		serve(() => undefined, source);
		renderEdit();
		await screen.findByRole("navigation", { name: "언어" });
		fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: "더보기" }));
		fireEvent.click(screen.getByRole("menuitem", { name: "휴지통으로 이동" }));
		expect(within(screen.getByRole("alertdialog")).getByText(/EN 번역본도 함께 휴지통으로 이동합니다\./)).toBeTruthy();
	});

	it("hides the tabs for record collections and new entries", async () => {
		renderShell(<EntryEditorShell mode="new" adminId={ADMIN} collection="post" />);
		await editorTitle();
		expect(screen.queryByRole("navigation", { name: "언어" })).toBeNull();
	});
});

describe("translation source pane", () => {
	const SOURCE_MDX = "첫 문단\n\n둘째 문단\n";
	const source = {
		...entry,
		locale: "ko",
		translationGroupId: "entry-1",
		translations: [],
	};
	/** What a document says, without its block ids (reading text draws new ones). */
	const contentKey = (doc: StoredDocument) => JSON.stringify(withoutBlockIds(doc.content));
	const translationWith = (
		baseSource: string | null,
		documents: { base?: StoredDocument | null; current?: StoredDocument | null; currentMdx?: string } = {},
	) => ({
		...entry,
		id: "entry-en",
		locale: "en",
		translationGroupId: "entry-1",
		translations: [],
		source: {
			locale: "ko",
			metadata: { title: "원문 제목" },
			doc: documents.current ?? docOf(documents.currentMdx ?? SOURCE_MDX),
		},
		working: {
			metadata: { title: "Title" },
			doc: docOf("First\n\nSecond\n"),
			translation: baseSource === null ? null : { version: 4, baseDoc: documents.base ?? docOf(baseSource) },
		},
	});
	const sourcePane = () => screen.queryByRole("complementary", { name: "원문 창" });
	const clearStorage = () => {
		try {
			window.localStorage.clear();
		} catch {
			// With no storage there is nothing to clear.
		}
	};
	beforeEach(clearStorage);
	afterEach(clearStorage);

	it("shows the full source beside only a translation", async () => {
		serve(() => undefined, translationWith(SOURCE_MDX));
		renderEdit();
		await editorTitle();
		await waitFor(() => expect(sourcePane()?.textContent).toContain("둘째 문단"));
		expect(within(sourcePane() as HTMLElement).getByText("KO 원문")).toBeTruthy();
		// The title slot hint is the source title.
		expect((await editorTitle()).getAttribute("placeholder")).toBe("원문 제목");
		// A translation uses the same editor too (formatting tools, source switch).
		expect(screen.getByRole("toolbar", { name: "서식 도구" })).toBeTruthy();
		expect(screen.getByRole("button", { name: SOURCE_LABEL })).toBeTruthy();

		cleanup();
		serve(() => undefined, source);
		renderEdit();
		await editorTitle();
		expect(sourcePane()).toBeNull();
	});

	it("collapses and expands the pane with the close-source button and the source toggle, and remembers it", async () => {
		serve(() => undefined, translationWith(SOURCE_MDX));
		renderEdit();
		await editorTitle();
		await waitFor(() => expect(sourcePane()).not.toBeNull());
		fireEvent.click(within(sourcePane() as HTMLElement).getByRole("button", { name: "닫기" }));
		expect(sourcePane()).toBeNull();
		expect(window.localStorage.getItem("cms:translation-source-pane")).toBe("closed");
		const toggle = screen.getByRole("button", { name: "원문" });
		expect(toggle.getAttribute("aria-pressed")).toBe("false");
		fireEvent.click(toggle);
		expect(sourcePane()).not.toBeNull();
		expect(window.localStorage.getItem("cms:translation-source-pane")).toBe("open");
	});

	it("opens a previously collapsed pane collapsed", async () => {
		window.localStorage.setItem("cms:translation-source-pane", "closed");
		serve(() => undefined, translationWith(SOURCE_MDX));
		renderEdit();
		await editorTitle();
		expect(sourcePane()).toBeNull();
	});

	it("shows no notice when it matches the confirmed source", async () => {
		serve(() => undefined, translationWith(SOURCE_MDX));
		renderEdit();
		await editorTitle();
		expect(screen.queryByText("원문이 바뀌었습니다")).toBeNull();
	});

	it("when the source changes, notifies, and confirm saves the confirmed source in the request", async () => {
		serve((_input, init) => {
			if (init?.method === "PATCH") {
				const body = JSON.parse(String(init.body));
				return json({ ...translationWith(SOURCE_MDX), version: 5, working: { ...body, metadata: body.metadata } });
			}
		}, translationWith("첫 문단\n"));
		renderEdit();
		expect(await screen.findByText("원문이 바뀌었습니다")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "확인" }));
		expect(screen.queryByText("원문이 바뀌었습니다")).toBeNull();
		fireEvent.click(await screen.findByRole("button", { name: "저장" }));
		await waitFor(() => expect(methodCalls("PATCH")).toHaveLength(1));
		// The confirmed source is the document of the source.
		const sent = JSON.parse(String(methodCalls("PATCH")[0]?.[1]?.body)).translation;
		expect(sent.version).toBe(4);
		expect(contentKey(sent.baseDoc)).toBe(contentKey(docOf(SOURCE_MDX)));
	});

	it("confirm also saves the source's document", async () => {
		const current = docOf(SOURCE_MDX);
		serve(
			(_input, init) => {
				if (init?.method === "PATCH") {
					const body = JSON.parse(String(init.body));
					return json({ ...translationWith(SOURCE_MDX), version: 5, working: { ...body, metadata: body.metadata } });
				}
			},
			translationWith("첫 문단\n", { current }),
		);
		renderEdit();
		expect(await screen.findByText("원문이 바뀌었습니다")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "확인" }));
		fireEvent.click(await screen.findByRole("button", { name: "저장" }));
		await waitFor(() => expect(methodCalls("PATCH")).toHaveLength(1));
		expect(JSON.parse(String(methodCalls("PATCH")[0]?.[1]?.body)).translation).toEqual({
			version: 4,
			baseDoc: current,
		});
	});

	it("with no translation state or a malformed one, nothing is treated as confirmed", async () => {
		serve(() => undefined, translationWith(null));
		renderEdit();
		expect(await screen.findByText("원문이 바뀌었습니다")).toBeTruthy();
	});

	it("the comparison lists changed blocks as before and now", async () => {
		serve(() => undefined, translationWith("첫 문단 옛\n\n둘째 문단\n\n지운 문단\n"));
		renderEdit();
		fireEvent.click(await screen.findByRole("button", { name: "비교" }));
		const dialog = await screen.findByRole("dialog", { name: "원문 변경" });
		expect(within(dialog).getByText("바뀜")).toBeTruthy();
		expect(within(dialog).getByText("삭제")).toBeTruthy();
		expect(within(dialog).getAllByText("이전").length).toBeGreaterThan(0);
		expect(within(dialog).getAllByText("지금").length).toBeGreaterThan(0);
		await waitFor(() => expect(dialog.textContent).toContain("첫 문단 옛"));
	});

	it("the comparison shows a block that moved as moved when both versions have documents", async () => {
		const before = docOf("가\n\n나\n\n다\n") as StoredDocument;
		const [first, second, third] = before.content;
		const current = { ...before, content: [third, first, second] } as StoredDocument;
		serve(
			() => undefined,
			translationWith("가\n\n나\n\n다\n", { base: before, current, currentMdx: "다\n\n가\n\n나\n" }),
		);
		renderEdit();
		fireEvent.click(await screen.findByRole("button", { name: "비교" }));
		const dialog = await screen.findByRole("dialog", { name: "원문 변경" });
		expect(within(dialog).getAllByText("이동")).toHaveLength(1);
		expect(within(dialog).queryByText("추가")).toBeNull();
		expect(within(dialog).queryByText("삭제")).toBeNull();
		await waitFor(() => expect(dialog.textContent).toContain("다"));
	});

	it("the comparison labels a block that moved and changed", async () => {
		const before = docOf("가\n\n나\n\n다\n") as StoredDocument;
		const [first, second, third] = before.content;
		const edited = { ...third, content: [{ type: "text", text: "다 고침" }] };
		const current = { ...before, content: [edited, first, second] } as StoredDocument;
		serve(
			() => undefined,
			translationWith("가\n\n나\n\n다\n", { base: before, current, currentMdx: "다 고침\n\n가\n\n나\n" }),
		);
		renderEdit();
		fireEvent.click(await screen.findByRole("button", { name: "비교" }));
		const dialog = await screen.findByRole("dialog", { name: "원문 변경" });
		expect(within(dialog).getByText("이동 및 수정")).toBeTruthy();
		await waitFor(() => expect(dialog.textContent).toContain("다 고침"));
	});

	it("without documents the same move is a removed and an added block", async () => {
		serve(() => undefined, translationWith("가\n\n나\n\n다\n", { currentMdx: "다\n\n가\n\n나\n" }));
		renderEdit();
		fireEvent.click(await screen.findByRole("button", { name: "비교" }));
		const dialog = await screen.findByRole("dialog", { name: "원문 변경" });
		expect(within(dialog).queryByText("이동")).toBeNull();
		expect(within(dialog).getByText("추가")).toBeTruthy();
		expect(within(dialog).getByText("삭제")).toBeTruthy();
	});

	it("an unparseable source is reported as not comparable", async () => {
		serve(() => undefined, translationWith("", { base: unparsedDocument("<Callout>닫히지 않음") }));
		renderEdit();
		fireEvent.click(await screen.findByRole("button", { name: "비교" }));
		const dialog = await screen.findByRole("dialog", { name: "원문 변경" });
		expect(within(dialog).getByText("비교할 수 없습니다.")).toBeTruthy();
	});

	it("shows the source title at the top of the source pane", async () => {
		serve(() => undefined, translationWith(SOURCE_MDX));
		renderEdit();
		await editorTitle();
		const heading = await within(sourcePane() as HTMLElement).findByRole("heading", { level: 1 });
		expect(heading.textContent).toBe("원문 제목");
	});

	it("marks the source block matching the block under the editor cursor", async () => {
		serve(() => undefined, translationWith(SOURCE_MDX));
		renderEdit();
		await editorTitle();
		const paneBlocks = async () => {
			const root = await waitFor(() => {
				const found = sourcePane()?.querySelector(".ProseMirror");
				if (!found || found.children.length < 2) throw new Error("pane not ready");
				return found;
			});
			return Array.from(root.children);
		};
		const blocks = await paneBlocks();
		const moveCaretTo = (index: number) => {
			const body = screen.getByTestId("mock-editor-body");
			const range = document.createRange();
			range.setStart(body.children[index]?.firstChild as Node, 1);
			range.collapse(true);
			const selection = document.getSelection();
			selection?.removeAllRanges();
			selection?.addRange(range);
			document.dispatchEvent(new Event("selectionchange"));
		};
		moveCaretTo(1);
		await waitFor(() => expect(blocks[1]?.classList.contains("cms-source-active")).toBe(true));
		expect(blocks[0]?.classList.contains("cms-source-active")).toBe(false);
		moveCaretTo(0);
		await waitFor(() => expect(blocks[0]?.classList.contains("cms-source-active")).toBe(true));
		expect(blocks[1]?.classList.contains("cms-source-active")).toBe(false);
	});
});
