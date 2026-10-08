"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator, withBasePath } from "@monti-cms/core/client";
import { isUnparsedDocument } from "@monti-cms/core/document";
import { Archive, CalendarSync, ChevronDown, ChevronLeft, Copy, Eye, FileCode, MoreHorizontal, PanelLeft, PanelRight, Save, SunMoon, Trash, Trash2, } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useCmsAdminComponents, useEditorExtensions } from "../../admin-components.js";
import { findBlock } from "../../editor/block-ids.js";
import { CmsEditor } from "../../editor/tiptap-editor.js";
import { cn } from "../../lib/utils/cn.js";
import { readPreference, writePreference } from "../../lib/utils/site-storage.js";
import { AdminLink as Link, useAdminRouter } from "../../router/index.js";
import { SOURCE_ERROR_ID } from "../../source-error-id.js";
import { Alert, AlertDescription } from "../../ui/alert.js";
import { Button, buttonVariants } from "../../ui/button.js";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, } from "../../ui/dropdown-menu.js";
import { FieldLabel } from "../../ui/field.js";
import { IconButton } from "../../ui/icon-button.js";
import { Input } from "../../ui/input.js";
import { Skeleton } from "../../ui/skeleton.js";
import { Toggle } from "../../ui/toggle.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip.js";
import { cmsIssueMessage } from "../api-error-message.js";
import { ConfirmDialog } from "../shared/confirm-dialog.js";
import { entryHref } from "../shared/entry-href.js";
import { describeEntryStatus } from "../shared/entry-status.js";
import { nounVars } from "../shared/noun.messages.js";
import { SIDE_PANEL_WIDTH } from "../shared/side-panel.js";
import { cmsEntryClient } from "./entry-editor-client.js";
import { entryEditorShellMessages } from "./entry-editor-shell.messages.js";
import { formText, isTranslationEntry, titleKeyOf } from "./entry-form.js";
import { InspectorPanel } from "./inspector-panel.js";
import { LanguageTabs } from "./language-tabs.js";
import { lifecycleConfirm, lifecycleLabel, lifecycleSuccess, } from "./lifecycle-confirm.js";
import { entriesMessages } from "./messages.js";
import { ConflictDialog, RecoveryDialog } from "./recovery-dialogs.js";
import { SourceChangeDialog } from "./source-change-dialog.js";
import { SourcePane } from "./source-pane.js";
import { useSourceSync } from "./source-sync.js";
import { TemplateMenu } from "./template-menu.js";
import { EntryEditorProvider, useEntryEditor } from "./use-entry-editor.js";
/** Name of the remembered source pane state in the site's browser storage (`lib/utils/site-storage.ts`). */
const SOURCE_PANE_STORAGE_NAME = "translation-source-pane";
function ToolbarAction({ label, icon: Icon, href, onClick, disabled = false, }) {
    const className = "size-8 shrink-0 text-cms-muted-foreground";
    const icon = _jsx(Icon, { "aria-hidden": true, className: "size-4" });
    if (!href || disabled) {
        return (_jsx(IconButton, { label: label, side: "bottom", disabled: disabled, className: className, onClick: onClick, children: icon }));
    }
    // A link stays a link (open in new tab, copy URL). Its name and tooltip match the icon buttons.
    return (_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { render: _jsx("a", { href: href, target: "_blank", rel: "noopener noreferrer", "aria-label": label, className: cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), className), children: icon }) }), _jsx(TooltipContent, { side: "bottom", children: label })] }));
}
/** Toggle button at the end of the editor toolbar (source pane, MDX source). Name and tooltip are the same. */
function ToolbarToggle({ label, text, icon: Icon, pressed, disabled, onPressedChange, }) {
    return (_jsxs(Tooltip, { children: [_jsxs(TooltipTrigger, { render: _jsx(Toggle, { size: "sm", "aria-label": label, pressed: pressed, disabled: disabled, onPressedChange: onPressedChange, className: "gap-1.5 text-cms-muted-foreground aria-pressed:text-cms-foreground" }), children: [_jsx(Icon, { "aria-hidden": true, className: "size-4" }), text] }), _jsx(TooltipContent, { side: "bottom", children: label })] }));
}
/** "Save first" hint. The same words are used wherever on the edit screen an action is blocked. */
const saveFirstMessage = (t, purpose) => t("saveFirst", { purpose });
/** Name of each save status. */
const saveStatusLabels = (tc) => ({
    new: tc("save.new"),
    saved: tc("save.saved"),
    dirty: tc("save.dirty"),
    saving: tc("save.saving"),
    "local-only": tc("save.local-only"),
    failed: tc("save.failed"),
    conflict: tc("save.conflict"),
    "session-expired": tc("save.session-expired"),
});
/** Color of the save status dot. When adding a status, its color must be chosen here. */
const SAVE_STATUS_DOT = {
    new: "bg-cms-muted-foreground/50",
    saved: "bg-emerald-500",
    dirty: "bg-cms-muted-foreground/50",
    saving: "animate-pulse bg-amber-500",
    "local-only": "bg-cms-muted-foreground/50",
    failed: "bg-cms-destructive",
    conflict: "bg-cms-destructive",
    "session-expired": "bg-cms-destructive",
};
/** Save status in the header. On narrow screens only the dot shows, and the name is announced to screen readers. */
function SaveStatusIndicator({ status, backupAvailable }) {
    const t = useTranslator(entryEditorShellMessages);
    const tc = useTranslator(entriesMessages);
    const label = `${saveStatusLabels(tc)[status]}${backupAvailable ? "" : t("backupUnavailable")}`;
    return (_jsxs("output", { "aria-live": "polite", "aria-label": label, className: "mr-1 flex items-center gap-1.5 text-cms-muted-foreground text-xs", children: [_jsx("span", { "aria-hidden": true, className: cn("size-2 rounded-full", SAVE_STATUS_DOT[status]) }), _jsx("span", { className: "hidden lg:inline", children: label })] }));
}
/**
 * Edit screen of a document entry. Item collections (tags, categories and the like) are edited in the small form on the list.
 */
export function EntryEditorShell({ mode, initialEntryId, collection: propCollectionProp, adminId, folderId, }) {
    const site = useSite();
    const t = useTranslator(entryEditorShellMessages);
    const tc = useTranslator(entriesMessages);
    const propCollection = propCollectionProp ?? site.DEFAULT_COLLECTION;
    const router = useAdminRouter();
    const { resolvedTheme, setTheme } = useTheme();
    const editor = useEntryEditor({
        formats: useCmsAdminComponents().formats,
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
    const { entry, collection, form, load, busy, saveStatus, publishIssues, recovery, conflict, translation } = editor;
    // The form keeps the title under the name of the collection's title field.
    const titleKey = site.isCollection(collection) ? titleKeyOf(site, collection) : undefined;
    const isReadOnly = editor.readOnly;
    const isLoading = load.status === "loading";
    const loadError = load.status === "error" ? load.error.message : null;
    const [editorMode, setEditorMode] = useState("visual");
    const [isInspectorOpen, setIsInspectorOpen] = useState(true);
    const [isNarrowScreen, setIsNarrowScreen] = useState(false);
    const [isSourcePaneOpen, setIsSourcePaneOpen] = useState(true);
    const [isSourceCompareOpen, setIsSourceCompareOpen] = useState(false);
    const editorScrollRef = useRef(null);
    const sourcePaneRef = useRef(null);
    /** Publish saves first. While that save runs, the header buttons are disabled and the label changes like during the publish request itself. */
    const [isPreparingPublish, setIsPreparingPublish] = useState(false);
    const isPublishing = busy === "publish" || isPreparingPublish;
    const isSubmitting = busy !== null || isPreparingPublish;
    const [pendingFieldPath, setPendingFieldPath] = useState(null);
    // Closing a dialog hides it without answering it: the editor keeps the recovery copy and the conflict until they are resolved.
    const [dismissedRecovery, setDismissedRecovery] = useState(null);
    const [dismissedConflict, setDismissedConflict] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [incoming, setIncoming] = useState({
        items: [],
        loading: false,
        error: null,
    });
    const isTrashed = entry?.status === "trashed";
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
                setIsSourcePaneOpen(false);
            }
        };
        update();
        media.addEventListener?.("change", update);
        return () => media.removeEventListener?.("change", update);
    }, []);
    // Whether the source pane was left open is remembered in the browser, per site. If storage is unavailable, it always starts open.
    useEffect(() => {
        if (readPreference(site, SOURCE_PANE_STORAGE_NAME) === "closed")
            setIsSourcePaneOpen(false);
    }, [site]);
    const toggleSourcePane = (open) => {
        setIsSourcePaneOpen(open);
        writePreference(site, SOURCE_PANE_STORAGE_NAME, open ? "open" : "closed");
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
    const lockedNote = useMemo(() => entry?.source ? (_jsxs(_Fragment, { children: [tc("inspector.source", { locale: site.localeLabel(entry.source.locale) }), " ", _jsx(Link, { href: site.adminEntryEditHref(entry.source.id), className: "text-cms-primary underline-offset-2 hover:underline", children: tc("inspector.sourceLink") })] })) : undefined, [entry?.source, site.adminEntryEditHref, site.localeLabel, tc]);
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
    const ensureSaved = async (purpose, { saveChanges = false, report = toast.error } = {}) => {
        if (editor.getSnapshot().saveStatus === "conflict") {
            report(t("conflictFirst", { purpose }));
            return null;
        }
        if (saveChanges) {
            const saved = await editor.save();
            if (!saved.ok) {
                report(t("notSaved", { purpose, reason: saved.error.message || t("checkSaveStatus") }));
                return null;
            }
        }
        const { entryId: id, hasUnsavedChanges } = editor.getSnapshot();
        if (!id || (!saveChanges && hasUnsavedChanges)) {
            report(saveFirstMessage(t, purpose));
            return null;
        }
        return id;
    };
    const handleSaveNow = async () => {
        if (isReadOnly)
            return;
        const saved = await editor.save();
        if (saved.ok)
            toast.success(t("saved"));
        // On failure, always show the reason (a conflict opens its own conflict dialog).
        else if (saved.error.code !== "conflict")
            toast.error(saved.error.message || tc("saveFailed"));
    };
    /**
     * Preview renders the server draft. If there are unsaved changes, save first, then open.
     * To avoid the popup blocker while waiting for the save, the window is opened as soon as the button is pressed.
     */
    const handlePreview = async (href) => {
        const opened = window.open("about:blank", "_blank");
        if (opened)
            opened.opener = null;
        const saved = isReadOnly ? null : await editor.save();
        if (!saved || saved.ok) {
            if (opened)
                opened.location.href = href;
            else
                window.open(href, "_blank", "noopener");
            return;
        }
        opened?.close();
        toast.error(`${t("previewNotOpened")} ${saved.error.message}`.trim());
    };
    const handlePublish = async ({ resetPublishedAt = false } = {}) => {
        if (isSubmitting || isReadOnly)
            return;
        // A field filled from the body (`fillFromBody`) that is empty is generated from the body and shown. If there is no body to generate from, it must be entered by hand.
        const filled = editor.fillFromBody();
        if (!filled.ok) {
            toast.error(filled.error.message);
            return;
        }
        for (const { label } of filled.value)
            toast.message(t("fillDone", { label }));
        // This does not block. It only warns when leaving with unconfirmed source changes.
        if (sourceChanged)
            toast.warning(t("sourceUnreviewed"));
        setIsPreparingPublish(true);
        try {
            const id = await ensureSaved("publish", { saveChanges: true });
            if (!id)
                return;
            const published = await editor.publish({ resetPublishedAt });
            if (!published.ok) {
                // A conflict opens its own conflict dialog.
                if (published.error.code === "conflict")
                    return;
                if (published.error.issues?.length)
                    toast.error(t("publishBlocked"));
                else
                    toast.error(published.error.message);
                return;
            }
            void refreshIncoming(id);
            const { warnings } = published.value;
            if (warnings.length > 0) {
                toast.warning(t("publishedWithWarnings", { count: warnings.length }), {
                    description: warnings
                        .slice(0, 5)
                        .map((issue) => cmsIssueMessage(site, issue))
                        .join("\n"),
                    duration: 10000,
                    action: warnings[0]?.position
                        ? { label: t("go"), onClick: () => focusIssue(warnings[0]) }
                        : undefined,
                });
            }
            else {
                toast.success(t("published"));
            }
        }
        finally {
            setIsPreparingPublish(false);
        }
    };
    /** Archive, unarchive, trash, restore. */
    const runLifecycle = async (action) => {
        if (!entry || isSubmitting)
            return;
        if (action !== "restore" && editor.getSnapshot().hasUnsavedChanges) {
            toast.error(saveFirstMessage(t, action));
            return;
        }
        const changed = await editor.changeStatus(action);
        if (!changed.ok) {
            toast.error(changed.error.message);
            return;
        }
        toast.success(lifecycleSuccess(site)[action]);
        // Sending a translation to the trash returns to the original's edit screen.
        if (changed.value.openEntryId)
            router.navigate(site.adminEntryEditHref(changed.value.openEntryId));
    };
    /** Only transitions that take a published post down (archive, move to trash) ask. Unarchive and restore happen right away. */
    const confirmLifecycle = (action) => {
        setConfirm({
            ...lifecycleConfirm(site, action, entry, incoming.items, collection),
            onConfirm: () => runLifecycle(action),
        });
    };
    const confirmPermanentDelete = () => {
        if (!entry)
            return;
        setConfirm({
            title: t("permanentDelete"),
            description: t("permanentDeleteAsk", nounVars(site, collection)),
            confirmLabel: t("permanentDelete"),
            destructive: true,
            onConfirm: async () => {
                const deleted = await editor.deletePermanently();
                if (!deleted.ok) {
                    toast.error(deleted.error.message);
                    return;
                }
                router.navigate(site.adminHref(`?collection=${entry.collection}&status=trashed`));
            },
        });
    };
    const handleDuplicate = async () => {
        const id = await ensureSaved("duplicate");
        if (!id)
            return;
        const copy = await editor.duplicate();
        if (!copy.ok) {
            toast.error(copy.error.message);
            return;
        }
        router.navigate(site.adminEntryEditHref(copy.value.id));
    };
    // A translation can share a slug with the original, so the language is passed along.
    const previewPath = entry ? site.previewHref(collection, entry.workingSlug, entry.locale) : null;
    // This is a URL opened in a new tab, so Next does not prepend `basePath`.
    const previewHref = previewPath === null ? null : withBasePath(previewPath);
    // Cmd/Ctrl+S saves immediately. Re-registered so it uses the latest state on every render.
    useEffect(() => {
        const onKeyDown = (event) => {
            if (!(event.metaKey || event.ctrlKey) || event.altKey || event.isComposing)
                return;
            const key = event.key.toLowerCase();
            if (key === "s") {
                event.preventDefault();
                void handleSaveNow();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    });
    const canResetPublishedAt = Boolean(entry?.publishedAt);
    if (isLoading) {
        return (_jsxs("div", { className: "space-y-4 p-8", "aria-busy": true, children: [_jsx("span", { className: "sr-only", children: t("loadingDocument") }), _jsx(Skeleton, { className: "h-8 w-1/2" }), _jsx(Skeleton, { className: "h-4 w-full" }), _jsx(Skeleton, { className: "h-4 w-5/6" })] }));
    }
    if (loadError) {
        return (_jsxs("div", { className: "space-y-3 p-8", children: [_jsx(Alert, { variant: "danger", children: _jsx(AlertDescription, { className: "col-start-auto", children: loadError }) }), _jsx(Link, { href: site.adminHref(), className: buttonVariants({ variant: "outline" }), children: t("backToList") })] }));
    }
    const statusLabel = entry ? describeEntryStatus(site, entry) : t("newEntry", nounVars(site, collection));
    const canRetry = ["failed", "local-only", "session-expired"].includes(saveStatus);
    const bodyIssue = publishIssues.find((issue) => issue.path === "body" || Boolean(issue.position));
    const titleIssue = publishIssues.find((issue) => issue.path === titleKey);
    const languageTabs = site.ADMIN_TRANSLATIONS && entry && !site.isItemCollection(collection) ? (_jsx(LanguageTabs, { entry: entry, disabled: isReadOnly, onBeforeCreate: async () => !editor.getSnapshot().hasUnsavedChanges, onTrashTranslation: () => confirmLifecycle("trash") })) : null;
    // The title field is the one with the title role. The label is decided by the site.
    const titleLabel = (site.isCollection(collection) ? site.titleField(collection).field.label : undefined) ?? t("title");
    const titleInput = (_jsxs(_Fragment, { children: [_jsx(FieldLabel, { htmlFor: "cms-title-canvas", className: "sr-only", children: titleLabel }), _jsx(Input, { id: "cms-title-canvas", value: titleKey ? formText(form, titleKey) : "", readOnly: isReadOnly, "aria-invalid": Boolean(titleIssue) || undefined, "aria-describedby": titleIssue ? "cms-title-error" : undefined, onChange: (event) => titleKey && editor.setForm({ [titleKey]: event.target.value }), placeholder: translationSource?.title || tc("untitled"), className: "h-auto w-full rounded-none border-0 bg-transparent cms-dark:bg-transparent px-6 py-1 font-semibold text-[34px] leading-tight tracking-tight shadow-none placeholder:text-cms-muted-foreground/40 focus-visible:ring-0 md:text-[34px]" }), titleIssue && (_jsx("p", { id: "cms-title-error", className: "text-cms-destructive text-sm", children: cmsIssueMessage(site, titleIssue) }))] }));
    const sourcePaneToggle = translationSource && (_jsx(ToolbarToggle, { label: tc("source"), text: tc("source"), icon: PanelLeft, pressed: isSourcePaneOpen, onPressedChange: toggleSourcePane }));
    const sourceModeToggle = sourcePanel && (_jsx(ToolbarToggle, { label: sourcePanel.label, icon: FileCode, pressed: isSourceMode, 
        // A body that could not be read cannot return to visual mode.
        disabled: isSourceMode && !canUseVisual, onPressedChange: (pressed) => setEditorMode(pressed ? "source" : "visual") }));
    const sourceEditor = sourcePanel && (_jsxs(_Fragment, { children: [_jsx(sourcePanel.Panel, { doc: form.doc, onChange: (doc, issues) => {
                    setSourceIssues(issues);
                    editor.setBody(doc);
                }, focusBlock: focusBlock, readOnly: isReadOnly, onComposing: editor.setComposing }), bodyIssue && (_jsx("p", { id: SOURCE_ERROR_ID, className: "mt-2 text-cms-destructive text-sm", children: cmsIssueMessage(site, bodyIssue) }))] }));
    return (_jsx(EntryEditorProvider, { editor: editor, lockedNote: lockedNote, children: _jsxs("div", { className: "flex h-screen w-full flex-col overflow-hidden bg-cms-background text-cms-foreground", children: [_jsxs("header", { className: "z-20 flex min-h-13 shrink-0 flex-wrap items-center justify-between gap-1 border-b bg-cms-background/95 px-3 py-2 backdrop-blur sm:flex-nowrap lg:px-4", children: [_jsxs("div", { className: "flex min-w-0 items-center gap-2 text-[13px]", children: [_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { render: _jsx(Link, { href: site.adminHref(`?collection=${collection}`), "aria-label": t("backToList"), className: cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "size-8 text-cms-muted-foreground"), children: _jsx(ChevronLeft, { "aria-hidden": true, className: "size-4" }) }) }), _jsx(TooltipContent, { side: "bottom", children: t("backToList") })] }), _jsx("span", { className: "hidden rounded bg-cms-muted px-1.5 py-0.5 text-cms-muted-foreground text-xs sm:inline-flex", children: statusLabel })] }), _jsxs("div", { className: "flex w-full items-center justify-end gap-1 whitespace-nowrap sm:w-auto", children: [_jsx(SaveStatusIndicator, { status: saveStatus, backupAvailable: editor.recoveryCopyAvailable }), canRetry && (_jsx(Button, { type: "button", size: "sm", variant: "ghost", className: "text-cms-muted-foreground", onClick: () => void editor.retry(), children: tc("retry") })), saveStatus === "session-expired" && (_jsx("a", { href: site.adminHref("/login"), target: "_blank", rel: "noreferrer", className: buttonVariants({ variant: "link", size: "xs" }), children: t("signInNewWindow") })), _jsx(ToolbarAction, { label: t("save"), icon: Save, disabled: isReadOnly || isSubmitting || saveStatus === "saving", onClick: () => void handleSaveNow() }), previewHref && (_jsx(ToolbarAction, { label: t("preview"), icon: Eye, href: editor.hasUnsavedChanges ? undefined : previewHref, onClick: () => void handlePreview(previewHref) })), isTrashed ? (_jsx(Button, { type: "button", size: "sm", className: "ml-1", disabled: isSubmitting, onClick: () => void runLifecycle("restore"), children: busy === "status" ? t("restoring") : lifecycleLabel(site).restore })) : entry?.status === "archived" ? (_jsx(Button, { type: "button", size: "sm", className: "ml-1", disabled: isSubmitting, onClick: () => void runLifecycle("unarchive"), children: busy === "status" ? t("unarchiving") : lifecycleLabel(site).unarchive })) : !canResetPublishedAt ? (_jsx(Button, { id: "cms-publish", type: "button", size: "sm", className: "ml-1", disabled: isSubmitting, onClick: () => void handlePublish(), children: isPublishing ? t("publishing") : t("publish") })) : (_jsxs("div", { className: "ml-1 flex h-8 items-center overflow-hidden rounded-[min(var(--radius-md),10px)] bg-cms-primary text-cms-primary-foreground", children: [_jsx(Button, { id: "cms-publish", type: "button", size: "sm", className: "h-full rounded-none bg-transparent pr-2 pl-3 hover:bg-cms-primary-foreground/10", disabled: isSubmitting, onClick: () => void handlePublish(), children: isPublishing ? t("publishing") : t("publish") }), _jsx("span", { "aria-hidden": true, className: "h-4 w-px bg-cms-primary-foreground/30" }), _jsxs(DropdownMenu, { children: [_jsx(IconButton, { label: t("publishOptions"), side: "bottom", variant: "default", disabled: isSubmitting, className: "h-full w-7 rounded-none bg-transparent hover:bg-cms-primary-foreground/10 aria-expanded:bg-cms-primary-foreground/10", trigger: (button) => _jsx(DropdownMenuTrigger, { render: button }), children: _jsx(ChevronDown, { "aria-hidden": true, className: "size-3.5" }) }), _jsx(DropdownMenuContent, { align: "end", className: "w-48", children: canResetPublishedAt && (_jsxs(DropdownMenuItem, { onClick: () => void handlePublish({ resetPublishedAt: true }), children: [_jsx(CalendarSync, { "aria-hidden": true }), t("republish")] })) })] })] })), _jsx("span", { "aria-hidden": true, className: "mx-1 h-4 w-px bg-cms-border" }), _jsx(IconButton, { label: t("properties"), side: "bottom", pressed: isInspectorOpen, className: "size-8 text-cms-muted-foreground", onClick: () => setIsInspectorOpen((open) => !open), children: _jsx(PanelRight, { "aria-hidden": true, className: "size-4" }) }), _jsxs(DropdownMenu, { children: [_jsx(IconButton, { label: t("more"), side: "bottom", className: "size-8 text-cms-muted-foreground", trigger: (button) => _jsx(DropdownMenuTrigger, { render: button }), children: _jsx(MoreHorizontal, { "aria-hidden": true, className: "size-4" }) }), _jsxs(DropdownMenuContent, { align: "end", className: "w-56", children: [entry && !isTrashed && (_jsxs(_Fragment, { children: [!isTranslationEntry(entry) && (_jsxs(DropdownMenuItem, { onClick: () => void handleDuplicate(), children: [_jsx(Copy, { "aria-hidden": true }), t("duplicate")] })), (entry.status === "draft" || entry.status === "published") && (_jsxs(DropdownMenuItem, { onClick: () => confirmLifecycle("archive"), children: [_jsx(Archive, { "aria-hidden": true }), lifecycleLabel(site).archive] }))] })), entry && (_jsxs(_Fragment, { children: [!isTrashed && _jsx(DropdownMenuSeparator, {}), isTrashed ? (_jsxs(DropdownMenuItem, { variant: "destructive", onClick: confirmPermanentDelete, children: [_jsx(Trash, { "aria-hidden": true }), t("permanentDelete")] })) : (_jsxs(DropdownMenuItem, { variant: "destructive", onClick: () => confirmLifecycle("trash"), children: [_jsx(Trash2, { "aria-hidden": true }), lifecycleLabel(site).trash] }))] })), entry && _jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { onClick: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"), children: [_jsx(SunMoon, { "aria-hidden": true }), t("toggleTheme")] })] })] })] })] }), isTrashed && (_jsx("section", { "aria-label": t("trash"), className: "flex flex-wrap items-center gap-2 border-b bg-cms-muted px-4 py-2 text-sm", children: _jsx("span", { children: t("trashNotice", nounVars(site, collection)) }) })), !canUseVisual && sourcePanel && (_jsxs("output", { className: "border-b bg-amber-500/10 px-4 py-2 text-sm", children: [t("visualUnavailable"), " ", sourceProblems[0] ? cmsIssueMessage(site, sourceProblems[0]) : ""] })), editor.saveError && ["failed", "session-expired"].includes(saveStatus) && (_jsx("p", { role: "alert", className: "border-b px-4 py-2 text-cms-destructive text-sm", children: editor.saveError.message })), publishIssues.length > 0 && (_jsx("ul", { className: "max-h-36 overflow-y-auto border-b px-4 py-2 text-sm", "aria-label": t("publishProblems"), children: publishIssues.map((issue) => (_jsx("li", { children: _jsx(Button, { type: "button", variant: "link", size: "xs", className: "h-auto whitespace-normal px-0 text-left", onClick: () => focusIssue(issue), children: cmsIssueMessage(site, issue) }) }, JSON.stringify(issue)))) })), sourceChanged && translationSource && (_jsxs("output", { className: "flex flex-wrap items-center gap-2 border-b bg-amber-500/10 px-4 py-1.5 text-sm", children: [_jsx("span", { className: "flex-1 font-medium cms-dark:text-amber-400 text-amber-700", children: t("sourceChanged") }), _jsx(Button, { type: "button", size: "sm", variant: "outline", onClick: () => setIsSourceCompareOpen(true), children: t("compare") }), _jsx(Button, { type: "button", size: "sm", variant: "outline", disabled: isReadOnly, onClick: editor.confirmTranslationSource, children: t("confirm") })] })), _jsxs("div", { className: "relative flex min-h-0 flex-1 overflow-hidden", children: [translationSource && isSourcePaneOpen && (_jsx(SourcePane, { ref: sourcePaneRef, doc: translationSource.doc, title: translationSource.title, locale: translationSource.locale, onClose: () => toggleSourcePane(false), className: "absolute inset-y-0 left-0 z-10 w-[min(100%,28rem)] shadow-lg lg:static lg:w-[45%] lg:shrink-0 lg:shadow-none" })), _jsxs("div", { ref: editorScrollRef, 
                            // Keep the source pane and bottom padding equal so correspondence holds even when scrolled to the end.
                            className: "h-full min-w-0 flex-1 overflow-y-auto", inert: (isInspectorOpen || (Boolean(translationSource) && isSourcePaneOpen)) && isNarrowScreen, children: [_jsx(CmsEditor, { doc: form.doc, allowed: site.isCollection(collection) ? site.schemaOf(collection).allowed : undefined, titleField: _jsxs(_Fragment, { children: [languageTabs, titleInput] }), toolbarAside: _jsxs("span", { className: "flex items-center gap-1", children: [site.ADMIN_TEMPLATES && (_jsx(TemplateMenu, { currentDoc: form.doc, disabled: isReadOnly, onApply: editor.setBody })), extensions.toolbar, sourcePaneToggle, sourceModeToggle] }), sourceView: isSourceMode ? sourceEditor : undefined, editable: !isReadOnly, onChange: editor.setBody, blockActions: extensions.blockActions.length > 0 ? extensions.blockActions : undefined, selectionActions: extensions.selectionActions, insertActions: extensions.insertActions, onEditor: (editor) => {
                                        visualEditorRef.current = editor;
                                        extensions.onEditor?.(editor);
                                    }, onCompositionStart: () => editor.setComposing(true), onCompositionEnd: () => editor.setComposing(false) }), extensions.overlay] }), isInspectorOpen && (_jsx("div", { className: cn("absolute inset-y-0 right-0 z-20 max-w-full shadow-lg lg:static lg:z-auto lg:shrink-0 lg:shadow-none", SIDE_PANEL_WIDTH), children: site.isCollection(collection) && (_jsx(InspectorPanel, { incomingReferences: incoming.items, isLoadingIncomingReferences: incoming.loading, onRefreshIncomingReferences: () => {
                                    if (entry)
                                        void refreshIncoming(entry.id);
                                }, onSlugChange: editor.setSlug, onRegenerateSlug: editor.regenerateSlug, onClose: () => setIsInspectorOpen(false), focusPath: pendingFieldPath !== "title-canvas" ? pendingFieldPath : null, onFocused: () => setPendingFieldPath(null) })) }))] }), _jsx(RecoveryDialog, { recovery: recovery === dismissedRecovery ? null : recovery, onClose: () => setDismissedRecovery(recovery), onKeepServer: () => void editor.discardRecovery(), onRestore: editor.restoreRecovery }), _jsx(ConflictDialog, { conflict: conflict === dismissedConflict ? null : conflict, onClose: () => setDismissedConflict(conflict), 
                    // The server version is loaded in place: the page is not reloaded.
                    onReload: () => void editor.reload().then((reloaded) => {
                        if (!reloaded.ok)
                            toast.error(reloaded.error.message);
                    }), onOverwrite: () => void editor.overwriteWithMine() }), _jsx(ConfirmDialog, { request: confirm, onClose: () => setConfirm(null) }), translationSource && (_jsx(SourceChangeDialog, { open: isSourceCompareOpen, onOpenChange: setIsSourceCompareOpen, before: confirmed?.baseDoc, after: translationSource.doc }))] }) }));
}
