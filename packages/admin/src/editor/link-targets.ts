"use client";

import { adminUrl, cmsApiUrl, contentPath, withBasePath } from "@monti-cms/core/client";
import { useEffect, useSyncExternalStore } from "react";
import { CmsApiError, cmsFetch } from "../screens/admin-api";
import type { InternalLinkItem } from "./internal-link";

/**
 * Where an internal link goes. A link in a stored document holds the id of its entry only (the id of the translation group, which is the source entry), so the
 * editor looks the entry up to show the reader of the body its title and address: in the link bubble and the link form.
 */

/** The entry a link points to, as the editor shows it. */
export interface LinkTarget {
	/** The id the link holds. */
	readonly id: string;
	readonly collection: string;
	/** The title of the entry, empty when it has none. */
	readonly title: string;
	/** The entry's public path, or `null` when its collection has no public path or it has no address. */
	readonly path: string | null;
	/** Whether the entry is published: only then does its public path work. */
	readonly published: boolean;
	/** Where opening the link goes: the page on the site when the entry is published, otherwise the entry in the admin. */
	readonly href: string;
}

export type LinkTargetState =
	| { readonly status: "loading" }
	| { readonly status: "ready"; readonly target: LinkTarget }
	/** No entry has this id (it was deleted). */
	| { readonly status: "missing" }
	/** The lookup failed (offline, signed out). It is tried again later. */
	| { readonly status: "error" };

/** How long a lookup is trusted. The title or address of an entry can change while the editor is open. */
const READY_TTL_MS = 60_000;
/** How long a failed lookup waits before it is tried again. */
const ERROR_TTL_MS = 10_000;

interface Cached {
	readonly state: LinkTargetState;
	readonly at: number;
}

const cache = new Map<string, Cached>();
const listeners = new Set<() => void>();
const inflight = new Set<string>();
/** The snapshot of a state is the same object until it changes, which `useSyncExternalStore` needs. */
const LOADING: LinkTargetState = { status: "loading" };
const MISSING: LinkTargetState = { status: "missing" };
const FAILED: LinkTargetState = { status: "error" };

const notify = () => {
	for (const listener of listeners) listener();
};

const put = (id: string, state: LinkTargetState) => {
	cache.set(id, { state, at: Date.now() });
	notify();
};

/** What the admin API returns for an entry, as far as a link needs it. */
interface EntryRow {
	readonly id: string;
	readonly collection: string;
	readonly status: string;
	readonly workingSlug: string | null;
	readonly publishedSlug: string | null;
	readonly working?: { readonly metadata?: Record<string, unknown> };
}

/** Where opening the link goes: the page on the site when the entry is published and has one, otherwise the entry in the admin. */
const hrefOf = (id: string, published: boolean, path: string | null): string =>
	published && path ? withBasePath(path) : adminUrl(`/entries/${id}/edit`);

const targetOf = (row: EntryRow): LinkTarget => {
	const published = row.status === "published";
	const title = row.working?.metadata?.title;
	// The address readers see is the published one; a draft shows the address it would get.
	const path = contentPath(row.collection, published ? (row.publishedSlug ?? row.workingSlug) : row.workingSlug);
	return {
		id: row.id,
		collection: row.collection,
		title: typeof title === "string" ? title.trim() : "",
		path,
		published,
		href: hrefOf(row.id, published, path),
	};
};

const load = (id: string) => {
	if (inflight.has(id)) return;
	inflight.add(id);
	cmsFetch<EntryRow>(cmsApiUrl(`/v1/entries/${encodeURIComponent(id)}`))
		.then((row) => put(id, { status: "ready", target: targetOf(row) }))
		.catch((error: unknown) => put(id, error instanceof CmsApiError && error.status === 404 ? MISSING : FAILED))
		.finally(() => inflight.delete(id));
};

const isFresh = (entry: Cached): boolean => {
	const { status } = entry.state;
	if (status === "loading") return true;
	const ttl = status === "error" ? ERROR_TTL_MS : READY_TTL_MS;
	return Date.now() - entry.at < ttl;
};

/** Looks the entry up when it is not known yet or the lookup is old. Safe to call often: a lookup in progress is not repeated. */
export function requestLinkTarget(id: string): void {
	const known = cache.get(id);
	if (known && isFresh(known)) return;
	if (!known) cache.set(id, { state: LOADING, at: Date.now() });
	load(id);
}

/** Remembers an entry the editor already knows (the one just picked for a link), so its bubble shows it without a lookup. */
export function rememberLinkTarget(item: InternalLinkItem): void {
	const published = item.status === "published";
	const path = contentPath(item.collection, item.slug);
	put(item.id, {
		status: "ready",
		target: {
			id: item.id,
			collection: item.collection,
			title: item.title,
			path,
			published,
			href: hrefOf(item.id, published, path),
		},
	});
}

/** Forgets every lookup. For tests, which share the module. */
export function resetLinkTargets(): void {
	cache.clear();
	inflight.clear();
	notify();
}

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
};

/**
 * Where the link to this entry goes, looked up on first use and kept for the session. `null` for a link that is not to an entry.
 */
export function useLinkTarget(entryId: string | null | undefined): LinkTargetState | null {
	const state = useSyncExternalStore(
		subscribe,
		() => (entryId ? (cache.get(entryId)?.state ?? LOADING) : null),
		() => null,
	);
	useEffect(() => {
		if (entryId) requestLinkTarget(entryId);
	}, [entryId]);
	return state;
}
