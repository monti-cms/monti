"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Folder as FolderIcon, FolderInput, FolderUp, Image as ImageIcon, LayoutGrid, Link2, List, PanelRightOpen, RefreshCw, SearchX, Trash2, Upload, } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { errorText } from "../../api/client.js";
import { foldersKeys, listFolders } from "../../api/folders.js";
import { cleanupMedia, deleteMedia, listMedia, mediaKeys, updateMedia, } from "../../api/media.js";
import { useCmsMutation } from "../../api/use-cms-mutation.js";
import { prepareUpload, uploadAttachment, uploadImageFile } from "../../editor/upload-helper.js";
import { commonMessages } from "../../lib/common.messages.js";
import { enumCodec, usePreference } from "../../lib/hooks/use-preference.js";
import { enumParam, pageParam, pageSizeParam, textParam, useUrlState, } from "../../lib/hooks/use-url-state.js";
import { cn } from "../../lib/utils/cn.js";
import { useAdminRouter } from "../../router/index.js";
import { Button } from "../../ui/button.js";
import { IconButton } from "../../ui/icon-button.js";
import { Input } from "../../ui/input.js";
import { Label } from "../../ui/label.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select.js";
import { Skeleton } from "../../ui/skeleton.js";
import { Switch } from "../../ui/switch.js";
import { ToggleGroup, ToggleGroupItem } from "../../ui/toggle-group.js";
import { AdminShell, PageActions } from "../shared/admin-shell.js";
import { useConfirm } from "../shared/confirm-dialog.js";
import { DateRangePicker } from "../shared/date-range-picker.js";
import { EmptyState } from "../shared/empty-state.js";
import { entryHref } from "../shared/entry-href.js";
import { ListPagination } from "../shared/list-pager.js";
import { LoadErrorAlert } from "../shared/load-error-alert.js";
import { DockedPanel, MEDIA_PANEL_RESIZE } from "../shared/side-panel.js";
import { useDebouncedInput } from "../shared/use-debounced.js";
import { useFolderActions } from "../shared/use-folder-actions.js";
import { useUnsavedGuard } from "../shared/use-unsaved-guard.js";
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
const isImageFile = (site, file) => site.api.isImageMime(file.type);
const usedOptions = (t) => [
    { value: "all", label: t("library.used.all") },
    { value: "used", label: t("library.used.used") },
    { value: "unused", label: t("library.used.unused") },
];
const VIEW_CODEC = enumCodec(["grid", "list"]);
const descendantsParam = {
    parse: (raw) => raw === "1",
    serialize: (value) => (value ? "1" : null),
};
/** The library's filters and page live in the address, so a refresh keeps them and the address can be shared. */
const LIBRARY_PARAMS = {
    page: pageParam,
    pageSize: pageSizeParam,
    search: textParam,
    used: enumParam(["all", "used", "unused"], "all"),
    kind: enumParam(["all", "image", "file"], "all"),
    uploadedFrom: textParam,
    uploadedTo: textParam,
    folder: textParam,
    descendants: descendantsParam,
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
    const [{ page, pageSize, search, used, kind, uploadedFrom, uploadedTo, folder, descendants }, update] = useUrlState(LIBRARY_PARAMS);
    const queryClient = useQueryClient();
    const [searchText, setSearchText] = useDebouncedInput(search, (text) => update({ search: text }));
    const [selectedId, setSelectedId] = useState(null);
    /** Whether the detail panel's default description has unsaved changes. The detail panel reports it. */
    const detailDirtyRef = useRef(false);
    const [optimize, setOptimize] = useState(false);
    const [upload, setUpload] = useState(null);
    const { confirm, confirmDiscard, dialog } = useConfirm();
    // The view is a per-device choice (browser preference), unlike the filters, which belong to the address.
    const [view, setView] = usePreference("media-view", VIEW_CODEC, "grid");
    const fileInputRef = useRef(null);
    // Keep the previous rows while conditions change (`keepPreviousData`) so placeholders do not flicker. Placeholders show only when there is no cache.
    const query = useMemo(() => {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), used });
        if (search.trim())
            params.set("search", search.trim());
        if (kind !== "all")
            params.set("kind", kind);
        if (folder !== "all" && folder !== "") {
            params.set("folderId", folder === "unfiled" ? "null" : folder);
            if (descendants || search.trim())
                params.set("includeDescendants", "true");
        }
        const from = uploadedFrom && site.parseDateTimeInput(`${uploadedFrom}T00:00`);
        const to = uploadedTo && site.parseDateTimeInput(`${uploadedTo}T23:59`);
        if (from)
            params.set("uploadedFrom", from);
        if (to)
            params.set("uploadedTo", new Date(Date.parse(to) + 59_999).toISOString());
        return params.toString();
    }, [page, pageSize, used, search, kind, folder, descendants, uploadedFrom, uploadedTo, site.parseDateTimeInput]);
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
            if (deletedId && folder === deletedId)
                update({ folder: "all" });
            else
                await queryClient.invalidateQueries({ queryKey: mediaKeys.all });
        },
    });
    const moveMediaToFolder = async (media, targetFolderId) => {
        const targetFolder = targetFolderId ? folders.find((f) => f.id === targetFolderId) : null;
        const destination = targetFolder ? `'${targetFolder.name}'` : t("detail.folder.none");
        try {
            await updateMedia(site, media.id, { folderId: targetFolderId });
            toast.success(t("library.moved", { name: media.filename, destination }));
            await queryClient.invalidateQueries({ queryKey: mediaKeys.all });
            await queryClient.invalidateQueries({ queryKey: foldersKeys.list("media") });
        }
        catch (error) {
            toast.error(errorText(site, error, t("library.moveFailed", { name: media.filename })));
        }
    };
    const onDropEntries = async (targetFolderId, entries) => {
        const targetFolder = targetFolderId ? folders.find((f) => f.id === targetFolderId) : null;
        const destination = targetFolder ? `'${targetFolder.name}'` : t("detail.folder.none");
        try {
            await Promise.all(entries.map((entry) => updateMedia(site, entry.id, { folderId: targetFolderId })));
            const label = entries.length === 1
                ? (items.find((item) => item.id === entries[0].id)?.filename ?? "File")
                : `${entries.length} files`;
            toast.success(t("library.moved", { name: label, destination }));
            await queryClient.invalidateQueries({ queryKey: mediaKeys.all });
            await queryClient.invalidateQueries({ queryKey: foldersKeys.list("media") });
        }
        catch (error) {
            toast.error(errorText(site, error, t("library.unknownError")));
        }
    };
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
    const uploadMutation = useCmsMutation({
        fn: async ({ files, optimize }) => {
            const targetFolderId = folder !== "all" && folder !== "" && folder !== "unfiled" ? folder : null;
            for (const [index, file] of files.entries()) {
                const onProgress = (percent) => setUpload({ current: index + 1, total: files.length, percent });
                setUpload({ current: index + 1, total: files.length, percent: 0 });
                if (isImageFile(site, file)) {
                    const prepared = await prepareUpload(site, file, { optimize });
                    await uploadImageFile(site, prepared, onProgress, { folderId: targetFolderId });
                }
                else {
                    await uploadAttachment(site, file, onProgress, { folderId: targetFolderId });
                }
            }
        },
        success: (_result, { files }) => t("library.uploaded", { count: files.length }),
        // A failed upload does not become available. It can be retried with the same file.
        failure: t("library.unknownError"),
        inline: true,
        onSuccess: () => update({ page: 1 }),
        onError: (error) => toast.error(t("library.uploadFailed", { error: errorText(site, error, t("library.unknownError")) })),
        invalidate: [mediaKeys.all, foldersKeys.list("media")],
    });
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
            await uploadMutation.mutateAsync({ files: list, optimize });
        }
        catch {
            // Reported by the mutation.
        }
        finally {
            setUpload(null);
            if (fileInputRef.current)
                fileInputRef.current.value = "";
        }
    };
    const deleteMutation = useCmsMutation({
        fn: (media, { site }) => deleteMedia(site, media.id, tc("deleteFailed")),
        success: (_result, media) => t("library.deleted", { name: media.filename }),
        failure: tc("deleteFailed"),
        // Remove from the list first, then send the request. On failure it reverts; when done, the list syncs to the server value.
        optimistic: {
            queryKey: mediaKeys.lists(),
            update: (data, media) => data.items.some((item) => item.id === media.id)
                ? { items: data.items.filter((item) => item.id !== media.id), total: Math.max(0, data.total - 1) }
                : data,
        },
        invalidate: [mediaKeys.all, foldersKeys.list("media")],
    });
    const removeMedia = (media) => {
        // If the file being deleted is open, close it. Its edited default description is discarded with it.
        setSelectedId((current) => {
            if (current !== media.id)
                return current;
            detailDirtyRef.current = false;
            return null;
        });
        deleteMutation.mutate(media);
    };
    /** Saves the default description. Failure is thrown as is so it shows inside the detail panel. */
    const saveDefaultsMutation = useCmsMutation({
        fn: ({ media, defaults }, { site }) => updateMedia(site, media.id, { defaultAlt: defaults.alt, defaultCaption: defaults.caption }, tc("saveFailed")),
        success: tc("saved"),
        failure: tc("saveFailed"),
        inline: true,
        invalidate: [mediaKeys.all],
    });
    /** Renames a file. Failure is thrown as is so it shows under the name field in the detail panel. */
    const renameMutation = useCmsMutation({
        fn: ({ media, filename }, { site }) => updateMedia(site, media.id, { filename }, t("library.renameFailed")),
        success: (_result, { filename }) => t("library.renamed", { name: filename }),
        failure: t("library.renameFailed"),
        inline: true,
        invalidate: [mediaKeys.all],
    });
    const cleanupMutation = useCmsMutation({
        // biome-ignore lint/suspicious/noConfusingVoidType: a mutation without variables, so `mutate()` takes no argument
        fn: (_variables, { site }) => cleanupMedia(site),
        failure: t("library.cleanup.failed"),
        onSuccess: (result) => {
            const text = result.failed.length
                ? t("library.cleanup.doneWithFailed", { removed: result.removed, failed: result.failed.length })
                : t("library.cleanup.done", { removed: result.removed });
            if (result.failed.length)
                toast.error(text);
            else
                toast.success(text);
        },
        invalidate: [mediaKeys.all],
    });
    // The same as state, for the guard on links that leave the library while the open file has changes.
    const [detailDirty, setDetailDirtyState] = useState(false);
    const { dialog: guardDialog } = useUnsavedGuard(detailDirty);
    const setDetailDirty = useCallback((dirty) => {
        detailDirtyRef.current = dirty;
        setDetailDirtyState(dirty);
    }, []);
    const requestDelete = async (media) => {
        const ok = await confirm({
            title: media.status === "deleting" ? t("library.delete.retryTitle") : t("library.delete.title"),
            description: t("library.delete.ask", { name: media.filename }),
            confirmLabel: tc("delete"),
            destructive: true,
        });
        if (ok)
            removeMedia(media);
    };
    /** Right-click and `⋯` menu of a media tile. */
    const mediaMenu = (media) => [
        { kind: "item", label: tc("open"), icon: PanelRightOpen, onSelect: () => void openDetail(media.id) },
        {
            kind: "sub",
            label: t("library.menu.usage"),
            icon: Link2,
            emptyLabel: t("library.menu.usageEmpty"),
            items: mediaUsages(media).map((usage) => ({
                kind: "item",
                label: `${usage.title || tc("untitled")}${usage.note ? ` · ${usageNoteLabel(t, usage.note)}` : ""}`,
                icon: FileText,
                onSelect: () => router.navigate(entryHref(site, usage.collection, usage.entryId)),
            })),
        },
        ...(folders.length > 0
            ? [
                {
                    kind: "sub",
                    label: t("library.menu.moveToFolder"),
                    icon: FolderInput,
                    items: [
                        ...(media.folderId
                            ? [
                                {
                                    kind: "item",
                                    label: t("detail.folder.none"),
                                    icon: FolderUp,
                                    onSelect: () => void moveMediaToFolder(media, null),
                                },
                            ]
                            : []),
                        ...folders
                            .filter((f) => f.id !== media.folderId)
                            .map((f) => ({
                            kind: "item",
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
    const viewProps = {
        items,
        selectedId,
        dimmed: mediaQuery.isPlaceholderData,
        onSelect: (media) => void openDetail(media.id),
        menuFor: mediaMenu,
        onDeleteKey: (media) => void requestDelete(media),
    };
    const filtered = search.trim() !== "" || used !== "all" || kind !== "all" || uploadedFrom !== "" || uploadedTo !== "";
    const clearFilters = () => update({ search: "", used: "all", kind: "all", uploadedFrom: "", uploadedTo: "" });
    const currentFolder = folders.find((f) => f.id === folder);
    const folderTitle = currentFolder ? ` · ${currentFolder.name}` : "";
    return (_jsxs(AdminShell, { title: `${t("title")}${folderTitle}`, count: mediaQuery.data ? total : undefined, sidebar: {
            activeNav: "media",
            folderNav: {
                collection: "media",
                currentFolder: folder || "all",
                includeDescendants: descendants,
                folders,
                folderActions,
                onSelectFolder: (f) => update({ folder: f ?? "all", page: 1 }),
                onIncludeDescendantsChange: (includeDescendants) => update({ descendants: includeDescendants, page: 1 }),
                onDropEntries,
            },
        }, children: [_jsx(PageActions, { children: _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs(Label, { className: "font-normal text-cms-muted-foreground text-xs", children: [_jsx(Switch, { size: "sm", checked: optimize, onCheckedChange: (checked) => setOptimize(checked === true) }), t("library.optimize")] }), _jsx("input", { ref: fileInputRef, type: "file", multiple: true, hidden: true, accept: uploadAccept(site), onChange: (event) => void handleFiles(event.target.files) }), _jsxs(Button, { type: "button", size: "sm", disabled: upload !== null, onClick: () => fileInputRef.current?.click(), children: [_jsx(Upload, { "aria-hidden": true }), upload
                                    ? t("library.uploadProgress", { current: upload.current, total: upload.total, percent: upload.percent })
                                    : t("library.upload")] }), _jsx(Button, { type: "button", size: "sm", variant: "outline", onClick: () => cleanupMutation.mutate(), children: t("library.cleanup") }), _jsx(IconButton, { label: tc("refresh"), variant: "outline", onClick: () => void mediaQuery.refetch(), children: _jsx(RefreshCw, { className: cn(mediaQuery.isFetching && "animate-spin"), "aria-hidden": true }) })] }) }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 border-b px-4 py-3 lg:px-6", children: [_jsx(Input, { type: "search", "aria-label": t("library.search"), value: searchText, placeholder: t("library.search"), onChange: (event) => setSearchText(event.target.value), className: "h-8 w-56" }), _jsxs(Select, { value: kind, items: kindOptions(t), onValueChange: (value) => value && update({ kind: value }), children: [_jsx(SelectTrigger, { size: "sm", "aria-label": t("library.kindLabel"), children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: kindOptions(t).map((option) => (_jsx(SelectItem, { value: option.value, children: option.label }, option.value))) })] }), _jsxs(Select, { value: used, items: usedOptions(t), onValueChange: (value) => value && update({ used: value }), children: [_jsx(SelectTrigger, { size: "sm", "aria-label": t("library.usedLabel"), children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: usedOptions(t).map((option) => (_jsx(SelectItem, { value: option.value, children: option.label }, option.value))) })] }), _jsx(DateRangePicker, { label: t("library.uploadedDate"), from: uploadedFrom, to: uploadedTo, onChange: (from, to) => update({ uploadedFrom: from, uploadedTo: to }) }), _jsxs(ToggleGroup, { "aria-label": t("library.view"), variant: "outline", size: "sm", spacing: 0, value: [view], onValueChange: (next) => {
                            const picked = next[0];
                            if (picked === "grid" || picked === "list")
                                setView(picked);
                        }, className: "ml-auto", children: [_jsx(ToggleGroupItem, { value: "grid", "aria-label": t("library.viewGrid"), children: _jsx(LayoutGrid, { "aria-hidden": true }) }), _jsx(ToggleGroupItem, { value: "list", "aria-label": t("library.viewList"), children: _jsx(List, { "aria-hidden": true }) })] })] }), _jsxs("div", { className: "relative flex min-h-0 flex-1 overflow-hidden", children: [_jsxs("div", { className: "flex min-w-0 flex-1 flex-col overflow-hidden", children: [_jsxs("div", { className: "flex min-h-0 flex-1 flex-col overflow-y-auto p-4 lg:p-6", children: [loadError && (_jsx(LoadErrorAlert, { message: loadError, onRetry: () => void mediaQuery.refetch(), className: "mb-4" })), items.length === 0 ? (loadError ? null : mediaQuery.isPending ? (_jsx("ul", { "aria-hidden": true, className: "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6", children: Array.from({ length: 6 }, (_, index) => (_jsx("li", { children: _jsx(Skeleton, { className: "aspect-square w-full rounded-lg" }) }, index))) })) : filtered ? (_jsx(EmptyState, { icon: SearchX, title: t("library.emptyNoMatch"), description: t("library.emptyNoMatchHint"), action: { label: t("library.clearFilters"), onClick: clearFilters } })) : (_jsx(EmptyState, { icon: ImageIcon, title: t("library.emptyYet"), description: t("library.emptyYetHint"), action: {
                                            label: t("library.upload"),
                                            icon: Upload,
                                            onClick: () => fileInputRef.current?.click(),
                                        } }))) : view === "grid" ? (_jsx(MediaGrid, { ...viewProps })) : (_jsx(MediaTable, { ...viewProps }))] }), _jsx(ListPagination, { total: total, shown: items.length, page: page, pageSize: pageSize, onPageChange: (next) => update({ page: next }), onPageSizeChange: (size) => update({ pageSize: size }) })] }), selected && (_jsx(DockedPanel, { resize: MEDIA_PANEL_RESIZE, children: _jsx(MediaDetailPanel, { media: selected, folders: folders, onClose: () => void openDetail(null), onSaveDefaults: (defaults) => saveDefaultsMutation.mutateAsync({ media: selected, defaults }), onRename: (filename) => renameMutation.mutateAsync({ media: selected, filename }), onMoveFolder: (targetFolderId) => moveMediaToFolder(selected, targetFolderId), onRequestDelete: () => void requestDelete(selected), onDirtyChange: setDetailDirty }, selected.id) }))] }), dialog, guardDialog, folderActions.dialogs] }));
}
