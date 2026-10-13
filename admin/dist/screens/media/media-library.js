"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cmsApiUrl, useSite, useTranslator, withBasePath } from "@monti-cms/core/client";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Image as ImageIcon, LayoutGrid, Link2, List, PanelRightOpen, RefreshCw, SearchX, Trash2, Upload, } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { prepareUpload, uploadAttachment, uploadImageFile } from "../../editor/upload-helper.js";
import { cn } from "../../lib/utils/cn.js";
import { readPreference, writePreference } from "../../lib/utils/site-storage.js";
import { Alert, AlertDescription } from "../../ui/alert.js";
import { Button } from "../../ui/button.js";
import { IconButton } from "../../ui/icon-button.js";
import { Input } from "../../ui/input.js";
import { Label } from "../../ui/label.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select.js";
import { Skeleton } from "../../ui/skeleton.js";
import { Switch } from "../../ui/switch.js";
import { ToggleGroup, ToggleGroupItem } from "../../ui/toggle-group.js";
import { cmsFetch, errorText } from "../admin-api.js";
import { AdminShell } from "../shared/admin-shell.js";
import { useConfirm } from "../shared/confirm-dialog.js";
import { DateRangePicker } from "../shared/date-range-picker.js";
import { EmptyState } from "../shared/empty-state.js";
import { entryHref } from "../shared/entry-href.js";
import { ListPagination } from "../shared/list-pager.js";
import { DockedPanel, MEDIA_PANEL_RESIZE } from "../shared/side-panel.js";
import { useDebounced } from "../shared/use-debounced.js";
import { MediaDetailPanel } from "./media-detail-panel.js";
import { mediaUsages, usageNoteLabel } from "./media-item.js";
import { MediaGrid, MediaTable } from "./media-views.js";
import { mediaMessages } from "./messages.js";
const kindOptions = (t) => [
    { value: "all", label: t("library.kind.all") },
    { value: "image", label: t("library.kind.image") },
    { value: "file", label: t("library.kind.file") },
];
const uploadAccept = (site) => `${site.api.ALLOWED_IMAGE_MIME_TYPES.join(",")},${site.api.FILE_ACCEPT}`;
const MEDIA_KEY = ["cms", "media"];
const isImageFile = (site, file) => site.api.isImageMime(file.type);
const usedOptions = (t) => [
    { value: "all", label: t("library.used.all") },
    { value: "used", label: t("library.used.used") },
    { value: "unused", label: t("library.used.unused") },
];
/** Name of the remembered view in the site's browser storage (`lib/utils/site-storage.ts`). */
const VIEW_STORAGE_NAME = "media-view";
/** Grid or list view choice. Remembered in this browser, per site; if storage is unavailable, starts with the grid. */
function useMediaView() {
    const site = useSite();
    const [view, setView] = useState("grid");
    useEffect(() => {
        if (readPreference(site, VIEW_STORAGE_NAME) === "list")
            setView("list");
    }, [site]);
    const change = (next) => {
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
    const [pageSize, setPageSize] = useState(25);
    const [search, setSearch] = useState("");
    const [used, setUsed] = useState("all");
    const [kind, setKind] = useState("all");
    const [uploadedFrom, setUploadedFrom] = useState("");
    const [uploadedTo, setUploadedTo] = useState("");
    const [selectedId, setSelectedId] = useState(null);
    /** Whether the detail panel's default description has unsaved changes. The detail panel reports it. */
    const detailDirtyRef = useRef(false);
    const [optimize, setOptimize] = useState(false);
    const [upload, setUpload] = useState(null);
    const { confirm, confirmDiscard, dialog } = useConfirm();
    const [view, setView] = useMediaView();
    const fileInputRef = useRef(null);
    // Keep the previous rows while conditions change (`keepPreviousData`) so placeholders do not flicker. Placeholders show only when there is no cache.
    const query = useMemo(() => {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), used });
        if (search.trim())
            params.set("search", search.trim());
        if (kind !== "all")
            params.set("kind", kind);
        const from = uploadedFrom && site.parseDateTimeInput(`${uploadedFrom}T00:00`);
        const to = uploadedTo && site.parseDateTimeInput(`${uploadedTo}T23:59`);
        if (from)
            params.set("uploadedFrom", from);
        if (to)
            params.set("uploadedTo", new Date(Date.parse(to) + 59_999).toISOString());
        return params.toString();
    }, [page, pageSize, used, search, kind, uploadedFrom, uploadedTo, site.parseDateTimeInput]);
    const debouncedQuery = useDebounced(query, 200);
    const mediaQuery = useQuery({
        queryKey: [...MEDIA_KEY, debouncedQuery],
        queryFn: ({ signal }) => cmsFetch(site, cmsApiUrl(`/v1/media?${debouncedQuery}`), { signal }),
        placeholderData: keepPreviousData,
    });
    const items = mediaQuery.data?.items ?? [];
    const total = mediaQuery.data?.total ?? 0;
    const selected = items.find((item) => item.id === selectedId) ?? null;
    const loadError = mediaQuery.error ? errorText(site, mediaQuery.error, t("library.loadFailed")) : null;
    /** Opens in the detail panel (null to close). If there is an unsaved default description, asks first whether to discard it. */
    const openDetail = async (id) => {
        if (id === selectedId)
            return;
        if (!(await confirmDiscard(detailDirtyRef.current)))
            return;
        detailDirtyRef.current = false;
        setSelectedId(id);
    };
    /** Refetches the list in the background. Rows currently visible stay as they are. */
    const invalidateMedia = () => queryClient.invalidateQueries({ queryKey: MEDIA_KEY });
    const handleFiles = async (files) => {
        if (!files?.length)
            return;
        const list = [];
        for (const file of Array.from(files)) {
            if (isImageFile(site, file) || site.api.fileTypeFor(file.name))
                list.push(file);
            else
                toast.error(t("library.unsupportedType", { name: file.name }));
        }
        if (list.length === 0) {
            if (fileInputRef.current)
                fileInputRef.current.value = "";
            return;
        }
        try {
            for (const [index, file] of list.entries()) {
                const onProgress = (percent) => setUpload({ current: index + 1, total: list.length, percent });
                setUpload({ current: index + 1, total: list.length, percent: 0 });
                if (isImageFile(site, file)) {
                    const prepared = await prepareUpload(site, file, { optimize });
                    await uploadImageFile(site, prepared, onProgress);
                }
                else {
                    await uploadAttachment(site, file, onProgress);
                }
            }
            toast.success(t("library.uploaded", { count: list.length }));
            setPage(1);
            await invalidateMedia();
        }
        catch (error) {
            // A failed upload does not become available. It can be retried with the same file.
            toast.error(t("library.uploadFailed", { error: errorText(site, error, t("library.unknownError")) }));
        }
        finally {
            setUpload(null);
            if (fileInputRef.current)
                fileInputRef.current.value = "";
        }
    };
    const deleteMedia = async (media) => {
        // Remove from the list first, then send the request. On failure, revert; when done, sync to the server value.
        await queryClient.cancelQueries({ queryKey: MEDIA_KEY });
        const snapshots = queryClient.getQueriesData({ queryKey: MEDIA_KEY });
        queryClient.setQueriesData({ queryKey: MEDIA_KEY }, (data) => data?.items.some((item) => item.id === media.id)
            ? { items: data.items.filter((item) => item.id !== media.id), total: Math.max(0, data.total - 1) }
            : data);
        // If the file being deleted is open, close it. Its edited default description is discarded with it.
        setSelectedId((current) => {
            if (current !== media.id)
                return current;
            detailDirtyRef.current = false;
            return null;
        });
        try {
            await cmsFetch(site, cmsApiUrl(`/v1/media/${media.id}`), {
                method: "DELETE",
                fallback: t("library.deleteFailed"),
            });
            toast.success(t("library.deleted", { name: media.filename }));
        }
        catch (error) {
            for (const [key, data] of snapshots)
                queryClient.setQueryData(key, data);
            toast.error(errorText(site, error, t("library.deleteFailed")));
        }
        finally {
            void invalidateMedia();
        }
    };
    /** Saves the default description. Failure is thrown as is so it shows inside the detail panel. */
    const saveDefaults = async (media, defaults) => {
        await cmsFetch(site, cmsApiUrl(`/v1/media/${media.id}`), {
            method: "PATCH",
            json: { defaultAlt: defaults.alt, defaultCaption: defaults.caption },
            fallback: t("library.saveFailed"),
        });
        toast.success(t("library.saved"));
        void invalidateMedia();
    };
    const rename = async (media, filename) => {
        try {
            await cmsFetch(site, cmsApiUrl(`/v1/media/${media.id}`), { method: "PATCH", json: { filename } });
            toast.success(t("library.renamed", { name: filename }));
            await invalidateMedia();
        }
        catch (error) {
            toast.error(errorText(site, error, t("library.renameFailed")));
        }
    };
    const cleanup = async () => {
        try {
            const result = await cmsFetch(site, cmsApiUrl("/v1/media/cleanup"), {
                method: "POST",
                json: {},
            });
            const text = result.failed.length
                ? t("library.cleanup.doneWithFailed", { removed: result.removed, failed: result.failed.length })
                : t("library.cleanup.done", { removed: result.removed });
            if (result.failed.length)
                toast.error(text);
            else
                toast.success(text);
            void invalidateMedia();
        }
        catch (error) {
            toast.error(errorText(site, error, t("library.cleanup.failed")));
        }
    };
    const setDetailDirty = useCallback((dirty) => {
        detailDirtyRef.current = dirty;
    }, []);
    const requestDelete = async (media) => {
        const ok = await confirm({
            title: media.status === "deleting" ? t("library.delete.retryTitle") : t("library.delete.title"),
            description: t("library.delete.ask", { name: media.filename }),
            confirmLabel: t("common.delete"),
            destructive: true,
        });
        if (ok)
            await deleteMedia(media);
    };
    /** Right-click and `⋯` menu of a media tile. */
    const mediaMenu = (media) => [
        { kind: "item", label: t("common.open"), icon: PanelRightOpen, onSelect: () => void openDetail(media.id) },
        {
            kind: "sub",
            label: t("library.menu.usage"),
            icon: Link2,
            emptyLabel: t("library.menu.usageEmpty"),
            items: mediaUsages(media).map((usage) => ({
                kind: "item",
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
        onSelect: (media) => void openDetail(media.id),
        menuFor: mediaMenu,
        onDeleteKey: (media) => void requestDelete(media),
    };
    const setFilter = (apply) => {
        apply();
        setPage(1);
    };
    const filtered = search.trim() !== "" || used !== "all" || kind !== "all" || uploadedFrom !== "" || uploadedTo !== "";
    const clearFilters = () => setFilter(() => {
        setSearch("");
        setUsed("all");
        setKind("all");
        setUploadedFrom("");
        setUploadedTo("");
    });
    return (_jsxs(AdminShell, { title: t("title"), count: mediaQuery.data ? total : undefined, sidebar: { activeNav: "media" }, headerActions: _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs(Label, { className: "font-normal text-cms-muted-foreground text-xs", children: [_jsx(Switch, { size: "sm", checked: optimize, onCheckedChange: (checked) => setOptimize(checked === true) }), t("library.optimize")] }), _jsx("input", { ref: fileInputRef, type: "file", multiple: true, hidden: true, accept: uploadAccept(site), onChange: (event) => void handleFiles(event.target.files) }), _jsxs(Button, { type: "button", size: "sm", disabled: upload !== null, onClick: () => fileInputRef.current?.click(), children: [_jsx(Upload, { "aria-hidden": true }), upload
                            ? t("library.uploadProgress", { current: upload.current, total: upload.total, percent: upload.percent })
                            : t("library.upload")] }), _jsx(Button, { type: "button", size: "sm", variant: "outline", onClick: () => void cleanup(), children: t("library.cleanup") }), _jsx(IconButton, { label: t("library.refresh"), variant: "outline", onClick: () => void mediaQuery.refetch(), children: _jsx(RefreshCw, { className: cn(mediaQuery.isFetching && "animate-spin"), "aria-hidden": true }) })] }), children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2 border-b px-4 py-3 lg:px-6", children: [_jsx(Input, { type: "search", "aria-label": t("library.search"), value: search, placeholder: t("library.search"), onChange: (event) => setFilter(() => setSearch(event.target.value)), className: "h-8 w-56" }), _jsxs(Select, { value: kind, items: kindOptions(t), onValueChange: (value) => value && setFilter(() => setKind(value)), children: [_jsx(SelectTrigger, { size: "sm", "aria-label": t("library.kindLabel"), children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: kindOptions(t).map((option) => (_jsx(SelectItem, { value: option.value, children: option.label }, option.value))) })] }), _jsxs(Select, { value: used, items: usedOptions(t), onValueChange: (value) => value && setFilter(() => setUsed(value)), children: [_jsx(SelectTrigger, { size: "sm", "aria-label": t("library.usedLabel"), children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: usedOptions(t).map((option) => (_jsx(SelectItem, { value: option.value, children: option.label }, option.value))) })] }), _jsx(DateRangePicker, { label: t("library.uploadedDate"), from: uploadedFrom, to: uploadedTo, onChange: (from, to) => setFilter(() => {
                            setUploadedFrom(from);
                            setUploadedTo(to);
                        }) }), _jsxs(ToggleGroup, { "aria-label": t("library.view"), variant: "outline", size: "sm", spacing: 0, value: [view], onValueChange: (next) => {
                            const picked = next[0];
                            if (picked === "grid" || picked === "list")
                                setView(picked);
                        }, className: "ml-auto", children: [_jsx(ToggleGroupItem, { value: "grid", "aria-label": t("library.viewGrid"), children: _jsx(LayoutGrid, { "aria-hidden": true }) }), _jsx(ToggleGroupItem, { value: "list", "aria-label": t("library.viewList"), children: _jsx(List, { "aria-hidden": true }) })] })] }), _jsxs("div", { className: "relative flex min-h-0 flex-1 overflow-hidden", children: [_jsxs("div", { className: "flex min-w-0 flex-1 flex-col overflow-hidden", children: [_jsxs("div", { className: "flex min-h-0 flex-1 flex-col overflow-y-auto p-4 lg:p-6", children: [loadError && (_jsxs(Alert, { variant: "danger", className: "mb-4 flex w-auto items-center justify-between", children: [_jsx(AlertDescription, { className: "col-start-auto", children: loadError }), _jsx(Button, { type: "button", variant: "outline", size: "xs", onClick: () => void mediaQuery.refetch(), children: t("common.retry") })] })), items.length === 0 ? (loadError ? null : mediaQuery.isPending ? (_jsx("ul", { "aria-hidden": true, className: "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6", children: Array.from({ length: 6 }, (_, index) => (_jsx("li", { children: _jsx(Skeleton, { className: "aspect-square w-full rounded-lg" }) }, index))) })) : filtered ? (_jsx(EmptyState, { icon: SearchX, title: t("library.emptyNoMatch"), description: t("library.emptyNoMatchHint"), action: { label: t("library.clearFilters"), onClick: clearFilters } })) : (_jsx(EmptyState, { icon: ImageIcon, title: t("library.emptyYet"), description: t("library.emptyYetHint"), action: {
                                            label: t("library.upload"),
                                            icon: Upload,
                                            onClick: () => fileInputRef.current?.click(),
                                        } }))) : view === "grid" ? (_jsx(MediaGrid, { ...viewProps })) : (_jsx(MediaTable, { ...viewProps }))] }), _jsx(ListPagination, { total: total, shown: items.length, page: page, pageSize: pageSize, onPageChange: setPage, onPageSizeChange: (size) => {
                                    setPageSize(size);
                                    setPage(1);
                                } })] }), selected && (_jsx(DockedPanel, { resize: MEDIA_PANEL_RESIZE, children: _jsx(MediaDetailPanel, { media: selected, onClose: () => void openDetail(null), onSaveDefaults: (defaults) => saveDefaults(selected, defaults), onRename: (filename) => void rename(selected, filename), onRequestDelete: () => void requestDelete(selected), onDirtyChange: setDetailDirty }, selected.id) }))] }), dialog] }));
}
