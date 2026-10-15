"use client";
import { useSite, useTranslator, withBasePath } from "@monti-cms/core/client";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CmsApiError, errorText } from "../api/client.js";
import { bulkEntries, changeEntryStatus, duplicateEntry, entriesKeys, listEntries, } from "../api/entries.js";
import { foldersKeys, listFolders } from "../api/folders.js";
import { getPreferences, preferencesKeys, savePreferences as putPreferences } from "../api/preferences.js";
import { useCmsMutation } from "../api/use-cms-mutation.js";
import { commonMessages } from "../lib/common.messages.js";
import { useAdminRouter, useAdminSearchParams } from "../router/index.js";
import { describeBulkFailure } from "./entries/bulk-bar.js";
import { copyTitle } from "./entries/entry-form.js";
import { actionTargets, rowMenuActions, toSelection } from "./list-row-menu.js";
import { isExplorerMode, listStateToApiQuery, listStateToSearchParams, parseListState, } from "./list-state.js";
import { screensMessages } from "./messages.js";
import { useConfirm } from "./shared/confirm-dialog.js";
import { OPEN_ITEM_PARAM } from "./shared/entry-href.js";
import { applyOptimistic } from "./shared/list-cache.js";
import { nounVars } from "./shared/noun.messages.js";
import { useFolderActions } from "./shared/use-folder-actions.js";
import { useTaxonomyOptions } from "./shared/use-taxonomy.js";
import { useUnsavedGuard } from "./shared/use-unsaved-guard.js";
/**
 * List state in the address bar. When the address has no page size or sort, uses the saved per-collection settings,
 * and saves when sort, page size or column settings change.
 */
function useListState(mode) {
    const site = useSite();
    const t = useTranslator(screensMessages);
    const router = useAdminRouter();
    const searchParams = useAdminSearchParams();
    const basePath = mode === "trash" ? site.adminHref("/trash") : site.adminHref();
    const parsed = useMemo(() => parseListState(site, new URLSearchParams(searchParams.toString())), [searchParams, site]);
    // Cached for the session: the list is not drawn until the settings are known, and a later fetch never reorders it under the user.
    // A failed load falls back to the defaults (the list still works); saving a setting reports its own failure.
    const preferencesQuery = useQuery({
        queryKey: preferencesKeys.all,
        queryFn: ({ signal }) => getPreferences(site, signal).catch(() => ({})),
        staleTime: Number.POSITIVE_INFINITY,
    });
    const preferences = preferencesQuery.data ?? null;
    const collectionPrefs = preferences?.collections?.[parsed.collection] ?? {};
    const state = useMemo(() => ({
        ...parsed,
        pageSize: parsed.explicit.pageSize ? parsed.pageSize : (collectionPrefs.pageSize ?? parsed.pageSize),
        sortField: parsed.explicit.sort ? parsed.sortField : (collectionPrefs.sort?.field ?? parsed.sortField),
        sortDirection: parsed.explicit.sort
            ? parsed.sortDirection
            : (collectionPrefs.sort?.direction ?? parsed.sortDirection),
    }), [parsed, collectionPrefs]);
    const navigate = useCallback((next) => router.replace(`${basePath}?${listStateToSearchParams(next).toString()}`, { scroll: false }), [router, basePath]);
    /** Updates the state and writes it to the address. Resets to the first page by default. */
    const update = useCallback((patch, options = { resetPage: true }) => navigate({ ...state, ...(options.resetPage ? { page: 1 } : {}), ...patch }), [navigate, state]);
    const collection = state.collection;
    const preferencesMutation = useCmsMutation({
        fn: (patch, { site }) => putPreferences(site, { collections: { [collection]: patch } }),
        failure: t("list.prefsSaveFailed"),
        optimistic: {
            queryKey: preferencesKeys.all,
            update: (current, patch) => ({
                ...current,
                collections: { ...current.collections, [collection]: { ...current.collections?.[collection], ...patch } },
            }),
        },
    });
    const savePreferences = (patch) => preferencesMutation.mutate(patch);
    // The saved sort and page size only matter when the address does not say them.
    const ready = preferences !== null || (parsed.explicit.pageSize && parsed.explicit.sort);
    return { state, ready, update, columnSettings: collectionPrefs.columns, savePreferences };
}
/**
 * One page of the list plus folders. Draws from cache right away and refetches in the background. Keeps the previous rows while conditions change
 * (`keepPreviousData`) so a placeholder does not flicker. A placeholder shows only when there is no cache at all.
 */
function useEntriesData(state, mode, ready, foldersEnabled = true) {
    const site = useSite();
    const t = useTranslator(screensMessages);
    const isTrash = mode === "trash";
    const collection = state.collection;
    const foldersQuery = useQuery({
        queryKey: foldersKeys.list(collection),
        queryFn: ({ signal }) => listFolders(site, collection, signal),
        enabled: !isTrash && foldersEnabled,
    });
    const folders = useMemo(() => (!foldersEnabled || isTrash ? [] : (foldersQuery.data ?? [])), [foldersEnabled, isTrash, foldersQuery.data]);
    const apiQuery = listStateToApiQuery(site, state, { trash: isTrash }).toString();
    const listKey = entriesKeys.list(apiQuery);
    const entriesQuery = useQuery({
        queryKey: listKey,
        queryFn: ({ signal }) => listEntries(site, apiQuery, signal, t("list.loadFailed")),
        // Waits for the saved sort and page size, so the list is requested once with them instead of twice.
        enabled: ready,
        // Rows from another collection have a different column layout, so they are not kept.
        placeholderData: (previous, previousQuery) => previousQuery && new URLSearchParams(String(previousQuery.queryKey.at(-1))).get("collection") === collection
            ? keepPreviousData(previous)
            : undefined,
    });
    return {
        folders,
        apiQuery,
        listKey,
        items: entriesQuery.data?.items ?? [],
        total: entriesQuery.data?.total ?? 0,
        errorMessage: entriesQuery.error && !entriesQuery.data ? errorText(site, entriesQuery.error, t("list.loadFailed")) : null,
        isLoading: entriesQuery.isPending,
        isRefreshing: entriesQuery.isPlaceholderData,
        retry: () => void entriesQuery.refetch(),
    };
}
/** Reports bulk results as notifications. Failures list the item name and reason. */
function announce(site, label, results, items) {
    const t = site.createTranslator(screensMessages);
    const tc = site.createTranslator(commonMessages);
    const failures = results.filter((result) => !result.ok);
    const ok = results.length - failures.length;
    if (failures.length === 0) {
        toast.success(t("bulk.success", { count: ok, label }));
        return;
    }
    const titleOf = (id) => items.find((item) => item.id === id)?.title || tc("untitled");
    toast.error(ok > 0 ? t("bulk.partial", { ok, label, failed: failures.length }) : t("bulk.failed", { label }), {
        description: failures
            .slice(0, 3)
            .map((failure) => `${titleOf(failure.id)} — ${describeBulkFailure(site, failure)}`)
            .join("\n"),
    });
}
/**
 * An action that changes the list. Applies the change to the list first, then sends the request. If the request itself fails it is rolled back,
 * and when it ends the list is synced to server values. Per-item results go to `onResults` (used to keep failed items selected).
 */
function useEntryMutations({ listKey, state, options, onResults, }) {
    const site = useSite();
    const t = useTranslator(screensMessages);
    const tc = useTranslator(commonMessages);
    const queryClient = useQueryClient();
    /** Refetches both the list and the trash badge (leaving the currently visible rows as they are). */
    const invalidateEntries = () => queryClient.invalidateQueries({ queryKey: entriesKeys.all });
    /**
     * Applies the change to the list first, then sends the request; a failed request rolls the list back, and the list is synced to server
     * values once it ends. Restoring is not in the bulk API, so it requests per item. A failure is thrown to the caller (`inline`).
     */
    const mutation = useCmsMutation({
        fn: async ({ op, targets, params }, { site }) => {
            if (op !== "restore")
                return bulkEntries(site, op, targets, params);
            const out = [];
            for (const target of targets) {
                try {
                    await changeEntryStatus(site, target.id, "restore", { expectedVersion: target.expectedVersion });
                    out.push({ id: target.id, ok: true, version: target.expectedVersion + 1 });
                }
                catch (error) {
                    out.push({ id: target.id, ok: false, error: (error instanceof CmsApiError && error.code) || "internal" });
                }
            }
            return out;
        },
        failure: ({ op }) => t("bulk.failed", { label: op }),
        inline: true,
        optimistic: {
            queryKey: listKey,
            update: (page, { op, targets, params }) => applyOptimistic(page, op, new Set(targets.map((target) => target.id)), { state, params, options }),
        },
        invalidate: [entriesKeys.all],
        onSuccess: onResults,
    });
    const run = (op, targets, params) => mutation.mutateAsync({ op, targets, params });
    /** Handles the action through the bulk API and reports the result. */
    const bulk = async (op, label, targets, params = {}) => {
        try {
            announce(site, label, await run(op, targets, params), targets);
        }
        catch (error) {
            toast.error(errorText(site, error, t("bulk.failed", { label })));
        }
    };
    /** Trash restore. */
    const restore = async (targets) => {
        announce(site, tc("lifecycle.restore"), await run("restore", targets), targets);
    };
    return { run, bulk, restore, invalidateEntries };
}
/** Subfolders directly inside the current folder, and one level up. None while searching or filtering, or in trash. */
function explorerOf(state, folders, mode, foldersEnabled = true) {
    if (!foldersEnabled || mode === "trash" || !isExplorerMode(state))
        return null;
    const current = state.folder === "all" ? null : state.folder;
    const currentFolder = current ? folders.find((folder) => folder.id === current) : undefined;
    return {
        folders: folders.filter((folder) => (folder.parentId ?? null) === current),
        parent: current ? (currentFolder?.parentId ?? "all") : null,
    };
}
/**
 * State, data and actions of the list and trash screens. Draws no UI pieces.
 * Shared by the sidebar folder navigation (list screen) and the body.
 */
export function useEntryList(mode) {
    const site = useSite();
    const t = useTranslator(screensMessages);
    const tc = useTranslator(commonMessages);
    const router = useAdminRouter();
    const queryClient = useQueryClient();
    const isTrash = mode === "trash";
    const { state, ready, update, columnSettings, savePreferences } = useListState(mode);
    const collection = state.collection;
    const def = site.COLLECTION_DEFINITIONS[collection];
    const isRecord = site.isItemCollection(collection);
    const isContent = site.isDocumentCollection(collection);
    const foldersEnabled = def?.folders ?? isContent;
    const options = useTaxonomyOptions(collection, !isTrash);
    const data = useEntriesData(state, mode, ready, foldersEnabled);
    const { items, folders } = data;
    const [selectedIds, setSelectedIds] = useState(new Set());
    // Select all targets the current page only. Changing the list clears the selection.
    // biome-ignore lint/correctness/useExhaustiveDependencies: reset whenever the visible query changes
    useEffect(() => setSelectedIds(new Set()), [data.apiQuery]);
    const [recordTarget, setRecordTarget] = useState(null);
    const { confirm, confirmDiscard, dialog: confirmDialog } = useConfirm();
    /** Whether the taxonomy edit panel has unsaved changes. The panel reports it. */
    const recordDirtyRef = useRef(false);
    /** The same, as state, for the guard on links that leave the list (the sidebar, another collection). */
    const [recordDirty, setRecordDirtyState] = useState(false);
    const { dialog: guardDialog } = useUnsavedGuard(recordDirty);
    const setRecordDirty = (dirty) => {
        recordDirtyRef.current = dirty;
        setRecordDirtyState(dirty);
    };
    /** Opens the taxonomy edit panel directly (without asking). Used to keep a saved item open as is. */
    const showRecord = (target) => {
        setRecordDirty(false);
        setRecordTarget(target);
    };
    /** Opens the taxonomy edit panel. If there are unsaved changes, asks first whether to discard them. */
    const openRecord = async (target) => {
        if (await confirmDiscard(recordDirtyRef.current))
            showRecord(target);
    };
    const closeRecord = () => {
        setRecordDirty(false);
        setRecordTarget(null);
    };
    // The panel belongs to the collection it was opened in: moving to another collection (the guard asked first if it had changes) closes it.
    // biome-ignore lint/correctness/useExhaustiveDependencies: close only when the collection changes
    useEffect(() => {
        if (recordTarget && recordTarget.collection !== state.collection)
            closeRecord();
    }, [state.collection]);
    // The address's `open` (an item opened from, e.g., media usages) opens once into the item slot and is then removed from the address.
    const searchParams = useAdminSearchParams();
    const openParam = searchParams.get(OPEN_ITEM_PARAM);
    // biome-ignore lint/correctness/useExhaustiveDependencies: open only when the address value changes
    useEffect(() => {
        if (!openParam || !site.isItemCollection(state.collection) || mode === "trash")
            return;
        showRecord({ collection: state.collection, id: openParam });
        const next = new URLSearchParams(searchParams.toString());
        next.delete(OPEN_ITEM_PARAM);
        router.replace(site.adminHref(`?${next.toString()}`), { scroll: false });
    }, [openParam]);
    const mutations = useEntryMutations({
        listKey: data.listKey,
        state,
        options,
        onResults: (results) => setSelectedIds(new Set(results.filter((result) => !result.ok).map((result) => result.id))),
    });
    const { bulk, restore, invalidateEntries } = mutations;
    const folderActions = useFolderActions({
        collection,
        folders,
        onChanged: async (deletedId) => {
            await queryClient.invalidateQueries({ queryKey: foldersKeys.list(collection) });
            // If the folder being viewed was deleted, go back to the all view.
            if (deletedId && state.folder === deletedId)
                update({ folder: "all" });
            else
                await invalidateEntries();
        },
    });
    const moveEntries = (folderId, entries) => void bulk("folder.move", t("bulk.move"), entries.map((entry) => ({ ...entry, title: items.find((item) => item.id === entry.id)?.title })), { folderId });
    const titleOf = (targets) => `'${targets[0]?.title || tc("untitled")}'`;
    const confirmTrash = async (targets) => {
        const ok = await confirm({
            title: tc("lifecycle.trash"),
            description: targets.length === 1
                ? t("trash.askOne", { title: titleOf(targets) })
                : t("trash.askMany", { count: targets.length }),
            confirmLabel: tc("lifecycle.trash"),
            destructive: true,
        });
        if (ok)
            await bulk("trash", tc("lifecycle.trash"), targets);
    };
    const confirmArchive = async (targets) => {
        const ok = await confirm({
            title: tc("lifecycle.archive"),
            description: targets.length === 1
                ? t("archive.askOne", { title: titleOf(targets) })
                : t("archive.askMany", { count: targets.length, ...nounVars(site, collection) }),
            confirmLabel: tc("lifecycle.archive"),
        });
        if (ok)
            await bulk("archive", tc("lifecycle.archive"), targets);
    };
    const confirmPermanentDelete = async (targets) => {
        const ok = await confirm({
            title: tc("lifecycle.deletePermanently"),
            description: targets.length === 1
                ? t("delete.askOne", { title: titleOf(targets) })
                : t("delete.askMany", { count: targets.length }),
            confirmLabel: tc("lifecycle.deletePermanently"),
            destructive: true,
        });
        if (ok)
            await bulk("permanentDelete", tc("lifecycle.deletePermanently"), targets);
    };
    const duplicateMutation = useCmsMutation({
        fn: (item, { site }) => duplicateEntry(site, item.id, { title: copyTitle(site, item.collection, item.title) }, t("duplicate.failed")),
        success: (_copy, item) => t("duplicate.done", { title: item.title || tc("untitled") }),
        failure: t("duplicate.failed"),
        onSuccess: (copy) => router.navigate(site.adminEntryEditHref(copy.entry.id)),
    });
    const duplicate = (item) => duplicateMutation.mutate(item);
    /** New item. Document entries are created in the edit screen in the current folder; taxonomy items through a small form. */
    const createNew = () => isRecord
        ? void openRecord({ collection, id: null })
        : router.navigate(site.adminHref(`/entries/new?collection=${collection}${state.folder !== "all" ? `&folder=${state.folder}` : ""}`));
    const editHref = (item) => site.adminEntryEditHref(item.id);
    const rowMenu = (item) => rowMenuActions(site, actionTargets(item, items, selectedIds), { mode, isRecord, isContent, folders, collection, options }, {
        openEditor: (target) => router.navigate(editHref(target)),
        openInNewTab: (target) => window.open(withBasePath(editHref(target)), "_blank", "noopener"),
        openRecord: (target) => void openRecord({ collection, id: target.id }),
        duplicate: (target) => duplicate(target),
        restore: (targets) => void restore(targets),
        confirmTrash: (targets) => void confirmTrash(targets),
        confirmArchive: (targets) => void confirmArchive(targets),
        confirmPermanentDelete: (targets) => void confirmPermanentDelete(targets),
        bulk: (op, label, targets, params) => void bulk(op, label, targets, params),
    });
    /** Delete key on a row. On the list it moves to trash; in trash it asks about permanent delete. */
    const onDeleteKey = (item) => {
        const targets = actionTargets(item, items, selectedIds).map(toSelection);
        if (isTrash)
            void confirmPermanentDelete(targets);
        else
            void confirmTrash(targets);
    };
    return {
        mode,
        state,
        update,
        label: site.COLLECTION_DEFINITIONS[collection].label,
        options,
        columnSettings,
        savePreferences,
        data,
        foldersEnabled,
        explorer: explorerOf(state, folders, mode, foldersEnabled),
        selectedIds,
        setSelectedIds,
        mutations,
        folderActions,
        recordTarget,
        openRecord,
        showRecord,
        closeRecord,
        setRecordDirty,
        /** Confirm dialogs of this list (move to trash, archive, permanent delete, discard changes). Render once per screen. */
        confirmDialog,
        /** The discard dialog of a link clicked while the panel has changes. Render once per screen. */
        guardDialog,
        reloadTaxonomies: () => void queryClient.invalidateQueries({ queryKey: entriesKeys.taxonomy() }),
        invalidateEntries,
        moveEntries,
        createNew,
        rowMenu,
        onDeleteKey,
        restore,
        confirmPermanentDelete: (targets) => void confirmPermanentDelete(targets),
    };
}
