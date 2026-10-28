"use client";

import { type FolderListItem, useSite } from "@monti-cms/core/site";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { foldersKeys, listFolders } from "../../api/folders";
import { listMedia, type MediaItem, mediaKeys } from "../../api/media";
import { enumCodec, usePreference } from "../../lib/hooks/use-preference";
import { useUrlState } from "../../lib/hooks/use-url-state";
import { useConfirm } from "../shared/confirm-dialog";
import { useDebouncedInput } from "../shared/use-debounced";
import { folderTrail, hasScope, isFiltered, MEDIA_PARAMS, mediaCountsParams, mediaListParams } from "./media-state";

export type MediaView = "grid" | "list";
const VIEW_CODEC = enumCodec<MediaView>(["grid", "list"]);

/** The most files one selection of "all that match" holds; the trash and the move take as many in one request. */
const MOST_PICKED = 500;
const ALL_PAGE = 100;

/**
 * The state of the media library: the address (open folder, search, conditions), the files and folders the server answers for it, the counts the filter
 * menus show, the files picked and the file open in the panel. Draws nothing; what changes files is in `useMediaActions`.
 */
export function useMediaLibrary() {
	const site = useSite();
	const [state, update] = useUrlState(MEDIA_PARAMS);
	const [searchText, setSearchText] = useDebouncedInput(state.search, (text) => update({ search: text }));
	// The view is a per-device choice (browser preference), unlike the conditions, which belong to the address.
	const [view, setView] = usePreference("media-view", VIEW_CODEC, "grid");

	const query = mediaListParams(state).toString();
	const list = useQuery({
		queryKey: mediaKeys.list(query),
		queryFn: ({ signal }) => listMedia(site, query, signal),
		placeholderData: keepPreviousData,
	});
	const countsQuery = mediaCountsParams(state).toString();
	const counts = useQuery({
		queryKey: mediaKeys.list(countsQuery),
		queryFn: ({ signal }) => listMedia(site, countsQuery, signal),
		placeholderData: keepPreviousData,
	});
	const foldersQuery = useQuery({
		queryKey: foldersKeys.list("media"),
		queryFn: ({ signal }) => listFolders(site, "media", signal),
	});
	const folders: FolderListItem[] = foldersQuery.data ?? [];
	const items: MediaItem[] = list.data?.items ?? [];

	const filtered = isFiltered(state);
	const trail = useMemo(() => folderTrail(folders, state.folder), [folders, state.folder]);
	const currentFolder = trail.at(-1) ?? null;
	// The folders shown beside the files: those inside the open folder, and the way up. Not while a search or a filter lists the matching files.
	const explorer = filtered
		? null
		: {
				folders: folders.filter((folder) => (folder.parentId ?? null) === (state.folder || null)),
				parent: currentFolder ? (currentFolder.parentId ?? "") : null,
			};

	/** Goes into a folder (empty for the top), leaving a search and the conditions behind. */
	const goToFolder = useCallback(
		(id: string) => update({ folder: id, scope: "here", search: "", used: "all", kind: "all", alt: "all", page: 1 }),
		[update],
	);

	// --- The pick: files ticked for a bulk action. It does not carry over to other results.
	const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
	// biome-ignore lint/correctness/useExhaustiveDependencies: the pick is cleared whenever the request changes
	useEffect(() => setPicked(new Set()), [query]);
	const togglePicked = (id: string, on: boolean) =>
		setPicked((current) => {
			const next = new Set(current);
			if (on) next.add(id);
			else next.delete(id);
			return next;
		});
	/** Picks every file the conditions match, on every page (up to the most one request takes). */
	const pickAllMatching = async () => {
		const ids: string[] = [];
		const total = list.data?.total ?? 0;
		for (let page = 1; ids.length < Math.min(total, MOST_PICKED); page += 1) {
			const params = mediaListParams(state);
			params.set("page", String(page));
			params.set("pageSize", String(ALL_PAGE));
			const answer = await listMedia(site, params);
			if (answer.items.length === 0) break;
			ids.push(...answer.items.map((item) => item.id));
		}
		setPicked(new Set(ids.slice(0, MOST_PICKED)));
	};

	// --- The file open in the panel. Leaving one with unsaved changes asks first.
	const { confirmDiscard, dialog: confirmDialog } = useConfirm();
	const [openId, setOpenId] = useState<string | null>(null);
	const panelDirty = useRef(false);
	const open = openId === null ? null : (items.find((item) => item.id === openId) ?? null);
	const openFile = async (id: string | null) => {
		if (id === openId) return;
		if (!(await confirmDiscard(panelDirty.current))) return;
		panelDirty.current = false;
		setOpenId(id);
	};

	return {
		state,
		update,
		searchText,
		setSearchText,
		view,
		setView,
		query,
		items,
		total: list.data?.total ?? 0,
		/** How many images and files, and how many pictures have alt text or none, in the place a search looks in. */
		kinds: counts.data?.kinds ?? list.data?.kinds ?? { image: 0, file: 0 },
		alts: counts.data?.alts ?? list.data?.alts ?? { none: 0, has: 0 },
		isLoading: list.isPending,
		isRefreshing: list.isPlaceholderData,
		error: list.error,
		retry: () => void list.refetch(),
		folders,
		filtered,
		scoped: hasScope(state),
		trail,
		currentFolder,
		explorer,
		goToFolder,
		picked,
		setPicked,
		togglePicked,
		pickAllMatching,
		open,
		openFile,
		/** The panel reports whether its fields hold unsaved changes. */
		setPanelDirty: useCallback((dirty: boolean) => {
			panelDirty.current = dirty;
		}, []),
		confirmDialog,
	};
}

export type MediaLibraryView = ReturnType<typeof useMediaLibrary>;
