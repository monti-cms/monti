"use client";

import { type Site, useSite, useTranslator } from "@monti-cms/core/site";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	FileText,
	Folder as FolderIcon,
	FolderInput,
	FolderPlus,
	FolderUp,
	Image as ImageIcon,
	LayoutGrid,
	Link2,
	List,
	PanelRightOpen,
	RefreshCw,
	SearchX,
	Trash2,
	Upload,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { errorText } from "../../api/client";
import { foldersKeys, listFolders } from "../../api/folders";
import {
	cleanupMedia,
	deleteMedia,
	listMedia,
	type MediaItem,
	type MediaPage,
	mediaKeys,
	updateMedia,
} from "../../api/media";
import { useCmsMutation } from "../../api/use-cms-mutation";
import { prepareUpload, uploadAttachment, uploadImageFile } from "../../editor/upload-helper";
import { commonMessages } from "../../lib/common.messages";
import { enumCodec, usePreference } from "../../lib/hooks/use-preference";
import { enumParam, pageParam, pageSizeParam, textParam, useUrlState } from "../../lib/hooks/use-url-state";
import { cn } from "../../lib/utils/cn";
import { useAdminRouter } from "../../router";
import type { TranslatorFor } from "../../translator";
import { Button } from "../../ui/button";
import { IconButton } from "../../ui/icon-button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Skeleton } from "../../ui/skeleton";
import { Switch } from "../../ui/switch";
import { ToggleGroup, ToggleGroupItem } from "../../ui/toggle-group";
import { ActionContextMenu, type MenuAction } from "../shared/action-menu";
import { AdminShell, PageActions } from "../shared/admin-shell";
import { useConfirm } from "../shared/confirm-dialog";
import { DateRangePicker } from "../shared/date-range-picker";
import { EmptyState } from "../shared/empty-state";
import type { DraggedEntry } from "../shared/entry-drag";
import { entryHref } from "../shared/entry-href";
import { ListPagination } from "../shared/list-pager";
import { LoadErrorAlert } from "../shared/load-error-alert";
import { DockedPanel, MEDIA_PANEL_RESIZE } from "../shared/side-panel";
import { useDebouncedInput } from "../shared/use-debounced";
import { useFolderActions } from "../shared/use-folder-actions";
import { useUnsavedGuard } from "../shared/use-unsaved-guard";
import { MediaDetailPanel } from "./media-detail-panel";
import { mediaUsages, usageNoteLabel } from "./media-item";
import { MediaGrid, MediaTable } from "./media-views";
import { mediaMessages } from "./messages";

const kindOptions = (t: TranslatorFor<typeof mediaMessages>) => [
	{ value: "all", label: t("library.kind.all") },
	{ value: "image", label: t("library.kind.image") },
	{ value: "file", label: t("library.kind.file") },
];

const uploadAccept = (site: Site) => `${site.api.ALLOWED_IMAGE_MIME_TYPES.join(",")},${site.api.FILE_ACCEPT}`;

const isAllowedImageFile = (site: Site, file: File) => site.api.isAllowedImage(file.type);

const usedOptions = (t: TranslatorFor<typeof mediaMessages>) => [
	{ value: "all", label: t("library.used.all") },
	{ value: "used", label: t("library.used.used") },
	{ value: "unused", label: t("library.used.unused") },
];

type MediaView = "grid" | "list";
const VIEW_CODEC = enumCodec<MediaView>(["grid", "list"]);

/** The library's filters and page live in the address, so a refresh keeps them and the address can be shared. */
const LIBRARY_PARAMS = {
	page: pageParam,
	pageSize: pageSizeParam,
	search: textParam,
	used: enumParam(["all", "used", "unused"] as const, "all"),
	kind: enumParam(["all", "image", "file"] as const, "all"),
	uploadedFrom: textParam,
	uploadedTo: textParam,
	folder: textParam,
};

/**
 * Media library. Grid and list views, file name search, filters for type, upload date and usage, newest upload first.
 * Picking an item opens the detail on the right.
 */
export function MediaLibrary() {
	const site = useSite();
	const t = useTranslator(mediaMessages);
	const tc = useTranslator(commonMessages);
	const router = useAdminRouter();
	const [{ page, pageSize, search, used, kind, uploadedFrom, uploadedTo, folder }, update] =
		useUrlState(LIBRARY_PARAMS);
	const queryClient = useQueryClient();
	const [searchText, setSearchText] = useDebouncedInput(search, (text) => update({ search: text }));
	const [selectedId, setSelectedId] = useState<string | null>(null);
	/** Whether the detail panel's default description has unsaved changes. The detail panel reports it. */
	const detailDirtyRef = useRef(false);
	const [optimize, setOptimize] = useState(false);
	const [upload, setUpload] = useState<{ current: number; total: number; percent: number } | null>(null);
	const { confirm, confirmDiscard, dialog } = useConfirm();
	// The view is a per-device choice (browser preference), unlike the filters, which belong to the address.
	const [view, setView] = usePreference("media-view", VIEW_CODEC, "grid");
	const fileInputRef = useRef<HTMLInputElement>(null);

	const isExplorer = !search.trim() && used === "all" && kind === "all" && !uploadedFrom && !uploadedTo;

	// Keep the previous rows while conditions change (`keepPreviousData`) so placeholders do not flicker. Placeholders show only when there is no cache.
	const query = useMemo(() => {
		const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), used });
		if (search.trim()) params.set("search", search.trim());
		if (kind !== "all") params.set("kind", kind);
		if (folder && folder !== "all") {
			params.set("folderId", folder);
		} else if (isExplorer) {
			params.set("folderId", "null");
		}
		const from = uploadedFrom && site.parseDateTimeInput(`${uploadedFrom}T00:00`);
		const to = uploadedTo && site.parseDateTimeInput(`${uploadedTo}T23:59`);
		if (from) params.set("uploadedFrom", from);
		if (to) params.set("uploadedTo", new Date(Date.parse(to) + 59_999).toISOString());
		return params.toString();
	}, [page, pageSize, used, search, kind, folder, isExplorer, uploadedFrom, uploadedTo, site.parseDateTimeInput]);
	const mediaQuery = useQuery({
		queryKey: mediaKeys.list(query),
		queryFn: ({ signal }) => listMedia(site, query, signal),
		placeholderData: keepPreviousData,
	});
	const items = mediaQuery.data?.items ?? [];
	const total = mediaQuery.data?.total ?? 0;
	const selected = items.find((item) => item.id === selectedId) ?? null;

	const foldersQuery = useQuery({
		queryKey: foldersKeys.list("media"),
		queryFn: ({ signal }) => listFolders(site, "media", signal),
	});
	const folders = foldersQuery.data ?? [];

	const folderActions = useFolderActions({
		collection: "media",
		folders,
		onChanged: async (deletedId) => {
			await queryClient.invalidateQueries({ queryKey: foldersKeys.list("media") });
			if (deletedId && folder === deletedId) update({ folder: "all" });
			else await queryClient.invalidateQueries({ queryKey: mediaKeys.all });
		},
	});

	const moveMediaToFolder = async (media: MediaItem, targetFolderId: string | null) => {
		const targetFolder = targetFolderId ? folders.find((f) => f.id === targetFolderId) : null;
		const destination = targetFolder ? `'${targetFolder.name}'` : t("detail.folder.none");
		try {
			await updateMedia(site, media.id, { folderId: targetFolderId });
			toast.success(t("library.moved", { name: media.filename, destination }));
			await queryClient.invalidateQueries({ queryKey: mediaKeys.all });
			await queryClient.invalidateQueries({ queryKey: foldersKeys.list("media") });
		} catch (error) {
			toast.error(errorText(site, error, t("library.moveFailed", { name: media.filename })));
		}
	};

	const onDropEntries = async (targetFolderId: string | null, entries: DraggedEntry[]) => {
		const targetFolder = targetFolderId ? folders.find((f) => f.id === targetFolderId) : null;
		const destination = targetFolder ? `'${targetFolder.name}'` : t("detail.folder.none");
		try {
			await Promise.all(entries.map((entry) => updateMedia(site, entry.id, { folderId: targetFolderId })));
			const label =
				entries.length === 1
					? (items.find((item) => item.id === entries[0].id)?.filename ?? "File")
					: `${entries.length} files`;
			toast.success(t("library.moved", { name: label, destination }));
			await queryClient.invalidateQueries({ queryKey: mediaKeys.all });
			await queryClient.invalidateQueries({ queryKey: foldersKeys.list("media") });
		} catch (error) {
			toast.error(errorText(site, error, t("library.unknownError")));
		}
	};

	const loadError = mediaQuery.error ? errorText(site, mediaQuery.error, t("library.loadFailed")) : null;

	/** Opens in the detail panel (null to close). If there is an unsaved default description, asks first whether to discard it. */
	const openDetail = async (id: string | null) => {
		if (id === selectedId) return;
		if (!(await confirmDiscard(detailDirtyRef.current))) return;
		detailDirtyRef.current = false;
		setSelectedId(id);
	};

	const uploadMutation = useCmsMutation({
		fn: async ({ files, optimize }: { files: File[]; optimize: boolean }) => {
			const targetFolderId = folder !== "all" && folder !== "" ? folder : null;
			for (const [index, file] of files.entries()) {
				const onProgress = (percent: number) => setUpload({ current: index + 1, total: files.length, percent });
				setUpload({ current: index + 1, total: files.length, percent: 0 });
				if (isAllowedImageFile(site, file)) {
					const prepared = await prepareUpload(site, file, { optimize });
					await uploadImageFile(site, prepared, onProgress, { folderId: targetFolderId });
				} else {
					await uploadAttachment(site, file, onProgress, { folderId: targetFolderId });
				}
			}
		},
		success: (_result, { files }) => t("library.uploaded", { count: files.length }),
		// A failed upload does not become available. It can be retried with the same file.
		failure: t("library.unknownError"),
		inline: true,
		onSuccess: () => update({ page: 1 }),
		onError: (error) =>
			toast.error(t("library.uploadFailed", { error: errorText(site, error, t("library.unknownError")) })),
		invalidate: [mediaKeys.all, foldersKeys.list("media")],
	});

	const handleFiles = async (files: FileList | null) => {
		if (!files?.length) return;
		const list: File[] = [];
		for (const file of Array.from(files)) {
			if (isAllowedImageFile(site, file) || site.api.fileTypeFor(file.name)) list.push(file);
			else toast.error(t("library.unsupportedType", { name: file.name }));
		}
		if (list.length === 0) {
			if (fileInputRef.current) fileInputRef.current.value = "";
			return;
		}
		try {
			await uploadMutation.mutateAsync({ files: list, optimize });
		} catch {
			// Reported by the mutation.
		} finally {
			setUpload(null);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	const deleteMutation = useCmsMutation<MediaItem, void, MediaPage>({
		fn: (media, { site }) => deleteMedia(site, media.id, tc("deleteFailed")),
		success: (_result, media) => t("library.deleted", { name: media.filename }),
		failure: tc("deleteFailed"),
		// Remove from the list first, then send the request. On failure it reverts; when done, the list syncs to the server value.
		optimistic: {
			queryKey: mediaKeys.lists(),
			update: (data, media) =>
				data.items.some((item) => item.id === media.id)
					? { items: data.items.filter((item) => item.id !== media.id), total: Math.max(0, data.total - 1) }
					: data,
		},
		invalidate: [mediaKeys.all, foldersKeys.list("media")],
	});

	const removeMedia = (media: MediaItem) => {
		// If the file being deleted is open, close it. Its edited default description is discarded with it.
		setSelectedId((current) => {
			if (current !== media.id) return current;
			detailDirtyRef.current = false;
			return null;
		});
		deleteMutation.mutate(media);
	};

	/** Saves the default description. Failure is thrown as is so it shows inside the detail panel. */
	const saveDefaultsMutation = useCmsMutation({
		fn: ({ media, defaults }: { media: MediaItem; defaults: { alt: string; caption: string } }, { site }) =>
			updateMedia(site, media.id, { defaultAlt: defaults.alt, defaultCaption: defaults.caption }, tc("saveFailed")),
		success: tc("saved"),
		failure: tc("saveFailed"),
		inline: true,
		invalidate: [mediaKeys.all],
	});

	/** Renames a file. Failure is thrown as is so it shows under the name field in the detail panel. */
	const renameMutation = useCmsMutation({
		fn: ({ media, filename }: { media: MediaItem; filename: string }, { site }) =>
			updateMedia(site, media.id, { filename }, t("library.renameFailed")),
		success: (_result, { filename }) => t("library.renamed", { name: filename }),
		failure: t("library.renameFailed"),
		inline: true,
		invalidate: [mediaKeys.all],
	});

	const cleanupMutation = useCmsMutation({
		// biome-ignore lint/suspicious/noConfusingVoidType: a mutation without variables, so `mutate()` takes no argument
		fn: (_variables: void, { site }) => cleanupMedia(site),
		failure: t("library.cleanup.failed"),
		onSuccess: (result) => {
			const text = result.failed.length
				? t("library.cleanup.doneWithFailed", { removed: result.removed, failed: result.failed.length })
				: t("library.cleanup.done", { removed: result.removed });
			if (result.failed.length) toast.error(text);
			else toast.success(text);
		},
		invalidate: [mediaKeys.all],
	});

	// The same as state, for the guard on links that leave the library while the open file has changes.
	const [detailDirty, setDetailDirtyState] = useState(false);
	const { dialog: guardDialog } = useUnsavedGuard(detailDirty);
	const setDetailDirty = useCallback((dirty: boolean) => {
		detailDirtyRef.current = dirty;
		setDetailDirtyState(dirty);
	}, []);

	const requestDelete = async (media: MediaItem) => {
		const ok = await confirm({
			title: media.status === "deleting" ? t("library.delete.retryTitle") : t("library.delete.title"),
			description: t("library.delete.ask", { name: media.filename }),
			confirmLabel: tc("delete"),
			destructive: true,
		});
		if (ok) removeMedia(media);
	};

	/** Right-click and `⋯` menu of a media tile. */
	const mediaMenu = (media: MediaItem): MenuAction[] => [
		{ kind: "item", label: tc("open"), icon: PanelRightOpen, onSelect: () => void openDetail(media.id) },
		{
			kind: "sub",
			label: t("library.menu.usage"),
			icon: Link2,
			emptyLabel: t("library.menu.usageEmpty"),
			items: mediaUsages(media).map((usage) => ({
				kind: "item" as const,
				label: `${usage.title || tc("untitled")}${usage.note ? ` · ${usageNoteLabel(t, usage.note)}` : ""}`,
				icon: FileText,
				onSelect: () => router.navigate(entryHref(site, usage.collection, usage.entryId)),
			})),
		},
		...(folders.length > 0
			? [
					{
						kind: "sub" as const,
						label: t("library.menu.moveToFolder"),
						icon: FolderInput,
						items: [
							...(media.folderId
								? [
										{
											kind: "item" as const,
											label: t("detail.folder.none"),
											icon: FolderUp,
											onSelect: () => void moveMediaToFolder(media, null),
										},
									]
								: []),
							...folders
								.filter((f) => f.id !== media.folderId)
								.map((f) => ({
									kind: "item" as const,
									label: f.name,
									icon: FolderIcon,
									onSelect: () => void moveMediaToFolder(media, f.id),
								})),
						],
					},
				]
			: []),
		{ kind: "separator" },
		{
			kind: "item",
			label: tc("delete"),
			icon: Trash2,
			shortcut: "Del",
			destructive: true,
			disabled: media.referencesCount > 0,
			onSelect: () => void requestDelete(media),
		},
	];

	const explorer = isExplorer
		? {
				folders: folders.filter((f) => (f.parentId ?? null) === (folder === "all" || !folder ? null : folder)),
				parent: folder && folder !== "all" ? (folders.find((f) => f.id === folder)?.parentId ?? "all") : null,
			}
		: null;

	const hasFolders = Boolean(explorer && (explorer.folders.length > 0 || explorer.parent !== null));

	const blankMenu: MenuAction[] = [
		{
			kind: "item",
			label: folder === "all" || folder === "" ? tc("addFolder") : tc("addSubfolder"),
			icon: FolderPlus,
			onSelect: () => folderActions.requestCreate(folder === "all" || folder === "" ? null : folder),
		},
		{
			kind: "item",
			label: t("library.upload"),
			icon: Upload,
			onSelect: () => fileInputRef.current?.click(),
		},
	];

	const viewProps = {
		items,
		selectedId,
		dimmed: mediaQuery.isPlaceholderData,
		onSelect: (media: MediaItem) => void openDetail(media.id),
		menuFor: mediaMenu,
		onDeleteKey: (media: MediaItem) => void requestDelete(media),
		explorer,
		folders,
		folderActions,
		onSelectFolder: (f: string) => update({ folder: f, page: 1 }),
	};

	const filtered = search.trim() !== "" || used !== "all" || kind !== "all" || uploadedFrom !== "" || uploadedTo !== "";
	const clearFilters = () => update({ search: "", used: "all", kind: "all", uploadedFrom: "", uploadedTo: "" });

	const currentFolder = folders.find((f) => f.id === folder);
	const folderTitle = currentFolder ? ` · ${currentFolder.name}` : "";

	return (
		<AdminShell
			title={`${t("title")}${folderTitle}`}
			count={mediaQuery.data ? t("library.count", { count: total }) : undefined}
			large
			description={t("description")}
			sidebar={{
				activeNav: "media",
				folderNav: {
					collection: "media",
					currentFolder: folder || "all",
					folders,
					folderActions,
					onSelectFolder: (f) => update({ folder: f ?? "all", page: 1 }),
					onDropEntries,
				},
			}}
		>
			<PageActions>
				<div className="flex flex-wrap items-center gap-2">
					<Label className="font-normal text-monti-caption text-monti-muted-foreground">
						<Switch size="sm" checked={optimize} onCheckedChange={(checked) => setOptimize(checked === true)} />
						{t("library.optimize")}
					</Label>
					<input
						ref={fileInputRef}
						type="file"
						multiple
						hidden
						accept={uploadAccept(site)}
						onChange={(event) => void handleFiles(event.target.files)}
					/>
					<Button type="button" size="sm" disabled={upload !== null} onClick={() => fileInputRef.current?.click()}>
						<Upload aria-hidden />
						{upload
							? t("library.uploadProgress", { current: upload.current, total: upload.total, percent: upload.percent })
							: t("library.upload")}
					</Button>
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() => folderActions.requestCreate(folder === "all" || folder === "" ? null : folder)}
					>
						<FolderPlus aria-hidden />
						{folder === "all" || folder === "" ? tc("addFolder") : tc("addSubfolder")}
					</Button>
					<Button type="button" size="sm" variant="outline" onClick={() => cleanupMutation.mutate()}>
						{t("library.cleanup")}
					</Button>
					<IconButton label={tc("refresh")} variant="outline" onClick={() => void mediaQuery.refetch()}>
						<RefreshCw className={cn(mediaQuery.isFetching && "animate-spin")} aria-hidden />
					</IconButton>
				</div>
			</PageActions>
			<div className="flex min-h-11 shrink-0 flex-wrap items-stretch gap-x-4 border-monti-border border-b px-8">
				<fieldset className="-mb-px flex items-stretch gap-5">
					<legend className="sr-only">{t("library.kindLabel")}</legend>
					{kindOptions(t).map((option) => (
						<button
							key={option.value}
							type="button"
							aria-pressed={kind === option.value}
							className="-mb-px border-transparent border-b-2 text-monti-body text-monti-muted-foreground outline-none transition-colors hover:text-monti-foreground focus-visible:ring-2 focus-visible:ring-monti-ring/50 aria-pressed:border-monti-highlight aria-pressed:font-medium aria-pressed:text-monti-foreground"
							onClick={() => update({ kind: option.value as typeof kind })}
						>
							{option.label}
						</button>
					))}
				</fieldset>
				<div className="ml-auto flex flex-wrap items-center gap-2 py-1.5">
					<Input
						type="search"
						aria-label={t("library.search")}
						value={searchText}
						placeholder={t("library.search")}
						onChange={(event) => setSearchText(event.target.value)}
						className="h-8 w-56 rounded-md"
					/>
					<Select
						value={used}
						items={usedOptions(t)}
						onValueChange={(value) => value && update({ used: value as typeof used })}
					>
						<SelectTrigger size="sm" aria-label={t("library.usedLabel")} className="rounded-md">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{usedOptions(t).map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<DateRangePicker
						label={t("library.uploadedDate")}
						from={uploadedFrom}
						to={uploadedTo}
						onChange={(from, to) => update({ uploadedFrom: from, uploadedTo: to })}
					/>
					<ToggleGroup
						aria-label={t("library.view")}
						variant="outline"
						size="sm"
						spacing={0}
						value={[view]}
						onValueChange={(next: unknown[]) => {
							const picked = next[0];
							if (picked === "grid" || picked === "list") setView(picked);
						}}
					>
						<ToggleGroupItem value="grid" aria-label={t("library.viewGrid")}>
							<LayoutGrid aria-hidden />
						</ToggleGroupItem>
						<ToggleGroupItem value="list" aria-label={t("library.viewList")}>
							<List aria-hidden />
						</ToggleGroupItem>
					</ToggleGroup>
				</div>
			</div>

			<div className="relative flex min-h-0 flex-1 overflow-hidden">
				<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
					<div
						className={cn(
							"flex min-h-0 flex-1 flex-col overflow-y-auto",
							(items.length === 0 && !hasFolders) || view === "grid" ? "px-8 py-5" : "p-0",
						)}
					>
						{loadError && (
							<LoadErrorAlert
								message={loadError}
								onRetry={() => void mediaQuery.refetch()}
								className={(items.length === 0 && !hasFolders) || view === "grid" ? "mb-4" : "m-4"}
							/>
						)}
						{items.length === 0 && !hasFolders ? (
							loadError ? null : mediaQuery.isPending ? (
								<ul aria-hidden className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
									{Array.from({ length: 6 }, (_, index) => (
										// biome-ignore lint/suspicious/noArrayIndexKey: placeholder
										<li key={index}>
											<Skeleton className="aspect-square w-full rounded-md" />
										</li>
									))}
								</ul>
							) : filtered ? (
								<EmptyState
									icon={SearchX}
									title={t("library.emptyNoMatch")}
									description={t("library.emptyNoMatchHint")}
									action={{ label: t("library.clearFilters"), onClick: clearFilters }}
								/>
							) : (
								<EmptyState
									icon={ImageIcon}
									title={t("library.emptyYet")}
									description={t("library.emptyYetHint")}
									action={{
										label: t("library.upload"),
										icon: Upload,
										onClick: () => fileInputRef.current?.click(),
									}}
								/>
							)
						) : view === "grid" ? (
							<MediaGrid {...viewProps} />
						) : (
							<MediaTable {...viewProps} />
						)}
						<ActionContextMenu actions={blankMenu} trigger={<div className="min-h-16 flex-1" aria-hidden />} />
					</div>
					<ListPagination
						total={total}
						shown={items.length}
						page={page}
						pageSize={pageSize}
						onPageChange={(next) => update({ page: next })}
						onPageSizeChange={(size) => update({ pageSize: size })}
						hidePagerWhenSingle
						showRange={total > pageSize}
					/>
				</div>

				{selected && (
					<DockedPanel resize={MEDIA_PANEL_RESIZE}>
						<MediaDetailPanel
							key={selected.id}
							media={selected}
							folders={folders}
							onClose={() => void openDetail(null)}
							onSaveDefaults={(defaults) => saveDefaultsMutation.mutateAsync({ media: selected, defaults })}
							onRename={(filename) => renameMutation.mutateAsync({ media: selected, filename })}
							onMoveFolder={(targetFolderId) => moveMediaToFolder(selected, targetFolderId)}
							onRequestDelete={() => void requestDelete(selected)}
							onDirtyChange={setDetailDirty}
						/>
					</DockedPanel>
				)}
			</div>
			{dialog}
			{guardDialog}
			{folderActions.dialogs}
		</AdminShell>
	);
}
