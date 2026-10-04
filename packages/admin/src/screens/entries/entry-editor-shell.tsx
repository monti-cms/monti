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
	/** 복구본 키에 쓰는 관리자 ID(§5.1). */
	adminId: string;
	/** 새 글을 만들 폴더(목록에서 연 위치). */
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
	// 링크는 링크로 남긴다(새 탭 열기·주소 복사). 이름과 툴팁은 아이콘 버튼과 같다.
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

/** 편집기 도구 모음 끝의 켜고 끄는 단추(원문 창·MDX 원문). 이름과 툴팁이 같다. */
function ToolbarToggle({
	label,
	text,
	icon: Icon,
	pressed,
	disabled,
	onPressedChange,
}: {
	label: string;
	/** 아이콘 옆 글자. 없으면 아이콘만 보인다(이름은 툴팁). */
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

/** "먼저 저장하세요" 안내. 편집 화면 어디서 막혀도 같은 말을 쓴다. */
const saveFirstMessage = (purpose: Purpose) => t("saveFirst", { purpose });

/** 막혔을 때 안내에 넣는 하려던 일. */
type Purpose = "publish" | "duplicate" | LifecycleAction;

/** 저장 상태 점의 색. 상태를 더하면 여기서 색을 정해야 한다. */
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

/** 머리글의 저장 상태. 좁은 화면에서는 점만 보이고 이름은 읽기 도구로 알린다. */
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
 * 저장·발행 응답에는 번역 묶음 정보(v2 B4)가 없다. 불러올 때 받은 값을 유지하고 이 콘텐츠의 상태만 갱신한다.
 */
function keepTranslationGroup(current: EntryData | null, next: EntryData): Pick<EntryData, "translations" | "source"> {
	const translations = (current?.translations ?? next.translations)?.map((member) =>
		member.id === next.id ? { ...member, status: next.status } : member,
	);
	return { translations, source: current?.source ?? next.source };
}

/**
 * 게시글·메모 편집 화면(§3.1, §5). 태그·카테고리·모음집(record 컬렉션)은 목록의 작은 폼에서 편집한다.
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
	/** 머리 단추가 하는 일. 하는 동안 단추를 막고 글자를 바꾼다. */
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

	const autosave = useEntryAutosave({
		adminId,
		collection,
		entry,
		initialForm: EMPTY_FORM,
		enabled: !isReadOnly,
		newEntryFolderId: folderId,
		// 저장 응답에는 번역 묶음 정보가 없다. 불러올 때 받은 값을 유지한다.
		onSaved: (saved) => setEntry((current) => ({ ...saved, ...keepTranslationGroup(current, saved) })),
		onConflict: (server, local) => setConflict({ server, local }),
	});
	const { form, setForm } = autosave;

	// §4.4: 해석할 수 없는 MDX나 frontmatter가 있는 본문은 시각 모드로 열지 않는다. 열면 빈 문서가 되어
	// 입력 한 번에 원문이 덮어써진다. 원문 모드에서 고치거나 보존한 채 저장할 수 있다.
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

	useEffect(() => {
		const media = window.matchMedia?.("(max-width: 1023px)");
		if (!media) return;
		const update = () => {
			setIsNarrowScreen(media.matches);
			// 1024px 이하에서는 본문을 우선한다(§3.1).
			if (media.matches) {
				setIsInspectorOpen(false);
				setIsSourcePaneOpen(false);
			}
		};
		update();
		media.addEventListener?.("change", update);
		return () => media.removeEventListener?.("change", update);
	}, []);

	// 원문 창을 열어 뒀는지는 브라우저에 기억한다. 저장소를 못 쓰면 매번 열린 채 시작한다.
	useEffect(() => {
		try {
			if (window.localStorage.getItem(SOURCE_PANE_STORAGE_KEY) === "closed") setIsSourcePaneOpen(false);
		} catch {
			// 저장소를 쓸 수 없으면 기본값을 쓴다.
		}
	}, []);
	const toggleSourcePane = (open: boolean) => {
		setIsSourcePaneOpen(open);
		try {
			window.localStorage.setItem(SOURCE_PANE_STORAGE_KEY, open ? "open" : "closed");
		} catch {
			// 기억하지 못해도 화면은 바뀐다.
		}
	};

	const translationSource = translationSourceOf(entry);
	const translationForm = form[TRANSLATION_FORM_KEY];
	/** 번역자가 마지막으로 확인한 원문. 지금 원문과 다르면 "원문이 바뀌었습니다"를 보인다. */
	const confirmedSource = translationStateFromForm(translationForm).baseSource;
	const sourceChanged =
		translationSource !== null && typeof translationForm === "string" && translationSource.mdx !== confirmedSource;

	useSourceSync({
		enabled: translationSource !== null && isSourcePaneOpen,
		syncScroll: editorMode === "visual",
		editorRef: editorScrollRef,
		paneRef: sourcePaneRef,
	});

	// 편집 화면 확장(플러그인의 툴바·블록 동작, 예: AI 번역). 언어가 같으면 같은 객체를 넘겨 동작이 다시 만들어지지 않게 한다.
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
				// 항목 컬렉션(태그·카테고리 등)은 목록의 작은 폼에서 연다(§5.2).
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

	// 편집 화면을 열 때 서버 값과 브라우저 복구본을 비교한다(§5.1).
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
					// 복구본 이후 서버도 바뀌었다. 불러오면 덮어쓴다는 것을 알린다.
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

	/** 주소를 직접 고치지 않았으면 주소 필드의 `from`이 가리키는 값이 바뀔 때 주소를 다시 만든다. */
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

	// 속성 필드는 속성 칸이 그 탭을 열고 초점을 옮긴다. 여기서는 본문 위 제목만 다룬다.
	useEffect(() => {
		if (pendingFieldPath !== "title-canvas") return;
		const control = document.getElementById("cms-title-canvas");
		if (control) {
			control.focus();
			setPendingFieldPath(null);
		}
	}, [pendingFieldPath]);

	/**
	 * 명시적 발행만 현재 입력을 저장한다. 다른 작업은 미저장 입력이 있으면 먼저 저장하도록 안내한다.
	 * 안내는 누른 자리 가까이에 보인다. 머리 단추·메뉴는 토스트(기본), 창은 창 안이다.
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
		// 실패하면 반드시 이유를 보인다(충돌은 충돌 창이 따로 뜬다).
		else if (autosave.getStatus() !== "conflict") toast.error(autosave.getLastError() ?? tc("saveFailed"));
	};

	/**
	 * 미리보기는 서버 초안을 그린다. 저장하지 않은 변경이 있으면 먼저 저장하고 연다.
	 * 저장을 기다리는 동안 팝업 차단에 걸리지 않게 창은 누르자마자 열어 둔다.
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
		// §5.6: 본문에서 채우는 필드(`fillFromBody`)가 비었으면 본문에서 만들어 보여 준다. 만들 글이 없으면 직접 입력해야 한다.
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
		// 막지는 않는다. 확인하지 않은 원문 변경이 있는 채로 나가는 것만 알린다.
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

	/** 보관·보관 해제·휴지통·복원(§5.3). */
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
			// 번역본을 휴지통으로 보내면 원문 편집 화면으로 돌아간다.
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

	/** 공개 글을 내리는 전환(보관·휴지통 이동)만 묻는다. 보관 해제·복원은 바로 한다(§5). */
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

	// 번역본은 원문과 slug를 같이 쓸 수 있어 언어를 함께 넘긴다(v2 B4).
	const previewPath = entry ? contentPreviewHref(collection, entry.workingSlug, entry.locale) : null;
	// 새 탭으로 여는 주소라 Next가 `basePath`를 붙여 주지 않는다.
	const previewHref = previewPath === null ? null : withBasePath(previewPath);

	// Cmd/Ctrl+S 즉시 저장. 매 렌더의 최신 상태를 쓰도록 다시 등록한다.
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
	// 제목 칸은 라이브러리 약속인 `title` 필드다. 이름표는 사이트가 정한다.
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
			// 해석할 수 없는 본문은 시각 모드로 돌아가지 못한다.
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
					{/* 하나만 바꾸는 전환(발행·보관 해제·복원)은 묻지 않고 바로 한다(§5). */}
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
						// 이미 발행한 글은 발행과 "오늘 날짜로 다시 발행"을 한 단추로 묶는다.
						// 한 단추처럼 보이게 바탕은 감싸는 칸이 칠하고, 두 단추는 사이의 가는 선으로만 나눈다.
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
									{/* 처음 발행한 날을 그대로 두는 것이 기본이다. 고친 글을 새 글처럼 올릴 때만 고른다. */}
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
							{/* 저장은 머리의 저장 단추와 ⌘S로 한다. 메뉴에 다시 두지 않는다. */}
							{entry && !isTrashed && (
								<>
									<DropdownMenuItem onClick={() => void handleDuplicate()}>
										<Copy aria-hidden />
										{t("duplicate")}
									</DropdownMenuItem>
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
					// 원문 창과 아래 여백을 같게 둬 끝까지 스크롤해도 대응이 맞는다.
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
						onChange={(mdx) => setForm({ mdx })}
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
					// 좁은 화면은 본문 위에 덮고, 넓은 화면은 옆에 고정 폭으로 둔다.
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
