"use client";

import {
	adminEntryEditHref,
	adminHref,
	bodyExcerpt,
	cmsApiUrl,
	previewHref as contentPreviewHref,
	createTranslator,
	DEFAULT_COLLECTION,
	fillFromBodyFields,
	fillFromBodyLength,
	isCollection,
	isItemCollection,
	slugFieldOf,
	slugFromValues,
	storedField,
	withBasePath,
} from "@monti-cms/core/client";
import type { StoredDocument } from "@monti-cms/core/mdx";
import { analyze } from "@monti-cms/core/mdx";
import type { IncomingReferenceItem } from "@monti-cms/core/runtime";
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
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useEditorExtensions } from "../../admin-components";
import { MdxSourceEditor } from "../../editor/mdx-source-editor";
import { CmsEditor } from "../../editor/tiptap-editor";
import { cn } from "../../lib/utils/cn";
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
import { CmsApiError, cmsFetch, errorText } from "../admin-api";
import { type CmsIssue, cmsIssueMessage } from "../api-error-message";
import { ConfirmDialog, type ConfirmRequest } from "../shared/confirm-dialog";
import { entryHref } from "../shared/entry-href";
import { describeEntryStatus } from "../shared/entry-status";
import { SIDE_PANEL_WIDTH } from "../shared/side-panel";
import { entryEditorShellMessages } from "./entry-editor-shell.messages";
import {
	copyTitle,
	EMPTY_FORM,
	type EntryData,
	type EntryForm,
	type EntryFormPatch,
	formFingerprint,
	formFromEntry,
	formText,
	isTranslationEntry,
	stringifyTranslation,
	TRANSLATION_FORM_KEY,
	translationSourceOf,
	translationStateFromForm,
} from "./entry-form";
import { InspectorPanel } from "./inspector-panel";
import { LanguageTabs } from "./language-tabs";
import {
	type ConfirmedLifecycleAction,
	LIFECYCLE_FAILED,
	LIFECYCLE_LABEL,
	LIFECYCLE_SUCCESS,
	type LifecycleAction,
	lifecycleConfirm,
} from "./lifecycle-confirm";
import { backupKey, deleteLocalBackup, getLocalBackup } from "./local-backup";
import { ConflictDialog, type Recovery, RecoveryDialog } from "./recovery-dialogs";
import { SourceChangeDialog } from "./source-change-dialog";
import { SourcePane } from "./source-pane";
import { useSourceSync } from "./source-sync";
import { TemplateMenu } from "./template-menu";
import { t as tc } from "./translate";
import { SAVE_STATUS_LABELS, type SaveStatus, useEntryAutosave } from "./use-entry-autosave";

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
 * Save and publish responses carry no translation group info. Keep the values received on load and update only this content's status.
 */
function keepTranslationGroup(current: EntryData | null, next: EntryData): Pick<EntryData, "translations" | "source"> {
	const translations = (current?.translations ?? next.translations)?.map((member) =>
		member.id === next.id ? { ...member, status: next.status } : member,
	);
	return { translations, source: current?.source ?? next.source };
}

/**
 * Post and memo edit screen. Tags, categories and collections (record collections) are edited in the small form on the list.
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
	const [entry, setEntry] = useState<EntryData | null>(null);
	const [collection, setCollection] = useState(propCollection);
	const [isLoading, setIsLoading] = useState(mode === "edit");
	const [loadError, setLoadError] = useState<string | null>(null);
	const [editorMode, setEditorMode] = useState<"visual" | "source">("visual");
	const [isInspectorOpen, setIsInspectorOpen] = useState(true);
	const [isNarrowScreen, setIsNarrowScreen] = useState(false);
	const [isSourcePaneOpen, setIsSourcePaneOpen] = useState(true);
	const [isSourceCompareOpen, setIsSourceCompareOpen] = useState(false);
	const editorScrollRef = useRef<HTMLDivElement>(null);
	const sourcePaneRef = useRef<HTMLElement>(null);
	const [isSlugTouched, setIsSlugTouched] = useState(mode === "edit");
	/** What the header button does. While it runs, the button is disabled and its label changes. */
	const [busy, setBusy] = useState<"publish" | "status" | null>(null);
	const isSubmitting = busy !== null;
	const [publishIssues, setPublishIssues] = useState<CmsIssue[]>([]);
	const [pendingBodyPosition, setPendingBodyPosition] = useState<CmsIssue["position"]>();
	const [pendingFieldPath, setPendingFieldPath] = useState<string | null>(null);
	const [recovery, setRecovery] = useState<Recovery | null>(null);
	const [conflict, setConflict] = useState<{ server: EntryData; local: EntryForm } | null>(null);
	const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
	const [incoming, setIncoming] = useState<{ items: IncomingReferenceItem[]; loading: boolean; error: string | null }>({
		items: [],
		loading: false,
		error: null,
	});

	const isTrashed = entry?.status === "trashed";
	const isReadOnly = isTrashed;

	// The body the visual editor last made, as MDX and as a stored document with its block ids. Saved as the document while the form still holds that MDX.
	const editorBodyRef = useRef<{ mdx: string; doc: StoredDocument | null } | null>(null);
	const autosave = useEntryAutosave({
		adminId,
		collection,
		entry,
		initialForm: EMPTY_FORM,
		enabled: !isReadOnly,
		newEntryFolderId: folderId,
		// The save response carries no translation group info. Keep the values received on load.
		onSaved: (saved) => setEntry((current) => ({ ...saved, ...keepTranslationGroup(current, saved) })),
		onConflict: (server, local) => setConflict({ server, local }),
		documentOf: (mdx) => (editorBodyRef.current?.mdx === mdx ? editorBodyRef.current.doc : undefined),
	});
	const { form, setForm } = autosave;

	// MDX or frontmatter that cannot be parsed is not opened in visual mode. Opening it would produce an empty document, and
	// a single keystroke would overwrite the source. It can be fixed in source mode or saved as is.
	const deferredMdx = useDeferredValue(form.mdx);
	const sourceProblems = useMemo<CmsIssue[]>(() => {
		const analysis = analyze(deferredMdx);
		const problems: CmsIssue[] = analysis.errors.map((error) => ({
			code: "mdx_error",
			message: error.message,
			position: error.position,
		}));
		if (analysis.frontmatter !== null) problems.push({ code: "frontmatter_present", position: { line: 1, column: 1 } });
		return problems;
	}, [deferredMdx]);
	const canUseVisual = sourceProblems.length === 0;
	useEffect(() => {
		if (!canUseVisual && editorMode === "visual") setEditorMode("source");
	}, [canUseVisual, editorMode]);
	// The deferred value lags one render behind the loaded body. Until it has caught up once, the analysis above is about
	// the previous (empty) body, and the visual editor would mount on a body it cannot read for a frame. Wait for it
	// instead, then keep deferring while the user types (the visual editor wrote that text itself).
	const [analysisSettled, setAnalysisSettled] = useState(false);
	const isAnalysisReady = analysisSettled || deferredMdx === form.mdx;
	useEffect(() => {
		if (!isLoading && deferredMdx === form.mdx) setAnalysisSettled(true);
	}, [isLoading, deferredMdx, form.mdx]);

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

	const translationSource = translationSourceOf(entry);
	const translationForm = form[TRANSLATION_FORM_KEY];
	/** The source the translator last confirmed. If it differs from the current source, "source changed" is shown. */
	const confirmedSource = translationStateFromForm(translationForm).baseSource;
	const sourceChanged =
		translationSource !== null && typeof translationForm === "string" && translationSource.mdx !== confirmedSource;

	useSourceSync({
		enabled: translationSource !== null && isSourcePaneOpen,
		syncScroll: editorMode === "visual",
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
			const data = await cmsFetch<{ incomingReferences: IncomingReferenceItem[] }>(
				cmsApiUrl(`/v1/entries/${targetId}/relations`),
			);
			setIncoming({ items: data.incomingReferences ?? [], loading: false, error: null });
		} catch {
			setIncoming({ items: [], loading: false, error: t("usagesFailed") });
		}
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: autosave methods are ref-backed and stable
	const loadEntry = useCallback(
		async (id: string) => {
			const loaded = await cmsFetch<EntryData>(cmsApiUrl(`/v1/entries/${id}`), { fallback: t("loadFailed") });
			if (isItemCollection(loaded.collection)) {
				// Item collections (tags, categories, etc.) open in the small form on the list.
				router.replace(entryHref(loaded.collection, loaded.id) as Route);
				return null;
			}
			const loadedForm = formFromEntry(loaded);
			setEntry(loaded);
			setCollection(loaded.collection);
			autosave.resetFromServer(loaded, loadedForm);
			void refreshIncoming(loaded.id);
			return { loaded, loadedForm };
		},
		[refreshIncoming, router],
	);

	// When the edit screen opens, compare the server value with the browser recovery copy.
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs once per opened entry
	useEffect(() => {
		let cancelled = false;
		const open = async () => {
			if (mode === "new") {
				if (isItemCollection(propCollection)) {
					router.replace(adminHref(`?collection=${propCollection}`) as Route);
					return;
				}
				const backup = await getLocalBackup<EntryForm>(backupKey(adminId, null, propCollection));
				if (!cancelled && backup && backup.localFingerprint !== backup.baseFingerprint) {
					setRecovery({ kind: "restore", backup });
				}
				return;
			}
			try {
				const result = await loadEntry(initialEntryId as string);
				if (!result || cancelled) return;
				const key = backupKey(adminId, result.loaded.id, result.loaded.collection);
				const backup = await getLocalBackup<EntryForm>(key);
				if (!backup || cancelled) return;
				if (backup.localFingerprint === formFingerprint(result.loadedForm)) {
					await deleteLocalBackup(key);
				} else if (backup.baseVersion === result.loaded.version) {
					setRecovery({ kind: "restore", backup });
				} else {
					// The server also changed after the recovery copy. Tell the user that loading will overwrite it.
					setRecovery({ kind: "conflict", backup, server: result.loaded });
				}
			} catch (error) {
				if (!cancelled) setLoadError(errorText(error, t("loadFailed")));
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		};
		void open();
		return () => {
			cancelled = true;
		};
	}, [mode, initialEntryId]);

	const applyRecovered = (recovered: EntryForm) => {
		setIsSlugTouched(true);
		setForm(recovered);
		setRecovery(null);
	};

	/** If the slug was not edited by hand, regenerates it when the value that the slug field's `from` points to changes. */
	const withAutoSlug = (patch: EntryFormPatch): EntryFormPatch => {
		if (isSlugTouched || !isCollection(collection)) return patch;
		const from = slugFieldOf(collection)?.from;
		if (!from || !Object.hasOwn(patch, from)) return patch;
		return { ...patch, slug: slugFromValues(collection, { ...form, ...patch }) };
	};
	const handleTitleChange = (title: string) => setForm(withAutoSlug({ title }));

	const focusIssue = (issue: CmsIssue) => {
		if (issue.path === "title") {
			if (isNarrowScreen) setIsInspectorOpen(false);
			setPendingFieldPath("title-canvas");
			return;
		}
		if (issue.position || issue.path === "mdx" || issue.path === "frontmatter") {
			if (isNarrowScreen) setIsInspectorOpen(false);
			setPendingBodyPosition(issue.position ?? { line: 1, column: 1 });
			setEditorMode("source");
			return;
		}
		if (issue.path) {
			setPendingFieldPath(issue.path);
			setIsInspectorOpen(true);
		}
	};

	useEffect(() => {
		if (!pendingBodyPosition || editorMode !== "source") return;
		const textarea = document.getElementById("cms-mdx-source") as HTMLTextAreaElement | null;
		if (!textarea) return;
		const lines = form.mdx.split("\n");
		const offset = lines.slice(0, pendingBodyPosition.line - 1).reduce((sum, line) => sum + line.length + 1, 0);
		const index = Math.min(form.mdx.length, offset + pendingBodyPosition.column - 1);
		textarea.focus();
		textarea.setSelectionRange(index, index);
		setPendingBodyPosition(undefined);
	}, [pendingBodyPosition, editorMode, form.mdx]);

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
		if (autosave.status === "conflict") {
			report(t("conflictFirst", { purpose }));
			return null;
		}
		if (saveChanges && !(await autosave.flush())) {
			report(t("notSaved", { purpose, reason: autosave.getLastError() ?? t("checkSaveStatus") }));
			return null;
		}
		const id = autosave.getEntryId();
		if (!id || (!saveChanges && autosave.hasPendingChanges())) {
			report(saveFirstMessage(purpose));
			return null;
		}
		return id;
	};

	const handleSaveNow = async () => {
		if (isReadOnly) return;
		if (await autosave.flush()) toast.success(t("saved"));
		// On failure, always show the reason (a conflict opens its own conflict dialog).
		else if (autosave.getStatus() !== "conflict") toast.error(autosave.getLastError() ?? tc("saveFailed"));
	};

	/**
	 * Preview renders the server draft. If there are unsaved changes, save first, then open.
	 * To avoid the popup blocker while waiting for the save, the window is opened as soon as the button is pressed.
	 */
	const handlePreview = async (href: string) => {
		const opened = window.open("about:blank", "_blank");
		if (opened) opened.opener = null;
		if (isReadOnly || (await autosave.flush())) {
			if (opened) opened.location.href = href;
			else window.open(href, "_blank", "noopener");
			return;
		}
		opened?.close();
		toast.error(`${t("previewNotOpened")} ${autosave.getLastError() ?? ""}`.trim());
	};

	const handlePublish = async ({ resetPublishedAt = false }: { resetPublishedAt?: boolean } = {}) => {
		if (isSubmitting || isReadOnly) return;
		setPublishIssues([]);
		// A field filled from the body (`fillFromBody`) that is empty is generated from the body and shown. If there is no body to generate from, it must be entered by hand.
		for (const { name, field } of isCollection(collection) ? fillFromBodyFields(collection) : []) {
			if (formText(form, name).trim()) continue;
			const generated = bodyExcerpt(form.mdx, fillFromBodyLength(field));
			if (!generated) {
				setPublishIssues([{ code: "missing_field", message: field.label, path: name }]);
				toast.error(t("fillEmpty", { label: field.label }));
				return;
			}
			setForm({ [name]: generated });
			toast.message(t("fillDone", { label: field.label }));
		}
		// This does not block. It only warns when leaving with unconfirmed source changes.
		if (sourceChanged) toast.warning(t("sourceUnreviewed"));
		setBusy("publish");
		try {
			const id = await ensureSaved("publish", { saveChanges: true });
			if (!id) return;
			const published = await cmsFetch<EntryData & { warnings?: CmsIssue[] }>(cmsApiUrl(`/v1/entries/${id}/publish`), {
				method: "POST",
				json: { expectedVersion: autosave.getVersion(), ...(resetPublishedAt ? { resetPublishedAt } : {}) },
				fallback: t("publishFailed"),
			});
			autosave.setVersion(published.version);
			setEntry((current) => ({ ...published, ...keepTranslationGroup(current, published) }));
			void refreshIncoming(id);
			const warnings = published.warnings ?? [];
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
		} catch (error) {
			if (error instanceof CmsApiError && error.code === "conflict") {
				const server = await cmsFetch<EntryData>(cmsApiUrl(`/v1/entries/${autosave.getEntryId()}`)).catch(() => null);
				if (server) setConflict({ server, local: form });
				return;
			}
			if (error instanceof CmsApiError && error.issues.length > 0) {
				setPublishIssues(error.issues);
				toast.error(t("publishBlocked"));
				return;
			}
			toast.error(errorText(error, t("publishFailed")));
		} finally {
			setBusy(null);
		}
	};

	/** Archive, unarchive, trash, restore. */
	const runLifecycle = async (action: LifecycleAction) => {
		if (!entry || isSubmitting) return;
		if (action !== "restore" && autosave.hasPendingChanges()) {
			toast.error(saveFirstMessage(action));
			return;
		}
		setBusy("status");
		try {
			await cmsFetch(cmsApiUrl(`/v1/entries/${entry.id}/${action}`), {
				method: "POST",
				json: { expectedVersion: autosave.getVersion() },
			});
			// Sending a translation to the trash returns to the original's edit screen.
			if (action === "trash" && isTranslationEntry(entry) && entry.translationGroupId) {
				toast.success(LIFECYCLE_SUCCESS[action]);
				router.push(adminEntryEditHref(entry.translationGroupId) as Route);
				return;
			}
			await loadEntry(entry.id);
			toast.success(LIFECYCLE_SUCCESS[action]);
		} catch (error) {
			toast.error(errorText(error, LIFECYCLE_FAILED[action]));
		} finally {
			setBusy(null);
		}
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
				try {
					await cmsFetch(cmsApiUrl(`/v1/entries/${entry.id}?expectedVersion=${autosave.getVersion()}`), {
						method: "DELETE",
					});
					await deleteLocalBackup(backupKey(adminId, entry.id, entry.collection));
					router.push(adminHref(`?collection=${entry.collection}&status=trashed`) as Route);
				} catch (error) {
					toast.error(errorText(error, t("deleteFailed")));
				}
			},
		});
	};

	const handleDuplicate = async () => {
		const id = await ensureSaved("duplicate");
		if (!id) return;
		try {
			const copy = await cmsFetch<EntryData>(cmsApiUrl(`/v1/entries/${id}/duplicate`), {
				method: "POST",
				json: { title: copyTitle(collection, formText(formRef.current, "title")) },
			});
			router.push(adminEntryEditHref(copy.id) as Route);
		} catch (error) {
			toast.error(errorText(error, t("duplicateFailed")));
		}
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

	if (isLoading || !isAnalysisReady) {
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
	const canRetry = ["failed", "local-only", "session-expired"].includes(autosave.status);
	const bodyIssue = publishIssues.find((issue) => issue.path === "mdx" || Boolean(issue.position));
	const titleIssue = publishIssues.find((issue) => issue.path === "title");
	const languageTabs =
		entry && !isItemCollection(collection) ? (
			<LanguageTabs
				entry={entry}
				disabled={isReadOnly}
				onBeforeCreate={async () => !autosave.hasPendingChanges()}
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
				onChange={(event) => handleTitleChange(event.target.value)}
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
	const sourceModeToggle = (
		<ToolbarToggle
			label={t("mdxSource")}
			icon={FileCode}
			pressed={editorMode === "source"}
			// Content that cannot be parsed cannot return to visual mode.
			disabled={editorMode === "source" && !canUseVisual}
			onPressedChange={(pressed) => setEditorMode(pressed ? "source" : "visual")}
		/>
	);
	const sourceEditor = (
		<>
			<MdxSourceEditor
				id="cms-mdx-source"
				aria-label={t("mdxBody")}
				aria-invalid={Boolean(bodyIssue) || !canUseVisual || undefined}
				aria-describedby={bodyIssue ? "cms-mdx-error" : undefined}
				value={form.mdx}
				readOnly={isReadOnly}
				onChange={(event) => setForm({ mdx: event.target.value })}
				onCompositionStart={() => autosave.setComposing(true)}
				onCompositionEnd={() => autosave.setComposing(false)}
				placeholder={t("mdxPlaceholder")}
				className="min-h-[calc(100vh-240px)] w-full flex-1 px-4"
			/>
			{bodyIssue && (
				<p id="cms-mdx-error" className="mt-2 text-cms-destructive text-sm">
					{cmsIssueMessage(bodyIssue)}
				</p>
			)}
		</>
	);

	return (
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
					<SaveStatusIndicator status={autosave.status} backupAvailable={autosave.backupAvailable} />
					{canRetry && (
						<Button
							type="button"
							size="sm"
							variant="ghost"
							className="text-cms-muted-foreground"
							onClick={() => void autosave.retry(true)}
						>
							{tc("retry")}
						</Button>
					)}
					{autosave.status === "session-expired" && (
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
						disabled={isReadOnly || isSubmitting || autosave.status === "saving"}
						onClick={() => void handleSaveNow()}
					/>
					{previewHref && (
						<ToolbarAction
							label={t("preview")}
							icon={Eye}
							href={autosave.hasPendingChanges() ? undefined : previewHref}
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
							{busy === "publish" ? t("publishing") : t("publish")}
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
								{busy === "publish" ? t("publishing") : t("publish")}
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
			{!canUseVisual && (
				<output className="border-b bg-amber-500/10 px-4 py-2 text-sm">
					{t("visualUnavailable")} {sourceProblems[0] ? cmsIssueMessage(sourceProblems[0]) : ""}
				</output>
			)}
			{autosave.lastError && ["failed", "session-expired"].includes(autosave.status) && (
				<p role="alert" className="border-b px-4 py-2 text-cms-destructive text-sm">
					{autosave.lastError}
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
						onClick={() =>
							setForm({
								[TRANSLATION_FORM_KEY]: stringifyTranslation({ version: 2, baseSource: translationSource.mdx }),
							})
						}
					>
						{t("confirm")}
					</Button>
				</output>
			)}

			<div className="relative flex min-h-0 flex-1 overflow-hidden">
				{translationSource && isSourcePaneOpen && (
					<SourcePane
						ref={sourcePaneRef}
						mdx={translationSource.mdx}
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
						content={form.mdx}
						titleField={
							<>
								{languageTabs}
								{titleInput}
							</>
						}
						toolbarAside={
							<span className="flex items-center gap-1">
								<TemplateMenu currentMdx={form.mdx} disabled={isReadOnly} onApply={(mdx) => setForm({ mdx })} />
								{extensions.toolbar}
								{sourcePaneToggle}
								{sourceModeToggle}
							</span>
						}
						sourceView={editorMode === "source" ? sourceEditor : undefined}
						editable={!isReadOnly}
						stored={entry ? { mdx: entry.working.mdx, doc: entry.working.doc ?? null } : undefined}
						onChange={(mdx, doc) => {
							editorBodyRef.current = { mdx, doc };
							setForm({ mdx });
						}}
						blockActions={extensions.blockActions.length > 0 ? extensions.blockActions : undefined}
						selectionActions={extensions.selectionActions}
						insertActions={extensions.insertActions}
						onEditor={extensions.onEditor}
						onCompositionStart={() => autosave.setComposing(true)}
						onCompositionEnd={() => autosave.setComposing(false)}
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
						<InspectorPanel
							collection={collection}
							form={form}
							disabled={isReadOnly}
							publishIssues={publishIssues}
							entry={entry}
							incomingReferences={incoming.items}
							isLoadingIncomingReferences={incoming.loading}
							onRefreshIncomingReferences={() => {
								if (entry) void refreshIncoming(entry.id);
							}}
							onSlugChange={(slug) => {
								setIsSlugTouched(true);
								setForm({ slug });
							}}
							onRegenerateSlug={() => {
								setIsSlugTouched(false);
								setForm({ slug: isCollection(collection) ? slugFromValues(collection, form) : "" });
							}}
							onChange={(patch) => setForm(withAutoSlug(patch))}
							onClose={() => setIsInspectorOpen(false)}
							focusPath={pendingFieldPath !== "title-canvas" ? pendingFieldPath : null}
							onFocused={() => setPendingFieldPath(null)}
						/>
					</div>
				)}
			</div>

			<RecoveryDialog
				recovery={recovery}
				onClose={() => setRecovery(null)}
				onKeepServer={async (current) => {
					await deleteLocalBackup(current.backup.key);
					setRecovery(null);
				}}
				onRestore={(current) => applyRecovered({ ...EMPTY_FORM, ...current.backup.snapshot })}
			/>
			<ConflictDialog
				conflict={conflict}
				onClose={() => setConflict(null)}
				onReload={() => window.location.reload()}
				onOverwrite={(serverVersion) => {
					setConflict(null);
					void autosave.overwriteWithLocal(serverVersion);
				}}
			/>

			<ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
			{translationSource && (
				<SourceChangeDialog
					open={isSourceCompareOpen}
					onOpenChange={setIsSourceCompareOpen}
					before={confirmedSource}
					after={translationSource.mdx}
				/>
			)}
		</div>
	);
}
