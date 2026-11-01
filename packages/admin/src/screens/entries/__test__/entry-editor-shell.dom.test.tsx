import { RightPanelOpen } from "@carbon/icons-react";
import { emptyStoredDocument, type StoredDocument, unparsedDocument } from "@monti-cms/core/document";
import { issueText } from "@monti-cms/core/site";
import { SidePanel } from "@monti-cms/ui";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { Editor, TiptapEditorHTMLElement } from "@tiptap/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	contentCollection,
	defaultLocale,
	recordCollection,
	requiredMetadata,
	secondLocale,
} from "../../../../../core/test/any-site";
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
import { editorMessages } from "../../../editor/messages";
import { StatusBarPluginCell } from "../../../kit";
import { commonMessages } from "../../../lib/common.messages";
import type { AdminPanel } from "../../../plugins";
import { type FakeApi, failure, fakeApi, type SentRequest } from "../../../test/fake-api";
import { type FakeIndexedDB, installFakeIndexedDB } from "../../../test/fake-indexed-db";
import { docOf } from "../../../test/mdx";
import { createTestRouter } from "../../../test/router";
import { withSite } from "../../../test/site";
import { toast } from "../../../test/ui-toast";
import { exportMessages } from "../../export/messages";
import { screensMessages } from "../../messages";
import { schemaReviewMessages } from "../../schema/review.messages";
import { deleteMessages } from "../../shared/delete.messages";
import { statusLabels } from "../../shared/entry-status";
import { useOpenEditor } from "../../shared/open-editor";
import { publishReadinessMessages } from "../../shared/publish-readiness.messages";
import { ScreenContextProvider, useScreenContext } from "../../shared/screen-context";
import { AdminPanelProvider } from "../../shared/side-panel-slot";
import { StatusCellsProvider, useStatusBarContext } from "../../shared/status-bar";
import { statusBarMessages } from "../../shared/status-bar.messages";
import { EntryEditorShell } from "../entry-editor-shell";
import { entryEditorShellMessages } from "../entry-editor-shell.messages";
import { COMPOSITION_WAIT_MS } from "../entry-editor-store";
import type { EntryData, TranslationMember } from "../entry-form";
import { entriesMessages } from "../messages";

const tEntryEditorShell = testSite.createTranslator(entryEditorShellMessages);
const tEntries = testSite.createTranslator(entriesMessages);
const tScreens = testSite.createTranslator(screensMessages);
const tStatusBar = testSite.createTranslator(statusBarMessages);
const tPublishReadiness = testSite.createTranslator(publishReadinessMessages);
const tSchemaReview = testSite.createTranslator(schemaReviewMessages);
const tExport = testSite.createTranslator(exportMessages);
const tDelete = testSite.createTranslator(deleteMessages);
const tEditor = testSite.createTranslator(editorMessages);
const tCommon = testSite.createTranslator(commonMessages);

/** A text as a pattern that matches it literally (a message put inside a longer name or sentence). */
const literally = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A name that starts with `text` (a row named by its title and then its detail). */
const startingWith = (text: string) => new RegExp(`^${literally(text)}`);

/** The entry's collection: the site's first document collection with a body. Its fields are looked up from the config. */
const COLLECTION = contentCollection;
const TITLE_LABEL = testSite.titleField(COLLECTION).field.label;
/** The field the publish fills from the body when it is empty (a summary). */
const FILLED_FIELD = (() => {
	const found = testSite
		.storedFields(COLLECTION)
		.find(({ field, when }) => !when && field.kind === "text" && field.fillFromBody);
	if (!found) throw new Error(`${COLLECTION} has no field filled from the body`);
	return { name: found.name, label: found.field.label };
})();
/** The properties panel row of the filled field, which is there once the entry has loaded. */
const filledFieldRow = () => screen.findByRole("button", { name: new RegExp(`^${literally(FILLED_FIELD.label)}`) });
/** The relation fields whose targets can be added from the field itself (`createInline`). */
const INLINE_RELATIONS = testSite
	.storedFields(COLLECTION)
	.flatMap(({ name, field, when }) =>
		!when && field.kind === "relation" && field.createInline
			? [{ name, label: field.label, to: field.to, many: field.many === true }]
			: [],
	);
/** The values publishing needs (a required relation points at an id the test never loads). */
const REQUIRED = await requiredMetadata(COLLECTION, "테스트", async (to) => `${to}-1`);
/** The visual editor's body, as the real editor labels it. In source mode it stays in the page, hidden, so only a shown one is found. */
const BODY_LABEL = tEditor("toolbar.editorLabel");
const visualBody = () => screen.findByRole("textbox", { name: BODY_LABEL });
const shownVisualBody = () => screen.queryByRole("textbox", { name: BODY_LABEL });
/** The editor instance behind the visual body (Tiptap keeps it on the editable element). */
const visualEditor = async () => {
	let editor: Editor | undefined;
	await waitFor(async () => {
		editor = ((await visualBody()) as TiptapEditorHTMLElement).editor;
		expect(editor?.isDestroyed).toBe(false);
	});
	return editor as Editor;
};

/** The browser's recovery database: the shell keeps and drops its copies there through the real `local-backup` module. */
let idb: FakeIndexedDB;
const backupAt = (key: string) => idb.backupOf(testSite, key);
vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);
const testRouter = createTestRouter();
const { render } = testRouter;

const ADMIN = "u1";
const entry: EntryData = {
	id: "entry-1",
	collection: COLLECTION,
	status: "draft",
	version: 4,
	folderId: null,
	workingSlug: "test",
	publishedSlug: null,
	working: { metadata: { ...REQUIRED, [FILLED_FIELD.name]: "요약" }, doc: docOf("첫째 줄\n둘째 줄") },
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
const reopenReadinessPopup = async (count: number) => {
	fireEvent.click(await screen.findByRole("button", { name: tStatusBar("todo.count", { count }) }));
	return within(await screen.findByRole("dialog"));
};
/** The readiness row of a body that does not parse (`mdx_error`). */
const MDX_ERROR = tPublishReadiness("issue.mdx_error");
/** Saves the way the header no longer offers a button for: the keyboard shortcut. */
const pressSave = () => fireEvent.keyDown(window, { key: "s", metaKey: true });

beforeEach(() => {
	asked.length = 0;
	vi.clearAllMocks();
	idb = installFakeIndexedDB();
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
		expect(backupAt(`${ADMIN}:entry-1`)).toBeUndefined();
		window.dispatchEvent(new Event("pagehide"));
		await waitFor(() => expect(backupAt(`${ADMIN}:entry-1`)?.snapshot).toMatchObject({ title: "로컬에서 수정" }));
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
		const savedAt = new RegExp(`^${literally(tStatusBar("save.saved", { time: "" }))}`);
		const bar = within(await screen.findByRole("region", { name: tScreens("column.status") }));
		await waitFor(() => expect(bar.getByText(savedAt)).toBeInTheDocument());
		// The size of the body (whitespace not counted) is at the end; the language and the reading time are not in the bar.
		expect(bar.getByText(tStatusBar("chars", { count: 6 }))).toBeInTheDocument();
		expect(bar.queryByText(defaultLocale)).toBeNull();
		fireEvent.change(await editorTitle(), { target: { value: "수정" } });
		// Pressing the cell saves, as Cmd/Ctrl+S does.
		fireEvent.click(bar.getByRole("button", { name: tEntries("save.dirty") }));
		await waitFor(() => expect(bar.getByText(tStatusBar("save.saving"))).toBeInTheDocument());
		expect(bar.queryByRole("button", { name: tStatusBar("save.saving") })).toBeNull();
		finish?.();
		await waitFor(() => expect(bar.getByText(savedAt)).toBeInTheDocument());
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
		// The save waits for the composition to end, at most this long (the length itself is in the entry editor store test).
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		pressSave();
		await act(() => vi.advanceTimersByTimeAsync(COMPOSITION_WAIT_MS));
		vi.useRealTimers();
		await waitFor(() => expect(api.sent("PATCH /v1/entries/:id")).toHaveLength(1));
		await waitFor(() => expect(toast).toHaveBeenCalledWith(tCommon("saved")));
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
		await waitFor(() => expect(opened.location.href).toBe(testSite.previewHref(COLLECTION, "test")));
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
		renderShell(<EntryEditorShell mode="new" adminId={ADMIN} collection={COLLECTION} />);
		fireEvent.change(await editorTitle(), { target: { value: "새 글" } });
		// The recovery copy is kept after input pauses (interval is in the entry editor store test). Here, leaving the screen writes it right away.
		expect(backupAt(`${ADMIN}:new:${COLLECTION}`)).toBeUndefined();
		window.dispatchEvent(new Event("pagehide"));
		await waitFor(() => expect(backupAt(`${ADMIN}:new:${COLLECTION}`)?.snapshot).toMatchObject({ title: "새 글" }));
		pressSave();
		await waitFor(() => expect(api.sent("POST /v1/entries")).toHaveLength(1));
		await waitFor(() => expect(backupAt(`${ADMIN}:new:${COLLECTION}`)).toBeUndefined());
		expect(window.location.pathname).toBe(testSite.adminEntryEditHref("created-entry"));
	});

	describe("to-do cell in the status bar (flow 1 steps 10 to 13)", () => {
		const checkCalls = () => api.sent("POST /v1/entries/:id/check");
		const bar = async () => within(await screen.findByRole("region", { name: tScreens("column.status") }));
		const missingTitle = told({ code: "missing_field", path: "title", message: TITLE_LABEL });
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
			fireEvent.click(await (await bar()).findByRole("button", { name: tStatusBar("todo.count", { count: 2 }) }));
			const list = within(await screen.findByRole("dialog"));
			expect(list.getByText(tStatusBar("todo.title"))).toBeInTheDocument();
			expect(list.queryByText(tPublishReadiness("issue.footnote_definition_unused"))).toBeNull();
		});

		it("WRITE-P1 rechecks after a save, not on a keystroke, and keeps the last answer meanwhile", async () => {
			checkAnswer = { issues: [missingTitle], warnings: [] };
			api.on("PATCH /v1/entries/:id", savedAs());
			renderEdit();
			await (await bar()).findByRole("button", { name: tStatusBar("todo.count", { count: 1 }) });
			expect(checkCalls()).toHaveLength(1);

			fireEvent.change(await editorTitle(), { target: { value: "수정 중" } });
			fireEvent.change(await editorTitle(), { target: { value: "수정 중 2" } });
			expect(await screen.findByRole("button", { name: tStatusBar("todo.count", { count: 1 }) })).toBeInTheDocument();
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
		/** The plugins' names for what they find; a cell is named by it and its count (one finding each here). */
		const ONE_LANGUAGE = "맞춤법";
		const EVERYWHERE = "점검";
		const cellName = (label: string) => `${label} 1`;
		/** A plugin's cell that checks only the default language, and draws nothing for any other. */
		const OneLanguageCell = () => {
			const { locale } = useStatusBarContext();
			return locale === defaultLocale ? (
				<StatusBarPluginCell label={ONE_LANGUAGE} findings={[finding(`언어 ${locale}`)]} />
			) : null;
		};
		const EverywhereCell = () => {
			const { locale, collection } = useStatusBarContext();
			return <StatusBarPluginCell label={EVERYWHERE} findings={[finding(`${collection} ${locale}`)]} />;
		};
		const renderWithCells = () =>
			renderShell(
				<StatusCellsProvider cells={{ oneLanguage: OneLanguageCell, everywhere: EverywhereCell }}>
					<EntryEditorShell mode="edit" initialEntryId="entry-1" adminId={ADMIN} />
				</StatusCellsProvider>,
			);
		const bar = async () => within(await screen.findByRole("region", { name: tScreens("column.status") }));

		it("PLUG-A4 fills the slot in the source editor, after the to-do cell", async () => {
			serve({ ...entry, locale: defaultLocale, translationGroupId: "entry-1", translations: [] });
			renderWithCells();
			const cells = await bar();
			await cells.findByRole("button", { name: tStatusBar("todo.none") });
			expect(cells.getAllByRole("button").map((button) => button.textContent)).toEqual([
				tStatusBar("todo.none"),
				cellName(ONE_LANGUAGE),
				cellName(EVERYWHERE),
			]);
			fireEvent.click(cells.getByRole("button", { name: cellName(EVERYWHERE) }));
			expect(within(await screen.findByRole("dialog")).getByText(`${COLLECTION} ${defaultLocale}`)).toBeInTheDocument();
		});

		it.skipIf(!secondLocale)(
			"PLUG-A4 fills the slot in the translation editor too, and a plugin can leave it empty for that language",
			async () => {
				serve({
					...entry,
					id: "entry-en",
					locale: secondLocale,
					translationGroupId: "entry-1",
					translations: [],
					source: {
						id: "entry-1",
						locale: defaultLocale,
						status: "draft",
						workingSlug: "test",
						metadata: { title: "원문 제목" },
						doc: docOf("원문\n"),
					},
					working: { metadata: { title: "Title" }, doc: docOf("First\n"), translation: null },
				});
				renderWithCells();
				const cells = await bar();
				await cells.findByRole("button", { name: cellName(EVERYWHERE) });
				expect(cells.queryByRole("button", { name: new RegExp(`^${ONE_LANGUAGE}`) })).toBeNull();
				fireEvent.click(cells.getByRole("button", { name: cellName(EVERYWHERE) }));
				expect(
					within(await screen.findByRole("dialog")).getByText(`${COLLECTION} ${secondLocale}`),
				).toBeInTheDocument();
			},
		);
	});

	it("WRITE-P2 creates and publishes a local new entry when Publish is clicked", async () => {
		api.on("POST /v1/entries", ({ body }) => ({
			entry: {
				...entry,
				id: "published-entry",
				collection: COLLECTION,
				version: 1,
				workingSlug: body.slug,
				working: { metadata: body.metadata, doc: body.doc },
			},
			warnings: [],
		}));
		const published: EntryWriteResult = {
			entry: { ...entry, id: "published-entry", status: "published", version: 2 },
			warnings: [],
		};
		api.on("POST /v1/entries/:id/publish", ({ params }) =>
			params.id === "published-entry" ? published : failure("not_found"),
		);
		renderShell(<EntryEditorShell mode="new" adminId={ADMIN} collection={COLLECTION} />);
		fireEvent.change(await editorTitle(), { target: { value: "바로 발행" } });
		// A body to fill the summary from, as the writer types it.
		const editor = await visualEditor();
		act(() => void editor.commands.insertContent("바로 발행할 본문"));
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
					told({ code: "missing_field", path: "title", message: TITLE_LABEL }),
					told({ code: "mdx_error", path: "body", position: { blockId: body.content[1]?.id } }),
				],
			}),
		);
		serve({ ...entry, working: { ...entry.working, doc: body } });
		renderEdit();
		await filledFieldRow();
		fireEvent.click(screen.getByRole("button", { name: tEntryEditorShell("publish") }));
		// A refused publish opens the readiness popup with what it found.
		const popup = await readinessPopup();
		const title = await editorTitle();
		expect(title.getAttribute("aria-invalid")).toBe("true");
		expect(title.getAttribute("aria-describedby")).toBe("cms-title-error");
		expect(screen.getAllByRole("textbox", { name: TITLE_LABEL })).toHaveLength(1);
		fireEvent.click(
			popup.getByRole("button", { name: startingWith(tPublishReadiness("field.write", { name: TITLE_LABEL })) }),
		);
		await waitFor(() => expect(document.activeElement).toBe(title));
		// In source mode, the panel is asked to focus the block the issue is in.
		await toggleView(SOURCE_LABEL);
		await screen.findByLabelText("패널 본문");
		fireEvent.click((await reopenReadinessPopup(2)).getByRole("button", { name: startingWith(MDX_ERROR) }));
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
		await filledFieldRow();
		const editor = await visualEditor();
		fireEvent.click(screen.getByRole("button", { name: tEntryEditorShell("publish") }));
		const popup = await readinessPopup();

		fireEvent.click(popup.getByRole("button", { name: startingWith(MDX_ERROR) }));
		await waitFor(() => expect(editor.state.selection.$from.parent.textContent).toBe("둘째 문단"));
		// The editor takes focus a frame later (Tiptap's `focus()`); a popup opened before that would lose it to the editor and close.
		await waitFor(() => expect(editor.isFocused).toBe(true));
		expect(screen.queryByLabelText("패널 본문")).toBeNull();

		blockId = "zzzzzzzz";
		fireEvent.click(screen.getByRole("button", { name: tEntryEditorShell("publish") }));
		await waitFor(() => expect(api.sent("POST /v1/entries/:id/publish").length).toBeGreaterThanOrEqual(2));
		fireEvent.click((await readinessPopup()).getByRole("button", { name: startingWith(MDX_ERROR) }));
		expect(await screen.findByLabelText("패널 본문")).toBeInTheDocument();
	});

	it("WRITE-P11 opens a body that cannot be read in source mode and does not allow the visual editor (no silent overwrite)", async () => {
		serve({
			...entry,
			working: { ...entry.working, doc: unparsedDocument("본문 <Callout>닫히지 않음") },
		});
		// The visual editor must never mount on a body it cannot read, not even for a frame: watch every DOM change instead of
		// checking the end state only.
		let visualEditorMounted = false;
		const watcher = new MutationObserver(() => {
			if (shownVisualBody()) visualEditorMounted = true;
		});
		watcher.observe(document.body, { childList: true, subtree: true });
		renderEdit();
		// The body opens after the deferred analysis of the loaded text.
		const source = await screen.findByLabelText("패널 본문");
		watcher.disconnect();
		expect(visualEditorMounted).toBe(false);
		expect(source).toBeInTheDocument();
		expect((await editorTitle()).getAttribute("value")).toBe("테스트");
		expect(shownVisualBody()).toBeNull();
		// The visual editor stays hidden behind the source, empty and locked: nothing it holds can be saved over the body.
		const hidden = screen.getByRole("textbox", { name: BODY_LABEL, hidden: true }) as TiptapEditorHTMLElement;
		expect(hidden).toHaveAttribute("contenteditable", "false");
		expect(hidden.editor?.getText()).toBe("");
		expect(screen.getByText(new RegExp(literally(tEntryEditorShell("visualUnavailable"))))).toBeInTheDocument();
		// There is no way back to the visual editor, so the ⋯ menu has no switch for it.
		expect(await viewSwitch(SOURCE_LABEL)).toBeNull();
	});

	it("FMT-P2 switches only the body to the source panel and keeps the title", async () => {
		renderEdit();
		await visualBody();
		expect((await viewSwitch(SOURCE_LABEL))?.getAttribute("aria-checked")).toBe("false");
		await toggleView(SOURCE_LABEL);
		const source = await screen.findByLabelText("패널 본문");
		expect(source.textContent).toBe("첫째 줄\n둘째 줄");
		expect(shownVisualBody()).toBeNull();
		expect((await editorTitle()).getAttribute("value")).toBe("테스트");
		expect((await viewSwitch(SOURCE_LABEL))?.getAttribute("aria-checked")).toBe("true");
		await toggleView(SOURCE_LABEL);
		expect(await visualBody()).toBeInTheDocument();
		expect(screen.queryByLabelText("패널 본문")).toBeNull();
	});

	describe("the source toggle is the source panel slot", () => {
		/** A panel that is not the MDX one: it shows how many blocks the body has and lets a test hand a body back. */
		const focused: string[] = [];
		const PANEL_LABEL = "내 원문 보기";
		const HAND_BACK = "패널에서 고침";
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
						{HAND_BACK}
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
			withPanels([{ format: "custom", label: PANEL_LABEL, Panel: FakePanel }]);
			await visualBody();
			// The menu's one source switch is the registered panel's.
			const menu = await openMoreMenu();
			expect(
				within(menu)
					.getAllByRole("menuitemcheckbox")
					.map((row) => row.textContent),
			).toEqual([PANEL_LABEL]);
			await toggleView(PANEL_LABEL);
			expect((await screen.findByLabelText("블록 수")).textContent).toBe("1");
			expect(shownVisualBody()).toBeNull();
			expect(screen.getByLabelText("읽기 전용").textContent).toBe("false");
		});

		it("FMT-R8 takes the body the panel hands back as the body, which the next save sends", async () => {
			api.on("PATCH /v1/entries/:id", () => ({ entry: { ...entry, version: 5 }, warnings: [] }));
			withPanels([{ format: "custom", label: PANEL_LABEL, Panel: FakePanel }]);
			await visualBody();
			await toggleView(PANEL_LABEL);
			fireEvent.click(await screen.findByRole("button", { name: HAND_BACK }));
			expect(screen.getByTitle(tEntries("save.dirty"))).toBeInTheDocument();
			pressSave();
			await waitFor(() => expect(api.sent("PATCH /v1/entries/:id")).toHaveLength(1));
			const sent = api.sent("PATCH /v1/entries/:id")[0]?.body as { doc: StoredDocument };
			expect(sent.doc.content.map((block) => block.type)).toEqual(["paragraph", "paragraph"]);
			expect(JSON.stringify(sent.doc)).toContain("패널에서 쓴 본문");
		});

		it("WRITE-P1 tells the panel which block an issue is in", async () => {
			const body = docOf("첫째 문단\n\n둘째 문단\n");
			api.on("POST /v1/entries/:id/publish", () =>
				failure("publish_validation_failed", undefined, {
					issues: [told({ code: "mdx_error", path: "body", position: { blockId: body.content[1]?.id } })],
				}),
			);
			serve({ ...entry, working: { ...entry.working, doc: body } });
			withPanels([{ format: "custom", label: PANEL_LABEL, Panel: FakePanel }]);
			await filledFieldRow();
			await toggleView(PANEL_LABEL);
			await screen.findByLabelText("블록 수");
			fireEvent.click(screen.getByRole("button", { name: tEntryEditorShell("publish") }));
			fireEvent.click((await readinessPopup()).getByRole("button", { name: startingWith(MDX_ERROR) }));
			// The panel is asked for that block, once; the screen does not keep asking.
			await waitFor(() => expect(focused).toEqual([body.content[1]?.id]));
			await waitFor(() => expect(screen.getByLabelText("포커스").textContent).toBe("-"));
		});
	});

	it.skipIf(INLINE_RELATIONS.length === 0)(
		"WRITE-W5 adds related records through the add panel, prefilled with the typed name",
		async () => {
			api.on("PATCH /v1/entries/:id", () => ({ entry: { ...entry, version: 5 }, warnings: [] }));
			api.on(
				"POST /v1/entries",
				({ body }): EntryWriteResult => ({
					entry: {
						id: `${body.collection}-2`,
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
			const saveIn = async (to: string) => {
				const name = tScreens("list.add", { label: testSite.schemaOf(to).label });
				const panel = await screen.findByRole("dialog", { name });
				fireEvent.click(within(panel).getByRole("button", { name: tCommon("save") }));
				await waitFor(() => expect(screen.queryByRole("dialog", { name })).toBeNull());
			};
			/**
			 * Enters a query and presses the `Add 'name'` item. Base UI opens the list only for real input (an input event with `inputType`).
			 * When several test files run together, input entered before the field is ready can vanish, so it is entered again until the item shows.
			 */
			const typeAndPickAdd = async (field: string, text: string) => {
				// The value opens its list where it is.
				if (!screen.queryByRole("combobox", { name: field })) {
					fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${literally(field)}`) }));
				}
				const input = (await screen.findByRole("combobox", { name: field })) as HTMLInputElement;
				const add = tEntries("relation.create", { label: text });
				const option = await waitFor(
					() => {
						if (!screen.queryByRole("option", { name: add })) {
							fireEvent.input(input, { target: { value: text }, inputType: "insertText" });
						}
						return screen.getByRole("option", { name: add });
					},
					{ interval: 200 },
				);
				fireEvent.click(option);
				return input;
			};
			for (const relation of INLINE_RELATIONS) {
				const text = `새 ${relation.label}`;
				const input = await typeAndPickAdd(relation.label, text);
				await saveIn(relation.to);
				// One value stands in the input; a list shows the new one among its picks.
				if (relation.many) await waitFor(() => expect(screen.getAllByText(text).length).toBeGreaterThan(0));
				else await waitFor(() => expect(input.value).toBe(text));
			}
			expect(api.sent("POST /v1/entries").map((request) => request.body)).toMatchObject(
				INLINE_RELATIONS.map((relation) => ({
					collection: relation.to,
					metadata: { title: `새 ${relation.label}` },
					doc: emptyStoredDocument(),
				})),
			);
		},
	);

	it("WRITE-S5 reports an offline save and keeps a browser backup", async () => {
		api.on("PATCH /v1/entries/:id", () => {
			throw new TypeError("offline");
		});
		renderEdit();
		fireEvent.change(await editorTitle(), { target: { value: "오프라인 수정" } });
		pressSave();
		await waitFor(() => expect(api.sent("PATCH /v1/entries/:id")).toHaveLength(1));
		await waitFor(() => expect(screen.getAllByText(tStatusBar("save.local-only")).length).toBeGreaterThan(0));
		expect(backupAt(`${ADMIN}:entry-1`)?.snapshot).toMatchObject({
			title: "오프라인 수정",
			[FILLED_FIELD.name]: "요약",
		});
	});

	it("WRITE-P1 does not publish when a body-filled field has nothing to fill from, naming the field", async () => {
		serve({
			...entry,
			working: { metadata: REQUIRED, doc: docOf("```js\nonly();\n```") },
		});
		renderEdit();
		await filledFieldRow();
		fireEvent.click(screen.getByRole("button", { name: tEntryEditorShell("publish") }));
		await waitFor(() => expect(toast.error).toHaveBeenCalledWith(tEntries("fillEmpty", { label: FILLED_FIELD.label })));
	});

	it("TRASH-T7 shows trashed entries read-only with restore and permanent delete", async () => {
		serve({ ...entry, status: "trashed" });
		renderEdit();
		const banner = await screen.findByRole("status", { name: tScreens("sidebar.trash") });
		const toolbar = screen.getByRole("banner");
		expect(within(toolbar).getByRole("button", { name: tCommon("lifecycle.restore") })).toBeInTheDocument();
		expect(within(toolbar).getByRole("button", { name: tCommon("lifecycle.deletePermanently") })).toBeInTheDocument();
		expect(within(banner).queryByRole("button")).toBeNull();
		expect(await visualBody()).toHaveAttribute("contenteditable", "false");
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
		for (const [status, action] of [
			["archived", "unarchive"],
			["trashed", "restore"],
		] as const) {
			const label = tCommon(`lifecycle.${action}`);
			const message = tEntries(`lifecycle.success.${action}`);
			api.on(`POST /v1/entries/:id/${action}`, () => ({ ...entry, version: 5 }));
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
		serve({ ...entry, collection: recordCollection });
		renderEdit();
		// An item collection opens that item in the small form on the list.
		await waitFor(() =>
			expect(testRouter.replace).toHaveBeenCalledWith(
				testSite.adminHref(`?collection=${recordCollection}&open=${entry.id}`),
			),
		);
	});
});

/** The language of a translation; the describes that need one are skipped on a site with one language. */
const SECOND = secondLocale ?? defaultLocale;
/** The menu buttons inside an element (a button that opens a menu says so with `aria-haspopup`). */
const menuButtons = (element: HTMLElement) =>
	within(element)
		.queryAllByRole("button")
		.filter((button) => button.hasAttribute("aria-haspopup"));
const addTranslation = (locale: string) => tEntries("lang.addTab", { code: locale.toUpperCase() });

describe.skipIf(!secondLocale)("language tabs", () => {
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
		locale: defaultLocale,
		translationGroupId: "entry-1",
		translations: [member("entry-1", defaultLocale, "published", true), member("entry-en", SECOND, "draft", false)],
	};
	const translation: EntryData = { ...source, id: "entry-en", locale: SECOND, status: "draft" };
	/** A source with no translation yet: every other language has an add button. */
	const alone: EntryData = { ...source, translations: [member("entry-1", defaultLocale, "published", true)] };
	it("TRANS-L2 shows one tab per member and marks the current one", async () => {
		serve(source);
		renderEdit();
		const nav = await screen.findByRole("navigation", { name: tScreens("column.locale") });
		const status = statusLabels(testSite);
		const current = within(nav).getByRole("link", {
			name: tEntries("lang.currentSource", { lang: testSite.localeLabel(defaultLocale), status: status.published }),
		});
		expect(current.getAttribute("aria-current")).toBe("page");
		const other = within(nav).getByRole("link", {
			name: tEntries("lang.current", { lang: testSite.localeLabel(SECOND), status: status.draft }),
		});
		expect(other.getAttribute("aria-current")).toBeNull();
		// The languages the group lacks have an add button each, and the tab bar has no menu.
		const missing = testSite.LOCALES.filter((locale) => locale !== defaultLocale && locale !== SECOND);
		for (const locale of missing)
			expect(within(nav).getByRole("button", { name: addTranslation(locale) })).toBeInTheDocument();
		expect(menuButtons(nav)).toEqual([]);
	});

	it("TRANS-N1 creates a translation from the missing-language button and opens it", async () => {
		api.on("POST /v1/entries/:id/translations", ({ params }) =>
			params.id === "entry-1" ? { entry: { id: "entry-new" } } : failure("not_found"),
		);
		serve(alone);
		renderEdit();
		fireEvent.click(await screen.findByRole("button", { name: addTranslation(SECOND) }));
		await waitFor(() => expect(testRouter.navigate).toHaveBeenCalledWith(testSite.adminEntryEditHref("entry-new")));
		expect(api.sent("POST /v1/entries/:id/translations")[0]?.body).toEqual({ locale: SECOND });
		expect(toast).toHaveBeenCalledWith(tEntries("lang.created", { lang: testSite.localeLabel(SECOND) }));
	});

	it("WRITE-S6 blocks translation creation while there are unsaved changes", async () => {
		serve(alone);
		renderEdit();
		fireEvent.change(await editorTitle(), { target: { value: "저장 전" } });
		fireEvent.click(screen.getByRole("button", { name: addTranslation(SECOND) }));
		await waitFor(() => expect(toast.error).toHaveBeenCalledWith(tEntries("lang.saveFirst")));
		expect(api.sent("POST /v1/entries/:id/translations")).toHaveLength(0);
	});

	describe("flow: this translation goes to the trash (T10)", () => {
		const serveTranslation = (current: EntryData) => {
			serve(current);
			api.on("POST /v1/entries/:id/trash", ({ params }) =>
				params.id === "entry-en" ? { ...current, status: "trashed" } : failure("not_found"),
			);
			api.on("POST /v1/trash/restore", () => ({ results: [] }));
		};
		const openMore = async () => {
			renderShell(<EntryEditorShell mode="edit" initialEntryId="entry-en" adminId={ADMIN} />);
			const nav = await screen.findByRole("navigation", { name: tScreens("column.locale") });
			// The tab bar has no menu of its own: the item is in the header's ⋯.
			expect(menuButtons(nav)).toEqual([]);
			fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: tEntryEditorShell("more") }));
		};

		it("TRASH-T6 moves a draft translation at once, goes back to the source, and the toast's undo restores it", async () => {
			serveTranslation(translation);
			await openMore();
			fireEvent.click(screen.getByRole("menuitem", { name: startingWith(tDelete("translation.trash")) }));

			await waitFor(() => expect(api.sent("POST /v1/entries/entry-en/trash")).toHaveLength(1));
			expect(screen.queryByRole("alertdialog")).toBeNull();
			await waitFor(() => expect(testRouter.navigate).toHaveBeenCalledWith(testSite.adminEntryEditHref("entry-1")));
			expect(toast).toHaveBeenCalledWith(
				tDelete("trash.done"),
				expect.objectContaining({ action: expect.objectContaining({ label: tDelete("undo") }) }),
			);
			const undo = toast.mock.calls.find(([message]) => message === tDelete("trash.done"))?.[1] as {
				action: { onClick: () => void };
			};

			await act(async () => undo.action.onClick());
			await waitFor(() => expect(api.sent("POST /v1/trash/restore")).toHaveLength(1));
			expect(api.sent("POST /v1/trash/restore")[0]?.body).toEqual({
				items: [{ type: "entry", id: "entry-en", expectedVersion: translation.version + 1 }],
			});
			await waitFor(() => expect(testRouter.navigate).toHaveBeenCalledWith(testSite.adminEntryEditHref("entry-en")));
		});

		it("TRASH-T3 asks first when the translation is published, and sends nothing when cancelled", async () => {
			serveTranslation({ ...translation, status: "published" });
			await openMore();
			fireEvent.click(screen.getByRole("menuitem", { name: startingWith(tDelete("translation.trash")) }));
			const dialog = await screen.findByRole("alertdialog", { name: tDelete("trash.ask.title") });
			fireEvent.click(within(dialog).getByRole("button", { name: tExport("action.cancel") }));
			await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
			expect(api.sent("POST /v1/entries/entry-en/trash")).toHaveLength(0);
		});
	});
});

describe.skipIf(!secondLocale)("translation source pane", () => {
	const SOURCE_MDX = "첫 문단\n\n둘째 문단\n";
	const source: EntryData = {
		...entry,
		locale: defaultLocale,
		translationGroupId: "entry-1",
		translations: [],
	};
	const translationWith = (
		baseSource: string | null,
		documents: { base?: StoredDocument | null; current?: StoredDocument | null; currentMdx?: string } = {},
	): EntryData => ({
		...entry,
		id: "entry-en",
		locale: SECOND,
		translationGroupId: "entry-1",
		translations: [],
		source: {
			id: "entry-1",
			locale: defaultLocale,
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
		expect(
			within(sourcePane() as HTMLElement).getByText(
				tEntries("sourcePane.heading", { locale: defaultLocale.toUpperCase() }),
			),
		).toBeInTheDocument();
		// The title slot hint is the source title.
		expect((await editorTitle()).getAttribute("placeholder")).toBe("원문 제목");
		// A translation uses the same editor too (formatting tools, source switch), and its ⋯ menu can show the source beside.
		expect(await viewSwitch(SOURCE_LABEL)).toBeInTheDocument();
		expect((await viewSwitch(tEntries("sourcePane")))?.getAttribute("aria-checked")).toBe("true");
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

	it("TRANS-S2 the comparison shows a block that moved as moved when both versions have documents", async () => {
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

	it("TRANS-S2 an unparseable source is reported as not comparable", async () => {
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

	it("PLUG-A5 publishes the screen, the collection and the open entry", async () => {
		renderWithPanel();
		await editorTitle();
		fireEvent.click(screen.getByRole("button", { name: /Helper/ }));
		expect(readOut("where")).toEqual({ screen: "entry", collection: COLLECTION, entryId: "entry-1" });
	});

	it("PLUG-A5 reads the entry as the form holds it, with the changes that are not saved", async () => {
		renderWithPanel();
		fireEvent.change(await editorTitle(), { target: { value: "저장 전에 고친 제목" } });
		fireEvent.click(screen.getByRole("button", { name: /Helper/ }));
		expect(readOut("entry")).toMatchObject({ title: "저장 전에 고친 제목", [FILLED_FIELD.name]: "요약" });
		expect(readOut("unsaved")).toBe(true);
	});

	it("PLUG-A5 reads the selected text and the block the selection is in, with its block id", async () => {
		renderWithPanel();
		await editorTitle();
		const editor = await visualEditor();
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
