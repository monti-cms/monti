"use client";

import {
	Document,
	FolderAdd,
	Folder as FolderIcon,
	FolderMoveTo,
	FolderParent,
	Grid,
	Link,
	List,
	Renew,
	RightPanelOpen,
	TrashCan,
	Upload,
} from "@carbon/icons-react";
import { type Folder, type Site, useSite, useTranslator } from "@monti-cms/core/site";
import {
	Box,
	Button,
	IconButton,
	Inline,
	Input,
	Label,
	PageBody,
	PageColumn,
	PageHeader,
	PageToolbar,
	PageToolbarEnd,
	Segmented,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Stack,
	Switch,
	Tabs,
	TabsList,
	TabsTrigger,
	Text,
	TextButton,
	toast,
} from "@monti-cms/ui";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
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
import { useAdminRouter } from "../../router";
import type { TranslatorFor } from "../../translator";
import { ActionContextMenu, type MenuAction } from "../shared/action-menu";
import { AdminFrame } from "../shared/admin-frame";
import { useConfirm } from "../shared/confirm-dialog";
import { DateRangePicker } from "../shared/date-range-picker";
import { EmptyState } from "../shared/empty-state";
import type { DraggedEntry } from "../shared/entry-drag";
import { entryHref } from "../shared/entry-href";
import { ListPagination } from "../shared/list-pager";
import { LoadErrorAlert } from "../shared/load-error-alert";
import { DockedPanel } from "../shared/side-panel";
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
			toast(t("library.moved", { name: media.filename, destination }));
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
			toast(t("library.moved", { name: label, destination }));
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
			else toast(text);
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
		{ kind: "item", label: tc("open"), icon: RightPanelOpen, onSelect: () => void openDetail(media.id) },
		{
			kind: "sub",
			label: t("library.menu.usage"),
			icon: Link,
			emptyLabel: t("library.menu.usageEmpty"),
			items: mediaUsages(media).map((usage) => ({
				kind: "item" as const,
				label: `${usage.title || tc("untitled")}${usage.note ? ` · ${usageNoteLabel(t, usage.note)}` : ""}`,
				icon: Document,
				onSelect: () => router.navigate(entryHref(site, usage.collection, usage.entryId)),
			})),
		},
		...(folders.length > 0
			? [
					{
						kind: "sub" as const,
						label: t("library.menu.moveToFolder"),
						icon: FolderMoveTo,
						items: [
							...(media.folderId
								? [
										{
											kind: "item" as const,
											label: t("detail.folder.none"),
											icon: FolderParent,
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
			icon: TrashCan,
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
			icon: FolderAdd,
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
	// The folders from the top down to the open one: the way back, above the title.
	const trail: Folder[] = [];
	for (let at = currentFolder; at; at = folders.find((f) => f.id === at?.parentId)) trail.unshift(at);
	const ancestors = trail.slice(0, -1);

	return (
		<AdminFrame
			sidebar={{
				activeNav: "media",
				folderNav: {
					collection: "media",
					currentFolder: folder || "all",
					folders,
					onSelectFolder: (f) => update({ folder: f ?? "all", page: 1 }),
					onDropEntries,
				},
			}}
		>
			<PageColumn width="list">
				<PageHeader
					title={currentFolder?.name ?? t("title")}
					trail={
						currentFolder && (
							<Inline gap={6} align="baseline">
								<TextButton variant="underline" type="button" onClick={() => update({ folder: "all", page: 1 })}>
									{t("title")}
								</TextButton>
								<span aria-hidden="true">/</span>
								{ancestors.map((ancestor) => (
									<Inline key={ancestor.id} gap={6} align="baseline">
										<TextButton
											variant="underline"
											type="button"
											onClick={() => update({ folder: ancestor.id, page: 1 })}
										>
											{ancestor.name}
										</TextButton>
										<span aria-hidden="true">/</span>
									</Inline>
								))}
							</Inline>
						)
					}
				>
					<Label size="caption" tone="muted">
						<Switch checked={optimize} onCheckedChange={(checked) => setOptimize(checked === true)} />
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
					<Button
						type="button"
						variant="secondary"
						onClick={() => folderActions.requestCreate(folder === "all" || folder === "" ? null : folder)}
					>
						<FolderAdd aria-hidden />
						{folder === "all" || folder === "" ? tc("addFolder") : tc("addSubfolder")}
					</Button>
					<Button type="button" variant="secondary" onClick={() => cleanupMutation.mutate()}>
						{t("library.cleanup")}
					</Button>
					<IconButton label={tc("refresh")} onClick={() => void mediaQuery.refetch()}>
						<Renew aria-hidden />
					</IconButton>
					<Button type="button" disabled={upload !== null} onClick={() => fileInputRef.current?.click()}>
						<Upload aria-hidden />
						{upload
							? t("library.uploadProgress", { current: upload.current, total: upload.total, percent: upload.percent })
							: t("library.upload")}
					</Button>
				</PageHeader>
				<PageToolbar>
					<Tabs value={kind} onValueChange={(value) => update({ kind: value as typeof kind })}>
						<TabsList variant="toolbar" aria-label={t("library.kindLabel")}>
							{kindOptions(t).map((option) => (
								<TabsTrigger key={option.value} value={option.value}>
									{option.label}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
					<PageToolbarEnd>
						<Input
							type="search"
							size="sm"
							aria-label={t("library.search")}
							value={searchText}
							placeholder={t("library.search")}
							onChange={(event) => setSearchText(event.target.value)}
						/>
						<Select
							value={used}
							items={usedOptions(t)}
							onValueChange={(value) => value && update({ used: value as typeof used })}
						>
							<SelectTrigger size="sm" aria-label={t("library.usedLabel")}>
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
						<Segmented
							aria-label={t("library.view")}
							size="sm"
							inline
							value={view}
							onValueChange={setView}
							options={[
								{ value: "grid", label: <Grid aria-hidden />, "aria-label": t("library.viewGrid") },
								{ value: "list", label: <List aria-hidden />, "aria-label": t("library.viewList") },
							]}
						/>
					</PageToolbarEnd>
				</PageToolbar>
				<PageBody>
					<Stack as="div" direction="row" gap={0} grow minHeight={0} overflow="hidden" position="relative">
						<Stack gap={0} grow minWidth={0} overflow="hidden">
							{/* The scroll area: padded on a grid or an empty state, edge to edge on the list view. */}
							<Stack
								gap={0}
								grow
								minHeight={0}
								overflow="y"
								paddingX={(items.length === 0 && !hasFolders) || view === "grid" ? 32 : 0}
								paddingY={(items.length === 0 && !hasFolders) || view === "grid" ? 16 : 0}
							>
								{loadError && (
									<Box
										padding={(items.length === 0 && !hasFolders) || view === "grid" ? undefined : 16}
										paddingBottom={(items.length === 0 && !hasFolders) || view === "grid" ? 16 : undefined}
									>
										<LoadErrorAlert message={loadError} onRetry={() => void mediaQuery.refetch()} />
									</Box>
								)}
								{items.length === 0 && !hasFolders ? (
									loadError ? null : mediaQuery.isPending ? (
										<Text as="p" variant="note" tone="subtle" role="status">
											{tc("loading")}
										</Text>
									) : filtered ? (
										<EmptyState
											title={t("library.emptyNoMatch")}
											description={t("library.emptyNoMatchHint")}
											action={{ label: t("library.clearFilters"), onClick: clearFilters }}
										/>
									) : (
										<EmptyState
											title={t("library.emptyYet")}
											description={t("library.emptyYetHint")}
											action={{
												label: t("library.upload"),
												onClick: () => fileInputRef.current?.click(),
											}}
										/>
									)
								) : view === "grid" ? (
									<MediaGrid {...viewProps} />
								) : (
									<MediaTable {...viewProps} />
								)}
								<ActionContextMenu actions={blankMenu} trigger={<Box grow paddingY={24} aria-hidden />} />
							</Stack>
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
						</Stack>

						{selected && (
							<DockedPanel>
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
					</Stack>
				</PageBody>
			</PageColumn>
			{dialog}
			{guardDialog}
			{folderActions.dialogs}
		</AdminFrame>
	);
}
