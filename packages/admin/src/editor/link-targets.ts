"use client";

import { perSite, type Site, useSite, withBasePath } from "@monti-cms/core/site";
import { useEffect, useSyncExternalStore } from "react";
import { CmsApiError } from "../api/client";
import { getEntry } from "../api/entries";
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
	/** The entry's public path as readers see it, with the locale prefix the site uses (`localePrefix`), or `null` when its collection has no public path or it has no address. */
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

/** The snapshot of a state is the same object until it changes, which `useSyncExternalStore` needs. */
const LOADING: LinkTargetState = { status: "loading" };
const MISSING: LinkTargetState = { status: "missing" };
const FAILED: LinkTargetState = { status: "error" };

/** The entry a link points to, as far as its title and address go. */
interface LinkedEntry {
	readonly id: string;
	readonly collection: string;
	readonly title: string;
	readonly published: boolean;
	/** The slug its address uses. */
	readonly slug?: string | null;
	readonly locale?: string;
}

/**
 * Where a link to the entry goes. Its path is the one on the site, with the locale prefix of its language (the same path the public read gives). Opening it
 * goes to that page when the entry is published and has one, otherwise to the entry in the admin.
 */
function linkTarget(site: Site, entry: LinkedEntry): LinkTarget {
	const contentPath = site.contentPath(entry.collection, entry.slug);
	const path = contentPath ? site.localizePath(entry.locale ?? site.DEFAULT_LOCALE, contentPath) : null;
	return {
		id: entry.id,
		collection: entry.collection,
		title: entry.title,
		path,
		published: entry.published,
		href: entry.published && path ? withBasePath(path) : site.adminUrl(`/entries/${entry.id}/edit`),
	};
}

/** Where a link to the entry the admin API returned goes. The address readers see is the published one; a draft shows the address it would get. */
export function linkTargetOfRow(site: Site, row: EntryRow): LinkTarget {
	const published = row.status === "published";
	const title = site.isCollection(row.collection)
		? site.titleOfValues(row.collection, row.working?.metadata ?? {})
		: null;
	return linkTarget(site, {
		id: row.id,
		collection: row.collection,
		title: title?.trim() ?? "",
		published,
		slug: published ? (row.publishedSlug ?? row.workingSlug) : row.workingSlug,
		locale: row.locale,
	});
}

/** What a site knows of the entries its links point to. Addresses depend on the site (locale prefixes, collection paths), so each site has its own. */
const storeOf = perSite((site: Site) => {
	const cache = new Map<string, Cached>();
	const listeners = new Set<() => void>();
	const inflight = new Set<string>();

	const notify = () => {
		for (const listener of listeners) listener();
	};

	const put = (id: string, state: LinkTargetState) => {
		cache.set(id, { state, at: Date.now() });
		notify();
	};

	const load = (id: string) => {
		if (inflight.has(id)) return;
		inflight.add(id);
		getEntry<EntryRow>(site, id)
			.then((row) => put(id, { status: "ready", target: linkTargetOfRow(site, row) }))
			.catch((error: unknown) => put(id, error instanceof CmsApiError && error.status === 404 ? MISSING : FAILED))
			.finally(() => inflight.delete(id));
	};

	const isFresh = (entry: Cached): boolean => {
		const { status } = entry.state;
		if (status === "loading") return true;
		const ttl = status === "error" ? ERROR_TTL_MS : READY_TTL_MS;
		return Date.now() - entry.at < ttl;
	};

	return {
		cache,
		/** Looks the entry up when it is not known yet or the lookup is old. Safe to call often: a lookup in progress is not repeated. */
		request(id: string): void {
			const known = cache.get(id);
			if (known && isFresh(known)) return;
			if (!known) cache.set(id, { state: LOADING, at: Date.now() });
			load(id);
		},
		remember(item: InternalLinkItem): void {
			put(item.id, {
				status: "ready",
				target: linkTarget(site, { ...item, published: item.status === "published" }),
			});
		},
		reset(): void {
			cache.clear();
			inflight.clear();
			notify();
		},
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
});

/** What the admin API returns for an entry, as far as a link needs it. */
interface EntryRow {
	readonly id: string;
	readonly collection: string;
	readonly status: string;
	readonly locale?: string;
	readonly workingSlug: string | null;
	readonly publishedSlug: string | null;
	readonly working?: { readonly metadata?: Record<string, unknown> };
}

/** Remembers an entry the editor already knows (the one just picked for a link), so its bubble shows it without a lookup. */
export function rememberLinkTarget(site: Site, item: InternalLinkItem): void {
	storeOf(site).remember(item);
}

/** The path of the entry a link points to, once it is known (`null` while it is being looked up, or when it has none). */
export function linkPathOf(site: Site, id: string): string | null {
	const state = storeOf(site).cache.get(id)?.state;
	return state?.status === "ready" ? state.target.path : null;
}

/** Looks the entries up and re-renders when what is known changes. Gives the paths known now. */
export function useLinkPaths(ids: readonly string[]): (id: string) => string | null {
	const site = useSite();
	const store = storeOf(site);
	const key = ids.join(",");
	useSyncExternalStore(
		store.subscribe,
		() => ids.map((id) => linkPathOf(site, id) ?? "").join(","),
		() => "",
	);
	// biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the list
	useEffect(() => {
		for (const id of ids) store.request(id);
	}, [key, store]);
	return (id) => linkPathOf(site, id);
}

/**
 * Forgets every lookup of the site. For tests, which share the module.
 * @internal For tests.
 */
export function resetLinkTargets(site: Site): void {
	storeOf(site).reset();
}

/**
 * Where the link to this entry goes, looked up on first use and kept for the session. `null` for a link that is not to an entry.
 */
export function useLinkTarget(entryId: string | null | undefined): LinkTargetState | null {
	const site = useSite();
	const store = storeOf(site);
	const state = useSyncExternalStore(
		store.subscribe,
		() => (entryId ? (store.cache.get(entryId)?.state ?? LOADING) : null),
		() => null,
	);
	useEffect(() => {
		if (entryId) store.request(entryId);
	}, [entryId, store]);
	return state;
}
