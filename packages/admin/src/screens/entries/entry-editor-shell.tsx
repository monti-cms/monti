"use client";

import { isUnparsedDocument } from "@monti-cms/core/document";
import type { FormatIssue } from "@monti-cms/core/format";
import type { IncomingReferenceItem } from "@monti-cms/core/site";
import { useSite, useTranslator, withBasePath } from "@monti-cms/core/site";
import { FormFieldLabel, Inline, Input, Stack, Text, TextLink } from "@monti-cms/ui";
import type { Editor } from "@tiptap/core";
import { FileCode, PanelLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAdminComponents, useEditorExtensions } from "../../admin-components";
import { adminEntryClient } from "../../api/entries";
import { type CmsIssue, issueLine } from "../../api/error-message";
import { findBlock } from "../../editor/block-ids";
import { CmsEditor } from "../../editor/tiptap-editor";
import { commonMessages } from "../../lib/common.messages";
import { enumCodec, usePreference } from "../../lib/hooks/use-preference";
import { useSaveShortcut } from "../../lib/hooks/use-save-shortcut";
import { AdminLink as Link, useAdminRouter } from "../../router";
import { SOURCE_ERROR_ID } from "../../source-error-id";
import { usePanelResize } from "../../ui/panel-resize";
import { entryHref } from "../shared/entry-href";
import { describeEntryStatus } from "../shared/entry-status";
import { nounVars } from "../shared/noun.messages";
import { type OpenEditor, OpenEditorContext } from "../shared/open-editor";
import { usePublishScreenContext } from "../shared/screen-context";
import { INSPECTOR_PANEL_RESIZE } from "../shared/side-panel";
import { SidePanelPane } from "../shared/side-panel-slot";
import { type EditorStatus, StatusBar } from "../shared/status-bar";
import { bodyStats } from "./body-stats";
import { EditorScroller } from "./editor-scroller";
import { EntryEditorBanners } from "./entry-editor-banners";
import { EntryEditorHeader } from "./entry-editor-header";
import { EntryEditorRecoveryDialogs } from "./entry-editor-recovery";
import { entryEditorShellMessages } from "./entry-editor-shell.messages";
import { InspectorSidePanel, TranslationSourcePanel } from "./entry-editor-side-panels";
import { EntryEditorLoadError, EntryEditorLoading } from "./entry-editor-states";
import { ToolbarToggle } from "./entry-editor-toolbar";
import { formText, titleKeyOf } from "./entry-form";
import { LanguageTabs } from "./language-tabs";
import { entriesMessages } from "./messages";
import { readOpenEntry, readOpenSelection } from "./open-editor-read";
import { SourceChangeDialog } from "./source-change-dialog";
import { useSourceSync } from "./source-sync";
import { TemplateMenu } from "./template-menu";
import { EntryEditorProvider, useEntryEditor } from "./use-entry-editor";
import { useEntryLifecycleCommands } from "./use-entry-lifecycle-commands";
import { usePublishReadiness } from "./use-publish-readiness";

interface EntryEditorShellProps {
	mode: "new" | "edit";
	initialEntryId?: string;
	collection?: string;
	/** Admin ID used in the recovery copy key. */
	adminId: string;
	/** Folder to create a new post in (location opened from the list). */
	folderId?: string | null;
}

/**
 * Width (px) of the body and its side panes below which the body takes priority: the panes close, and one opened by hand covers the body. It is what a 1024px window
 * gave the area beside the sidebar, and `entry-editor-side-panels.tsx` docks its panes at the same width (`@min-[784px]`).
 */
const NARROW_AREA_WIDTH = 784;

/** Name of the remembered source pane state in the site's browser storage (`lib/utils/site-storage.ts`). */
const SOURCE_PANE_CODEC = enumCodec(["open", "closed"] as const);

/**
 * Edit screen of a document entry. Item collections (tags, categories and the like) are edited in the small form on the list.
 */
export function EntryEditorShell({
	mode,
	initialEntryId,
	collection: propCollectionProp,
	adminId,
	folderId,
}: EntryEditorShellProps) {
	const site = useSite();
	const t = useTranslator(entryEditorShellMessages);
	const te = useTranslator(entriesMessages);
	const tc = useTranslator(commonMessages);
	const propCollection = propCollectionProp ?? site.DEFAULT_COLLECTION;
	const router = useAdminRouter();
	const editor = useEntryEditor({
		adminId,
		target:
			mode === "edit"
				? { mode: "edit", entryId: initialEntryId as string }
				: { mode: "new", collection: propCollection, folderId },
		// Change only the URL to the edit URL after the first save of a new entry, without remounting the screen.
		onSaved: (saved, { created }) => {
			if (created)
				window.history.replaceState({ ...window.history.state }, "", withBasePath(site.adminEntryEditHref(saved.id)));
		},
	});
	const { entry, collection, form, load, publishIssues, translation } = editor;
	// What the server's publish check finds in the saved draft: when the entry loads and after each save that changed it. An entry that cannot be
	// published (in the trash, archived) and one not saved yet have nothing to check.
	const readiness = usePublishReadiness({
		entryId: entry?.id,
		version: entry?.version,
		enabled: load.status === "ready" && Boolean(entry) && entry?.status !== "trashed" && entry?.status !== "archived",
	});
	const [isReadinessOpen, setIsReadinessOpen] = useState(false);
	// The form keeps the title under the name of the collection's title field.
	const titleKey = site.isCollection(collection) ? titleKeyOf(site, collection) : undefined;
	const isReadOnly = editor.readOnly;
	const isLoading = load.status === "loading";
	// A missing entry gets its own wording (the server's fix, "refresh the page", would not help); other failures keep the server's text.
	const loadError =
		load.status === "error" ? (load.error.code === "not_found" ? t("loadNotFound") : load.error.message) : null;
	const [editorMode, setEditorMode] = useState<"visual" | "source">("visual");
	const [isInspectorOpen, setIsInspectorOpen] = useState(true);
	const inspectorResize = usePanelResize(INSPECTOR_PANEL_RESIZE);
	// Whether the source pane was left open is remembered in this browser (a per-device preference); a narrow window closes it for as long as it stays narrow.
	const [sourcePanePreference, setSourcePanePreference] = usePreference(
		"translation-source-pane",
		SOURCE_PANE_CODEC,
		"open",
	);
	const [narrowClosedSourcePane, setNarrowClosedSourcePane] = useState(false);
	const isSourcePaneOpen = sourcePanePreference === "open" && !narrowClosedSourcePane;
	const [isSourceCompareOpen, setIsSourceCompareOpen] = useState(false);
	// The two scrolling columns of a translation, as elements: the source sync starts once both are on screen.
	const [editorScroller, setEditorScroller] = useState<HTMLDivElement | null>(null);
	const [sourcePane, setSourcePane] = useState<HTMLElement | null>(null);
	const [pendingFieldPath, setPendingFieldPath] = useState<string | null>(null);
	const [incoming, setIncoming] = useState<{ items: IncomingReferenceItem[]; loading: boolean; error: string | null }>({
		items: [],
		loading: false,
		error: null,
	});

	// An item collection (tags, categories and the like) is edited in the small form on the list: the editor says so, and this screen moves there.
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs once per redirect
	useEffect(() => {
		if (load.status !== "redirect") return;
		router.replace(
			load.entryId ? entryHref(site, load.collection, load.entryId) : site.adminHref(`?collection=${load.collection}`),
		);
	}, [load]);

	const visualEditorRef = useRef<Editor | null>(null);

	// The source toggle exists only when a source panel is registered (`sourcePanels`). With several, the first registered is used.
	const sourcePanel = useAdminComponents().sourcePanels?.[0];
	// A body that could not be read (one `unparsed` node) is not opened in visual mode. Opening it would show it as a box the user cannot edit, and
	// it can be fixed in source mode or saved as is.
	const canUseVisual = !isUnparsedDocument(form.doc);
	const isSourceMode = sourcePanel !== undefined && (editorMode === "source" || !canUseVisual);
	// What the source panel found about the text as it was typed (parse errors). The body itself says whether it could be read.
	const [sourceIssues, setSourceIssues] = useState<readonly FormatIssue[]>([]);
	const sourceProblems = canUseVisual ? [] : sourceIssues;
	// The block to bring the caret to when the source panel opens or is told to (from a publish problem).
	const [focusBlock, setFocusBlock] = useState<string>();
	useEffect(() => {
		// The panel takes the block when it renders with it; it is asked once.
		if (focusBlock !== undefined) setFocusBlock(undefined);
	}, [focusBlock]);

	// "Narrow" is the window below 1024px, or the area of the body and its side panes below the width above (a side panel open beside the editor takes room the window keeps).
	const [isNarrowWindow, setIsNarrowWindow] = useState(false);
	const [area, setArea] = useState<HTMLElement | null>(null);
	const [isNarrowArea, setIsNarrowArea] = useState(false);
	const isNarrowScreen = isNarrowWindow || isNarrowArea;
	useEffect(() => {
		const media = window.matchMedia?.("(max-width: 1023px)");
		if (!media) return;
		const update = () => setIsNarrowWindow(media.matches);
		update();
		media.addEventListener?.("change", update);
		return () => media.removeEventListener?.("change", update);
	}, []);
	useEffect(() => {
		if (!area || typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(([entry]) => {
			const width = entry?.contentRect.width ?? 0;
			setIsNarrowArea(width > 0 && width < NARROW_AREA_WIDTH);
		});
		observer.observe(area);
		return () => observer.disconnect();
	}, [area]);
	// When it gets narrow, the body takes priority.
	useEffect(() => {
		if (!isNarrowScreen) return;
		setIsInspectorOpen(false);
		setNarrowClosedSourcePane(true);
	}, [isNarrowScreen]);

	const toggleSourcePane = (open: boolean) => {
		setNarrowClosedSourcePane(false);
		setSourcePanePreference(open ? "open" : "closed");
	};

	const translationSource = translation?.source ?? null;
	/** The source the translator last confirmed. If it differs from the current source, "source changed" is shown. */
	const confirmed = translation?.confirmed;
	const sourceChanged = translation?.sourceChanged ?? false;

	useSourceSync({
		enabled: translationSource !== null && isSourcePaneOpen,
		syncScroll: !isSourceMode,
		editor: editorScroller,
		pane: sourcePane,
	});

	// Edit screen extensions (plugin toolbar and block actions, e.g. AI translation). For the same language, pass the same object so the actions are not recreated.
	const sourceLocale = translationSource?.locale;
	const targetLocale = entry?.locale;
	const translateLocales = useMemo(
		() => (sourceLocale && targetLocale ? { sourceLocale: sourceLocale, targetLocale: targetLocale } : null),
		[sourceLocale, targetLocale],
	);
	const formRef = useRef(form);
	formRef.current = form;
	// Where the admin is, for the side panel; and the editor itself, which the panel reads when its tools ask (the form as it is then, not as it was at render).
	usePublishScreenContext({ screen: "entry", collection: collection || undefined, entryId: entry?.id });
	const latestRef = useRef({ editor, collection });
	latestRef.current = { editor, collection };
	const openEditor = useMemo<OpenEditor>(
		() => ({
			readEntry: () => {
				const latest = latestRef.current;
				return readOpenEntry({
					form: latest.editor.form,
					entry: latest.editor.entry,
					collection: latest.collection,
					hasUnsavedChanges: latest.editor.getSnapshot().hasUnsavedChanges,
				});
			},
			readSelection: () => readOpenSelection(visualEditorRef.current),
		}),
		[],
	);
	const getEntry = useCallback(
		() => ({
			title: titleKey ? formText(formRef.current, titleKey) : "",
			collection,
			...(entry?.locale ? { locale: entry.locale } : {}),
			...(entry?.id ? { entryId: entry.id } : {}),
		}),
		[collection, titleKey, entry?.locale, entry?.id],
	);
	const extensions = useEditorExtensions({ translateLocales, getEntry });

	const refreshIncoming = useCallback(
		async (targetId: string) => {
			setIncoming((current) => ({ ...current, loading: true, error: null }));
			try {
				const data = await adminEntryClient(site).relations(targetId);
				setIncoming({ items: data.incomingReferences ?? [], loading: false, error: null });
			} catch {
				setIncoming({ items: [], loading: false, error: t("usagesFailed") });
			}
		},
		[site, t],
	);
	// The usages of an entry are read when it has loaded, and again when its status changes (and after a publish, below).
	const entryId = entry?.id;
	const entryStatus = entry?.status;
	// biome-ignore lint/correctness/useExhaustiveDependencies: a status change reloads the usages
	useEffect(() => {
		if (load.status === "ready" && entryId) void refreshIncoming(entryId);
	}, [load.status, entryId, entryStatus, refreshIncoming]);

	// Shown beside a field a translation shares with the original: where to change it.
	const lockedNote = useMemo(
		() =>
			entry?.source ? (
				<>
					{te("inspector.source", { locale: site.localeLabel(entry.source.locale) })}{" "}
					<TextLink tone="accent" render={<Link href={site.adminEntryEditHref(entry.source.id)} />}>
						{te("inspector.sourceLink")}
					</TextLink>
				</>
			) : undefined,
		[entry?.source, site.adminEntryEditHref, site.localeLabel, te],
	);

	/** Selects the start of a block in the visual editor and scrolls to it. False when the editor does not have that block. */
	const revealBlock = (blockId: string): boolean => {
		const visual = visualEditorRef.current;
		if (!visual || visual.isDestroyed) return false;
		const pos = findBlock(visual.state.doc, blockId);
		if (pos === undefined) return false;
		visual
			.chain()
			.focus()
			.setTextSelection(Math.min(pos + 1, visual.state.doc.content.size))
			.scrollIntoView()
			.run();
		return true;
	};

	const focusIssue = (issue: CmsIssue) => {
		if (titleKey !== undefined && issue.path === titleKey) {
			if (isNarrowScreen) setIsInspectorOpen(false);
			setPendingFieldPath("title-canvas");
			return;
		}
		if (issue.position || issue.path === "body" || issue.path === "frontmatter") {
			if (isNarrowScreen) setIsInspectorOpen(false);
			// In the visual editor, go to the block the issue is in (found by its id); otherwise to the block in the source text.
			if (!isSourceMode && issue.position?.blockId && revealBlock(issue.position.blockId)) return;
			if (!sourcePanel) return;
			setFocusBlock(issue.position?.blockId);
			setEditorMode("source");
			return;
		}
		if (issue.path) {
			setPendingFieldPath(issue.path);
			setIsInspectorOpen(true);
		}
	};

	// For property fields, the properties panel opens that tab and moves focus. Here only the title above the body is handled.
	useEffect(() => {
		if (pendingFieldPath !== "title-canvas") return;
		const control = document.getElementById("cms-title-canvas");
		if (control) {
			control.focus();
			setPendingFieldPath(null);
		}
	}, [pendingFieldPath]);

	/**
	 * Only an explicit publish saves the current input. Other actions ask to save first if there is unsaved input.
	 * The hint shows near where it was pressed. For header buttons and menus it is a toast (default); for dialogs, inside the dialog.
	 */

	const commands = useEntryLifecycleCommands({
		editor,
		incomingItems: incoming.items,
		refreshIncoming,
		focusIssue,
		sourceChanged,
		// A refused publish shows what it found in the readiness popup, which lists each problem and goes to its place.
		onPublishBlocked: (issues) => {
			readiness.setBlocked(issues);
			setIsReadinessOpen(true);
		},
	});

	// Cmd/Ctrl+S saves immediately.
	useSaveShortcut(() => void commands.handleSaveNow());

	// What the status bar shows of the entry: when the server last confirmed it (read from the entry on load, stamped when a save finishes), and the body's size.
	const { saveStatus } = editor;
	const [savedAt, setSavedAt] = useState<number | null>(null);
	const wasSaving = useRef(false);
	// biome-ignore lint/correctness/useExhaustiveDependencies: a finished save (the version moves) stamps the time again
	useEffect(() => {
		if (saveStatus === "saved") {
			const loaded = !wasSaving.current && entry?.changedAt ? Date.parse(entry.changedAt) : Number.NaN;
			setSavedAt(Number.isNaN(loaded) ? Date.now() : loaded);
		}
		wasSaving.current = saveStatus === "saving";
	}, [saveStatus, entry?.version]);
	const stats = useMemo(() => bodyStats(form.doc), [form.doc]);

	if (isLoading) return <EntryEditorLoading />;
	if (loadError) return <EntryEditorLoadError message={loadError} />;

	const statusLabel = entry ? describeEntryStatus(site, entry) : t("newEntry", nounVars(site, collection));
	const barStatus: EditorStatus = {
		saveStatus,
		savedAt,
		statusLabel,
		charCount: stats.chars,
		readingMinutes: stats.minutes,
		bodyStats: {
			charsWithSpaces: stats.charsWithSpaces,
			words: stats.words,
			paragraphs: stats.paragraphs,
			headings: stats.headings,
		},
		backupAvailable: editor.recoveryCopyAvailable,
		recovery: editor.recovery
			? { restore: editor.restoreRecovery, discard: () => void editor.discardRecovery() }
			: null,
		translations:
			site.ADMIN_TRANSLATIONS && entry && !site.isItemCollection(collection)
				? (entry.translations ?? []).map((member) => ({
						id: member.id,
						locale: member.locale,
						status: member.status,
						current: member.id === entry.id,
					}))
				: null,
		save: () => void commands.handleSaveNow(),
		publishReadiness:
			entry && (readiness.result || readiness.checking)
				? {
						result: readiness.result,
						checking: readiness.checking,
						stale: saveStatus !== "saved",
						recheck: readiness.recheck,
						focus: focusIssue,
						open: isReadinessOpen,
						onOpenChange: setIsReadinessOpen,
					}
				: null,
		textIssues: extensions.textIssues,
	};
	const bodyIssue = publishIssues.find((issue) => issue.path === "body" || Boolean(issue.position));
	const titleIssue = publishIssues.find((issue) => issue.path === titleKey);
	const languageTabs =
		site.ADMIN_TRANSLATIONS && entry && !site.isItemCollection(collection) ? (
			<LanguageTabs
				entry={entry}
				disabled={isReadOnly}
				onBeforeCreate={async () => !editor.getSnapshot().hasUnsavedChanges}
				onTrashTranslation={() => commands.confirmLifecycle("trash")}
			/>
		) : null;
	// The title field is the one with the title role. The label is decided by the site.
	const titleLabel =
		(site.isCollection(collection) ? site.titleField(collection).field.label : undefined) ?? t("title");
	const titleInput = (
		<>
			<FormFieldLabel htmlFor="cms-title-canvas" hidden>
				{titleLabel}
			</FormFieldLabel>
			<Input
				id="cms-title-canvas"
				value={titleKey ? formText(form, titleKey) : ""}
				readOnly={isReadOnly}
				aria-invalid={Boolean(titleIssue) || undefined}
				aria-describedby={titleIssue ? "cms-title-error" : undefined}
				onChange={(event) => titleKey && editor.setForm({ [titleKey]: event.target.value })}
				placeholder={translationSource?.title || tc("untitled")}
				size="display"
				appearance="inline"
			/>
			{titleIssue && (
				<Text as="p" id="cms-title-error" tone="danger">
					{issueLine(titleIssue)}
				</Text>
			)}
		</>
	);
	const sourcePaneToggle = translationSource && (
		<ToolbarToggle
			label={te("source")}
			text={te("source")}
			icon={PanelLeft}
			pressed={isSourcePaneOpen}
			onPressedChange={toggleSourcePane}
		/>
	);
	const sourceModeToggle = sourcePanel && (
		<ToolbarToggle
			label={sourcePanel.label}
			icon={FileCode}
			pressed={isSourceMode}
			// A body that could not be read cannot return to visual mode.
			disabled={isSourceMode && !canUseVisual}
			onPressedChange={(pressed) => setEditorMode(pressed ? "source" : "visual")}
		/>
	);
	const sourceEditor = sourcePanel && (
		<>
			<sourcePanel.Panel
				doc={form.doc}
				onChange={(doc, issues) => {
					setSourceIssues(issues);
					editor.setBody(doc);
				}}
				focusBlock={focusBlock}
				readOnly={isReadOnly}
				onComposing={editor.setComposing}
			/>
			{bodyIssue && (
				<Text as="p" id={SOURCE_ERROR_ID} tone="danger">
					{issueLine(bodyIssue)}
				</Text>
			)}
		</>
	);

	return (
		<EntryEditorProvider editor={editor} lockedNote={lockedNote}>
			<OpenEditorContext.Provider value={openEditor}>
				<Stack gap="none" height="screen" overflow="clip" background="page">
					<EntryEditorHeader
						editor={editor}
						commands={commands}
						isInspectorOpen={isInspectorOpen}
						onToggleInspector={() => setIsInspectorOpen((open) => !open)}
					/>

					<EntryEditorBanners
						editor={editor}
						visualUnavailable={!canUseVisual && Boolean(sourcePanel)}
						sourceProblem={sourceProblems[0]}
						sourceChanged={sourceChanged && Boolean(translationSource)}
						onCompareSource={() => setIsSourceCompareOpen(true)}
					/>

					<Inline align="stretch" gap="none" grow minHeight={0} overflow="hidden" position="relative">
						{/* The body and its side panes. They size by this area's width, not the window's: a panel beside it takes room the window does not lose. */}
						<Inline
							ref={setArea}
							container
							align="stretch"
							gap="none"
							grow
							minWidth={0}
							minHeight={0}
							overflow="hidden"
							position="relative"
						>
							{translationSource && isSourcePaneOpen && (
								<TranslationSourcePanel
									source={translationSource}
									paneRef={setSourcePane}
									onClose={() => toggleSourcePane(false)}
								/>
							)}
							<EditorScroller
								scrollerRef={setEditorScroller}
								highlightActive={Boolean(translationSource)}
								inert={(isInspectorOpen || (Boolean(translationSource) && isSourcePaneOpen)) && isNarrowScreen}
							>
								<CmsEditor
									doc={form.doc}
									allowed={site.isCollection(collection) ? site.schemaOf(collection).allowed : undefined}
									titleField={
										<>
											{languageTabs}
											{titleInput}
										</>
									}
									toolbarAside={
										<Inline gap="tight">
											{site.ADMIN_TEMPLATES && (
												<TemplateMenu currentDoc={form.doc} disabled={isReadOnly} onApply={editor.setBody} />
											)}
											{extensions.toolbar}
											{sourcePaneToggle}
											{sourceModeToggle}
										</Inline>
									}
									sourceView={isSourceMode ? sourceEditor : undefined}
									editable={!isReadOnly}
									onChange={editor.setBody}
									blockActions={extensions.blockActions.length > 0 ? extensions.blockActions : undefined}
									selectionActions={extensions.selectionActions}
									insertActions={extensions.insertActions}
									onEditor={(editor) => {
										visualEditorRef.current = editor;
										extensions.onEditor?.(editor);
									}}
									onCompositionStart={() => editor.setComposing(true)}
									onCompositionEnd={() => editor.setComposing(false)}
								/>
								{extensions.overlay}
							</EditorScroller>

							{isInspectorOpen && (
								<InspectorSidePanel
									editor={editor}
									resize={inspectorResize}
									incomingItems={incoming.items}
									isLoadingIncoming={incoming.loading}
									onRefreshIncoming={(id) => void refreshIncoming(id)}
									onClose={() => setIsInspectorOpen(false)}
									focusPath={pendingFieldPath !== "title-canvas" ? pendingFieldPath : null}
									onFocused={() => setPendingFieldPath(null)}
								/>
							)}
						</Inline>
						<SidePanelPane />
					</Inline>

					<StatusBar
						context={{
							screen: "entry",
							collection,
							...(entry?.id ? { entryId: entry.id } : {}),
							locale: entry?.locale ?? site.DEFAULT_LOCALE,
							editor: barStatus,
						}}
					/>

					<EntryEditorRecoveryDialogs editor={editor} />

					{commands.confirmDialog}
					{translationSource && (
						<SourceChangeDialog
							open={isSourceCompareOpen}
							onOpenChange={setIsSourceCompareOpen}
							before={confirmed?.baseDoc}
							after={translationSource.doc}
						/>
					)}
				</Stack>
			</OpenEditorContext.Provider>
		</EntryEditorProvider>
	);
}
