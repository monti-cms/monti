"use client";

import type { CollectionPreferences, Folder, ListEntriesItem, PreferencesBody } from "@monti-cms/core/site";
import { useSite, useTranslator, withBasePath } from "@monti-cms/core/site";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { errorText } from "../api/client";
import { type BulkSelection, duplicateEntry, type EntryWriteResult, entriesKeys, listEntries } from "../api/entries";
import { foldersKeys, listFolders } from "../api/folders";
import { getPreferences, preferencesKeys, savePreferences as putPreferences } from "../api/preferences";
import { useCmsMutation } from "../api/use-cms-mutation";
import { commonMessages } from "../lib/common.messages";
import { useAdminRouter, useAdminSearchParams } from "../router";
import { bulkBarMessages } from "./entries/bulk-bar.messages";
import { toSelection } from "./entries/bulk-model";
import { copyTitle } from "./entries/entry-form";
import { trashConfirm, trashSubjectOfRow } from "./entries/lifecycle-confirm";
import { actionTargets, rowMenuActions } from "./list-row-menu";
import {
	isExplorerMode,
	type ListState,
	listStateToApiQuery,
	listStateToSearchParams,
	parseListState,
} from "./list-state";
import { screensMessages } from "./messages";
import type { MenuAction } from "./shared/action-menu";
import { useConfirm } from "./shared/confirm-dialog";
import type { DraggedEntry } from "./shared/entry-drag";
import { nounVars } from "./shared/noun.messages";
import { isInsideFolder, useFolderActions } from "./shared/use-folder-actions";
import { useTaxonomyOptions } from "./shared/use-taxonomy";
import { useEntryMutations } from "./use-entry-mutations";
import { useRecordPanel } from "./use-record-panel";

export type ListMode = "list" | "trash";

/**
 * List state in the address bar. When the address has no page size or sort, uses the saved per-collection settings,
 * and saves when sort, page size or column settings change.
 */
function useListState(mode: ListMode) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const router = useAdminRouter();
	const searchParams = useAdminSearchParams();
	const basePath = mode === "trash" ? site.adminHref("/trash") : site.adminHref();
	const parsed = useMemo(
		() => parseListState(site, new URLSearchParams(searchParams.toString())),
		[searchParams, site],
	);
	// Cached for the session: the list is not drawn until the settings are known, and a later fetch never reorders it under the user.
	// A failed load falls back to the defaults (the list still works); saving a setting reports its own failure.
	const preferencesQuery = useQuery({
		queryKey: preferencesKeys.all,
		queryFn: ({ signal }) => getPreferences(site, signal).catch((): PreferencesBody => ({})),
		staleTime: Number.POSITIVE_INFINITY,
	});
	const preferences = preferencesQuery.data ?? null;

	const collectionPrefs: CollectionPreferences = preferences?.collections?.[parsed.collection] ?? {};
	const isTrash = mode === "trash";
	// The trash starts with what was trashed last, and keeps no sort of its own in the settings: the list's saved sort is not its.
	const sortPrefs = isTrash ? undefined : collectionPrefs.sort;
	const state: ListState = useMemo(
		() => ({
			...parsed,
			pageSize: parsed.explicit.pageSize ? parsed.pageSize : (collectionPrefs.pageSize ?? parsed.pageSize),
			sortField: parsed.explicit.sort
				? parsed.sortField
				: isTrash
					? "trashedAt"
					: (sortPrefs?.field ?? parsed.sortField),
			sortDirection: parsed.explicit.sort ? parsed.sortDirection : (sortPrefs?.direction ?? parsed.sortDirection),
		}),
		[parsed, collectionPrefs, sortPrefs, isTrash],
	);

	const navigate = useCallback(
		(next: ListState) => router.replace(`${basePath}?${listStateToSearchParams(next).toString()}`, { scroll: false }),
		[router, basePath],
	);
	/** Updates the state and writes it to the address. Resets to the first page by default. */
	const update = useCallback(
		(patch: Partial<ListState>, options: { resetPage?: boolean } = { resetPage: true }) =>
			navigate({ ...state, ...(options.resetPage ? { page: 1 } : {}), ...patch }),
		[navigate, state],
	);

	const collection = state.collection;
	const preferencesMutation = useCmsMutation<CollectionPreferences, unknown, PreferencesBody>({
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
	const savePreferences = (patch: CollectionPreferences) => preferencesMutation.mutate(patch);

	// The saved sort and page size only matter when the address does not say them.
	const ready = preferences !== null || (parsed.explicit.pageSize && parsed.explicit.sort);
	return { state, ready, update, columnSettings: collectionPrefs.columns, savePreferences };
}

/**
 * One page of the list plus folders. Draws from cache right away and refetches in the background. Keeps the previous rows while conditions change
 * (`keepPreviousData`) so a placeholder does not flicker. A placeholder shows only when there is no cache at all.
 */
function useEntriesData(state: ListState, mode: ListMode, ready: boolean, showsFolders: boolean) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const isTrash = mode === "trash";
	const collection = state.collection;

	const foldersQuery = useQuery({
		queryKey: foldersKeys.list(collection),
		queryFn: ({ signal }) => listFolders(site, collection, signal),
		enabled: showsFolders,
	});
	const folders = useMemo(() => (showsFolders ? (foldersQuery.data ?? []) : []), [showsFolders, foldersQuery.data]);

	const apiQuery = listStateToApiQuery(site, state, { trash: isTrash }).toString();
	const listKey = entriesKeys.list(apiQuery);
	const entriesQuery = useQuery({
		queryKey: listKey,
		queryFn: ({ signal }) => listEntries(site, apiQuery, signal, t("list.loadFailed")),
		// Waits for the saved sort and page size, so the list is requested once with them instead of twice.
		enabled: ready,
		// Rows from another collection have a different column layout, so they are not kept.
		placeholderData: (previous, previousQuery) =>
			previousQuery && new URLSearchParams(String(previousQuery.queryKey.at(-1))).get("collection") === collection
				? keepPreviousData(previous)
				: undefined,
	});

	return {
		folders,
		apiQuery,
		listKey,
		items: entriesQuery.data?.items ?? [],
		total: entriesQuery.data?.total ?? 0,
		errorMessage:
			entriesQuery.error && !entriesQuery.data ? errorText(site, entriesQuery.error, t("list.loadFailed")) : null,
		isLoading: entriesQuery.isPending,
		isRefreshing: entriesQuery.isPlaceholderData,
		retry: () => void entriesQuery.refetch(),
	};
}

/** Subfolders directly inside the current folder, and one level up. None while searching or filtering, or where the list shows no folders. */
function explorerOf(state: ListState, folders: readonly Folder[], showsFolders: boolean) {
	if (!showsFolders || !isExplorerMode(state)) return null;
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
export function useEntryList(mode: ListMode) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const tc = useTranslator(commonMessages);
	const router = useAdminRouter();
	const queryClient = useQueryClient();
	const isTrash = mode === "trash";
	const { state, ready, update, columnSettings, savePreferences } = useListState(mode);
	const collection = state.collection;
	const isRecord = site.isItemCollection(collection);
	const isContent = site.isDocumentCollection(collection);
	// The one answer to "does this list show folders": the collection uses them (the rule the server checks every folder write against) and this is
	// not the trash. Folder menus, dialogs, drop targets and the bulk move all hang off `folders` below, which is `null` where this is false.
	const showsFolders = site.foldersEnabled(collection) && !isTrash;
	const options = useTaxonomyOptions(collection, !isTrash);

	const data = useEntriesData(state, mode, ready, showsFolders);
	const { items, folders } = data;

	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	// Select all targets the current page only. Changing the list clears the selection.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset whenever the visible query changes
	useEffect(() => setSelectedIds(new Set()), [data.apiQuery]);
	const { confirm, confirmDiscard, dialog: confirmDialog } = useConfirm();
	// The entries whose export dialog is open (from the bar's ⋯ or the menu of several rows).
	const [exportIds, setExportIds] = useState<string[] | null>(null);
	const { recordTarget, openRecord, showRecord, closeRecord, setRecordDirty, guardDialog } = useRecordPanel({
		collection,
		mode,
		confirmDiscard,
	});

	const mutations = useEntryMutations({
		listKey: data.listKey,
		state,
		options,
		// A change of a relation leaves the rows picked: its menu is still open to change them again.
		onResults: (results, op) => {
			if (!op.startsWith("relation."))
				setSelectedIds(new Set(results.filter((result) => !result.ok).map((result) => result.id)));
		},
	});
	const { bulk, restore, invalidateEntries } = mutations;

	const folderActions = useFolderActions({
		collection,
		folders,
		onChanged: async (change) => {
			await queryClient.invalidateQueries({ queryKey: foldersKeys.list(collection) });
			// If the folder being viewed (or one inside it) went to the trash, go up to the folder it was in, or to the all view.
			const { deleted } = change ?? {};
			if (deleted && state.folder !== "all" && isInsideFolder(folders, state.folder, deleted.id)) {
				update({ folder: deleted.parentId ?? "all" });
			}
			await invalidateEntries();
		},
	});

	const moveEntries = (folderId: string | null, entries: DraggedEntry[]) =>
		void bulk(
			"folder.move",
			t("bulk.move"),
			entries.map((entry) => {
				const row = items.find((item) => item.id === entry.id);
				return { ...entry, title: row?.title, folderId: row?.folderId };
			}),
			{ folderId },
		);

	const titleOf = (targets: BulkSelection[]) => `'${targets[0]?.title || tc("untitled")}'`;

	/** Moves to the trash at once; a published entry (or one with a published translation) asks first, because it leaves the site. */
	const confirmTrash = async (targets: BulkSelection[]) => {
		const rows = targets.flatMap((target) => items.filter((item) => item.id === target.id));
		const ask = trashConfirm(site, collection, rows.map(trashSubjectOfRow));
		if (ask && !(await confirm(ask))) return;
		await bulk("trash", tc("lifecycle.trash"), targets);
	};

	const tb = useTranslator(bulkBarMessages);
	const confirmPublish = async (targets: BulkSelection[]) => {
		const ok = await confirm({
			title: tc("lifecycle.publish"),
			description: tb("ask.publish", { count: targets.length, ...nounVars(site, collection) }),
			confirmLabel: tc("lifecycle.publish"),
		});
		if (ok) await bulk("publish", tc("lifecycle.publish"), targets);
	};

	const confirmArchive = async (targets: BulkSelection[]) => {
		const ok = await confirm({
			title: tc("lifecycle.archive"),
			description:
				targets.length === 1
					? t("archive.askOne", { title: titleOf(targets) })
					: t("archive.askMany", { count: targets.length, ...nounVars(site, collection) }),
			confirmLabel: tc("lifecycle.archive"),
		});
		if (ok) await bulk("archive", tc("lifecycle.archive"), targets);
	};

	const confirmPermanentDelete = async (targets: BulkSelection[]) => {
		const ok = await confirm({
			title: tc("lifecycle.deletePermanently"),
			description:
				targets.length === 1
					? t("delete.askOne", { title: titleOf(targets) })
					: t("delete.askMany", { count: targets.length }),
			confirmLabel: tc("lifecycle.deletePermanently"),
			destructive: true,
		});
		if (ok) await bulk("permanentDelete", tc("lifecycle.deletePermanently"), targets);
	};

	const duplicateMutation = useCmsMutation<ListEntriesItem, EntryWriteResult>({
		fn: (item, { site }) =>
			duplicateEntry(site, item.id, { title: copyTitle(site, item.collection, item.title) }, t("duplicate.failed")),
		success: (_copy, item) => t("duplicate.done", { title: item.title || tc("untitled") }),
		failure: t("duplicate.failed"),
		onSuccess: (copy) => router.navigate(site.adminEntryEditHref(copy.entry.id)),
	});
	const duplicate = (item: ListEntriesItem) => duplicateMutation.mutate(item);

	/** New item. Document entries are created in the edit screen in the current folder; taxonomy items through a small form. */
	const createNew = () =>
		isRecord
			? void openRecord({ collection, id: null })
			: router.navigate(
					site.adminHref(
						`/entries/new?collection=${collection}${state.folder !== "all" ? `&folder=${state.folder}` : ""}`,
					),
				);

	const editHref = (item: ListEntriesItem) => site.adminEntryEditHref(item.id);
	const rowMenu = (item: ListEntriesItem): MenuAction[] =>
		rowMenuActions(
			site,
			actionTargets(item, items, selectedIds),
			{ mode, isRecord, isContent, folders: showsFolders ? folders : null, collection },
			{
				openEditor: (target) => router.navigate(editHref(target)),
				openInNewTab: (target) => window.open(withBasePath(editHref(target)), "_blank", "noopener"),
				openRecord: (target) => void openRecord({ collection, id: target.id }),
				duplicate: (target) => duplicate(target),
				restore: (targets) => void restore(targets),
				confirmPublish: (targets) => void confirmPublish(targets),
				exportEntries: (ids) => setExportIds(ids),
				confirmTrash: (targets) => void confirmTrash(targets),
				confirmArchive: (targets) => void confirmArchive(targets),
				confirmPermanentDelete: (targets) => void confirmPermanentDelete(targets),
				bulk: (op, label, targets, params) => void bulk(op, label, targets, params),
			},
		);

	/** Delete key on a row. On the list it moves to trash; in trash it asks about permanent delete. */
	const onDeleteKey = (item: ListEntriesItem) => {
		const targets = actionTargets(item, items, selectedIds).map(toSelection);
		if (isTrash) void confirmPermanentDelete(targets);
		else void confirmTrash(targets);
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
		/**
		 * The folders of this list and what can be done with them; `null` where the list shows no folders (a collection without folders, the trash).
		 * Every folder entry point (the sidebar tree, folder rows, the blank-area and row menus, the bulk move, dropping rows on a folder) reads this,
		 * so none of them can offer folders the server would refuse.
		 */
		folders: showsFolders ? { list: folders, actions: folderActions, moveEntries } : null,
		/** The folder dialogs (create, rename, delete). Render once per screen; they open only through `folders.actions`. */
		folderDialogs: folderActions.dialogs,
		explorer: explorerOf(state, folders, showsFolders),
		selectedIds,
		setSelectedIds,
		mutations,
		recordTarget,
		openRecord,
		showRecord,
		closeRecord,
		setRecordDirty,
		/** Confirm dialogs of this list (move to trash, archive, permanent delete, discard changes). Render once per screen. */
		confirmDialog,
		/** The discard dialog of a link clicked while the panel has changes. Render once per screen. */
		guardDialog,
		/** Opens the export of these entries. */
		exportEntries: (ids: string[]) => setExportIds(ids),
		/** The entries whose export dialog is open, or `null`. */
		exportIds,
		closeExport: () => setExportIds(null),
		reloadTaxonomies: () => void queryClient.invalidateQueries({ queryKey: entriesKeys.taxonomy() }),
		invalidateEntries,
		createNew,
		rowMenu,
		onDeleteKey,
		restore,
		confirmPermanentDelete: (targets: BulkSelection[]) => void confirmPermanentDelete(targets),
	};
}

export type EntryList = ReturnType<typeof useEntryList>;
