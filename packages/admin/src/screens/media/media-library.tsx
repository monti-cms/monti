"use client";

import { cmsApiUrl, type Site, useSite, useTranslator, withBasePath } from "@monti-cms/core/client";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, LayoutGrid, Link2, List, PanelRightOpen, RefreshCw, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { prepareUpload, uploadAttachment, uploadImageFile } from "../../editor/upload-helper";
import { cn } from "../../lib/utils/cn";
import { readPreference, writePreference } from "../../lib/utils/site-storage";
import type { TranslatorFor } from "../../translator";
import { Alert, AlertDescription } from "../../ui/alert";
import { Button } from "../../ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "../../ui/empty";
import { IconButton } from "../../ui/icon-button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Skeleton } from "../../ui/skeleton";
import { Switch } from "../../ui/switch";
import { ToggleGroup, ToggleGroupItem } from "../../ui/toggle-group";
import { cmsFetch, errorText } from "../admin-api";
import type { MenuAction } from "../shared/action-menu";
import { AdminShell } from "../shared/admin-shell";
import { useConfirm } from "../shared/confirm-dialog";
import { DateRangePicker } from "../shared/date-range-picker";
import { entryHref } from "../shared/entry-href";
import { SIDE_PANEL_DOCK } from "../shared/side-panel";
import { useDebounced } from "../shared/use-debounced";
import { MediaDetailPanel } from "./media-detail-panel";
import { type MediaItem, mediaUsages, usageNoteLabel } from "./media-item";
import { MediaGrid, MediaTable } from "./media-views";
import { mediaMessages } from "./messages";

const PAGE_SIZE = 30;
const kindOptions = (t: TranslatorFor<typeof mediaMessages>) => [
	{ value: "all", label: t("library.kind.all") },
	{ value: "image", label: t("library.kind.image") },
	{ value: "file", label: t("library.kind.file") },
];

const uploadAccept = (site: Site) => `${site.api.ALLOWED_IMAGE_MIME_TYPES.join(",")},${site.api.FILE_ACCEPT}`;

const MEDIA_KEY = ["cms", "media"] as const;

interface MediaPage {
	items: MediaItem[];
	total: number;
}

const isImageFile = (site: Site, file: File) => site.api.isImageMime(file.type);

const usedOptions = (t: TranslatorFor<typeof mediaMessages>) => [
	{ value: "all", label: t("library.used.all") },
	{ value: "used", label: t("library.used.used") },
	{ value: "unused", label: t("library.used.unused") },
];

type MediaView = "grid" | "list";
/** Name of the remembered view in the site's browser storage (`lib/utils/site-storage.ts`). */
const VIEW_STORAGE_NAME = "media-view";

/** Grid or list view choice. Remembered in this browser, per site; if storage is unavailable, starts with the grid. */
function useMediaView(): [MediaView, (view: MediaView) => void] {
	const site = useSite();
	const [view, setView] = useState<MediaView>("grid");
	useEffect(() => {
		if (readPreference(site, VIEW_STORAGE_NAME) === "list") setView("list");
	}, [site]);
	const change = (next: MediaView) => {
		setView(next);
		writePreference(site, VIEW_STORAGE_NAME, next);
	};
	return [view, change];
}

/**
 * Media library. Grid and list views, file name search, filters for type, upload date and usage, newest upload first.
 * Picking an item opens the detail on the right.
 */
export function MediaLibrary() {
	const site = useSite();
	const t = useTranslator(mediaMessages);
	const queryClient = useQueryClient();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [used, setUsed] = useState<"all" | "used" | "unused">("all");
	const [kind, setKind] = useState<"all" | "image" | "file">("all");
	const [uploadedFrom, setUploadedFrom] = useState("");
	const [uploadedTo, setUploadedTo] = useState("");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	/** Whether the detail panel's default description has unsaved changes. The detail panel reports it. */
	const detailDirtyRef = useRef(false);
	const [optimize, setOptimize] = useState(false);
	const [upload, setUpload] = useState<{ current: number; total: number; percent: number } | null>(null);
	const { confirm, confirmDiscard, dialog } = useConfirm();
	const [view, setView] = useMediaView();
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Keep the previous rows while conditions change (`keepPreviousData`) so placeholders do not flicker. Placeholders show only when there is no cache.
	const query = useMemo(() => {
		const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), used });
		if (search.trim()) params.set("search", search.trim());
		if (kind !== "all") params.set("kind", kind);
		const from = uploadedFrom && site.parseDateTimeInput(`${uploadedFrom}T00:00`);
		const to = uploadedTo && site.parseDateTimeInput(`${uploadedTo}T23:59`);
		if (from) params.set("uploadedFrom", from);
		if (to) params.set("uploadedTo", new Date(Date.parse(to) + 59_999).toISOString());
		return params.toString();
	}, [page, used, search, kind, uploadedFrom, uploadedTo, site.parseDateTimeInput]);
	const debouncedQuery = useDebounced(query, 200);
	const mediaQuery = useQuery({
		queryKey: [...MEDIA_KEY, debouncedQuery],
		queryFn: ({ signal }) => cmsFetch<MediaPage>(site, cmsApiUrl(`/v1/media?${debouncedQuery}`), { signal }),
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

	/** Refetches the list in the background. Rows currently visible stay as they are. */
	const invalidateMedia = () => queryClient.invalidateQueries({ queryKey: MEDIA_KEY });

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
			for (const [index, file] of list.entries()) {
				const onProgress = (percent: number) => setUpload({ current: index + 1, total: list.length, percent });
				setUpload({ current: index + 1, total: list.length, percent: 0 });
				if (isImageFile(site, file)) {
					const prepared = await prepareUpload(site, file, { optimize });
					await uploadImageFile(site, prepared, onProgress);
				} else {
					await uploadAttachment(site, file, onProgress);
				}
			}
			toast.success(t("library.uploaded", { count: list.length }));
			setPage(1);
			await invalidateMedia();
		} catch (error) {
			// A failed upload does not become available. It can be retried with the same file.
			toast.error(t("library.uploadFailed", { error: errorText(site, error, t("library.unknownError")) }));
		} finally {
			setUpload(null);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	const deleteMedia = async (media: MediaItem) => {
		// Remove from the list first, then send the request. On failure, revert; when done, sync to the server value.
		await queryClient.cancelQueries({ queryKey: MEDIA_KEY });
		const snapshots = queryClient.getQueriesData<MediaPage>({ queryKey: MEDIA_KEY });
		queryClient.setQueriesData<MediaPage>({ queryKey: MEDIA_KEY }, (data) =>
			data?.items.some((item) => item.id === media.id)
				? { items: data.items.filter((item) => item.id !== media.id), total: Math.max(0, data.total - 1) }
				: data,
		);
		// If the file being deleted is open, close it. Its edited default description is discarded with it.
		setSelectedId((current) => {
			if (current !== media.id) return current;
			detailDirtyRef.current = false;
			return null;
		});
		try {
			await cmsFetch(site, cmsApiUrl(`/v1/media/${media.id}`), {
				method: "DELETE",
				fallback: t("library.deleteFailed"),
			});
			toast.success(t("library.deleted", { name: media.filename }));
		} catch (error) {
			for (const [key, data] of snapshots) queryClient.setQueryData(key, data);
			toast.error(errorText(site, error, t("library.deleteFailed")));
		} finally {
			void invalidateMedia();
		}
	};

	/** Saves the default description. Failure is thrown as is so it shows inside the detail panel. */
	const saveDefaults = async (media: MediaItem, defaults: { alt: string; caption: string }) => {
		await cmsFetch(site, cmsApiUrl(`/v1/media/${media.id}`), {
			method: "PATCH",
			json: { defaultAlt: defaults.alt, defaultCaption: defaults.caption },
			fallback: t("library.saveFailed"),
		});
		toast.success(t("library.saved"));
		void invalidateMedia();
	};

	const rename = async (media: MediaItem, filename: string) => {
		try {
			await cmsFetch(site, cmsApiUrl(`/v1/media/${media.id}`), { method: "PATCH", json: { filename } });
			toast.success(t("library.renamed", { name: filename }));
			await invalidateMedia();
		} catch (error) {
			toast.error(errorText(site, error, t("library.renameFailed")));
		}
	};

	const cleanup = async () => {
		try {
			const result = await cmsFetch<{ removed: number; failed: string[] }>(site, cmsApiUrl("/v1/media/cleanup"), {
				method: "POST",
				json: {},
			});
			const text = result.failed.length
				? t("library.cleanup.doneWithFailed", { removed: result.removed, failed: result.failed.length })
				: t("library.cleanup.done", { removed: result.removed });
			if (result.failed.length) toast.error(text);
			else toast.success(text);
			void invalidateMedia();
		} catch (error) {
			toast.error(errorText(site, error, t("library.cleanup.failed")));
		}
	};

	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const setDetailDirty = useCallback((dirty: boolean) => {
		detailDirtyRef.current = dirty;
	}, []);

	const requestDelete = async (media: MediaItem) => {
		const ok = await confirm({
			title: media.status === "deleting" ? t("library.delete.retryTitle") : t("library.delete.title"),
			description: t("library.delete.ask", { name: media.filename }),
			confirmLabel: t("common.delete"),
			destructive: true,
		});
		if (ok) await deleteMedia(media);
	};

	/** Right-click and `⋯` menu of a media tile. */
	const mediaMenu = (media: MediaItem): MenuAction[] => [
		{ kind: "item", label: t("common.open"), icon: PanelRightOpen, onSelect: () => void openDetail(media.id) },
		{
			kind: "sub",
			label: t("library.menu.usage"),
			icon: Link2,
			emptyLabel: t("library.menu.usageEmpty"),
			items: mediaUsages(media).map((usage) => ({
				kind: "item" as const,
				label: `${usage.title || t("common.untitled")}${usage.note ? ` · ${usageNoteLabel(t, usage.note)}` : ""}`,
				icon: FileText,
				onSelect: () => window.location.assign(withBasePath(entryHref(site, usage.collection, usage.entryId))),
			})),
		},
		{ kind: "separator" },
		{
			kind: "item",
			label: t("common.delete"),
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

	const setFilter = (apply: () => void) => {
		apply();
		setPage(1);
	};

	return (
		<AdminShell
			title={t("title")}
			count={mediaQuery.data ? total : undefined}
			sidebar={{ activeNav: "media" }}
			headerActions={
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
					<Button type="button" size="sm" variant="outline" onClick={() => void cleanup()}>
						{t("library.cleanup")}
					</Button>
					<IconButton label={t("library.refresh")} variant="outline" onClick={() => void mediaQuery.refetch()}>
						<RefreshCw className={cn(mediaQuery.isFetching && "animate-spin")} aria-hidden />
					</IconButton>
				</div>
			}
		>
			<div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 lg:px-6">
				<Input
					type="search"
					aria-label={t("library.search")}
					value={search}
					placeholder={t("library.search")}
					onChange={(event) => setFilter(() => setSearch(event.target.value))}
					className="h-8 w-56"
				/>
				<Select
					value={kind}
					items={kindOptions(t)}
					onValueChange={(value) => value && setFilter(() => setKind(value as typeof kind))}
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
					onValueChange={(value) => value && setFilter(() => setUsed(value as typeof used))}
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
					onChange={(from, to) =>
						setFilter(() => {
							setUploadedFrom(from);
							setUploadedTo(to);
						})
					}
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
				<div className="flex-1 overflow-y-auto p-4 lg:p-6">
					{loadError && (
						<Alert variant="danger" className="mb-4 flex w-auto items-center justify-between">
							<AlertDescription className="col-start-auto">{loadError}</AlertDescription>
							<Button type="button" variant="outline" size="xs" onClick={() => void mediaQuery.refetch()}>
								{t("common.retry")}
							</Button>
						</Alert>
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
						) : (
							<Empty className="py-16">
								<EmptyHeader>
									<EmptyTitle>{t("library.empty")}</EmptyTitle>
								</EmptyHeader>
							</Empty>
						)
					) : view === "grid" ? (
						<MediaGrid {...viewProps} />
					) : (
						<MediaTable {...viewProps} />
					)}
					<nav aria-label={t("library.pageNav")} className="mt-4 flex items-center justify-end gap-2 text-xs">
						<Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
							{t("library.prev")}
						</Button>
						<span className="tabular-nums">
							{page} / {totalPages}
						</span>
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={page >= totalPages}
							onClick={() => setPage(page + 1)}
						>
							{t("library.next")}
						</Button>
					</nav>
				</div>

				{selected && (
					<MediaDetailPanel
						key={selected.id}
						media={selected}
						className={SIDE_PANEL_DOCK}
						onClose={() => void openDetail(null)}
						onSaveDefaults={(defaults) => saveDefaults(selected, defaults)}
						onRename={(filename) => void rename(selected, filename)}
						onRequestDelete={() => void requestDelete(selected)}
						onDirtyChange={setDetailDirty}
					/>
				)}
			</div>
			{dialog}
		</AdminShell>
	);
}
