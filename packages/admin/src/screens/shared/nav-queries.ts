// Gating of the admin's background counts (sidebar badges, the status bar): they wait for the page's own requests.

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { entriesKeys } from "../../api/entries";
import { eventsKeys } from "../../api/events";
import { foldersKeys } from "../../api/folders";

/** The longest the sidebar's background counts wait for the page's own requests. */
const NAV_QUERIES_MAX_WAIT_MS = 2500;

const startsWith = (key: readonly unknown[], prefix: readonly unknown[]) =>
	prefix.every((part, index) => key[index] === part);

/** The sidebar's counts are background work (a request per collection for the trash and for the folders). */
export const isNavQuery = (key: readonly unknown[]) =>
	startsWith(key, foldersKeys.all) || startsWith(key, eventsKeys.count()) || startsWith(key, entriesKeys.trashCount());

/**
 * Whether the sidebar's counts may start. A screen's own list is what the person waits for, and a browser sends only a handful of requests to one host at a
 * time, so the counts (two requests per collection) wait until the page's requests have finished, or a short while at most.
 */
export function useNavQueriesReady(): boolean {
	const queryClient = useQueryClient();
	const [ready, setReady] = useState(false);
	useEffect(() => {
		const idle = () => queryClient.isFetching({ predicate: (query) => !isNavQuery(query.queryKey) }) === 0;
		const started = Date.now();
		const timer = setInterval(() => {
			if (idle() || Date.now() - started > NAV_QUERIES_MAX_WAIT_MS) {
				setReady(true);
				clearInterval(timer);
			}
		}, 60);
		return () => clearInterval(timer);
	}, [queryClient]);
	return ready;
}
