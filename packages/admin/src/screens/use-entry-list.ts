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
 * 주소창의 목록 상태. 주소에 페이지 크기·정렬이 없으면 컬렉션별 저장 설정을 쓰고(§3.2),
 * 정렬·페이지 크기·열 설정을 바꾸면 저장한다.
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
	/** 상태를 바꿔 주소에 쓴다. 기본은 첫 페이지로 돌아간다. */
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
 * 목록 한 페이지와 폴더. 캐시에서 바로 그리고 뒤에서 새로 받는다. 조건을 바꾸는 동안에도 이전 줄을 남겨
 * (`keepPreviousData`) 자리 표시로 깜빡이지 않는다. 자리 표시는 캐시가 아예 없을 때만 보인다.
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
		// 다른 컬렉션의 줄은 열 구성이 달라 남기지 않는다.
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

/** 일괄 결과를 알림으로 알린다. 실패는 항목 이름과 사유를 적는다. */
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
 * 목록을 바꾸는 작업. 작업을 목록에 먼저 반영하고 요청한다. 요청 자체가 실패하면 되돌리고,
 * 끝나면 서버 값으로 맞춘다. 항목별 결과는 `onResults`로 넘긴다(실패한 항목을 고른 채로 남기는 데 쓴다).
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

	/** 목록·휴지통 배지를 모두 다시 받는다(지금 보이는 줄은 그대로 둔 채). */
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

	/** 일괄 API로 처리하고 결과를 알린다. */
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

	/** 휴지통 복원. 일괄 API에 없어 항목마다 요청한다. */
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

/** 지금 폴더에 바로 든 하위 폴더와 한 단계 위. 검색·필터 중이거나 휴지통이면 없다. */
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
 * 목록·휴지통 화면의 상태·데이터·작업. 화면 조각은 그리지 않는다.
 * 사이드바 폴더 탐색(목록 화면)과 본문이 함께 쓴다.
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
	// 전체 선택은 현재 페이지만 대상이다(§3.4). 목록이 바뀌면 선택을 비운다.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset whenever the visible query changes
	useEffect(() => setSelectedIds(new Set()), [data.apiQuery]);
	const [recordTarget, setRecordTarget] = useState<RecordTarget | null>(null);
	const { confirm, confirmDiscard, dialog: confirmDialog } = useConfirm();
	/** 분류 편집 패널에 저장하지 않은 변경이 있는가. 패널이 알려 준다. */
	const recordDirtyRef = useRef(false);
	/** 분류 편집 패널에 바로 연다(묻지 않는다). 저장한 항목을 그대로 열어 둘 때 쓴다. */
	const showRecord = (target: RecordTarget) => {
		recordDirtyRef.current = false;
		setRecordTarget(target);
	};
	/** 분류 편집 패널을 연다. 저장하지 않은 변경이 있으면 버릴지 먼저 묻는다. */
	const openRecord = async (target: RecordTarget) => {
		if (await confirmDiscard(recordDirtyRef.current)) showRecord(target);
	};
	const closeRecord = () => {
		recordDirtyRef.current = false;
		setRecordTarget(null);
	};
	// 주소의 `open`(미디어 사용처 등에서 연 항목)은 항목 칸으로 한 번 열고 주소에서 뺀다.
	const searchParams = useSearchParams();
	const openParam = searchParams.get(OPEN_ITEM_PARAM);
	// biome-ignore lint/correctness/useExhaustiveDependencies: 주소의 값이 바뀔 때만 연다
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
			// 보고 있던 폴더를 지웠으면 전체 보기로 돌아간다.
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

	/** 새 항목. 글·메모는 지금 폴더에 편집 화면으로, 분류 항목은 작은 폼으로 만든다. */
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

	/** 행에서 Delete 키. 목록은 휴지통 이동, 휴지통은 영구 삭제를 묻는다. */
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
		/** 이 목록의 확인창(휴지통 이동·보관·영구 삭제·변경 버리기). 화면에 한 번 렌더한다. */
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
