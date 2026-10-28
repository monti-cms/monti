"use client";

import { MEDIA_TRASH_KIND, useSite, useTranslator } from "@monti-cms/core/site";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { errorText } from "../../api/client";
import { listTrash, type TrashFolderJson, type TrashItemJson, trashKeys, trashQuery } from "../../api/trash";
import { useAdminRouter, useAdminSearchParams } from "../../router";
import { screensMessages } from "../messages";
import { itemKey } from "./trash-model";
import { parseTrashState, type TrashState, trashStateToParams, trashStateToSearchParams } from "./trash-state";

/** The values of the kind column's filter: every collection in the site's order, then the media, each counted (a kind with nothing is 0). */
export function kindValues(
	kinds: Readonly<Record<string, number>>,
	collections: readonly string[],
	mediaKind = MEDIA_TRASH_KIND,
): { kind: string; count: number }[] {
	return [...collections, mediaKind].map((kind) => ({ kind, count: kinds[kind] ?? 0 }));
}

/**
 * The state of the trash screen: the address (kinds, folder, search, order, page), the page the server answers for it, the rows picked and the row open in
 * the panel. Draws nothing; the actions that change the trash are in `useTrashActions`.
 */
export function useTrash() {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const router = useAdminRouter();
	const searchParams = useAdminSearchParams();
	const state = useMemo(() => parseTrashState(new URLSearchParams(searchParams.toString())), [searchParams]);

	const update = useCallback(
		(patch: Partial<TrashState>, options: { resetPage?: boolean } = { resetPage: true }) => {
			const next = { ...state, ...(options.resetPage ? { page: 1 } : {}), ...patch };
			router.replace(`${site.adminHref("/trash")}?${trashStateToSearchParams(next).toString()}`, { scroll: false });
		},
		[router, site, state],
	);
	/** Looks into a trashed folder; the way back is kept in the address. */
	const openFolder = (id: string) =>
		update({ folder: id, trail: state.folder ? [...state.trail, state.folder] : [], search: "" });
	/** One folder up: the folder it was reached through, or the top of the trash. */
	const closeFolder = () => {
		const parent = state.trail.at(-1) ?? null;
		update({ folder: parent, trail: state.trail.slice(0, -1) });
	};

	const query = trashQuery(trashStateToParams(state)).toString();
	const list = useQuery({
		queryKey: trashKeys.list(query),
		queryFn: ({ signal }) => listTrash(site, query, signal, t("list.loadFailed")),
		placeholderData: keepPreviousData,
	});
	const page = list.data;
	const items: TrashItemJson[] = page?.items ?? [];
	const folder: TrashFolderJson | null = state.folder ? (page?.folder ?? null) : null;

	const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
	// Picking one page does not carry over to another: the pick is cleared whenever the rows asked for change.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset whenever the request changes
	useEffect(() => setSelected(new Set()), [query]);

	const [panelKey, setPanelKey] = useState<string | null>(null);
	const panelItem = panelKey ? (items.find((item) => itemKey(item) === panelKey) ?? null) : null;

	const kinds = page?.kinds ?? {};
	// A folder with nothing left in it (everything came back) is gone too: back up.
	const hollow = state.folder !== null && page !== undefined && !list.isPlaceholderData && items.length === 0;
	// biome-ignore lint/correctness/useExhaustiveDependencies: only when the folder is empty
	useEffect(() => {
		if (hollow) closeFolder();
	}, [hollow]);

	return {
		state,
		update,
		openFolder,
		closeFolder,
		query,
		items,
		kinds,
		total: Object.values(kinds).reduce((sum, count) => sum + count, 0),
		resultTotal: page?.total ?? 0,
		folder,
		isLoading: list.isPending,
		isRefreshing: list.isPlaceholderData,
		errorMessage: list.error && !page ? errorText(site, list.error, t("list.loadFailed")) : null,
		retry: () => void list.refetch(),
		selected,
		setSelected,
		panelItem,
		openPanel: (item: TrashItemJson) => setPanelKey(itemKey(item)),
		closePanel: () => setPanelKey(null),
	};
}

export type TrashView = ReturnType<typeof useTrash>;
