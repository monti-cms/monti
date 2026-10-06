"use client";

import {
	adminEntryEditHref,
	adminHref,
	previewHref as contentPreviewHref,
	createTranslator,
	DEFAULT_COLLECTION,
	isCollection,
	isItemCollection,
	localeLabel,
	storedField,
	withBasePath,
} from "@monti-cms/core/client";
import { isUnparsedDocument } from "@monti-cms/core/document";
import type { FormatIssue } from "@monti-cms/core/format";
import type { IncomingReferenceItem } from "@monti-cms/core/runtime";
import type { Editor } from "@tiptap/core";
import {
	Archive,
	CalendarSync,
	ChevronDown,
	ChevronLeft,
	Copy,
	Eye,
	FileCode,
	type LucideIcon,
	MoreHorizontal,
	PanelLeft,
	PanelRight,
	Save,
	SunMoon,
	Trash,
	Trash2,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useCmsAdminComponents, useEditorExtensions } from "../../admin-components";
import { findBlock } from "../../editor/block-ids";
import { CmsEditor } from "../../editor/tiptap-editor";
import { cn } from "../../lib/utils/cn";
import { SOURCE_ERROR_ID } from "../../source-error-id";
import { Alert, AlertDescription } from "../../ui/alert";
import { Button, buttonVariants } from "../../ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { FieldLabel } from "../../ui/field";
import { IconButton } from "../../ui/icon-button";
import { Input } from "../../ui/input";
import { Skeleton } from "../../ui/skeleton";
import { Toggle } from "../../ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";
import { type CmsIssue, cmsIssueMessage } from "../api-error-message";
import { ConfirmDialog, type ConfirmRequest } from "../shared/confirm-dialog";
import { entryHref } from "../shared/entry-href";
import { describeEntryStatus } from "../shared/entry-status";
import { SIDE_PANEL_WIDTH } from "../shared/side-panel";
import { cmsEntryClient } from "./entry-editor-client";
import { entryEditorShellMessages } from "./entry-editor-shell.messages";
import type { ConflictInfo, RecoveryOffer, SaveStatus } from "./entry-editor-store";
import { formText, isTranslationEntry } from "./entry-form";
import { InspectorPanel } from "./inspector-panel";
import { LanguageTabs } from "./language-tabs";
import {
	type ConfirmedLifecycleAction,
	LIFECYCLE_LABEL,
	LIFECYCLE_SUCCESS,
	type LifecycleAction,
	lifecycleConfirm,
} from "./lifecycle-confirm";
import { ConflictDialog, RecoveryDialog } from "./recovery-dialogs";
import { SourceChangeDialog } from "./source-change-dialog";
import { SourcePane } from "./source-pane";
import { useSourceSync } from "./source-sync";
import { TemplateMenu } from "./template-menu";
import { t as tc } from "./translate";
import { EntryEditorProvider, useEntryEditor } from "./use-entry-editor";

const t = createTranslator(entryEditorShellMessages);

interface EntryEditorShellProps {
	mode: "new" | "edit";
	initialEntryId?: string;
	collection?: string;
	/** Admin ID used in the recovery copy key. */
	adminId: string;
	/** Folder to create a new post in (location opened from the list). */
	folderId?: string | null;
}

const SOURCE_PANE_STORAGE_KEY = "cms:translation-source-pane";

function ToolbarAction({
	label,
	icon: Icon,
	href,
	onClick,
	disabled = false,
}: {
	label: string;
	icon: LucideIcon;
	href?: string;
	onClick?: () => void;
	disabled?: boolean;
}) {
	const className = "size-8 shrink-0 text-cms-muted-foreground";
	const icon = <Icon aria-hidden className="size-4" />;
	if (!href || disabled) {
		return (
			<IconButton label={label} side="bottom" disabled={disabled} className={className} onClick={onClick}>
				{icon}
			</IconButton>
		);
	}
	// A link stays a link (open in new tab, copy URL). Its name and tooltip match the icon buttons.
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<a
						href={href}
						target="_blank"
						rel="noopener noreferrer"
						aria-label={label}
						className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), className)}
					>
						{icon}
					</a>
				}
			/>
			<TooltipContent side="bottom">{label}</TooltipContent>
		</Tooltip>
	);
}

/** Toggle button at the end of the editor toolbar (source pane, MDX source). Name and tooltip are the same. */
function ToolbarToggle({
	label,
	text,
	icon: Icon,
	pressed,
	disabled,
	onPressedChange,
}: {
	label: string;
	/** Text next to the icon. If absent, only the icon shows (the name is the tooltip). */
	text?: string;
	icon: LucideIcon;
	pressed: boolean;
	disabled?: boolean;
	onPressedChange: (pressed: boolean) => void;
}) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Toggle
						size="sm"
						aria-label={label}
						pressed={pressed}
						disabled={disabled}
						onPressedChange={onPressedChange}
						className="gap-1.5 text-cms-muted-foreground aria-pressed:text-cms-foreground"
					/>
				}
			>
				<Icon aria-hidden className="size-4" />
				{text}
			</TooltipTrigger>
			<TooltipContent side="bottom">{label}</TooltipContent>
		</Tooltip>
	);
}

/** "Save first" hint. The same words are used wherever on the edit screen an action is blocked. */
const saveFirstMessage = (purpose: Purpose) => t("saveFirst", { purpose });

/** The action that was attempted, put into the hint when blocked. */
type Purpose = "publish" | "duplicate" | LifecycleAction;

/** Name of each save status. */
const SAVE_STATUS_LABELS: Record<SaveStatus, string> = {
	new: tc("save.new"),
	saved: tc("save.saved"),
	dirty: tc("save.dirty"),
	saving: tc("save.saving"),
	"local-only": tc("save.local-only"),
	failed: tc("save.failed"),
	conflict: tc("save.conflict"),
	"session-expired": tc("save.session-expired"),
};

/** Color of the save status dot. When adding a status, its color must be chosen here. */
const SAVE_STATUS_DOT: Record<SaveStatus, string> = {
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
function SaveStatusIndicator({ status, backupAvailable }: { status: SaveStatus; backupAvailable: boolean }) {
	const label = `${SAVE_STATUS_LABELS[status]}${backupAvailable ? "" : t("backupUnavailable")}`;
	return (
		<output
			aria-live="polite"
			aria-label={label}
			className="mr-1 flex items-center gap-1.5 text-cms-muted-foreground text-xs"
		>
			<span aria-hidden className={cn("size-2 rounded-full", SAVE_STATUS_DOT[status])} />
			<span className="hidden lg:inline">{label}</span>
		</output>
	);
}

/**
 * Edit screen of a document entry. Item collections (tags, categories and the like) are edited in the small form on the list.
 */
export function EntryEditorShell({
	mode,
	initialEntryId,
	collection: propCollection = DEFAULT_COLLECTION,
	adminId,
	folderId,
}: EntryEditorShellProps) {
	const router = useRouter();
	const { resolvedTheme, setTheme } = useTheme();
	const editor = useEntryEditor({
		formats: useCmsAdminComponents().formats,
		adminId,
		target:
			mode === "edit"
				? { mode: "edit", entryId: initialEntryId as string }
				: { mode: "new", collection: propCollection, folderId },
		// Change only the URL to the edit URL after the first save of a new entry, without remounting the screen.
		onSaved: (saved, { created }) => {
			if (created)
				window.history.replaceState({ ...window.history.state }, "", withBasePath(adminEntryEditHref(saved.id)));
		},
	});
	const { entry, collection, form, load, busy, saveStatus, publishIssues, recovery, conflict, translation } = editor;
	const isReadOnly = editor.readOnly;
	const isLoading = load.status === "loading";
	const loadError = load.status === "error" ? load.error.message : null;
	const [editorMode, setEditorMode] = useState<"visual" | "source">("visual");
	const [isInspectorOpen, setIsInspectorOpen] = useState(true);
	const [isNarrowScreen, setIsNarrowScreen] = useState(false);
	const [isSourcePaneOpen, setIsSourcePaneOpen] = useState(true);
	const [isSourceCompareOpen, setIsSourceCompareOpen] = useState(false);
	const editorScrollRef = useRef<HTMLDivElement>(null);
	const sourcePaneRef = useRef<HTMLElement>(null);
	/** Publish saves first. While that save runs, the header buttons are disabled and the label changes like during the publish request itself. */
	const [isPreparingPublish, setIsPreparingPublish] = useState(false);
	const isPublishing = busy === "publish" || isPreparingPublish;
	const isSubmitting = busy !== null || isPreparingPublish;
	const [pendingFieldPath, setPendingFieldPath] = useState<string | null>(null);
	// Closing a dialog hides it without answering it: the editor keeps the recovery copy and the conflict until they are resolved.
	const [dismissedRecovery, setDismissedRecovery] = useState<RecoveryOffer | null>(null);
	const [dismissedConflict, setDismissedConflict] = useState<ConflictInfo | null>(null);
	const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
	const [incoming, setIncoming] = useState<{ items: IncomingReferenceItem[]; loading: boolean; error: string | null }>({
		items: [],
		loading: false,
		error: null,
	});

	const isTrashed = entry?.status === "trashed";

	// An item collection (tags, categories and the like) is edited in the small form on the list: the editor says so, and this screen moves there.
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs once per redirect
	useEffect(() => {
		if (load.status !== "redirect") return;
		router.replace(
			(load.entryId ? entryHref(load.collection, load.entryId) : adminHref(`?collection=${load.collection}`)) as Route,
		);
	}, [load]);

	const visualEditorRef = useRef<Editor | null>(null);

	// The source toggle exists only when a source panel is registered (`sourcePanels`). With several, the first registered is used.
	const sourcePanel = useCmsAdminComponents().sourcePanels?.[0];
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

	useEffect(() => {
		const media = window.matchMedia?.("(max-width: 1023px)");
		if (!media) return;
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

	// Whether the source pane was left open is remembered in the browser. If storage is unavailable, it always starts open.
	useEffect(() => {
		try {
			if (window.localStorage.getItem(SOURCE_PANE_STORAGE_KEY) === "closed") setIsSourcePaneOpen(false);
		} catch {
			// If storage is unavailable, use the default.
		}
	}, []);
	const toggleSourcePane = (open: boolean) => {
		setIsSourcePaneOpen(open);
		try {
			window.localStorage.setItem(SOURCE_PANE_STORAGE_KEY, open ? "open" : "closed");
		} catch {
			// The screen still changes even if it cannot be remembered.
		}
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
	const translateLocales = useMemo(
		() => (sourceLocale && targetLocale ? { sourceLocale: sourceLocale, targetLocale: targetLocale } : null),
		[sourceLocale, targetLocale],
	);
	const formRef = useRef(form);
	formRef.current = form;
	const getEntry = useCallback(
		() => ({
			title: formText(formRef.current, "title"),
			collection,
			...(entry?.locale ? { locale: entry.locale } : {}),
			...(entry?.id ? { entryId: entry.id } : {}),
		}),
		[collection, entry?.locale, entry?.id],
	);
	const extensions = useEditorExtensions({ translateLocales, getEntry });

	const refreshIncoming = useCallback(async (targetId: string) => {
		setIncoming((current) => ({ ...current, loading: true, error: null }));
		try {
			const data = await cmsEntryClient.relations(targetId);
			setIncoming({ items: data.incomingReferences ?? [], loading: false, error: null });
		} catch {
			setIncoming({ items: [], loading: false, error: t("usagesFailed") });
		}
	}, []);
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
					{tc("inspector.source", { locale: localeLabel(entry.source.locale) })}{" "}
					<Link
						href={adminEntryEditHref(entry.source.id) as Route}
						className="text-cms-primary underline-offset-2 hover:underline"
					>
						{tc("inspector.sourceLink")}
					</Link>
				</>
			) : undefined,
		[entry?.source],
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
		if (issue.path === "title") {
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
	const ensureSaved = async (
		purpose: Purpose,
		{ saveChanges = false, report = toast.error }: { saveChanges?: boolean; report?: (message: string) => void } = {},
	) => {
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
			report(saveFirstMessage(purpose));
			return null;
		}
		return id;
	};

	const handleSaveNow = async () => {
		if (isReadOnly) return;
		const saved = await editor.save();
		if (saved.ok) toast.success(t("saved"));
		// On failure, always show the reason (a conflict opens its own conflict dialog).
		else if (saved.error.code !== "conflict") toast.error(saved.error.message || tc("saveFailed"));
	};

	/**
	 * Preview renders the server draft. If there are unsaved changes, save first, then open.
	 * To avoid the popup blocker while waiting for the save, the window is opened as soon as the button is pressed.
	 */
	const handlePreview = async (href: string) => {
		const opened = window.open("about:blank", "_blank");
		if (opened) opened.opener = null;
		const saved = isReadOnly ? null : await editor.save();
		if (!saved || saved.ok) {
			if (opened) opened.location.href = href;
			else window.open(href, "_blank", "noopener");
			return;
		}
		opened?.close();
		toast.error(`${t("previewNotOpened")} ${saved.error.message}`.trim());
	};

	const handlePublish = async ({ resetPublishedAt = false }: { resetPublishedAt?: boolean } = {}) => {
		if (isSubmitting || isReadOnly) return;
		// A field filled from the body (`fillFromBody`) that is empty is generated from the body and shown. If there is no body to generate from, it must be entered by hand.
		const filled = editor.fillFromBody();
		if (!filled.ok) {
			toast.error(filled.error.message);
			return;
		}
		for (const { label } of filled.value) toast.message(t("fillDone", { label }));
		// This does not block. It only warns when leaving with unconfirmed source changes.
		if (sourceChanged) toast.warning(t("sourceUnreviewed"));
		setIsPreparingPublish(true);
		try {
			const id = await ensureSaved("publish", { saveChanges: true });
			if (!id) return;
			const published = await editor.publish({ resetPublishedAt });
			if (!published.ok) {
				// A conflict opens its own conflict dialog.
				if (published.error.code === "conflict") return;
				if (published.error.issues?.length) toast.error(t("publishBlocked"));
				else toast.error(published.error.message);
				return;
			}
			void refreshIncoming(id);
			const { warnings } = published.value;
			if (warnings.length > 0) {
				toast.warning(t("publishedWithWarnings", { count: warnings.length }), {
					description: warnings.slice(0, 5).map(cmsIssueMessage).join("\n"),
					duration: 10000,
					action: warnings[0]?.position
						? { label: t("go"), onClick: () => focusIssue(warnings[0] as CmsIssue) }
						: undefined,
				});
			} else {
				toast.success(t("published"));
			}
		} finally {
			setIsPreparingPublish(false);
		}
	};

	/** Archive, unarchive, trash, restore. */
	const runLifecycle = async (action: LifecycleAction) => {
		if (!entry || isSubmitting) return;
		if (action !== "restore" && editor.getSnapshot().hasUnsavedChanges) {
			toast.error(saveFirstMessage(action));
			return;
		}
		const changed = await editor.changeStatus(action);
		if (!changed.ok) {
			toast.error(changed.error.message);
			return;
		}
		toast.success(LIFECYCLE_SUCCESS[action]);
		// Sending a translation to the trash returns to the original's edit screen.
		if (changed.value.openEntryId) router.push(adminEntryEditHref(changed.value.openEntryId) as Route);
	};

	/** Only transitions that take a published post down (archive, move to trash) ask. Unarchive and restore happen right away. */
	const confirmLifecycle = (action: ConfirmedLifecycleAction) => {
		setConfirm({ ...lifecycleConfirm(action, entry, incoming.items), onConfirm: () => runLifecycle(action) });
	};

	const confirmPermanentDelete = () => {
		if (!entry) return;
		setConfirm({
			title: t("permanentDelete"),
			description: t("permanentDeleteAsk"),
			confirmLabel: t("permanentDelete"),
			destructive: true,
			onConfirm: async () => {
				const deleted = await editor.deletePermanently();
				if (!deleted.ok) {
					toast.error(deleted.error.message);
					return;
				}
				router.push(adminHref(`?collection=${entry.collection}&status=trashed`) as Route);
			},
		});
	};

	const handleDuplicate = async () => {
		const id = await ensureSaved("duplicate");
		if (!id) return;
		const copy = await editor.duplicate();
		if (!copy.ok) {
			toast.error(copy.error.message);
			return;
		}
		router.push(adminEntryEditHref(copy.value.id) as Route);
	};

	// A translation can share a slug with the original, so the language is passed along.
	const previewPath = entry ? contentPreviewHref(collection, entry.workingSlug, entry.locale) : null;
	// This is a URL opened in a new tab, so Next does not prepend `basePath`.
	const previewHref = previewPath === null ? null : withBasePath(previewPath);

	// Cmd/Ctrl+S saves immediately. Re-registered so it uses the latest state on every render.
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (!(event.metaKey || event.ctrlKey) || event.altKey || event.isComposing) return;
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
		return (
			<div className="space-y-4 p-8" aria-busy>
				<span className="sr-only">{t("loadingDocument")}</span>
				<Skeleton className="h-8 w-1/2" />
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-5/6" />
			</div>
		);
	}
	if (loadError) {
		return (
			<div className="space-y-3 p-8">
				<Alert variant="danger">
					<AlertDescription className="col-start-auto">{loadError}</AlertDescription>
				</Alert>
				<Link href={adminHref() as Route} className={buttonVariants({ variant: "outline" })}>
					{t("backToList")}
				</Link>
			</div>
		);
	}

	const statusLabel = entry ? describeEntryStatus(entry) : t("newEntry");
	const canRetry = ["failed", "local-only", "session-expired"].includes(saveStatus);
	const bodyIssue = publishIssues.find((issue) => issue.path === "body" || Boolean(issue.position));
	const titleIssue = publishIssues.find((issue) => issue.path === "title");
	const languageTabs =
		entry && !isItemCollection(collection) ? (
			<LanguageTabs
				entry={entry}
				disabled={isReadOnly}
				onBeforeCreate={async () => !editor.getSnapshot().hasUnsavedChanges}
				onTrashTranslation={() => confirmLifecycle("trash")}
			/>
		) : null;
	// The title field is the library-convention `title` field. The label is decided by the site.
	const titleLabel =
		(isCollection(collection) ? storedField(collection, "title")?.field.label : undefined) ?? t("title");
	const titleInput = (
		<>
			<FieldLabel htmlFor="cms-title-canvas" className="sr-only">
				{titleLabel}
			</FieldLabel>
			<Input
				id="cms-title-canvas"
				value={form.title}
				readOnly={isReadOnly}
				aria-invalid={Boolean(titleIssue) || undefined}
				aria-describedby={titleIssue ? "cms-title-error" : undefined}
				onChange={(event) => editor.setForm({ title: event.target.value })}
				placeholder={translationSource?.title || tc("untitled")}
				className="h-auto w-full rounded-none border-0 bg-transparent cms-dark:bg-transparent px-6 py-1 font-semibold text-[34px] leading-tight tracking-tight shadow-none placeholder:text-cms-muted-foreground/40 focus-visible:ring-0 md:text-[34px]"
			/>
			{titleIssue && (
				<p id="cms-title-error" className="text-cms-destructive text-sm">
					{cmsIssueMessage(titleIssue)}
				</p>
			)}
		</>
	);
	const sourcePaneToggle = translationSource && (
		<ToolbarToggle
			label={tc("source")}
			text={tc("source")}
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
				<p id={SOURCE_ERROR_ID} className="mt-2 text-cms-destructive text-sm">
					{cmsIssueMessage(bodyIssue)}
				</p>
			)}
		</>
	);

	return (
		<EntryEditorProvider editor={editor} lockedNote={lockedNote}>
			<div className="flex h-screen w-full flex-col overflow-hidden bg-cms-background text-cms-foreground">
				<header className="z-20 flex min-h-13 shrink-0 flex-wrap items-center justify-between gap-1 border-b bg-cms-background/95 px-3 py-2 backdrop-blur sm:flex-nowrap lg:px-4">
					<div className="flex min-w-0 items-center gap-2 text-[13px]">
						<Tooltip>
							<TooltipTrigger
								render={
									<Link
										href={adminHref(`?collection=${collection}`) as Route}
										aria-label={t("backToList")}
										className={cn(
											buttonVariants({ variant: "ghost", size: "icon-sm" }),
											"size-8 text-cms-muted-foreground",
										)}
									>
										<ChevronLeft aria-hidden className="size-4" />
									</Link>
								}
							/>
							<TooltipContent side="bottom">{t("backToList")}</TooltipContent>
						</Tooltip>
						<span className="hidden rounded bg-cms-muted px-1.5 py-0.5 text-cms-muted-foreground text-xs sm:inline-flex">
							{statusLabel}
						</span>
					</div>

					<div className="flex w-full items-center justify-end gap-1 whitespace-nowrap sm:w-auto">
						<SaveStatusIndicator status={saveStatus} backupAvailable={editor.recoveryCopyAvailable} />
						{canRetry && (
							<Button
								type="button"
								size="sm"
								variant="ghost"
								className="text-cms-muted-foreground"
								onClick={() => void editor.retry()}
							>
								{tc("retry")}
							</Button>
						)}
						{saveStatus === "session-expired" && (
							<a
								href={adminHref("/login") as Route}
								target="_blank"
								rel="noreferrer"
								className={buttonVariants({ variant: "link", size: "xs" })}
							>
								{t("signInNewWindow")}
							</a>
						)}

						<ToolbarAction
							label={t("save")}
							icon={Save}
							disabled={isReadOnly || isSubmitting || saveStatus === "saving"}
							onClick={() => void handleSaveNow()}
						/>
						{previewHref && (
							<ToolbarAction
								label={t("preview")}
								icon={Eye}
								href={editor.hasUnsavedChanges ? undefined : previewHref}
								onClick={() => void handlePreview(previewHref)}
							/>
						)}
						{/* Single-step transitions (publish, unarchive, restore) happen right away without asking. */}
						{isTrashed ? (
							<Button
								type="button"
								size="sm"
								className="ml-1"
								disabled={isSubmitting}
								onClick={() => void runLifecycle("restore")}
							>
								{busy === "status" ? t("restoring") : LIFECYCLE_LABEL.restore}
							</Button>
						) : entry?.status === "archived" ? (
							<Button
								type="button"
								size="sm"
								className="ml-1"
								disabled={isSubmitting}
								onClick={() => void runLifecycle("unarchive")}
							>
								{busy === "status" ? t("unarchiving") : LIFECYCLE_LABEL.unarchive}
							</Button>
						) : !canResetPublishedAt ? (
							<Button
								id="cms-publish"
								type="button"
								size="sm"
								className="ml-1"
								disabled={isSubmitting}
								onClick={() => void handlePublish()}
							>
								{isPublishing ? t("publishing") : t("publish")}
							</Button>
						) : (
							// For an already published post, publish and "republish with today's date" are combined into one button.
							// To look like one button, the wrapper paints the background and the two buttons are separated only by a thin line.
							<div className="ml-1 flex h-8 items-center overflow-hidden rounded-[min(var(--radius-md),10px)] bg-cms-primary text-cms-primary-foreground">
								<Button
									id="cms-publish"
									type="button"
									size="sm"
									className="h-full rounded-none bg-transparent pr-2 pl-3 hover:bg-cms-primary-foreground/10"
									disabled={isSubmitting}
									onClick={() => void handlePublish()}
								>
									{isPublishing ? t("publishing") : t("publish")}
								</Button>
								<span aria-hidden className="h-4 w-px bg-cms-primary-foreground/30" />
								<DropdownMenu>
									<IconButton
										label={t("publishOptions")}
										side="bottom"
										variant="default"
										disabled={isSubmitting}
										className="h-full w-7 rounded-none bg-transparent hover:bg-cms-primary-foreground/10 aria-expanded:bg-cms-primary-foreground/10"
										trigger={(button) => <DropdownMenuTrigger render={button} />}
									>
										<ChevronDown aria-hidden className="size-3.5" />
									</IconButton>
									<DropdownMenuContent align="end" className="w-48">
										{/* Keeping the original publish date is the default. Choose it only when re-posting an edited post as new. */}
										{canResetPublishedAt && (
											<DropdownMenuItem onClick={() => void handlePublish({ resetPublishedAt: true })}>
												<CalendarSync aria-hidden />
												{t("republish")}
											</DropdownMenuItem>
										)}
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						)}
						<span aria-hidden className="mx-1 h-4 w-px bg-cms-border" />
						<IconButton
							label={t("properties")}
							side="bottom"
							pressed={isInspectorOpen}
							className="size-8 text-cms-muted-foreground"
							onClick={() => setIsInspectorOpen((open) => !open)}
						>
							<PanelRight aria-hidden className="size-4" />
						</IconButton>
						<DropdownMenu>
							<IconButton
								label={t("more")}
								side="bottom"
								className="size-8 text-cms-muted-foreground"
								trigger={(button) => <DropdownMenuTrigger render={button} />}
							>
								<MoreHorizontal aria-hidden className="size-4" />
							</IconButton>
							<DropdownMenuContent align="end" className="w-56">
								{/* Save with the header save button and ⌘S. Not repeated in the menu. */}
								{entry && !isTrashed && (
									<>
										{/* The store refuses to duplicate a translation, so only a source can be duplicated. */}
										{!isTranslationEntry(entry) && (
											<DropdownMenuItem onClick={() => void handleDuplicate()}>
												<Copy aria-hidden />
												{t("duplicate")}
											</DropdownMenuItem>
										)}
										{(entry.status === "draft" || entry.status === "published") && (
											<DropdownMenuItem onClick={() => confirmLifecycle("archive")}>
												<Archive aria-hidden />
												{LIFECYCLE_LABEL.archive}
											</DropdownMenuItem>
										)}
									</>
								)}
								{entry && (
									<>
										{!isTrashed && <DropdownMenuSeparator />}
										{isTrashed ? (
											<DropdownMenuItem variant="destructive" onClick={confirmPermanentDelete}>
												<Trash aria-hidden />
												{t("permanentDelete")}
											</DropdownMenuItem>
										) : (
											<DropdownMenuItem variant="destructive" onClick={() => confirmLifecycle("trash")}>
												<Trash2 aria-hidden />
												{LIFECYCLE_LABEL.trash}
											</DropdownMenuItem>
										)}
									</>
								)}
								{entry && <DropdownMenuSeparator />}
								<DropdownMenuItem onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
									<SunMoon aria-hidden />
									{t("toggleTheme")}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</header>

				{isTrashed && (
					<section
						aria-label={t("trash")}
						className="flex flex-wrap items-center gap-2 border-b bg-cms-muted px-4 py-2 text-sm"
					>
						<span>{t("trashNotice")}</span>
					</section>
				)}
				{!canUseVisual && sourcePanel && (
					<output className="border-b bg-amber-500/10 px-4 py-2 text-sm">
						{t("visualUnavailable")} {sourceProblems[0] ? cmsIssueMessage(sourceProblems[0]) : ""}
					</output>
				)}
				{editor.saveError && ["failed", "session-expired"].includes(saveStatus) && (
					<p role="alert" className="border-b px-4 py-2 text-cms-destructive text-sm">
						{editor.saveError.message}
					</p>
				)}
				{publishIssues.length > 0 && (
					<ul className="max-h-36 overflow-y-auto border-b px-4 py-2 text-sm" aria-label={t("publishProblems")}>
						{publishIssues.map((issue) => (
							<li key={JSON.stringify(issue)}>
								<Button
									type="button"
									variant="link"
									size="xs"
									className="h-auto whitespace-normal px-0 text-left"
									onClick={() => focusIssue(issue)}
								>
									{cmsIssueMessage(issue)}
								</Button>
							</li>
						))}
					</ul>
				)}

				{sourceChanged && translationSource && (
					<output className="flex flex-wrap items-center gap-2 border-b bg-amber-500/10 px-4 py-1.5 text-sm">
						<span className="flex-1 font-medium cms-dark:text-amber-400 text-amber-700">{t("sourceChanged")}</span>
						<Button type="button" size="sm" variant="outline" onClick={() => setIsSourceCompareOpen(true)}>
							{t("compare")}
						</Button>
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={isReadOnly}
							onClick={editor.confirmTranslationSource}
						>
							{t("confirm")}
						</Button>
					</output>
				)}

				<div className="relative flex min-h-0 flex-1 overflow-hidden">
					{translationSource && isSourcePaneOpen && (
						<SourcePane
							ref={sourcePaneRef}
							doc={translationSource.doc}
							title={translationSource.title}
							locale={translationSource.locale}
							onClose={() => toggleSourcePane(false)}
							className="absolute inset-y-0 left-0 z-10 w-[min(100%,28rem)] shadow-lg lg:static lg:w-[45%] lg:shrink-0 lg:shadow-none"
						/>
					)}
					<div
						ref={editorScrollRef}
						// Keep the source pane and bottom padding equal so correspondence holds even when scrolled to the end.
						className="h-full min-w-0 flex-1 overflow-y-auto"
						inert={(isInspectorOpen || (Boolean(translationSource) && isSourcePaneOpen)) && isNarrowScreen}
					>
						<CmsEditor
							doc={form.doc}
							titleField={
								<>
									{languageTabs}
									{titleInput}
								</>
							}
							toolbarAside={
								<span className="flex items-center gap-1">
									<TemplateMenu currentDoc={form.doc} disabled={isReadOnly} onApply={editor.setBody} />
									{extensions.toolbar}
									{sourcePaneToggle}
									{sourceModeToggle}
								</span>
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
					</div>

					{isInspectorOpen && (
						// On narrow screens it overlays the body; on wide screens it sits beside it at a fixed width.
						<div
							className={cn(
								"absolute inset-y-0 right-0 z-20 max-w-full shadow-lg lg:static lg:z-auto lg:shrink-0 lg:shadow-none",
								SIDE_PANEL_WIDTH,
							)}
						>
							{isCollection(collection) && (
								<InspectorPanel
									incomingReferences={incoming.items}
									isLoadingIncomingReferences={incoming.loading}
									onRefreshIncomingReferences={() => {
										if (entry) void refreshIncoming(entry.id);
									}}
									onSlugChange={editor.setSlug}
									onRegenerateSlug={editor.regenerateSlug}
									onClose={() => setIsInspectorOpen(false)}
									focusPath={pendingFieldPath !== "title-canvas" ? pendingFieldPath : null}
									onFocused={() => setPendingFieldPath(null)}
								/>
							)}
						</div>
					)}
				</div>

				<RecoveryDialog
					recovery={recovery === dismissedRecovery ? null : recovery}
					onClose={() => setDismissedRecovery(recovery)}
					onKeepServer={() => void editor.discardRecovery()}
					onRestore={editor.restoreRecovery}
				/>
				<ConflictDialog
					conflict={conflict === dismissedConflict ? null : conflict}
					onClose={() => setDismissedConflict(conflict)}
					// The server version is loaded in place: the page is not reloaded.
					onReload={() =>
						void editor.reload().then((reloaded) => {
							if (!reloaded.ok) toast.error(reloaded.error.message);
						})
					}
					onOverwrite={() => void editor.overwriteWithMine()}
				/>

				<ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
				{translationSource && (
					<SourceChangeDialog
						open={isSourceCompareOpen}
						onOpenChange={setIsSourceCompareOpen}
						before={confirmed?.baseDoc}
						after={translationSource.doc}
					/>
				)}
			</div>
		</EntryEditorProvider>
	);
}
