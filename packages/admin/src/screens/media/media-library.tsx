"use client";

import { type Site, useSite, useTranslator } from "@monti-cms/core/client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
	FileText,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { errorText } from "../../api/client";
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
import type { MenuAction } from "../shared/action-menu";
import { AdminShell, PageActions } from "../shared/admin-shell";
import { useConfirm } from "../shared/confirm-dialog";
import { DateRangePicker } from "../shared/date-range-picker";
import { EmptyState } from "../shared/empty-state";
import { entryHref } from "../shared/entry-href";
import { ListPagination } from "../shared/list-pager";
import { LoadErrorAlert } from "../shared/load-error-alert";
import { DockedPanel, MEDIA_PANEL_RESIZE } from "../shared/side-panel";
import { useDebouncedInput } from "../shared/use-debounced";
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

const isImageFile = (site: Site, file: File) => site.api.isImageMime(file.type);

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
	const [{ page, pageSize, search, used, kind, uploadedFrom, uploadedTo }, update] = useUrlState(LIBRARY_PARAMS);
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

	// Keep the previous rows while conditions change (`keepPreviousData`) so placeholders do not flicker. Placeholders show only when there is no cache.
	const query = useMemo(() => {
		const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), used });
		if (search.trim()) params.set("search", search.trim());
		if (kind !== "all") params.set("kind", kind);
		const from = uploadedFrom && site.parseDateTimeInput(`${uploadedFrom}T00:00`);
		const to = uploadedTo && site.parseDateTimeInput(`${uploadedTo}T23:59`);
		if (from) params.set("uploadedFrom", from);
		if (to) params.set("uploadedTo", new Date(Date.parse(to) + 59_999).toISOString());
		return params.toString();
	}, [page, pageSize, used, search, kind, uploadedFrom, uploadedTo, site.parseDateTimeInput]);
	const mediaQuery = useQuery({
		queryKey: mediaKeys.list(query),
		queryFn: ({ signal }) => listMedia(site, query, signal),
		placeholderData: keepPreviousData,
	});
	const items = mediaQuery.data?.items ?? [];
	const total = mediaQuery.data?.total ?? 0;
	const selected = items.find((item) => item.id === selectedId) ?? null;

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
			for (const [index, file] of files.entries()) {
				const onProgress = (percent: number) => setUpload({ current: index + 1, total: files.length, percent });
				setUpload({ current: index + 1, total: files.length, percent: 0 });
				if (isImageFile(site, file)) {
					const prepared = await prepareUpload(site, file, { optimize });
					await uploadImageFile(site, prepared, onProgress);
				} else {
					await uploadAttachment(site, file, onProgress);
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
		invalidate: [mediaKeys.all],
	});

	const handleFiles = async (files: FileList | null) => {
		if (!files?.length) return;
		const list: File[] = [];
		for (const file of Array.from(files)) {
			if (isImageFile(site, file) || site.api.fileTypeFor(file.name)) list.push(file);
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
		invalidate: [mediaKeys.all],
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

	const renameMutation = useCmsMutation({
		fn: ({ media, filename }: { media: MediaItem; filename: string }, { site }) =>
			updateMedia(site, media.id, { filename }),
		success: (_result, { filename }) => t("library.renamed", { name: filename }),
		failure: t("library.renameFailed"),
		invalidate: [mediaKeys.all],
	});

	const cleanupMutation = useCmsMutation({
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

	const setDetailDirty = useCallback((dirty: boolean) => {
		detailDirtyRef.current = dirty;
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

	const viewProps = {
		items,
		selectedId,
		dimmed: mediaQuery.isPlaceholderData,
		onSelect: (media: MediaItem) => void openDetail(media.id),
		menuFor: mediaMenu,
		onDeleteKey: (media: MediaItem) => void requestDelete(media),
	};

	const filtered = search.trim() !== "" || used !== "all" || kind !== "all" || uploadedFrom !== "" || uploadedTo !== "";
	const clearFilters = () => update({ search: "", used: "all", kind: "all", uploadedFrom: "", uploadedTo: "" });

	return (
		<AdminShell title={t("title")} count={mediaQuery.data ? total : undefined} sidebar={{ activeNav: "media" }}>
			<PageActions>
				<div className="flex flex-wrap items-center gap-2">
					<Label className="font-normal text-cms-muted-foreground text-xs">
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
					<Button type="button" size="sm" variant="outline" onClick={() => cleanupMutation.mutate()}>
						{t("library.cleanup")}
					</Button>
					<IconButton label={tc("refresh")} variant="outline" onClick={() => void mediaQuery.refetch()}>
						<RefreshCw className={cn(mediaQuery.isFetching && "animate-spin")} aria-hidden />
					</IconButton>
				</div>
			</PageActions>
			<div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 lg:px-6">
				<Input
					type="search"
					aria-label={t("library.search")}
					value={searchText}
					placeholder={t("library.search")}
					onChange={(event) => setSearchText(event.target.value)}
					className="h-8 w-56"
				/>
				<Select
					value={kind}
					items={kindOptions(t)}
					onValueChange={(value) => value && update({ kind: value as typeof kind })}
				>
					<SelectTrigger size="sm" aria-label={t("library.kindLabel")}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{kindOptions(t).map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
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
					className="ml-auto"
				>
					<ToggleGroupItem value="grid" aria-label={t("library.viewGrid")}>
						<LayoutGrid aria-hidden />
					</ToggleGroupItem>
					<ToggleGroupItem value="list" aria-label={t("library.viewList")}>
						<List aria-hidden />
					</ToggleGroupItem>
				</ToggleGroup>
			</div>

			<div className="relative flex min-h-0 flex-1 overflow-hidden">
				<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
					<div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 lg:p-6">
						{loadError && (
							<LoadErrorAlert message={loadError} onRetry={() => void mediaQuery.refetch()} className="mb-4" />
						)}
						{items.length === 0 ? (
							loadError ? null : mediaQuery.isPending ? (
								<ul aria-hidden className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
									{Array.from({ length: 6 }, (_, index) => (
										// biome-ignore lint/suspicious/noArrayIndexKey: placeholder
										<li key={index}>
											<Skeleton className="aspect-square w-full rounded-lg" />
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
					</div>
					<ListPagination
						total={total}
						shown={items.length}
						page={page}
						pageSize={pageSize}
						onPageChange={(next) => update({ page: next })}
						onPageSizeChange={(size) => update({ pageSize: size })}
					/>
				</div>

				{selected && (
					<DockedPanel resize={MEDIA_PANEL_RESIZE}>
						<MediaDetailPanel
							key={selected.id}
							media={selected}
							onClose={() => void openDetail(null)}
							onSaveDefaults={(defaults) => saveDefaultsMutation.mutateAsync({ media: selected, defaults })}
							onRename={(filename) => renameMutation.mutate({ media: selected, filename })}
							onRequestDelete={() => void requestDelete(selected)}
							onDirtyChange={setDetailDirty}
						/>
					</DockedPanel>
				)}
			</div>
			{dialog}
		</AdminShell>
	);
}
