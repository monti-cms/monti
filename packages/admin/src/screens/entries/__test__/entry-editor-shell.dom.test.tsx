import { RightPanelOpen } from "@carbon/icons-react";
import { emptyStoredDocument, type StoredDocument, unparsedDocument, withoutBlockIds } from "@monti-cms/core/document";
import { createSite, issueText } from "@monti-cms/core/site";
import { SidePanel } from "@monti-cms/ui";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testConfig, testSite } from "../../../../../core/test/site";
import {
	AdminComponentsProvider,
	type SourcePanelProps,
	type SourcePanelRegistration,
} from "../../../admin-components";
import { findBlock } from "../../../editor/block-ids";
import { StatusBarPluginCell } from "../../../kit";
import { commonMessages } from "../../../lib/common.messages";
import type { AdminPanel } from "../../../plugins";
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
import { EMPTY_FORM } from "../entry-form";
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

// An error answer is `{ error: {...} }`; a mock may pass the bare error object.
const json = (data: unknown, status = 200) => ({
	ok: status < 400,
	status,
	json: async () => (status >= 400 && data && typeof data === "object" && !("error" in data) ? { error: data } : data),
});
type Handler = (input: string, init?: RequestInit) => unknown;
let fetchMock: ReturnType<typeof vi.fn>;
/** What the publish check answers (`POST …/check`); a test changes it to put problems in the readiness item. */
let checkAnswer: { issues: unknown[]; warnings: unknown[] } = { issues: [], warnings: [] };

/** Adds per-test handling to the common responses (lists, usages). */
function serve(handler: Handler, current: unknown = entry) {
	fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
		const handled = await handler(input, init);
		if (handled !== undefined) return handled;
		if (input.startsWith("/api/monti/v1/entries?")) return json({ items: [], total: 0 });
		if (input.startsWith("/api/monti/v1/entries/search?")) return json({ items: [] });
		if (input.endsWith("/relations")) return json({ incomingReferences: [] });
		if (input.endsWith("/check") && init?.method === "POST") return json(checkAnswer);
		if (input === "/api/monti/v1/entries/entry-1" && !init?.method) return json(current);
		throw new Error(`Unexpected fetch: ${init?.method ?? "GET"} ${input}`);
	});
}

const methodCalls = (method: string, suffix = "") =>
	fetchMock.mock.calls.filter(([input, init]) => init?.method === method && String(input).endsWith(suffix));

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
	fetchMock = vi.fn();
	checkAnswer = { issues: [], warnings: [] };
	serve(() => undefined);
	vi.stubGlobal("fetch", fetchMock);
});
const told = (issue: Parameters<typeof issueText>[1]) => ({ ...issue, ...issueText(testSite, issue) });

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
					entry: {
						...entry,
						version: 5,
						working: { metadata: body.metadata, doc: body.doc },
					},
					warnings: [],
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
		expect(screen.getByTitle(tEntries("save.dirty"))).toBeInTheDocument();
		vi.useFakeTimers();
		await act(async () => vi.advanceTimersByTimeAsync(11_000));
		vi.useRealTimers();
		expect(methodCalls("PATCH")).toHaveLength(0);
		pressSave();
		await waitFor(() => expect(methodCalls("PATCH")).toHaveLength(1));
		await waitFor(() => expect(screen.getByTitle(tEntries("save.saved"))).toBeInTheDocument());
		expect(JSON.parse(String(methodCalls("PATCH")[0]?.[1]?.body)).metadata.title).toBe("로컬에서 수정");
	});

	it("shows the save state in the status bar and saves from it: saved, then unsaved, saving and saved again", async () => {
		let finish: (() => void) | undefined;
		serve(async (_input, init) => {
			if (init?.method !== "PATCH") return undefined;
			const body = JSON.parse(String(init.body));
			await new Promise<void>((resolve) => {
				finish = resolve;
			});
			return json({
				entry: { ...entry, version: 5, working: { metadata: body.metadata, doc: body.doc } },
				warnings: [],
			});
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
		expect(methodCalls("PATCH")).toHaveLength(1);
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
					entry: {
						...entry,
						version: 5,
						working: { metadata: body.metadata, doc: body.doc },
					},
					warnings: [],
				});
			}
		});
		renderEdit();
		const title = await editorTitle();
		fireEvent.change(title, { target: { value: "조합 중 수정" } });
		// The input that started composition vanished without an end signal.
		fireEvent.compositionStart(title);
		pressSave();
		await waitFor(() => expect(methodCalls("PATCH")).toHaveLength(1), { timeout: 3000 });
		await waitFor(() => expect(toast).toHaveBeenCalledWith("저장했어요."));
	});

	it("shows why an explicit save failed instead of doing nothing", async () => {
		serve((_input, init) => {
			if (init?.method === "PATCH")
				return json({ error: { code: "invalid_input", message: "제목이 너무 길어요." } }, 400);
		});
		renderEdit();
		fireEvent.change(await editorTitle(), { target: { value: "실패할 수정" } });
		pressSave();
		await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("제목이 너무 길어요.")));
	});

	it("saves pending changes before opening the preview", async () => {
		const opened = { opener: {}, location: { href: "" }, close: vi.fn() };
		const open = vi.spyOn(window, "open").mockReturnValue(opened as unknown as Window);
		serve((_input, init) => {
			if (init?.method === "PATCH") {
				const body = JSON.parse(String(init.body));
				return json({
					entry: {
						...entry,
						version: 5,
						working: { metadata: body.metadata, doc: body.doc },
					},
					warnings: [],
				});
			}
		});
		renderEdit();
		fireEvent.change(await editorTitle(), { target: { value: "미리보기 전 수정" } });
		fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: tEntryEditorShell("preview") }));
		await waitFor(() => expect(methodCalls("PATCH")).toHaveLength(1));
		await waitFor(() => expect(opened.location.href).toBe("/preview/posts/test"));
		open.mockRestore();
	});

	it("creates a new entry only after an explicit Save", async () => {
		serve((input, init) => {
			if (input === "/api/monti/v1/entries" && init?.method === "POST") {
				const body = JSON.parse(String(init.body));
				return json(
					{
						entry: {
							...entry,
							id: "created-entry",
							version: 1,
							workingSlug: body.slug,
							working: { metadata: body.metadata, doc: body.doc },
						},
						warnings: [],
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
		expect(methodCalls("POST", "/api/monti/v1/entries")).toHaveLength(0);
		pressSave();
		await waitFor(() => expect(methodCalls("POST", "/api/monti/v1/entries")).toHaveLength(1));
		await waitFor(() => expect(deleteLocalBackup).toHaveBeenCalledWith(`${ADMIN}:new:post`));
		expect(window.location.pathname).toBe("/admin/entries/created-entry/edit");
	});

	it("tells a missing entry how to find it again instead of asking for a refresh", async () => {
		serve((input, init) =>
			input === "/api/monti/v1/entries/entry-1" && !init?.method
				? json({ code: "not_found", message: "not found", fix: "refresh" }, 404)
				: undefined,
		);
		renderEdit();
		const text = testSite.createTranslator(entryEditorShellMessages)("loadNotFound");
		expect(await screen.findByText(text)).toBeInTheDocument();
		expect(screen.queryByText(/새로고침/)).toBeNull();
	});

	describe("to-do cell in the status bar (flow 1 steps 10 to 13)", () => {
		const checkCalls = () => methodCalls("POST", "/check");
		const bar = async () => within(await screen.findByRole("region", { name: tScreens("column.status") }));
		const missingTitle = told({ code: "missing_field", path: "title", message: "제목" });
		const missingAlt = told({ code: "missing_image_alt", path: "body", position: { blockId: "b1" } });

		it("says nothing is left to do when the check finds nothing, and checks once after loading", async () => {
			renderEdit();
			expect(await (await bar()).findByRole("button", { name: tStatusBar("todo.none") })).toBeInTheDocument();
			expect(checkCalls()).toHaveLength(1);
			expect(String(checkCalls()[0]?.[0])).toContain("/entries/entry-1/check");
		});

		it("counts what to fix, and leaves the warnings out", async () => {
			checkAnswer = { issues: [missingTitle, missingAlt], warnings: [told({ code: "footnote_definition_unused" })] };
			renderEdit();
			fireEvent.click(await (await bar()).findByRole("button", { name: "할 일 2" }));
			const list = within(await screen.findByRole("dialog"));
			expect(list.getByText(tStatusBar("todo.title"))).toBeInTheDocument();
			expect(list.queryByText(tPublishReadiness("issue.footnote_definition_unused"))).toBeNull();
		});

		it("rechecks after a save, not on a keystroke, and keeps the last answer meanwhile", async () => {
			checkAnswer = { issues: [missingTitle], warnings: [] };
			serve(async (_input, init) => {
				if (init?.method !== "PATCH") return undefined;
				const body = JSON.parse(String(init.body));
				return json({
					entry: { ...entry, version: 5, working: { metadata: body.metadata, doc: body.doc } },
					warnings: [],
				});
			});
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

		it("fills the slot in the source editor, after the to-do cell", async () => {
			serve(() => undefined, { ...entry, locale: "ko", translationGroupId: "entry-1", translations: [] });
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

		it("fills the slot in the translation editor too, and a plugin can leave it empty for that language", async () => {
			serve(() => undefined, {
				...entry,
				id: "entry-en",
				locale: "en",
				translationGroupId: "entry-1",
				translations: [],
				source: { locale: "ko", metadata: { title: "원문 제목" }, doc: docOf("원문\n") },
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

	it("creates and publishes a local new entry when Publish is clicked", async () => {
		serve((input, init) => {
			if (input === "/api/monti/v1/entries" && init?.method === "POST") {
				const body = JSON.parse(String(init.body));
				return json({
					entry: {
						...entry,
						id: "published-entry",
						collection: "memo",
						version: 1,
						workingSlug: body.slug,
						working: { metadata: body.metadata, doc: body.doc },
					},
					warnings: [],
				});
			}
			if (input === "/api/monti/v1/entries/published-entry/publish" && init?.method === "POST") {
				return json({
					entry: { ...entry, id: "published-entry", collection: "memo", status: "published", version: 2 },
					warnings: [],
				});
			}
		});
		renderShell(<EntryEditorShell mode="new" adminId={ADMIN} collection="memo" />);
		fireEvent.change(await editorTitle(), { target: { value: "바로 발행" } });
		window.dispatchEvent(new Event("pagehide"));
		await waitFor(() => expect(saveLocalBackup).toHaveBeenCalled());
		expect(methodCalls("POST", "/api/monti/v1/entries")).toHaveLength(0);
		fireEvent.click(screen.getByRole("button", { name: tEntryEditorShell("publish") }));
		await waitFor(() => expect(methodCalls("POST", "/publish")).toHaveLength(1));
		expect(methodCalls("POST", "/api/monti/v1/entries")).toHaveLength(1);
		expect(JSON.parse(String(methodCalls("POST", "/publish")[0]?.[1]?.body))).toEqual({ expectedVersion: 1 });
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
									told({ code: "missing_field", path: "title", message: "제목" }),
									told({ code: "mdx_error", path: "body", position: { blockId: body.content[1]?.id } }),
								],
							},
							422,
						)
					: undefined,
			{ ...entry, working: { ...entry.working, doc: body } },
		);
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
								issues: [told({ code: "mdx_error", path: "body", position: { blockId } })],
							},
							422,
						)
					: undefined,
			{ ...entry, working: { ...entry.working, doc } },
		);
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
		await waitFor(() => expect(methodCalls("POST", "/publish").length).toBeGreaterThanOrEqual(2));
		fireEvent.click((await readinessPopup()).getByRole("button", { name: /본문 구문에 오류가 있어요/ }));
		expect(await screen.findByLabelText("패널 본문")).toBeInTheDocument();
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
		expect(source).toBeInTheDocument();
		expect((await editorTitle()).getAttribute("value")).toBe("테스트");
		expect(screen.queryByLabelText("시각 본문")).toBeNull();
		expect(screen.getByText(/원문 모드로만 편집해요/)).toBeInTheDocument();
		// There is no way back to the visual editor, so the ⋯ menu has no switch for it.
		expect(await viewSwitch(SOURCE_LABEL)).toBeNull();
	});

	it("switches only the body to the source panel and keeps the title", async () => {
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

		it("shows the toggle of the registered panel under its label, and opens that panel on the body", async () => {
			withPanels([{ format: "custom", label: "내 원문 보기", Panel: FakePanel }]);
			await screen.findByLabelText("시각 본문");
			expect(await viewSwitch("MDX로 보기")).toBeNull();
			await toggleView("내 원문 보기");
			expect((await screen.findByLabelText("블록 수")).textContent).toBe("1");
			expect(screen.queryByLabelText("시각 본문")).toBeNull();
			expect(screen.getByLabelText("읽기 전용").textContent).toBe("false");
		});

		it("takes the body the panel hands back as the body, which the next save sends", async () => {
			serve((_input, init) => {
				if (init?.method === "PATCH") return json({ entry: { ...entry, version: 5 }, warnings: [] });
			});
			withPanels([{ format: "custom", label: "내 원문 보기", Panel: FakePanel }]);
			await screen.findByLabelText("시각 본문");
			await toggleView("내 원문 보기");
			fireEvent.click(await screen.findByRole("button", { name: "패널에서 고침" }));
			expect(screen.getByTitle(tEntries("save.dirty"))).toBeInTheDocument();
			pressSave();
			await waitFor(() => expect(methodCalls("PATCH")).toHaveLength(1));
			const sent = JSON.parse(String(methodCalls("PATCH")[0]?.[1]?.body)) as { doc: StoredDocument };
			expect(sent.doc.content.map((block) => block.type)).toEqual(["paragraph", "paragraph"]);
			expect(JSON.stringify(sent.doc)).toContain("패널에서 쓴 본문");
		});

		it("opens a body that could not be read in the panel, and shows the visual editor's box when there is none", async () => {
			serve(() => undefined, { ...entry, working: { ...entry.working, doc: unparsedDocument("본문 <Callout>") } });
			withPanels([{ format: "custom", label: "내 원문 보기", Panel: FakePanel }]);
			expect(await screen.findByLabelText("블록 수")).toBeInTheDocument();
			expect(screen.queryByLabelText("시각 본문")).toBeNull();
			cleanup();

			serve(() => undefined, { ...entry, working: { ...entry.working, doc: unparsedDocument("본문 <Callout>") } });
			render(<EntryEditorShell mode="edit" initialEntryId="entry-1" adminId={ADMIN} />);
			await screen.findByLabelText("시각 본문");
			// There is no panel to edit it in, so no note that says to.
			expect(screen.queryByText(/원문 모드로만 편집해요/)).toBeNull();
		});

		it("tells the panel which block an issue is in", async () => {
			const body = docOf("첫째 문단\n\n둘째 문단\n");
			serve(
				(input) =>
					input.endsWith("/publish")
						? json(
								{
									code: "publish_validation_failed",
									issues: [told({ code: "mdx_error", path: "body", position: { blockId: body.content[1]?.id } })],
								},
								422,
							)
						: undefined,
				{ ...entry, working: { ...entry.working, doc: body } },
			);
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

	it("adds categories and tags through the add panel, prefilled with the typed name", async () => {
		serve((input, init) => {
			if (init?.method === "PATCH") return json({ entry: { ...entry, version: 5 }, warnings: [] });
			if (input === "/api/monti/v1/entries" && init?.method === "POST") {
				const data = JSON.parse(String(init.body));
				return json(
					{
						entry: {
							id: data.collection === "category" ? "cat-2" : "tag-2",
							workingSlug: "slug",
							publishedSlug: "slug",
							working: { metadata: data.metadata, doc: emptyStoredDocument() },
						},
						warnings: [],
					},
					201,
				);
			}
		});
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
		const creations = methodCalls("POST", "/api/monti/v1/entries").map(([, init]) => JSON.parse(String(init?.body)));
		expect(creations).toMatchObject([
			{ collection: "category", metadata: { title: "새 카테고리" }, doc: emptyStoredDocument() },
			{ collection: "tag", metadata: { title: "새 태그" }, doc: emptyStoredDocument() },
		]);
	}, 30_000);

	it("reports offline, server and expired-session failures and keeps a browser backup", async () => {
		const failures: unknown[] = [
			new TypeError("offline"),
			json({ error: { message: "server error" } }, 500),
			json({ error: { code: "unauthorized" } }, 401),
		];
		serve((_input, init) => {
			if (init?.method !== "PATCH") return undefined;
			const failure = failures.shift();
			if (failure instanceof Error) throw failure;
			return failure;
		});
		renderEdit();
		const title = await editorTitle();
		const expected = ["브라우저에만 임시 저장됨", "브라우저에만 임시 저장됨", "세션 만료 · 로그인"];
		for (const [index, value] of ["오프라인 수정", "서버 오류 수정", "세션 만료 수정"].entries()) {
			fireEvent.change(title, { target: { value } });
			fireEvent.keyDown(window, { key: "s", metaKey: true });
			await waitFor(() => expect(methodCalls("PATCH").length).toBeGreaterThanOrEqual(index + 1), { timeout: 4000 });
			await waitFor(() => expect(screen.getAllByText(expected[index] as string).length).toBeGreaterThan(0));
		}
		// The expired session's cell leads to signing in, in a new tab.
		const signIn = screen.getByRole("link", { name: tStatusBar("save.session-expired") });
		expect(signIn.getAttribute("href")).toContain("/login");
		expect(signIn.getAttribute("target")).toBe("_blank");
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
			if (input === "/api/monti/v1/entries/entry-1" && !init?.method) return json(server);
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
				if (init?.method === "PATCH") return json({ entry: { ...entry, version: 5 }, warnings: [] });
				if (input.endsWith("/publish")) return json({ ...entry, version: 6, status: "published", warnings: [] });
			},
			{
				...entry,
				working: { metadata: { title: "테스트", categoryId: "cat-1" }, doc: docOf("## 소개\n\n**본문** 첫 문장.") },
			},
		);
		renderEdit();
		await screen.findByRole("button", { name: /^요약/ });
		expect(screen.queryByText(/비워 두면 발행할 때 본문에서 만들어요/)).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: tEntryEditorShell("publish") }));
		await waitFor(() => expect(methodCalls("POST", "/publish")).toHaveLength(1));
		expect(JSON.parse(String(methodCalls("PATCH")[0]?.[1]?.body)).metadata.summary).toBe("소개 본문 첫 문장.");
	});

	it("does not publish when a body-filled field has nothing to fill from, naming the field", async () => {
		serve(() => undefined, {
			...entry,
			working: { metadata: { title: "테스트", categoryId: "cat-1" }, doc: docOf("```js\nonly();\n```") },
		});
		renderEdit();
		await screen.findByRole("button", { name: /^요약/ });
		fireEvent.click(screen.getByRole("button", { name: tEntryEditorShell("publish") }));
		await waitFor(() => expect(toast.error).toHaveBeenCalledWith("요약을 만들 본문이 없어요. 직접 입력하세요."));
		expect(methodCalls("POST", "/publish")).toHaveLength(0);
	});

	it("shows trashed entries read-only with restore and permanent delete", async () => {
		serve(() => undefined, { ...entry, status: "trashed" });
		renderEdit();
		const banner = await screen.findByRole("status", { name: tScreens("sidebar.trash") });
		const toolbar = screen.getByRole("banner");
		expect(within(toolbar).getByRole("button", { name: tCommon("lifecycle.restore") })).toBeInTheDocument();
		expect(within(toolbar).getByRole("button", { name: tCommon("lifecycle.deletePermanently") })).toBeInTheDocument();
		expect(within(banner).queryByRole("button")).toBeNull();
		expect((screen.getByLabelText("시각 본문") as HTMLTextAreaElement).readOnly).toBe(true);
	});

	it("exports this entry from the more menu: the dialog asks for the entry and its translations, and nothing else", async () => {
		serve((input, init) => {
			if (input === "/api/monti/v1/meta") return json({ formats: [] });
			if (input === "/api/monti/v1/export/summary" && init?.method === "POST") {
				return json({
					scope: "admin",
					entries: 3,
					addedByTranslations: 2,
					notPublished: 0,
					notFound: 0,
					templates: 0,
					folders: 0,
					addresses: 1,
					media: 0,
				});
			}
		});
		renderEdit();
		await editorTitle();
		fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: tEntryEditorShell("more") }));
		fireEvent.click(screen.getByRole("menuitem", { name: tSchemaReview("drop.export") }));
		const dialog = await screen.findByRole("dialog", { name: tExport("dialog.title.entry") });
		expect(await within(dialog).findByTestId("export-headline")).toBeInTheDocument();
		expect(JSON.parse(String(methodCalls("POST", "/export/summary")[0]?.[1]?.body))).toEqual({
			scope: "admin",
			ids: ["entry-1"],
		});
	});

	it("unarchives and restores at once without asking", async () => {
		for (const [status, action, label, message] of [
			["archived", "unarchive", "보관 해제", "보관을 해제했어요."],
			["trashed", "restore", "복원", "복원했어요."],
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
			await waitFor(() => expect(toast).toHaveBeenCalledWith(message));
			cleanup();
		}
	});

	it("reports header action failures as a toast", async () => {
		serve((input, init) => {
			if (input.endsWith("/publish") && init?.method === "POST") return json({ error: { message: "서버 오류" } }, 500);
		});
		renderEdit();
		await editorTitle();
		fireEvent.click(screen.getByRole("button", { name: tEntryEditorShell("publish") }));
		await waitFor(() => expect(toast.error).toHaveBeenCalled());
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("sends record collections to their explicit-save form", async () => {
		serve(() => undefined, { ...entry, collection: "tag" });
		renderEdit();
		// An item collection opens that item in the small form on the list.
		await waitFor(() => expect(testRouter.replace).toHaveBeenCalledWith(`/admin?collection=tag&open=${entry.id}`));
		expect(EMPTY_FORM.slug).toBe("");
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
		const nav = await screen.findByRole("navigation", { name: tScreens("column.locale") });
		const current = within(nav).getByRole("link", { name: "한국어 원문 · 발행됨" });
		expect(current.getAttribute("aria-current")).toBe("page");
		const other = within(nav).getByRole("link", { name: "영어 · 초안" });
		expect(other.getAttribute("aria-current")).toBeNull();
		expect(within(nav).getByRole("button", { name: "JA 번역 추가" })).toBeInTheDocument();
		expect(within(nav).queryByRole("button", { name: "번역본 메뉴" })).toBeNull();
		const title = await editorTitle();
		expect(nav.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING,
		);
	});

	it("moves to another language by its link, and has no tab list without panels", async () => {
		serve(() => undefined, source);
		renderEdit();
		const link = await screen.findByRole("link", { name: "영어 · 초안" });
		expect(link.getAttribute("href")).toBe("/admin/entries/entry-en/edit");
		expect(
			within(screen.getByRole("navigation", { name: tScreens("column.locale") })).queryByRole("tablist"),
		).toBeNull();
	});

	it("creates a translation from the missing-language button and opens it", async () => {
		serve((input, init) => {
			if (input === "/api/monti/v1/entries/entry-1/translations" && init?.method === "POST") {
				return json({ entry: { id: "entry-ja" }, warnings: [] }, 201);
			}
		}, source);
		renderEdit();
		fireEvent.click(await screen.findByRole("button", { name: "JA 번역 추가" }));
		await waitFor(() => expect(testRouter.navigate).toHaveBeenCalledWith("/admin/entries/entry-ja/edit"));
		expect(JSON.parse(String(methodCalls("POST", "/translations")[0]?.[1]?.body))).toEqual({ locale: "ja" });
		expect(toast).toHaveBeenCalledWith("일본어 번역본을 만들었어요.");
	});

	it("blocks translation creation while there are unsaved changes", async () => {
		serve(() => undefined, source);
		renderEdit();
		fireEvent.change(await editorTitle(), { target: { value: "저장 전" } });
		fireEvent.click(screen.getByRole("button", { name: "JA 번역 추가" }));
		await waitFor(() => expect(toast.error).toHaveBeenCalled());
		expect(methodCalls("POST", "/translations")).toHaveLength(0);
	});

	describe("flow: this translation goes to the trash (T10)", () => {
		const serveTranslation = (current: typeof translation) =>
			serve((input, init) => {
				if (input === "/api/monti/v1/entries/entry-en" && !init?.method) return json(current);
				if (input === "/api/monti/v1/entries/entry-en/trash" && init?.method === "POST") {
					return json({ ...current, status: "trashed" });
				}
				if (input === "/api/monti/v1/trash/restore" && init?.method === "POST") return json({ results: [] });
			}, current);
		const openMore = async () => {
			renderShell(<EntryEditorShell mode="edit" initialEntryId="entry-en" adminId={ADMIN} />);
			const nav = await screen.findByRole("navigation", { name: tScreens("column.locale") });
			// The tab bar has no menu of its own: the item is in the header's ⋯.
			expect(within(nav).queryByRole("button", { name: /메뉴/ })).toBeNull();
			fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: tEntryEditorShell("more") }));
		};

		it("moves a draft translation at once, goes back to the source, and the toast's undo restores it", async () => {
			serveTranslation(translation);
			await openMore();
			fireEvent.click(screen.getByRole("menuitem", { name: /이 번역 휴지통으로/ }));

			await waitFor(() => expect(methodCalls("POST", "/entry-en/trash")).toHaveLength(1));
			expect(screen.queryByRole("alertdialog")).toBeNull();
			await waitFor(() => expect(testRouter.navigate).toHaveBeenCalledWith("/admin/entries/entry-1/edit"));
			const [message, options] = toast.mock.calls.at(-1) as [
				string,
				{ action: { label: string; onClick: () => void } },
			];
			expect(message).toBe("휴지통으로 옮겼어요");
			expect(options.action.label).toBe("되돌리기");

			await act(async () => options.action.onClick());
			await waitFor(() => expect(methodCalls("POST", "/trash/restore")).toHaveLength(1));
			expect(JSON.parse(String(methodCalls("POST", "/trash/restore")[0]?.[1]?.body))).toEqual({
				items: [{ type: "entry", id: "entry-en", expectedVersion: translation.version + 1 }],
			});
			await waitFor(() => expect(testRouter.navigate).toHaveBeenCalledWith("/admin/entries/entry-en/edit"));
		});

		it("asks first when the translation is published, and sends nothing when cancelled", async () => {
			serveTranslation({ ...translation, status: "published" });
			await openMore();
			fireEvent.click(screen.getByRole("menuitem", { name: /이 번역 휴지통으로/ }));
			const dialog = await screen.findByRole("alertdialog", { name: tDelete("trash.ask.title") });
			expect(within(dialog).getByText("테스트의 공개가 끝나요.")).toBeInTheDocument();
			fireEvent.click(within(dialog).getByRole("button", { name: tExport("action.cancel") }));
			await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
			expect(methodCalls("POST", "/entry-en/trash")).toHaveLength(0);
		});
	});

	it("tells that translations go along when trashing a published source, and moves a draft source at once", async () => {
		serve(() => undefined, { ...source, status: "published" });
		renderEdit();
		await screen.findByRole("navigation", { name: tScreens("column.locale") });
		fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: tEntryEditorShell("more") }));
		fireEvent.click(screen.getByRole("menuitem", { name: tCommon("lifecycle.trash") }));
		expect(
			within(await screen.findByRole("alertdialog")).getByText("테스트의 공개가 끝나요. 영어 번역도 함께 옮겨요."),
		).toBeInTheDocument();
	});
});

describe("admin options that hide features", () => {
	const hiding = createSite({ ...testConfig, admin: { ...testConfig.admin, templates: false, translations: false } });
	const grouped = {
		...entry,
		locale: "ko",
		translationGroupId: "entry-1",
		translations: [
			{ id: "entry-1", locale: "ko", status: "published", isSource: true, title: "테스트", workingSlug: "test" },
			{ id: "entry-en", locale: "en", status: "draft", isSource: false, title: "테스트", workingSlug: "test" },
		],
	};

	it("hides the language tabs of the editor", async () => {
		serve(() => undefined, grouped);
		render(withSite(<EntryEditorShell mode="edit" initialEntryId="entry-1" adminId={ADMIN} />, hiding));
		await editorTitle();
		expect(screen.queryByRole("navigation", { name: tScreens("column.locale") })).toBeNull();
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

	it("shows the full source beside only a translation", async () => {
		serve(() => undefined, translationWith(SOURCE_MDX));
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
		serve(() => undefined, source);
		renderEdit();
		await editorTitle();
		expect(sourcePane()).toBeNull();
	});

	it("shows no notice when it matches the confirmed source", async () => {
		serve(() => undefined, translationWith(SOURCE_MDX));
		renderEdit();
		await editorTitle();
		expect(screen.queryByText(tEntryEditorShell("sourceChanged"))).toBeNull();
	});

	it("when the source changes, notifies, and confirm saves the confirmed source in the request", async () => {
		serve((_input, init) => {
			if (init?.method === "PATCH") {
				const body = JSON.parse(String(init.body));
				return json({ ...translationWith(SOURCE_MDX), version: 5, working: { ...body, metadata: body.metadata } });
			}
		}, translationWith("첫 문단\n"));
		renderEdit();
		expect(await screen.findByText(tEntryEditorShell("sourceChanged"))).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: tEntryEditorShell("confirm") }));
		expect(screen.queryByText(tEntryEditorShell("sourceChanged"))).toBeNull();
		pressSave();
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
		expect(await screen.findByText(tEntryEditorShell("sourceChanged"))).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: tEntryEditorShell("confirm") }));
		pressSave();
		await waitFor(() => expect(methodCalls("PATCH")).toHaveLength(1));
		expect(JSON.parse(String(methodCalls("PATCH")[0]?.[1]?.body)).translation).toEqual({
			version: 4,
			baseDoc: current,
		});
	});

	it("with no translation state or a malformed one, nothing is treated as confirmed", async () => {
		serve(() => undefined, translationWith(null));
		renderEdit();
		expect(await screen.findByText(tEntryEditorShell("sourceChanged"))).toBeInTheDocument();
	});

	it("the comparison lists changed blocks as before and now", async () => {
		serve(() => undefined, translationWith("첫 문단 옛\n\n둘째 문단\n\n지운 문단\n"));
		renderEdit();
		fireEvent.click(await screen.findByRole("button", { name: tEntryEditorShell("compare") }));
		const dialog = await screen.findByRole("dialog", { name: tEntries("sourceChange.title") });
		expect(within(dialog).getByText(tEntries("sourceChange.changed"))).toBeInTheDocument();
		expect(within(dialog).getByText(tEntries("sourceChange.removed"))).toBeInTheDocument();
		expect(within(dialog).getAllByText(tEntries("sourceChange.before")).length).toBeGreaterThan(0);
		expect(within(dialog).getAllByText(tEntries("sourceChange.after")).length).toBeGreaterThan(0);
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
		fireEvent.click(await screen.findByRole("button", { name: tEntryEditorShell("compare") }));
		const dialog = await screen.findByRole("dialog", { name: tEntries("sourceChange.title") });
		expect(within(dialog).getAllByText(tEntries("sourceChange.moved"))).toHaveLength(1);
		expect(within(dialog).queryByText(tEntries("sourceChange.added"))).toBeNull();
		expect(within(dialog).queryByText(tEntries("sourceChange.removed"))).toBeNull();
		await waitFor(() => expect(dialog.textContent).toContain("다"));
	});

	it("an unparseable source is reported as not comparable", async () => {
		serve(() => undefined, translationWith("", { base: unparsedDocument("<Callout>닫히지 않음") }));
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

	it("publishes the screen, the collection and the open entry", async () => {
		renderWithPanel();
		await editorTitle();
		fireEvent.click(screen.getByRole("button", { name: /Helper/ }));
		expect(readOut("where")).toEqual({ screen: "entry", collection: "post", entryId: "entry-1" });
	});

	it("reads the entry as the form holds it, with the changes that are not saved", async () => {
		renderWithPanel();
		fireEvent.change(await editorTitle(), { target: { value: "저장 전에 고친 제목" } });
		fireEvent.click(screen.getByRole("button", { name: /Helper/ }));
		expect(readOut("entry")).toMatchObject({ title: "저장 전에 고친 제목", summary: "요약" });
		expect(readOut("unsaved")).toBe(true);
	});

	it("reads the selected text and the block the selection is in, with its block id", async () => {
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
