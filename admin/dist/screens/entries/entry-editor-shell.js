"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator, withBasePath } from "@monti-cms/core/client";
import { isUnparsedDocument } from "@monti-cms/core/document";
import { FileCode, PanelLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCmsAdminComponents, useEditorExtensions } from "../../admin-components.js";
import { cmsEntryClient } from "../../api/entries.js";
import { cmsIssueMessage } from "../../api/error-message.js";
import { findBlock } from "../../editor/block-ids.js";
import { CmsEditor } from "../../editor/tiptap-editor.js";
import { commonMessages } from "../../lib/common.messages.js";
import { enumCodec, usePreference } from "../../lib/hooks/use-preference.js";
import { useSaveShortcut } from "../../lib/hooks/use-save-shortcut.js";
import { AdminLink as Link, useAdminRouter } from "../../router/index.js";
import { SOURCE_ERROR_ID } from "../../source-error-id.js";
import { FieldLabel } from "../../ui/field.js";
import { Input } from "../../ui/input.js";
import { usePanelResize } from "../../ui/panel-resize.js";
import { entryHref } from "../shared/entry-href.js";
import { describeEntryStatus } from "../shared/entry-status.js";
import { nounVars } from "../shared/noun.messages.js";
import { INSPECTOR_PANEL_RESIZE } from "../shared/side-panel.js";
import { EntryEditorBanners } from "./entry-editor-banners.js";
import { EntryEditorHeader } from "./entry-editor-header.js";
import { EntryEditorRecoveryDialogs } from "./entry-editor-recovery.js";
import { entryEditorShellMessages } from "./entry-editor-shell.messages.js";
import { InspectorSidePanel, TranslationSourcePanel } from "./entry-editor-side-panels.js";
import { EntryEditorLoadError, EntryEditorLoading } from "./entry-editor-states.js";
import { ToolbarToggle } from "./entry-editor-toolbar.js";
import { formText, titleKeyOf } from "./entry-form.js";
import { LanguageTabs } from "./language-tabs.js";
import { entriesMessages } from "./messages.js";
import { SourceChangeDialog } from "./source-change-dialog.js";
import { useSourceSync } from "./source-sync.js";
import { TemplateMenu } from "./template-menu.js";
import { EntryEditorProvider, useEntryEditor } from "./use-entry-editor.js";
import { useEntryLifecycleCommands } from "./use-entry-lifecycle-commands.js";
/** Name of the remembered source pane state in the site's browser storage (`lib/utils/site-storage.ts`). */
const SOURCE_PANE_CODEC = enumCodec(["open", "closed"]);
/**
 * Edit screen of a document entry. Item collections (tags, categories and the like) are edited in the small form on the list.
 */
export function EntryEditorShell({ mode, initialEntryId, collection: propCollectionProp, adminId, folderId, }) {
    const site = useSite();
    const t = useTranslator(entryEditorShellMessages);
    const te = useTranslator(entriesMessages);
    const tc = useTranslator(commonMessages);
    const propCollection = propCollectionProp ?? site.DEFAULT_COLLECTION;
    const router = useAdminRouter();
    const editor = useEntryEditor({
        adminId,
        target: mode === "edit"
            ? { mode: "edit", entryId: initialEntryId }
            : { mode: "new", collection: propCollection, folderId },
        // Change only the URL to the edit URL after the first save of a new entry, without remounting the screen.
        onSaved: (saved, { created }) => {
            if (created)
                window.history.replaceState({ ...window.history.state }, "", withBasePath(site.adminEntryEditHref(saved.id)));
        },
    });
    const { entry, collection, form, load, publishIssues, translation } = editor;
    // The form keeps the title under the name of the collection's title field.
    const titleKey = site.isCollection(collection) ? titleKeyOf(site, collection) : undefined;
    const isReadOnly = editor.readOnly;
    const isLoading = load.status === "loading";
    const loadError = load.status === "error" ? load.error.message : null;
    const [editorMode, setEditorMode] = useState("visual");
    const [isInspectorOpen, setIsInspectorOpen] = useState(true);
    const inspectorResize = usePanelResize(INSPECTOR_PANEL_RESIZE);
    const [isNarrowScreen, setIsNarrowScreen] = useState(false);
    // Whether the source pane was left open is remembered in this browser (a per-device preference); a narrow window closes it for as long as it stays narrow.
    const [sourcePanePreference, setSourcePanePreference] = usePreference("translation-source-pane", SOURCE_PANE_CODEC, "open");
    const [narrowClosedSourcePane, setNarrowClosedSourcePane] = useState(false);
    const isSourcePaneOpen = sourcePanePreference === "open" && !narrowClosedSourcePane;
    const [isSourceCompareOpen, setIsSourceCompareOpen] = useState(false);
    const editorScrollRef = useRef(null);
    const sourcePaneRef = useRef(null);
    const [pendingFieldPath, setPendingFieldPath] = useState(null);
    const [incoming, setIncoming] = useState({
        items: [],
        loading: false,
        error: null,
    });
    // An item collection (tags, categories and the like) is edited in the small form on the list: the editor says so, and this screen moves there.
    // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per redirect
    useEffect(() => {
        if (load.status !== "redirect")
            return;
        router.replace(load.entryId ? entryHref(site, load.collection, load.entryId) : site.adminHref(`?collection=${load.collection}`));
    }, [load]);
    const visualEditorRef = useRef(null);
    // The source toggle exists only when a source panel is registered (`sourcePanels`). With several, the first registered is used.
    const sourcePanel = useCmsAdminComponents().sourcePanels?.[0];
    // A body that could not be read (one `unparsed` node) is not opened in visual mode. Opening it would show it as a box the user cannot edit, and
    // it can be fixed in source mode or saved as is.
    const canUseVisual = !isUnparsedDocument(form.doc);
    const isSourceMode = sourcePanel !== undefined && (editorMode === "source" || !canUseVisual);
    // What the source panel found about the text as it was typed (parse errors). The body itself says whether it could be read.
    const [sourceIssues, setSourceIssues] = useState([]);
    const sourceProblems = canUseVisual ? [] : sourceIssues;
    // The block to bring the caret to when the source panel opens or is told to (from a publish problem).
    const [focusBlock, setFocusBlock] = useState();
    useEffect(() => {
        // The panel takes the block when it renders with it; it is asked once.
        if (focusBlock !== undefined)
            setFocusBlock(undefined);
    }, [focusBlock]);
    useEffect(() => {
        const media = window.matchMedia?.("(max-width: 1023px)");
        if (!media)
            return;
        const update = () => {
            setIsNarrowScreen(media.matches);
            // At 1024px and below, the body takes priority.
            if (media.matches) {
                setIsInspectorOpen(false);
                setNarrowClosedSourcePane(true);
            }
        };
        update();
        media.addEventListener?.("change", update);
        return () => media.removeEventListener?.("change", update);
    }, []);
    const toggleSourcePane = (open) => {
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
        editorRef: editorScrollRef,
        paneRef: sourcePaneRef,
    });
    // Edit screen extensions (plugin toolbar and block actions, e.g. AI translation). For the same language, pass the same object so the actions are not recreated.
    const sourceLocale = translationSource?.locale;
    const targetLocale = entry?.locale;
    const translateLocales = useMemo(() => (sourceLocale && targetLocale ? { sourceLocale: sourceLocale, targetLocale: targetLocale } : null), [sourceLocale, targetLocale]);
    const formRef = useRef(form);
    formRef.current = form;
    const getEntry = useCallback(() => ({
        title: titleKey ? formText(formRef.current, titleKey) : "",
        collection,
        ...(entry?.locale ? { locale: entry.locale } : {}),
        ...(entry?.id ? { entryId: entry.id } : {}),
    }), [collection, titleKey, entry?.locale, entry?.id]);
    const extensions = useEditorExtensions({ translateLocales, getEntry });
    const refreshIncoming = useCallback(async (targetId) => {
        setIncoming((current) => ({ ...current, loading: true, error: null }));
        try {
            const data = await cmsEntryClient(site).relations(targetId);
            setIncoming({ items: data.incomingReferences ?? [], loading: false, error: null });
        }
        catch {
            setIncoming({ items: [], loading: false, error: t("usagesFailed") });
        }
    }, [site, t]);
    // The usages of an entry are read when it has loaded, and again when its status changes (and after a publish, below).
    const entryId = entry?.id;
    const entryStatus = entry?.status;
    // biome-ignore lint/correctness/useExhaustiveDependencies: a status change reloads the usages
    useEffect(() => {
        if (load.status === "ready" && entryId)
            void refreshIncoming(entryId);
    }, [load.status, entryId, entryStatus, refreshIncoming]);
    // Shown beside a field a translation shares with the original: where to change it.
    const lockedNote = useMemo(() => entry?.source ? (_jsxs(_Fragment, { children: [te("inspector.source", { locale: site.localeLabel(entry.source.locale) }), " ", _jsx(Link, { href: site.adminEntryEditHref(entry.source.id), className: "text-cms-primary underline-offset-2 hover:underline", children: te("inspector.sourceLink") })] })) : undefined, [entry?.source, site.adminEntryEditHref, site.localeLabel, te]);
    /** Selects the start of a block in the visual editor and scrolls to it. False when the editor does not have that block. */
    const revealBlock = (blockId) => {
        const visual = visualEditorRef.current;
        if (!visual || visual.isDestroyed)
            return false;
        const pos = findBlock(visual.state.doc, blockId);
        if (pos === undefined)
            return false;
        visual
            .chain()
            .focus()
            .setTextSelection(Math.min(pos + 1, visual.state.doc.content.size))
            .scrollIntoView()
            .run();
        return true;
    };
    const focusIssue = (issue) => {
        if (titleKey !== undefined && issue.path === titleKey) {
            if (isNarrowScreen)
                setIsInspectorOpen(false);
            setPendingFieldPath("title-canvas");
            return;
        }
        if (issue.position || issue.path === "body" || issue.path === "frontmatter") {
            if (isNarrowScreen)
                setIsInspectorOpen(false);
            // In the visual editor, go to the block the issue is in (found by its id); otherwise to the block in the source text.
            if (!isSourceMode && issue.position?.blockId && revealBlock(issue.position.blockId))
                return;
            if (!sourcePanel)
                return;
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
        if (pendingFieldPath !== "title-canvas")
            return;
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
    });
    // Cmd/Ctrl+S saves immediately.
    useSaveShortcut(() => void commands.handleSaveNow());
    if (isLoading)
        return _jsx(EntryEditorLoading, {});
    if (loadError)
        return _jsx(EntryEditorLoadError, { message: loadError });
    const statusLabel = entry ? describeEntryStatus(site, entry) : t("newEntry", nounVars(site, collection));
    const bodyIssue = publishIssues.find((issue) => issue.path === "body" || Boolean(issue.position));
    const titleIssue = publishIssues.find((issue) => issue.path === titleKey);
    const languageTabs = site.ADMIN_TRANSLATIONS && entry && !site.isItemCollection(collection) ? (_jsx(LanguageTabs, { entry: entry, disabled: isReadOnly, onBeforeCreate: async () => !editor.getSnapshot().hasUnsavedChanges, onTrashTranslation: () => commands.confirmLifecycle("trash") })) : null;
    // The title field is the one with the title role. The label is decided by the site.
    const titleLabel = (site.isCollection(collection) ? site.titleField(collection).field.label : undefined) ?? t("title");
    const titleInput = (_jsxs(_Fragment, { children: [_jsx(FieldLabel, { htmlFor: "cms-title-canvas", className: "sr-only", children: titleLabel }), _jsx(Input, { id: "cms-title-canvas", value: titleKey ? formText(form, titleKey) : "", readOnly: isReadOnly, "aria-invalid": Boolean(titleIssue) || undefined, "aria-describedby": titleIssue ? "cms-title-error" : undefined, onChange: (event) => titleKey && editor.setForm({ [titleKey]: event.target.value }), placeholder: translationSource?.title || tc("untitled"), className: "h-auto w-full rounded-none border-0 bg-transparent cms-dark:bg-transparent px-6 py-1 font-semibold text-[34px] leading-tight tracking-tight shadow-none placeholder:text-cms-muted-foreground/40 focus-visible:ring-0 md:text-[34px]" }), titleIssue && (_jsx("p", { id: "cms-title-error", className: "text-cms-destructive text-sm", children: cmsIssueMessage(site, titleIssue) }))] }));
    const sourcePaneToggle = translationSource && (_jsx(ToolbarToggle, { label: te("source"), text: te("source"), icon: PanelLeft, pressed: isSourcePaneOpen, onPressedChange: toggleSourcePane }));
    const sourceModeToggle = sourcePanel && (_jsx(ToolbarToggle, { label: sourcePanel.label, icon: FileCode, pressed: isSourceMode, 
        // A body that could not be read cannot return to visual mode.
        disabled: isSourceMode && !canUseVisual, onPressedChange: (pressed) => setEditorMode(pressed ? "source" : "visual") }));
    const sourceEditor = sourcePanel && (_jsxs(_Fragment, { children: [_jsx(sourcePanel.Panel, { doc: form.doc, onChange: (doc, issues) => {
                    setSourceIssues(issues);
                    editor.setBody(doc);
                }, focusBlock: focusBlock, readOnly: isReadOnly, onComposing: editor.setComposing }), bodyIssue && (_jsx("p", { id: SOURCE_ERROR_ID, className: "mt-2 text-cms-destructive text-sm", children: cmsIssueMessage(site, bodyIssue) }))] }));
    return (_jsx(EntryEditorProvider, { editor: editor, lockedNote: lockedNote, children: _jsxs("div", { className: "flex h-screen w-full flex-col overflow-hidden bg-cms-background text-cms-foreground", children: [_jsx(EntryEditorHeader, { editor: editor, commands: commands, statusLabel: statusLabel, isInspectorOpen: isInspectorOpen, onToggleInspector: () => setIsInspectorOpen((open) => !open) }), _jsx(EntryEditorBanners, { editor: editor, visualUnavailable: !canUseVisual && Boolean(sourcePanel), sourceProblem: sourceProblems[0], onFocusIssue: focusIssue, sourceChanged: sourceChanged && Boolean(translationSource), onCompareSource: () => setIsSourceCompareOpen(true) }), _jsxs("div", { className: "relative flex min-h-0 flex-1 overflow-hidden", children: [translationSource && isSourcePaneOpen && (_jsx(TranslationSourcePanel, { source: translationSource, paneRef: sourcePaneRef, onClose: () => toggleSourcePane(false) })), _jsxs("div", { ref: editorScrollRef, 
                            // Keep the source pane and bottom padding equal so correspondence holds even when scrolled to the end.
                            className: "h-full min-w-0 flex-1 overflow-y-auto", inert: (isInspectorOpen || (Boolean(translationSource) && isSourcePaneOpen)) && isNarrowScreen, children: [_jsx(CmsEditor, { doc: form.doc, allowed: site.isCollection(collection) ? site.schemaOf(collection).allowed : undefined, titleField: _jsxs(_Fragment, { children: [languageTabs, titleInput] }), toolbarAside: _jsxs("span", { className: "flex items-center gap-1", children: [site.ADMIN_TEMPLATES && (_jsx(TemplateMenu, { currentDoc: form.doc, disabled: isReadOnly, onApply: editor.setBody })), extensions.toolbar, sourcePaneToggle, sourceModeToggle] }), sourceView: isSourceMode ? sourceEditor : undefined, editable: !isReadOnly, onChange: editor.setBody, blockActions: extensions.blockActions.length > 0 ? extensions.blockActions : undefined, selectionActions: extensions.selectionActions, insertActions: extensions.insertActions, onEditor: (editor) => {
                                        visualEditorRef.current = editor;
                                        extensions.onEditor?.(editor);
                                    }, onCompositionStart: () => editor.setComposing(true), onCompositionEnd: () => editor.setComposing(false) }), extensions.overlay] }), isInspectorOpen && (_jsx(InspectorSidePanel, { editor: editor, resize: inspectorResize, incomingItems: incoming.items, isLoadingIncoming: incoming.loading, onRefreshIncoming: (id) => void refreshIncoming(id), onClose: () => setIsInspectorOpen(false), focusPath: pendingFieldPath !== "title-canvas" ? pendingFieldPath : null, onFocused: () => setPendingFieldPath(null) }))] }), _jsx(EntryEditorRecoveryDialogs, { editor: editor }), commands.confirmDialog, translationSource && (_jsx(SourceChangeDialog, { open: isSourceCompareOpen, onOpenChange: setIsSourceCompareOpen, before: confirmed?.baseDoc, after: translationSource.doc }))] }) }));
}
