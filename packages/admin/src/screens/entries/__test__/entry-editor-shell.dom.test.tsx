import { RightPanelOpen } from "@carbon/icons-react";
import { emptyStoredDocument, type StoredDocument, unparsedDocument } from "@monti-cms/core/document";
import { issueText } from "@monti-cms/core/site";
import { SidePanel } from "@monti-cms/ui";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import {
	AdminComponentsProvider,
	type SourcePanelProps,
	type SourcePanelRegistration,
} from "../../../admin-components";
import type { EntryWriteResult } from "../../../api/entries";
import type { CmsIssue } from "../../../api/error-message";
import type { ExportSummary } from "../../../api/export";
import { findBlock } from "../../../editor/block-ids";
import { StatusBarPluginCell } from "../../../kit";
import { commonMessages } from "../../../lib/common.messages";
import type { AdminPanel } from "../../../plugins";
import { type FakeApi, failure, fakeApi, type SentRequest } from "../../../test/fake-api";
import { docOf } from "../../../test/mdx";
import { createTestRouter } from "../../../test/router";
import { withSite } from "../../../test/site";
import { toast } from "../../../test/ui-toast";
import { exportMessages } from "../../export/messages";
import { screensMessages } from "../../messages";
import { schemaReviewMessages } from "../../schema/review.messages";
import { deleteMessages } from "../../shared/delete.messages";
import { useOpenEditor } from "../../shared/open-editor";
import { publishReadinessMessages } from "../../shared/publish-readiness.messages";
import { ScreenContextProvider, useScreenContext } from "../../shared/screen-context";
import { AdminPanelProvider } from "../../shared/side-panel-slot";
import { StatusCellsProvider, useStatusBarContext } from "../../shared/status-bar";
import { statusBarMessages } from "../../shared/status-bar.messages";
import { EntryEditorShell } from "../entry-editor-shell";
import { entryEditorShellMessages } from "../entry-editor-shell.messages";
import { type EntryData, type TranslationMember } from "../entry-form";
import { entriesMessages } from "../messages";

const tEntryEditorShell = testSite.createTranslator(entryEditorShellMessages);
const tEntries = testSite.createTranslator(entriesMessages);
const tScreens = testSite.createTranslator(screensMessages);
const tStatusBar = testSite.createTranslator(statusBarMessages);
const tPublishReadiness = testSite.createTranslator(publishReadinessMessages);
const tSchemaReview = testSite.createTranslator(schemaReviewMessages);
const tExport = testSite.createTranslator(exportMessages);
const tDelete = testSite.createTranslator(deleteMessages);
const TITLE_LABEL = testSite.titleField("post").field.label;
const tCommon = testSite.createTranslator(commonMessages);

const { getLocalBackup, deleteLocalBackup, saveLocalBackup } = vi.hoisted(() => ({
	getLocalBackup: vi.fn(),
	deleteLocalBackup: vi.fn(),
	saveLocalBackup: vi.fn(),
}));
// The functions take the site as their last argument (its recovery database); these tests look at the key and the record only.
vi.mock("../local-backup", async (importOriginal) => ({
	...(await importOriginal<typeof import("../local-backup")>()),
	getLocalBackup: (key: string) => getLocalBackup(key),
	deleteLocalBackup: (key: string) => deleteLocalBackup(key),
	saveLocalBackup: (record: unknown) => saveLocalBackup(record),
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
			tools?: React.ReactNode;
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
	sourceView,
	doc,
	onEditor,
	useHeadlessEditor,
}: {
	editable?: boolean;
	titleField?: React.ReactNode;
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
			{titleField}
			{sourceView ?? <textarea aria-label="시각 본문" readOnly={editable === false} />}
			<div className="ProseMirror" data-testid="mock-editor-body">
				<p>번역 첫 문단</p>
				<p>번역 둘째 문단</p>
			</div>
		</>
	);
}
vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);
// AI translation is tested separately (ai-translate.test.ts). Edit screen tests must not make an AI feature list request.
vi.mock("../ai-translate", () => ({
	useAiTranslate: () => ({ blockAction: null, menuItems: [], setEditor: () => {} }),
}));
const testRouter = createTestRouter();
const { render } = testRouter;

const ADMIN = "u1";
const entry: EntryData = {
	id: "entry-1",
	collection: "post",
	status: "draft",
	version: 4,
	folderId: null,
	workingSlug: "test",
	publishedSlug: null,
	working: { metadata: { title: "테스트", categoryId: "cat-1", summary: "요약" }, doc: docOf("첫째 줄\n둘째 줄") },
};

let api: FakeApi;
/** What the publish check answers (`POST …/check`); a test changes it to put problems in the readiness item. */
let checkAnswer: { issues: CmsIssue[]; warnings: CmsIssue[] } = { issues: [], warnings: [] };

/** Makes `current` the entry the editor loads; the lists, the usages and the publish check keep their common answers. */
const serve = (current: EntryData) => api.on("GET /v1/entries/:id", () => current);
/** What a save answers: `current` at the next version, holding what was sent. */
const savedAs =
	(current: EntryData = entry) =>
	({ body }: SentRequest) => ({
		entry: {
			...current,
			version: current.version + 1,
			working: {
				...current.working,
				metadata: body.metadata,
				doc: body.doc ?? current.working.doc,
				...(body.translation === undefined ? {} : { translation: body.translation }),
			},
		},
		warnings: [],
	});

const SOURCE_LABEL = "원문 보기";
/** Opens the header's ⋯ menu, where the document tools are, and waits for it. */
const openMoreMenu = async () => {
	if (!screen.queryByRole("menu"))
		fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: tEntryEditorShell("more") }));
	return screen.findByRole("menu");
};
/** A switch of the ⋯ menu's document tools (the source panel, the source beside a translation), or null when the menu has none by that name. */
const viewSwitch = async (name: string) => {
	const menu = await openMoreMenu();
	return within(menu).queryByRole("menuitemcheckbox", { name });
};
/** Turns a document-tools switch over and closes the menu again. */
const toggleView = async (name: string) => {
	const row = await viewSwitch(name);
	if (!row) throw new Error(`no switch named ${name}`);
	fireEvent.click(row);
	const menu = screen.queryByRole("menu");
	if (menu) fireEvent.keyDown(menu, { key: "Escape" });
	await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
};
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
	render(withSite(<AdminComponentsProvider components={{ sourcePanels }}>{ui}</AdminComponentsProvider>));
const renderEdit = () => renderShell(<EntryEditorShell mode="edit" initialEntryId="entry-1" adminId={ADMIN} />);
const editorTitle = () => screen.findByRole("textbox", { name: TITLE_LABEL });
/** The popup a refused publish opens by itself. */
const readinessPopup = async () => within(await screen.findByRole("dialog"));
/** The list opened from the to-do cell in the status bar, which names how many problems there are. */
const reopenReadinessPopup = async () => {
	fireEvent.click(await screen.findByRole("button", { name: /^할 일 \d/ }));
	return within(await screen.findByRole("dialog"));
};
/** Saves the way the header no longer offers a button for: the keyboard shortcut. */
const pressSave = () => fireEvent.keyDown(window, { key: "s", metaKey: true });

beforeEach(() => {
	asked.length = 0;
	vi.clearAllMocks();
	getLocalBackup.mockResolvedValue(null);
	deleteLocalBackup.mockResolvedValue(undefined);
	saveLocalBackup.mockResolvedValue(true);
	checkAnswer = { issues: [], warnings: [] };
	api = fakeApi()
		.on("GET /v1/entries", () => ({ items: [], total: 0 }))
		.on("GET /v1/entries/search", () => ({ items: [] }))
		.on("GET /v1/entries/:id/relations", () => ({ incomingReferences: [] }))
		.on("POST /v1/entries/:id/check", () => checkAnswer)
		.install();
	serve(entry);
});
/** An issue as the server sends it on an admin route: with its person's text. */
const told = (issue: Parameters<typeof issueText>[1] & { path?: string }): CmsIssue => ({
	...issue,
	...issueText(testSite, issue),
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("entry editor shell", () => {
	it("WRITE-S1 keeps edits in the browser until Save is clicked", async () => {
		api.on("PATCH /v1/entries/:id", savedAs());
		renderEdit();
		fireEvent.change(await editorTitle(), { target: { value: "로컬에서 수정" } });
		// The recovery copy is kept after input pauses (interval is in the entry editor store test). Here, leaving the screen writes it right away.
		expect(saveLocalBackup).not.toHaveBeenCalled();
		window.dispatchEvent(new Event("pagehide"));
		await waitFor(() =>
			expect(saveLocalBackup).toHaveBeenCalledWith(expect.objectContaining({ key: `${ADMIN}:entry-1` })),
		);
		expect(screen.getByTitle(tEntries("save.dirty"))).toBeInTheDocument();
		pressSave();
		await waitFor(() => expect(api.sent("PATCH /v1/entries/:id")).toHaveLength(1));
		await waitFor(() => expect(screen.getByTitle(tEntries("save.saved"))).toBeInTheDocument());
		expect(api.sent("PATCH /v1/entries/:id")[0]?.body.metadata.title).toBe("로컬에서 수정");
	});

	it("WRITE-S1 shows the save state in the status bar and saves from it: saved, then unsaved, saving and saved again", async () => {
		let finish: (() => void) | undefined;
		api.on("PATCH /v1/entries/:id", async (request) => {
			await new Promise<void>((resolve) => {
				finish = resolve;
			});
			return savedAs()(request);
		});
		renderEdit();
		const bar = within(await screen.findByRole("region", { name: tScreens("column.status") }));
		await waitFor(() => expect(bar.getByText(/^저장됨 /)).toBeInTheDocument());
		// The size of the body (whitespace not counted) is at the end; the language and the reading time are not in the bar.
		expect(bar.getByText("6자")).toBeInTheDocument();
		expect(bar.queryByText("ko")).toBeNull();
		fireEvent.change(await editorTitle(), { target: { value: "수정" } });
		// Pressing the cell saves, as Cmd/Ctrl+S does.
		fireEvent.click(bar.getByRole("button", { name: tEntries("save.dirty") }));
		await waitFor(() => expect(bar.getByText(tStatusBar("save.saving"))).toBeInTheDocument());
		expect(bar.queryByRole("button", { name: tStatusBar("save.saving") })).toBeNull();
		finish?.();
		await waitFor(() => expect(bar.getByText(/^저장됨 /)).toBeInTheDocument());
		expect(bar.queryByText(tStatusBar("save.saving"))).toBeNull();
		expect(api.sent("PATCH /v1/entries/:id")).toHaveLength(1);
	});

	it("WRITE-S4 saves even when a Korean composition never reports its end", async () => {
		api.on("PATCH /v1/entries/:id", savedAs());
		renderEdit();
		const title = await editorTitle();
		fireEvent.change(title, { target: { value: "조합 중 수정" } });
		// The input that started composition vanished without an end signal.
		fireEvent.compositionStart(title);
		pressSave();
		await waitFor(() => expect(api.sent("PATCH /v1/entries/:id")).toHaveLength(1), { timeout: 3000 });
		await waitFor(() => expect(toast).toHaveBeenCalledWith("저장했어요."));
	});

	it("WRITE-S5 shows why an explicit save failed instead of doing nothing", async () => {
		api.on("PATCH /v1/entries/:id", () => failure("invalid_input", "제목이 너무 길어요."));
		renderEdit();
		fireEvent.change(await editorTitle(), { target: { value: "실패할 수정" } });
		pressSave();
		await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("제목이 너무 길어요.")));
	});

	it("WRITE-S1 saves pending changes before opening the preview", async () => {
		const opened = { opener: {}, location: { href: "" }, close: vi.fn() };
		const open = vi.spyOn(window, "open").mockReturnValue(opened as unknown as Window);
		api.on("PATCH /v1/entries/:id", savedAs());
		renderEdit();
		fireEvent.change(await editorTitle(), { target: { value: "미리보기 전 수정" } });
		fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: tEntryEditorShell("preview") }));
		await waitFor(() => expect(api.sent("PATCH /v1/entries/:id")).toHaveLength(1));
		await waitFor(() => expect(opened.location.href).toBe("/preview/posts/test"));
		open.mockRestore();
	});

	it("WRITE-S1 creates a new entry only after an explicit Save", async () => {
		api.on("POST /v1/entries", ({ body }) => ({
			entry: {
				...entry,
				id: "created-entry",
				version: 1,
				workingSlug: body.slug,
				working: { metadata: body.metadata, doc: body.doc },
			},
			warnings: [],
		}));
		renderShell(<EntryEditorShell mode="new" adminId={ADMIN} collection="post" />);
		fireEvent.change(await editorTitle(), { target: { value: "새 글" } });
		// The recovery copy is kept after input pauses (interval is in the entry editor store test). Here, leaving the screen writes it right away.
		expect(saveLocalBackup).not.toHaveBeenCalled();
		window.dispatchEvent(new Event("pagehide"));
		await waitFor(() =>
			expect(saveLocalBackup).toHaveBeenCalledWith(expect.objectContaining({ key: `${ADMIN}:new:post` })),
		);
		pressSave();
		await waitFor(() => expect(api.sent("POST /v1/entries")).toHaveLength(1));
		await waitFor(() => expect(deleteLocalBackup).toHaveBeenCalledWith(`${ADMIN}:new:post`));
		expect(window.location.pathname).toBe("/admin/entries/created-entry/edit");
	});

	describe("to-do cell in the status bar (flow 1 steps 10 to 13)", () => {
		const checkCalls = () => api.sent("POST /v1/entries/:id/check");
		const bar = async () => within(await screen.findByRole("region", { name: tScreens("column.status") }));
		const missingTitle = told({ code: "missing_field", path: "title", message: "제목" });
		const missingAlt = told({ code: "missing_image_alt", path: "body", position: { blockId: "b1" } });

		it("WRITE-P1 says nothing is left to do when the check finds nothing, and checks once after loading", async () => {
			renderEdit();
			expect(await (await bar()).findByRole("button", { name: tStatusBar("todo.none") })).toBeInTheDocument();
			expect(checkCalls()).toHaveLength(1);
			expect(checkCalls()[0]?.path).toBe("/v1/entries/entry-1/check");
		});

		it("WRITE-P1 counts what to fix, and leaves the warnings out", async () => {
			checkAnswer = { issues: [missingTitle, missingAlt], warnings: [told({ code: "footnote_definition_unused" })] };
			renderEdit();
			fireEvent.click(await (await bar()).findByRole("button", { name: "할 일 2" }));
			const list = within(await screen.findByRole("dialog"));
			expect(list.getByText(tStatusBar("todo.title"))).toBeInTheDocument();
			expect(list.queryByText(tPublishReadiness("issue.footnote_definition_unused"))).toBeNull();
		});

		it("WRITE-P1 rechecks after a save, not on a keystroke, and keeps the last answer meanwhile", async () => {
			checkAnswer = { issues: [missingTitle], warnings: [] };
			api.on("PATCH /v1/entries/:id", savedAs());
			renderEdit();
			await (await bar()).findByRole("button", { name: "할 일 1" });
			expect(checkCalls()).toHaveLength(1);

			fireEvent.change(await editorTitle(), { target: { value: "수정 중" } });
			fireEvent.change(await editorTitle(), { target: { value: "수정 중 2" } });
			expect(await screen.findByRole("button", { name: "할 일 1" })).toBeInTheDocument();
			expect(checkCalls()).toHaveLength(1);

			checkAnswer = { issues: [], warnings: [] };
			pressSave();
			await waitFor(() => expect(checkCalls()).toHaveLength(2));
			expect(await (await bar()).findByRole("button", { name: tStatusBar("todo.none") })).toBeInTheDocument();
		});
	});

	describe("plugin cell in the status bar (flow 1 step 06, flow 3)", () => {
		const finding = (title: string) => ({
			id: title,
			title,
			detail: "문단 1",
			actionLabel: "고치기",
			onAction: () => {},
		});
		/** A plugin's cell that shows where it is, and draws nothing for any other language. */
		const KoreanCell = () => {
			const { locale } = useStatusBarContext();
			return locale === "ko" ? <StatusBarPluginCell label="맞춤법" findings={[finding(`언어 ${locale}`)]} /> : null;
		};
		const EverywhereCell = () => {
			const { locale, collection } = useStatusBarContext();
			return <StatusBarPluginCell label="점검" findings={[finding(`${collection} ${locale}`)]} />;
		};
		const renderWithCells = () =>
			renderShell(
				<StatusCellsProvider cells={{ korean: KoreanCell, everywhere: EverywhereCell }}>
					<EntryEditorShell mode="edit" initialEntryId="entry-1" adminId={ADMIN} />
				</StatusCellsProvider>,
			);
		const bar = async () => within(await screen.findByRole("region", { name: tScreens("column.status") }));

		it("PLUG-A4 fills the slot in the source editor, after the to-do cell", async () => {
			serve({ ...entry, locale: "ko", translationGroupId: "entry-1", translations: [] });
			renderWithCells();
			const cells = await bar();
			await cells.findByRole("button", { name: tStatusBar("todo.none") });
			expect(cells.getAllByRole("button").map((button) => button.textContent)).toEqual([
				"할 일 없음",
				"맞춤법 1",
				"점검 1",
			]);
			fireEvent.click(cells.getByRole("button", { name: "점검 1" }));
			expect(within(await screen.findByRole("dialog")).getByText("post ko")).toBeInTheDocument();
		});

		it("PLUG-A4 fills the slot in the translation editor too, and a plugin can leave it empty for that language", async () => {
			serve({
				...entry,
				id: "entry-en",
				locale: "en",
				translationGroupId: "entry-1",
				translations: [],
				source: {
					id: "entry-1",
					locale: "ko",
					status: "draft",
					workingSlug: "test",
					metadata: { title: "원문 제목" },
					doc: docOf("원문\n"),
				},
				working: { metadata: { title: "Title" }, doc: docOf("First\n"), translation: null },
			});
			renderWithCells();
			const cells = await bar();
			await cells.findByRole("button", { name: "점검 1" });
			expect(cells.queryByRole("button", { name: /맞춤법/ })).toBeNull();
			fireEvent.click(cells.getByRole("button", { name: "점검 1" }));
			expect(within(await screen.findByRole("dialog")).getByText("post en")).toBeInTheDocument();
		});
	});

	it("WRITE-P2 creates and publishes a local new entry when Publish is clicked", async () => {
		api.on("POST /v1/entries", ({ body }) => ({
			entry: {
				...entry,
				id: "published-entry",
				collection: "memo",
				version: 1,
				workingSlug: body.slug,
				working: { metadata: body.metadata, doc: body.doc },
			},
			warnings: [],
		}));
		const published: EntryWriteResult = {
			entry: { ...entry, id: "published-entry", collection: "memo", status: "published", version: 2 },
			warnings: [],
		};
		api.on("POST /v1/entries/:id/publish", ({ params }) =>
			params.id === "published-entry" ? published : failure("not_found"),
		);
		renderShell(<EntryEditorShell mode="new" adminId={ADMIN} collection="memo" />);
		fireEvent.change(await editorTitle(), { target: { value: "바로 발행" } });
		fireEvent.click(screen.getByRole("button", { name: tEntryEditorShell("publish") }));
		// The create runs first: the publish names the entry it made.
		await waitFor(() => expect(api.sent("POST /v1/entries/:id/publish")).toHaveLength(1));
		expect(api.sent("POST /v1/entries/:id/publish")[0]?.params.id).toBe("published-entry");
	});

	it("WRITE-P1 binds field issues and moves issues in the body to the source text, at the block they are in", async () => {
		const body = docOf("첫째 문단\n\n둘째 문단\n");
		api.on("POST /v1/entries/:id/publish", () =>
			failure("publish_validation_failed", undefined, {
				issues: [
					told({ code: "missing_field", path: "title", message: "제목" }),
					told({ code: "mdx_error", path: "body", position: { blockId: body.content[1]?.id } }),
				],
			}),
		);
		serve({ ...entry, working: { ...entry.working, doc: body } });
		renderEdit();
		await screen.findByRole("button", { name: /^요약/ });
		fireEvent.click(screen.getByRole("button", { name: tEntryEditorShell("publish") }));
		// A refused publish opens the readiness popup with what it found.
		const popup = await readinessPopup();
		const title = await editorTitle();
		expect(title.getAttribute("aria-invalid")).toBe("true");
		expect(title.getAttribute("aria-describedby")).toBe("cms-title-error");
		expect(screen.getAllByRole("textbox", { name: TITLE_LABEL })).toHaveLength(1);
		fireEvent.click(popup.getByRole("button", { name: /제목 쓰기/ }));
		await waitFor(() => expect(document.activeElement).toBe(title));
		// In source mode, the panel is asked to focus the block the issue is in.
		await toggleView(SOURCE_LABEL);
		await screen.findByLabelText("패널 본문");
		fireEvent.click((await reopenReadinessPopup()).getByRole("button", { name: /본문 구문에 오류가 있어요/ }));
		await waitFor(() => expect(asked).toContain(body.content[1]?.id));
	});

	it("WRITE-P1 goes to the issue's block in the visual editor, and to the block in source mode when the editor does not have it", async () => {
		const doc = docOf("첫째 문단\n\n둘째 문단\n");
		const second = doc.content[1]?.id;
		let blockId = second;
		api.on("POST /v1/entries/:id/publish", () =>
			failure("publish_validation_failed", undefined, {
				issues: [told({ code: "mdx_error", path: "body", position: { blockId } })],
			}),
		);
		serve({ ...entry, working: { ...entry.working, doc } });
		renderEdit();
		await screen.findByRole("button", { name: /^요약/ });
		await screen.findByLabelText("시각 본문");
		fireEvent.click(screen.getByRole("button", { name: tEntryEditorShell("publish") }));
		const popup = await readinessPopup();

		await waitFor(() => expect(mockEditor.current).not.toBeNull());
		fireEvent.click(popup.getByRole("button", { name: /본문 구문에 오류가 있어요/ }));
		await waitFor(() => expect(mockEditor.current?.state.selection.$from.parent.textContent).toBe("둘째 문단"));
		expect(screen.queryByLabelText("패널 본문")).toBeNull();

		blockId = "zzzzzzzz";
		fireEvent.click(screen.getByRole("button", { name: tEntryEditorShell("publish") }));
		await waitFor(() => expect(api.sent("POST /v1/entries/:id/publish").length).toBeGreaterThanOrEqual(2));
		fireEvent.click((await readinessPopup()).getByRole("button", { name: /본문 구문에 오류가 있어요/ }));
		expect(await screen.findByLabelText("패널 본문")).toBeInTheDocument();
	});

	it("WRITE-P8 opens a body that cannot be read in source mode and does not allow the visual editor (no silent overwrite)", async () => {
		serve({
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
		expect(source).toBeInTheDocument();
		expect((await editorTitle()).getAttribute("value")).toBe("테스트");
		expect(screen.queryByLabelText("시각 본문")).toBeNull();
		expect(screen.getByText(/원문 모드로만 편집해요/)).toBeInTheDocument();
		// There is no way back to the visual editor, so the ⋯ menu has no switch for it.
		expect(await viewSwitch(SOURCE_LABEL)).toBeNull();
	});

	it("FMT-P2 switches only the body to the source panel and keeps the title", async () => {
		renderEdit();
		await screen.findByLabelText("시각 본문");
		expect((await viewSwitch(SOURCE_LABEL))?.getAttribute("aria-checked")).toBe("false");
		await toggleView(SOURCE_LABEL);
		const source = await screen.findByLabelText("패널 본문");
		expect(source.textContent).toBe("첫째 줄\n둘째 줄");
		expect(screen.queryByLabelText("시각 본문")).toBeNull();
		expect((await editorTitle()).getAttribute("value")).toBe("테스트");
		expect((await viewSwitch(SOURCE_LABEL))?.getAttribute("aria-checked")).toBe("true");
		await toggleView(SOURCE_LABEL);
		expect(await screen.findByLabelText("시각 본문")).toBeInTheDocument();
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

		it("FMT-P1 shows the toggle of the registered panel under its label, and opens that panel on the body", async () => {
			withPanels([{ format: "custom", label: "내 원문 보기", Panel: FakePanel }]);
			await screen.findByLabelText("시각 본문");
			expect(await viewSwitch("MDX로 보기")).toBeNull();
			await toggleView("내 원문 보기");
			expect((await screen.findByLabelText("블록 수")).textContent).toBe("1");
			expect(screen.queryByLabelText("시각 본문")).toBeNull();
			expect(screen.getByLabelText("읽기 전용").textContent).toBe("false");
		});

		it("FMT-R8 takes the body the panel hands back as the body, which the next save sends", async () => {
			api.on("PATCH /v1/entries/:id", () => ({ entry: { ...entry, version: 5 }, warnings: [] }));
			withPanels([{ format: "custom", label: "내 원문 보기", Panel: FakePanel }]);
			await screen.findByLabelText("시각 본문");
			await toggleView("내 원문 보기");
			fireEvent.click(await screen.findByRole("button", { name: "패널에서 고침" }));
			expect(screen.getByTitle(tEntries("save.dirty"))).toBeInTheDocument();
			pressSave();
			await waitFor(() => expect(api.sent("PATCH /v1/entries/:id")).toHaveLength(1));
			const sent = api.sent("PATCH /v1/entries/:id")[0]?.body as { doc: StoredDocument };
			expect(sent.doc.content.map((block) => block.type)).toEqual(["paragraph", "paragraph"]);
			expect(JSON.stringify(sent.doc)).toContain("패널에서 쓴 본문");
		});

		it("opens a body that could not be read in the panel, and shows the visual editor's box when there is none", async () => {
			serve({ ...entry, working: { ...entry.working, doc: unparsedDocument("본문 <Callout>") } });
			withPanels([{ format: "custom", label: "내 원문 보기", Panel: FakePanel }]);
			expect(await screen.findByLabelText("블록 수")).toBeInTheDocument();
			expect(screen.queryByLabelText("시각 본문")).toBeNull();
			cleanup();

			serve({ ...entry, working: { ...entry.working, doc: unparsedDocument("본문 <Callout>") } });
			render(<EntryEditorShell mode="edit" initialEntryId="entry-1" adminId={ADMIN} />);
			await screen.findByLabelText("시각 본문");
			// There is no panel to edit it in, so no note that says to.
			expect(screen.queryByText(/원문 모드로만 편집해요/)).toBeNull();
		});

		it("tells the panel which block an issue is in", async () => {
			const body = docOf("첫째 문단\n\n둘째 문단\n");
			api.on("POST /v1/entries/:id/publish", () =>
				failure("publish_validation_failed", undefined, {
					issues: [told({ code: "mdx_error", path: "body", position: { blockId: body.content[1]?.id } })],
				}),
			);
			serve({ ...entry, working: { ...entry.working, doc: body } });
			withPanels([{ format: "custom", label: "내 원문 보기", Panel: FakePanel }]);
			await screen.findByRole("button", { name: /^요약/ });
			await toggleView("내 원문 보기");
			await screen.findByLabelText("블록 수");
			fireEvent.click(screen.getByRole("button", { name: tEntryEditorShell("publish") }));
			fireEvent.click((await readinessPopup()).getByRole("button", { name: /본문 구문에 오류가 있어요/ }));
			// The panel is asked for that block, once; the screen does not keep asking.
			await waitFor(() => expect(focused).toEqual([body.content[1]?.id]));
			await waitFor(() => expect(screen.getByLabelText("포커스").textContent).toBe("-"));
		});
	});

	it("WRITE-W5 adds categories and tags through the add panel, prefilled with the typed name", async () => {
		api.on("PATCH /v1/entries/:id", () => ({ entry: { ...entry, version: 5 }, warnings: [] }));
		api.on(
			"POST /v1/entries",
			({ body }): EntryWriteResult => ({
				entry: {
					id: body.collection === "category" ? "cat-2" : "tag-2",
					collection: body.collection,
					status: "draft",
					version: 1,
					folderId: null,
					workingSlug: "slug",
					publishedSlug: "slug",
					working: { metadata: body.metadata, doc: emptyStoredDocument() },
				},
				warnings: [],
			}),
		);
		renderEdit();
		// Searching for a name that does not exist shows `Add 'name'` at the end of the list; pressing it opens the add sheet with the name filled in.
		const saveIn = async (label: string) => {
			const panel = await screen.findByRole("dialog", { name: label }, { timeout: 10_000 });
			fireEvent.click(within(panel).getByRole("button", { name: tCommon("save") }));
			await waitFor(() => expect(screen.queryByRole("dialog", { name: label })).toBeNull(), {
				timeout: 10_000,
			});
		};
		/**
		 * Enters a query and presses the `Add 'name'` item. Base UI opens the list only for real input (an input event with `inputType`).
		 * When several test files run together, input entered before the field is ready can vanish, so it is entered again until the item shows.
		 */
		const typeAndPickAdd = async (field: string, text: string) => {
			// The value opens its list where it is.
			if (!screen.queryByRole("combobox", { name: field })) {
				fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${field}`) }));
			}
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
		const creations = api.sent("POST /v1/entries").map((request) => request.body);
		expect(creations).toMatchObject([
			{ collection: "category", metadata: { title: "새 카테고리" }, doc: emptyStoredDocument() },
			{ collection: "tag", metadata: { title: "새 태그" }, doc: emptyStoredDocument() },
		]);
	}, 30_000);

	it("WRITE-S5 reports an offline save and keeps a browser backup", async () => {
		api.on("PATCH /v1/entries/:id", () => {
			throw new TypeError("offline");
		});
		renderEdit();
		fireEvent.change(await editorTitle(), { target: { value: "오프라인 수정" } });
		pressSave();
		await waitFor(() => expect(api.sent("PATCH /v1/entries/:id")).toHaveLength(1));
		await waitFor(() => expect(screen.getAllByText("브라우저에만 임시 저장됨").length).toBeGreaterThan(0));
		expect(saveLocalBackup).toHaveBeenLastCalledWith(
			expect.objectContaining({
				key: `${ADMIN}:entry-1`,
				snapshot: expect.objectContaining({ title: "오프라인 수정", summary: "요약" }),
			}),
		);
	});

	it("WRITE-P1 does not publish when a body-filled field has nothing to fill from, naming the field", async () => {
		serve({
			...entry,
			working: { metadata: { title: "테스트", categoryId: "cat-1" }, doc: docOf("```js\nonly();\n```") },
		});
		renderEdit();
		await screen.findByRole("button", { name: /^요약/ });
		fireEvent.click(screen.getByRole("button", { name: tEntryEditorShell("publish") }));
		await waitFor(() => expect(toast.error).toHaveBeenCalledWith("요약을 만들 본문이 없어요. 직접 입력하세요."));
	});

	it("TRASH-T7 shows trashed entries read-only with restore and permanent delete", async () => {
		serve({ ...entry, status: "trashed" });
		renderEdit();
		const banner = await screen.findByRole("status", { name: tScreens("sidebar.trash") });
		const toolbar = screen.getByRole("banner");
		expect(within(toolbar).getByRole("button", { name: tCommon("lifecycle.restore") })).toBeInTheDocument();
		expect(within(toolbar).getByRole("button", { name: tCommon("lifecycle.deletePermanently") })).toBeInTheDocument();
		expect(within(banner).queryByRole("button")).toBeNull();
		expect((screen.getByLabelText("시각 본문") as HTMLTextAreaElement).readOnly).toBe(true);
	});

	it("DATA-B4 exports this entry from the more menu: the dialog asks for the entry and its translations, and nothing else", async () => {
		api.on("GET /v1/meta", () => ({ formats: [] }));
		api.on(
			"POST /v1/export/summary",
			(): ExportSummary => ({
				scope: "admin",
				entries: 3,
				addedByTranslations: 2,
				notPublished: 0,
				notFound: 0,
				templates: 0,
				folders: 0,
				addresses: 1,
				media: 0,
			}),
		);
		renderEdit();
		await editorTitle();
		fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: tEntryEditorShell("more") }));
		fireEvent.click(screen.getByRole("menuitem", { name: tSchemaReview("drop.export") }));
		await screen.findByRole("dialog", { name: tExport("dialog.title.entry") });
		await waitFor(() => expect(api.sent("POST /v1/export/summary")).toHaveLength(1));
		expect(api.sent("POST /v1/export/summary")[0]?.body).toEqual({
			scope: "admin",
			ids: ["entry-1"],
		});
	});

	it("TRASH-R1 unarchives and restores at once without asking", async () => {
		for (const [status, action, label, message] of [
			["archived", "unarchive", "보관 해제", "보관을 해제했어요."],
			["trashed", "restore", "복원", "복원했어요."],
		] as const) {
			api.on("POST /v1/entries/:id/:action", ({ params }) =>
				params.action === action ? { ...entry, version: 5 } : failure("not_found"),
			);
			serve({ ...entry, status });
			renderEdit();
			await editorTitle();
			fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: label }));
			expect(screen.queryByRole("alertdialog")).toBeNull();
			await waitFor(() => expect(api.sent(`POST /v1/entries/:id/${action}`)).toHaveLength(1));
			await waitFor(() => expect(toast).toHaveBeenCalledWith(message));
			cleanup();
		}
	});

	it("WRITE-P2 reports header action failures as a toast", async () => {
		api.on("POST /v1/entries/:id/publish", () => failure("internal_error", "서버 오류"));
		renderEdit();
		await editorTitle();
		fireEvent.click(screen.getByRole("button", { name: tEntryEditorShell("publish") }));
		await waitFor(() => expect(toast.error).toHaveBeenCalledWith("서버 오류"));
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("WRITE-W6 sends record collections to their explicit-save form", async () => {
		serve({ ...entry, collection: "tag" });
		renderEdit();
		// An item collection opens that item in the small form on the list.
		await waitFor(() => expect(testRouter.replace).toHaveBeenCalledWith(`/admin?collection=tag&open=${entry.id}`));
	});
});

describe("language tabs", () => {
	const member = (id: string, locale: string, status: EntryData["status"], isSource: boolean): TranslationMember => ({
		id,
		locale,
		status,
		isSource,
		title: "테스트",
		workingSlug: "test",
	});
	const source: EntryData = {
		...entry,
		locale: "ko",
		translationGroupId: "entry-1",
		translations: [member("entry-1", "ko", "published", true), member("entry-en", "en", "draft", false)],
	};
	const translation: EntryData = { ...source, id: "entry-en", locale: "en", status: "draft" };
	it("TRANS-L2 shows one tab per member and marks the current one", async () => {
		serve(source);
		renderEdit();
		const nav = await screen.findByRole("navigation", { name: tScreens("column.locale") });
		const current = within(nav).getByRole("link", { name: "한국어 원문 · 발행됨" });
		expect(current.getAttribute("aria-current")).toBe("page");
		const other = within(nav).getByRole("link", { name: "영어 · 초안" });
		expect(other.getAttribute("aria-current")).toBeNull();
		expect(within(nav).getByRole("button", { name: "JA 번역 추가" })).toBeInTheDocument();
		expect(within(nav).queryByRole("button", { name: "번역본 메뉴" })).toBeNull();
	});

	it("moves to another language by its link, and has no tab list without panels", async () => {
		serve(source);
		renderEdit();
		const link = await screen.findByRole("link", { name: "영어 · 초안" });
		expect(link.getAttribute("href")).toBe("/admin/entries/entry-en/edit");
		expect(
			within(screen.getByRole("navigation", { name: tScreens("column.locale") })).queryByRole("tablist"),
		).toBeNull();
	});

	it("TRANS-N1 creates a translation from the missing-language button and opens it", async () => {
		api.on("POST /v1/entries/:id/translations", ({ params }) =>
			params.id === "entry-1" ? { entry: { id: "entry-ja" } } : failure("not_found"),
		);
		serve(source);
		renderEdit();
		fireEvent.click(await screen.findByRole("button", { name: "JA 번역 추가" }));
		await waitFor(() => expect(testRouter.navigate).toHaveBeenCalledWith("/admin/entries/entry-ja/edit"));
		expect(api.sent("POST /v1/entries/:id/translations")[0]?.body).toEqual({ locale: "ja" });
		expect(toast).toHaveBeenCalledWith("일본어 번역본을 만들었어요.");
	});

	it("WRITE-S6 blocks translation creation while there are unsaved changes", async () => {
		serve(source);
		renderEdit();
		fireEvent.change(await editorTitle(), { target: { value: "저장 전" } });
		fireEvent.click(screen.getByRole("button", { name: "JA 번역 추가" }));
		await waitFor(() => expect(toast.error).toHaveBeenCalledWith(tEntries("lang.saveFirst")));
		expect(api.sent("POST /v1/entries/:id/translations")).toHaveLength(0);
	});

	describe("flow: this translation goes to the trash (T10)", () => {
		const serveTranslation = (current: EntryData) => {
			serve(current);
			api.on("POST /v1/entries/:id/:action", ({ params }) =>
				params.id === "entry-en" && params.action === "trash"
					? { ...current, status: "trashed" }
					: failure("not_found"),
			);
			api.on("POST /v1/trash/restore", () => ({ results: [] }));
		};
		const openMore = async () => {
			renderShell(<EntryEditorShell mode="edit" initialEntryId="entry-en" adminId={ADMIN} />);
			const nav = await screen.findByRole("navigation", { name: tScreens("column.locale") });
			// The tab bar has no menu of its own: the item is in the header's ⋯.
			expect(within(nav).queryByRole("button", { name: /메뉴/ })).toBeNull();
			fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: tEntryEditorShell("more") }));
		};

		it("TRASH-T6 moves a draft translation at once, goes back to the source, and the toast's undo restores it", async () => {
			serveTranslation(translation);
			await openMore();
			fireEvent.click(screen.getByRole("menuitem", { name: /이 번역 휴지통으로/ }));

			await waitFor(() => expect(api.sent("POST /v1/entries/entry-en/trash")).toHaveLength(1));
			expect(screen.queryByRole("alertdialog")).toBeNull();
			await waitFor(() => expect(testRouter.navigate).toHaveBeenCalledWith("/admin/entries/entry-1/edit"));
			expect(toast).toHaveBeenCalledWith(
				"휴지통으로 옮겼어요",
				expect.objectContaining({ action: expect.objectContaining({ label: "되돌리기" }) }),
			);
			const undo = toast.mock.calls.find(([message]) => message === "휴지통으로 옮겼어요")?.[1] as {
				action: { onClick: () => void };
			};

			await act(async () => undo.action.onClick());
			await waitFor(() => expect(api.sent("POST /v1/trash/restore")).toHaveLength(1));
			expect(api.sent("POST /v1/trash/restore")[0]?.body).toEqual({
				items: [{ type: "entry", id: "entry-en", expectedVersion: translation.version + 1 }],
			});
			await waitFor(() => expect(testRouter.navigate).toHaveBeenCalledWith("/admin/entries/entry-en/edit"));
		});

		it("TRASH-T3 asks first when the translation is published, and sends nothing when cancelled", async () => {
			serveTranslation({ ...translation, status: "published" });
			await openMore();
			fireEvent.click(screen.getByRole("menuitem", { name: /이 번역 휴지통으로/ }));
			const dialog = await screen.findByRole("alertdialog", { name: tDelete("trash.ask.title") });
			fireEvent.click(within(dialog).getByRole("button", { name: tExport("action.cancel") }));
			await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
			expect(api.sent("POST /v1/entries/entry-en/trash")).toHaveLength(0);
		});
	});
});

describe("translation source pane", () => {
	const SOURCE_MDX = "첫 문단\n\n둘째 문단\n";
	const source: EntryData = {
		...entry,
		locale: "ko",
		translationGroupId: "entry-1",
		translations: [],
	};
	const translationWith = (
		baseSource: string | null,
		documents: { base?: StoredDocument | null; current?: StoredDocument | null; currentMdx?: string } = {},
	): EntryData => ({
		...entry,
		id: "entry-en",
		locale: "en",
		translationGroupId: "entry-1",
		translations: [],
		source: {
			id: "entry-1",
			locale: "ko",
			status: "draft",
			workingSlug: "test",
			metadata: { title: "원문 제목" },
			doc: documents.current ?? docOf(documents.currentMdx ?? SOURCE_MDX),
		},
		working: {
			metadata: { title: "Title" },
			doc: docOf("First\n\nSecond\n"),
			translation: baseSource === null ? null : { version: 4, baseDoc: documents.base ?? docOf(baseSource) },
		},
	});
	const sourcePane = () => screen.queryByRole("complementary", { name: tEntries("sourcePane.aria") });
	const clearStorage = () => {
		try {
			window.localStorage.clear();
		} catch {
			// With no storage there is nothing to clear.
		}
	};
	beforeEach(clearStorage);
	afterEach(clearStorage);

	it("TRANS-S3 shows the full source beside only a translation", async () => {
		serve(translationWith(SOURCE_MDX));
		renderEdit();
		await editorTitle();
		await waitFor(() => expect(sourcePane()?.textContent).toContain("둘째 문단"));
		expect(within(sourcePane() as HTMLElement).getByText("KO 원문")).toBeInTheDocument();
		// The title slot hint is the source title.
		expect((await editorTitle()).getAttribute("placeholder")).toBe("원문 제목");
		// A translation uses the same editor too (formatting tools, source switch), and its ⋯ menu can show the source beside.
		expect(await viewSwitch(SOURCE_LABEL)).toBeInTheDocument();
		expect((await viewSwitch("원문 옆에 보기"))?.getAttribute("aria-checked")).toBe("true");
		fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });

		cleanup();
		serve(source);
		renderEdit();
		await editorTitle();
		expect(sourcePane()).toBeNull();
	});

	it("TRANS-S1 when the source changes, notifies, and confirm makes a change that Save sends", async () => {
		api.on("PATCH /v1/entries/:id", savedAs(translationWith(SOURCE_MDX)));
		serve(translationWith("첫 문단\n"));
		renderEdit();
		expect(await screen.findByText(tEntryEditorShell("sourceChanged"))).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: tEntryEditorShell("confirm") }));
		expect(screen.queryByText(tEntryEditorShell("sourceChanged"))).toBeNull();
		pressSave();
		await waitFor(() => expect(api.sent("PATCH /v1/entries/:id")).toHaveLength(1));
	});

	it("with no translation state or a malformed one, nothing is treated as confirmed", async () => {
		serve(translationWith(null));
		renderEdit();
		expect(await screen.findByText(tEntryEditorShell("sourceChanged"))).toBeInTheDocument();
	});

	it("TRANS-S2 the comparison lists changed blocks as before and now", async () => {
		serve(translationWith("첫 문단 옛\n\n둘째 문단\n\n지운 문단\n"));
		renderEdit();
		fireEvent.click(await screen.findByRole("button", { name: tEntryEditorShell("compare") }));
		const dialog = await screen.findByRole("dialog", { name: tEntries("sourceChange.title") });
		expect(within(dialog).getByText(tEntries("sourceChange.changed"))).toBeInTheDocument();
		expect(within(dialog).getAllByText(tEntries("sourceChange.before")).length).toBeGreaterThan(0);
		expect(within(dialog).getAllByText(tEntries("sourceChange.after")).length).toBeGreaterThan(0);
		await waitFor(() => expect(dialog.textContent).toContain("첫 문단 옛"));
	});

	it("the comparison shows a block that moved as moved when both versions have documents", async () => {
		const before = docOf("가\n\n나\n\n다\n") as StoredDocument;
		const [first, second, third] = before.content;
		const current = { ...before, content: [third, first, second] } as StoredDocument;
		serve(translationWith("가\n\n나\n\n다\n", { base: before, current, currentMdx: "다\n\n가\n\n나\n" }));
		renderEdit();
		fireEvent.click(await screen.findByRole("button", { name: tEntryEditorShell("compare") }));
		const dialog = await screen.findByRole("dialog", { name: tEntries("sourceChange.title") });
		expect(within(dialog).getAllByText(tEntries("sourceChange.moved"))).toHaveLength(1);
		await waitFor(() => expect(dialog.textContent).toContain("다"));
	});

	it("an unparseable source is reported as not comparable", async () => {
		serve(translationWith("", { base: unparsedDocument("<Callout>닫히지 않음") }));
		renderEdit();
		fireEvent.click(await screen.findByRole("button", { name: tEntryEditorShell("compare") }));
		const dialog = await screen.findByRole("dialog", { name: tEntries("sourceChange.title") });
		expect(within(dialog).getByText(tEntries("sourceChange.cantCompare"))).toBeInTheDocument();
	});
});

describe("side panel over the editor", () => {
	/** What a plugin's panel component can read here: where the admin is, and the open editor. */
	function Probe() {
		const where = useScreenContext();
		const editor = useOpenEditor();
		return (
			<SidePanel title="Helper">
				<output aria-label="where">{JSON.stringify(where)}</output>
				<output aria-label="entry">{editor ? JSON.stringify(editor.readEntry().fields) : "no editor"}</output>
				<output aria-label="unsaved">{String(editor?.readEntry().hasUnsavedChanges)}</output>
				<output aria-label="selection">{editor ? JSON.stringify(editor.readSelection()) : "no editor"}</output>
			</SidePanel>
		);
	}
	const PANEL: AdminPanel = { label: "Helper", icon: RightPanelOpen, Component: Probe };
	const renderWithPanel = () =>
		render(
			withSite(
				<ScreenContextProvider>
					<AdminPanelProvider panel={PANEL}>
						<EntryEditorShell mode="edit" initialEntryId="entry-1" adminId={ADMIN} />
					</AdminPanelProvider>
				</ScreenContextProvider>,
			),
		);
	const readOut = (label: string) => JSON.parse(screen.getByLabelText(label).textContent ?? "null");

	beforeEach(() => window.localStorage.clear());

	it("opens from the header and shows the plugin's component next to the editor", async () => {
		renderWithPanel();
		await editorTitle();
		fireEvent.click(screen.getByRole("button", { name: /Helper/ }));
		expect(screen.getByRole("complementary", { name: "Helper" })).toBeInTheDocument();
		// The properties panel and the editor are still there.
		expect(screen.getByRole("textbox", { name: TITLE_LABEL })).toBeInTheDocument();
	});

	it("PLUG-A5 publishes the screen, the collection and the open entry", async () => {
		renderWithPanel();
		await editorTitle();
		fireEvent.click(screen.getByRole("button", { name: /Helper/ }));
		expect(readOut("where")).toEqual({ screen: "entry", collection: "post", entryId: "entry-1" });
	});

	it("PLUG-A5 reads the entry as the form holds it, with the changes that are not saved", async () => {
		renderWithPanel();
		fireEvent.change(await editorTitle(), { target: { value: "저장 전에 고친 제목" } });
		fireEvent.click(screen.getByRole("button", { name: /Helper/ }));
		expect(readOut("entry")).toMatchObject({ title: "저장 전에 고친 제목", summary: "요약" });
		expect(readOut("unsaved")).toBe(true);
	});

	it("PLUG-A5 reads the selected text and the block the selection is in, with its block id", async () => {
		renderWithPanel();
		await editorTitle();
		await waitFor(() => expect(mockEditor.current).not.toBeNull());
		const editor = mockEditor.current as import("@tiptap/core").Editor;
		act(() => void editor.commands.setTextSelection({ from: 2, to: 4 }));
		fireEvent.click(screen.getByRole("button", { name: /Helper/ }));
		const { text, block } = readOut("selection");
		expect(text).toBe(editor.state.doc.textBetween(2, 4));
		expect(text.length).toBeGreaterThan(0);
		expect(block).toMatchObject({ type: "paragraph", text: expect.stringContaining("첫째 줄") });
		expect(block.id).toMatch(/\S/);
		// The id is the block's own: the same one the editor holds for that block.
		expect(findBlock(editor.state.doc, block.id)).toEqual(expect.any(Number));
	});
});
