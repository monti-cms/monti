"use client";

import type { CollectionPreferences, PreferencesBody } from "@monti-cms/core/client";
import {
	adminEntryEditHref,
	adminHref,
	COLLECTION_DEFINITIONS,
	cmsApiUrl,
	createTranslator,
	isDocumentCollection,
	isItemCollection,
	withBasePath,
} from "@monti-cms/core/client";
import type { Folder, ListEntriesItem } from "@monti-cms/core/runtime";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { cmsFetch, errorText } from "./admin-api";
import { type BulkItemResult, type BulkSelection, describeBulkFailure, runBulk } from "./entries/bulk-bar";
import { copyTitle } from "./entries/entry-form";
import { actionTargets, type BulkParams, rowMenuActions, toSelection } from "./list-row-menu";
import {
	isExplorerMode,
	type ListState,
	listStateToApiQuery,
	listStateToSearchParams,
	parseListState,
} from "./list-state";
import { screensMessages } from "./messages";
import type { RecordTarget } from "./record-panel";
import type { MenuAction } from "./shared/action-menu";
import { useConfirm } from "./shared/confirm-dialog";
import type { DraggedEntry } from "./shared/entry-drag";
import { OPEN_ITEM_PARAM } from "./shared/entry-href";
import {
	applyOptimistic,
	ENTRIES_KEY,
	type EntriesPage,
	entriesKey,
	foldersKey,
	type OptimisticOp,
} from "./shared/list-cache";
import { useFolderActions } from "./shared/use-folder-actions";
import { type TaxonomyOptions, useTaxonomyOptions } from "./shared/use-taxonomy";

const t = createTranslator(screensMessages);

export type ListMode = "list" | "trash";

/**
 * List state in the address bar. When the address has no page size or sort, uses the saved per-collection settings,
 * and saves when sort, page size or column settings change.
 */
function useListState(mode: ListMode) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const basePath = mode === "trash" ? adminHref("/trash") : adminHref();
	const parsed = useMemo(() => parseListState(new URLSearchParams(searchParams.toString())), [searchParams]);
	const [preferences, setPreferences] = useState<PreferencesBody | null>(null);

	const collectionPrefs: CollectionPreferences = preferences?.collections?.[parsed.collection] ?? {};
	const state: ListState = useMemo(
		() => ({
			...parsed,
			pageSize: parsed.explicit.pageSize ? parsed.pageSize : (collectionPrefs.pageSize ?? parsed.pageSize),
			sortField: parsed.explicit.sort ? parsed.sortField : (collectionPrefs.sort?.field ?? parsed.sortField),
			sortDirection: parsed.explicit.sort
				? parsed.sortDirection
				: (collectionPrefs.sort?.direction ?? parsed.sortDirection),
		}),
		[parsed, collectionPrefs],
	);

	const navigate = useCallback(
		(next: ListState) =>
			router.replace(`${basePath}?${listStateToSearchParams(next).toString()}` as Route, { scroll: false }),
		[router, basePath],
	);
	/** Updates the state and writes it to the address. Resets to the first page by default. */
	const update = useCallback(
		(patch: Partial<ListState>, options: { resetPage?: boolean } = { resetPage: true }) =>
			navigate({ ...state, ...(options.resetPage ? { page: 1 } : {}), ...patch }),
		[navigate, state],
	);

	useEffect(() => {
		cmsFetch<PreferencesBody>(cmsApiUrl("/v1/preferences"))
			.then(setPreferences)
			.catch(() => setPreferences({}));
	}, []);

	const collection = state.collection;
	const savePreferences = (patch: CollectionPreferences) => {
		setPreferences((current) => ({
			...current,
			collections: { ...current?.collections, [collection]: { ...current?.collections?.[collection], ...patch } },
		}));
		void cmsFetch(cmsApiUrl("/v1/preferences"), {
			method: "PUT",
			json: { collections: { [collection]: patch } },
		}).catch(() => toast.error(t("list.prefsSaveFailed")));
	};

	return { state, update, columnSettings: collectionPrefs.columns, savePreferences };
}

/**
 * One page of the list plus folders. Draws from cache right away and refetches in the background. Keeps the previous rows while conditions change
 * (`keepPreviousData`) so a placeholder does not flicker. A placeholder shows only when there is no cache at all.
 */
function useEntriesData(state: ListState, mode: ListMode) {
	const isTrash = mode === "trash";
	const collection = state.collection;

	const foldersQuery = useQuery({
		queryKey: foldersKey(collection),
		queryFn: ({ signal }) => cmsFetch<Folder[]>(cmsApiUrl(`/v1/folders?collection=${collection}`), { signal }),
		enabled: !isTrash,
	});
	const folders = useMemo(() => (isTrash ? [] : (foldersQuery.data ?? [])), [isTrash, foldersQuery.data]);

	const apiQuery = listStateToApiQuery(state, { trash: isTrash }).toString();
	const listKey = entriesKey(apiQuery);
	const entriesQuery = useQuery({
		queryKey: listKey,
		queryFn: ({ signal }) =>
			cmsFetch<EntriesPage>(cmsApiUrl(`/v1/entries?${apiQuery}`), { signal, fallback: t("list.loadFailed") }),
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
		errorMessage: entriesQuery.error && !entriesQuery.data ? errorText(entriesQuery.error, t("list.loadFailed")) : null,
		isLoading: entriesQuery.isPending,
		isRefreshing: entriesQuery.isPlaceholderData,
		retry: () => void entriesQuery.refetch(),
	};
}

/** Reports bulk results as notifications. Failures list the item name and reason. */
function announce(label: string, results: BulkItemResult[], items: BulkSelection[]) {
	const failures = results.filter((result): result is Extract<BulkItemResult, { ok: false }> => !result.ok);
	const ok = results.length - failures.length;
	if (failures.length === 0) {
		toast.success(t("bulk.success", { count: ok, label }));
		return;
	}
	const titleOf = (id: string) => items.find((item) => item.id === id)?.title || t("common.untitled");
	toast.error(ok > 0 ? t("bulk.partial", { ok, label, failed: failures.length }) : t("bulk.failed", { label }), {
		description: failures
			.slice(0, 3)
			.map((failure) => `${titleOf(failure.id)} — ${describeBulkFailure(failure)}`)
			.join("\n"),
	});
}

/**
 * An action that changes the list. Applies the change to the list first, then sends the request. If the request itself fails it is rolled back,
 * and when it ends the list is synced to server values. Per-item results go to `onResults` (used to keep failed items selected).
 */
function useEntryMutations({
	listKey,
	state,
	options,
	onResults,
}: {
	listKey: ReturnType<typeof entriesKey>;
	state: ListState;
	options: TaxonomyOptions;
	onResults: (results: BulkItemResult[]) => void;
}) {
	const queryClient = useQueryClient();

	/** Refetches both the list and the trash badge (leaving the currently visible rows as they are). */
	const invalidateEntries = () => queryClient.invalidateQueries({ queryKey: ENTRIES_KEY });

	const mutateEntries = async (
		op: OptimisticOp,
		targets: BulkSelection[],
		request: () => Promise<BulkItemResult[]>,
		params?: BulkParams,
	): Promise<BulkItemResult[]> => {
		await queryClient.cancelQueries({ queryKey: listKey });
		const previous = queryClient.getQueryData<EntriesPage>(listKey);
		if (previous) {
			queryClient.setQueryData<EntriesPage>(
				listKey,
				applyOptimistic(previous, op, new Set(targets.map((target) => target.id)), {
					state,
					params,
					options,
				}),
			);
		}
		try {
			const results = await request();
			onResults(results);
			return results;
		} catch (error) {
			if (previous) queryClient.setQueryData(listKey, previous);
			throw error;
		} finally {
			void invalidateEntries();
		}
	};

	/** Handles the action through the bulk API and reports the result. */
	const bulk = async (
		op: Parameters<typeof runBulk>[0],
		label: string,
		targets: BulkSelection[],
		params: BulkParams = {},
	) => {
		try {
			const results = await mutateEntries(op, targets, () => runBulk(op, targets, params), params);
			announce(label, results, targets);
		} catch (error) {
			toast.error(errorText(error, t("bulk.failed", { label })));
		}
	};

	/** Trash restore. Not in the bulk API, so it requests per item. */
	const restore = async (targets: BulkSelection[]) => {
		const results = await mutateEntries("restore", targets, async () => {
			const out: BulkItemResult[] = [];
			for (const target of targets) {
				try {
					await cmsFetch(cmsApiUrl(`/v1/entries/${target.id}/restore`), {
						method: "POST",
						json: { expectedVersion: target.expectedVersion },
					});
					out.push({ id: target.id, ok: true, version: target.expectedVersion + 1 });
				} catch (error) {
					const code = (error as { code?: string }).code ?? "internal";
					out.push({ id: target.id, ok: false, error: code });
				}
			}
			return out;
		});
		announce(t("bulk.restore"), results, targets);
	};

	return { mutateEntries, bulk, restore, invalidateEntries };
}

/** Subfolders directly inside the current folder, and one level up. None while searching or filtering, or in trash. */
function explorerOf(state: ListState, folders: readonly Folder[], mode: ListMode) {
	if (mode === "trash" || !isExplorerMode(state)) return null;
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
	const router = useRouter();
	const queryClient = useQueryClient();
	const isTrash = mode === "trash";
	const { state, update, columnSettings, savePreferences } = useListState(mode);
	const collection = state.collection;
	const isRecord = isItemCollection(collection);
	const isContent = isDocumentCollection(collection);
	const options = useTaxonomyOptions(collection, !isTrash);

	const data = useEntriesData(state, mode);
	const { items, folders } = data;

	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	// Select all targets the current page only. Changing the list clears the selection.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset whenever the visible query changes
	useEffect(() => setSelectedIds(new Set()), [data.apiQuery]);
	const [recordTarget, setRecordTarget] = useState<RecordTarget | null>(null);
	const { confirm, confirmDiscard, dialog: confirmDialog } = useConfirm();
	/** Whether the taxonomy edit panel has unsaved changes. The panel reports it. */
	const recordDirtyRef = useRef(false);
	/** Opens the taxonomy edit panel directly (without asking). Used to keep a saved item open as is. */
	const showRecord = (target: RecordTarget) => {
		recordDirtyRef.current = false;
		setRecordTarget(target);
	};
	/** Opens the taxonomy edit panel. If there are unsaved changes, asks first whether to discard them. */
	const openRecord = async (target: RecordTarget) => {
		if (await confirmDiscard(recordDirtyRef.current)) showRecord(target);
	};
	const closeRecord = () => {
		recordDirtyRef.current = false;
		setRecordTarget(null);
	};
	// The address's `open` (an item opened from, e.g., media usages) opens once into the item slot and is then removed from the address.
	const searchParams = useSearchParams();
	const openParam = searchParams.get(OPEN_ITEM_PARAM);
	// biome-ignore lint/correctness/useExhaustiveDependencies: open only when the address value changes
	useEffect(() => {
		if (!openParam || !isItemCollection(state.collection) || mode === "trash") return;
		showRecord({ collection: state.collection, id: openParam });
		const next = new URLSearchParams(searchParams.toString());
		next.delete(OPEN_ITEM_PARAM);
		router.replace(adminHref(`?${next.toString()}`) as Route, { scroll: false });
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
			await queryClient.invalidateQueries({ queryKey: foldersKey(collection) });
			// If the folder being viewed was deleted, go back to the all view.
			if (deletedId && state.folder === deletedId) update({ folder: "all" });
			else await invalidateEntries();
		},
	});

	const moveEntries = (folderId: string | null, entries: DraggedEntry[]) =>
		void bulk(
			"folder.move",
			t("bulk.move"),
			entries.map((entry) => ({ ...entry, title: items.find((item) => item.id === entry.id)?.title })),
			{ folderId },
		);

	const titleOf = (targets: BulkSelection[]) => `'${targets[0]?.title || t("common.untitled")}'`;

	const confirmTrash = async (targets: BulkSelection[]) => {
		const ok = await confirm({
			title: t("bulk.trash"),
			description:
				targets.length === 1
					? t("trash.askOne", { title: titleOf(targets) })
					: t("trash.askMany", { count: targets.length }),
			confirmLabel: t("bulk.trash"),
			destructive: true,
		});
		if (ok) await bulk("trash", t("bulk.trash"), targets);
	};

	const confirmArchive = async (targets: BulkSelection[]) => {
		const ok = await confirm({
			title: t("archive.title"),
			description:
				targets.length === 1
					? t("archive.askOne", { title: titleOf(targets) })
					: t("archive.askMany", { count: targets.length }),
			confirmLabel: t("archive.title"),
		});
		if (ok) await bulk("archive", t("bulk.archive"), targets);
	};

	const confirmPermanentDelete = async (targets: BulkSelection[]) => {
		const ok = await confirm({
			title: t("delete.title"),
			description:
				targets.length === 1
					? t("delete.askOne", { title: titleOf(targets) })
					: t("delete.askMany", { count: targets.length }),
			confirmLabel: t("delete.title"),
			destructive: true,
		});
		if (ok) await bulk("permanentDelete", t("bulk.permanentDelete"), targets);
	};

	const duplicate = async (item: ListEntriesItem) => {
		try {
			const copy = await cmsFetch<{ id: string }>(cmsApiUrl(`/v1/entries/${item.id}/duplicate`), {
				method: "POST",
				json: { title: copyTitle(item.collection, item.title) },
				fallback: t("duplicate.failed"),
			});
			toast.success(t("duplicate.done", { title: item.title || t("common.untitled") }));
			router.push(adminEntryEditHref(copy.id) as Route);
		} catch (error) {
			toast.error(errorText(error, t("duplicate.failed")));
		}
	};

	/** New item. Posts and memos are created in the edit screen in the current folder; taxonomy items through a small form. */
	const createNew = () =>
		isRecord
			? void openRecord({ collection, id: null })
			: router.push(
					adminHref(
						`/entries/new?collection=${collection}${state.folder !== "all" ? `&folder=${state.folder}` : ""}`,
					) as Route,
				);

	const editHref = (item: ListEntriesItem) => adminEntryEditHref(item.id);
	const rowMenu = (item: ListEntriesItem): MenuAction[] =>
		rowMenuActions(
			actionTargets(item, items, selectedIds),
			{ mode, isRecord, isContent, folders, collection, options },
			{
				openEditor: (target) => router.push(editHref(target) as Route),
				openInNewTab: (target) => window.open(withBasePath(editHref(target)), "_blank", "noopener"),
				openRecord: (target) => void openRecord({ collection, id: target.id }),
				duplicate: (target) => void duplicate(target),
				restore: (targets) => void restore(targets),
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
		label: COLLECTION_DEFINITIONS[collection].label,
		options,
		columnSettings,
		savePreferences,
		data,
		explorer: explorerOf(state, folders, mode),
		selectedIds,
		setSelectedIds,
		mutations,
		folderActions,
		recordTarget,
		openRecord,
		showRecord,
		closeRecord,
		setRecordDirty: (dirty: boolean) => {
			recordDirtyRef.current = dirty;
		},
		/** Confirm dialogs of this list (move to trash, archive, permanent delete, discard changes). Render once per screen. */
		confirmDialog,
		reloadTaxonomies: () => void queryClient.invalidateQueries({ queryKey: [...ENTRIES_KEY, "taxonomy"] }),
		invalidateEntries,
		moveEntries,
		createNew,
		rowMenu,
		onDeleteKey,
		restore,
		confirmPermanentDelete: (targets: BulkSelection[]) => void confirmPermanentDelete(targets),
	};
}

export type EntryList = ReturnType<typeof useEntryList>;
