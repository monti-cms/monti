"use client";
import { cmsApiUrl, perSite, useSite, withBasePath } from "@monti-cms/core/client";
import { useEffect, useSyncExternalStore } from "react";
import { CmsApiError, cmsFetch } from "../screens/admin-api.js";
/** How long a lookup is trusted. The title or address of an entry can change while the editor is open. */
const READY_TTL_MS = 60_000;
/** How long a failed lookup waits before it is tried again. */
const ERROR_TTL_MS = 10_000;
/** The snapshot of a state is the same object until it changes, which `useSyncExternalStore` needs. */
const LOADING = { status: "loading" };
const MISSING = { status: "missing" };
const FAILED = { status: "error" };
/** What a site knows of the entries its links point to. Addresses depend on the site (locale prefixes, collection paths), so each site has its own. */
const storeOf = perSite((site) => {
    const cache = new Map();
    const listeners = new Set();
    const inflight = new Set();
    const notify = () => {
        for (const listener of listeners)
            listener();
    };
    const put = (id, state) => {
        cache.set(id, { state, at: Date.now() });
        notify();
    };
    /** Where opening the link goes: the page on the site when the entry is published and has one, otherwise the entry in the admin. */
    const hrefOf = (id, published, path) => published && path ? withBasePath(path) : site.adminUrl(`/entries/${id}/edit`);
    /** The path of an entry on the site, with the locale prefix of its language (the same path the public read gives). */
    const publicPath = (collection, slug, locale) => {
        const path = site.contentPath(collection, slug);
        return path ? site.localizePath(locale ?? site.DEFAULT_LOCALE, path) : null;
    };
    const targetOf = (row) => {
        const published = row.status === "published";
        const title = site.isCollection(row.collection)
            ? site.titleOfValues(row.collection, row.working?.metadata ?? {})
            : null;
        // The address readers see is the published one; a draft shows the address it would get.
        const path = publicPath(row.collection, published ? (row.publishedSlug ?? row.workingSlug) : row.workingSlug, row.locale);
        return {
            id: row.id,
            collection: row.collection,
            title: title?.trim() ?? "",
            path,
            published,
            href: hrefOf(row.id, published, path),
        };
    };
    const load = (id) => {
        if (inflight.has(id))
            return;
        inflight.add(id);
        cmsFetch(site, cmsApiUrl(`/v1/entries/${encodeURIComponent(id)}`))
            .then((row) => put(id, { status: "ready", target: targetOf(row) }))
            .catch((error) => put(id, error instanceof CmsApiError && error.status === 404 ? MISSING : FAILED))
            .finally(() => inflight.delete(id));
    };
    const isFresh = (entry) => {
        const { status } = entry.state;
        if (status === "loading")
            return true;
        const ttl = status === "error" ? ERROR_TTL_MS : READY_TTL_MS;
        return Date.now() - entry.at < ttl;
    };
    return {
        cache,
        /** Looks the entry up when it is not known yet or the lookup is old. Safe to call often: a lookup in progress is not repeated. */
        request(id) {
            const known = cache.get(id);
            if (known && isFresh(known))
                return;
            if (!known)
                cache.set(id, { state: LOADING, at: Date.now() });
            load(id);
        },
        remember(item) {
            const published = item.status === "published";
            const path = publicPath(item.collection, item.slug, item.locale);
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
        },
        reset() {
            cache.clear();
            inflight.clear();
            notify();
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
});
/** Remembers an entry the editor already knows (the one just picked for a link), so its bubble shows it without a lookup. */
export function rememberLinkTarget(site, item) {
    storeOf(site).remember(item);
}
/** The path of the entry a link points to, once it is known (`null` while it is being looked up, or when it has none). */
export function linkPathOf(site, id) {
    const state = storeOf(site).cache.get(id)?.state;
    return state?.status === "ready" ? state.target.path : null;
}
/** Looks the entries up and re-renders when what is known changes. Gives the paths known now. */
export function useLinkPaths(ids) {
    const site = useSite();
    const store = storeOf(site);
    const key = ids.join(",");
    useSyncExternalStore(store.subscribe, () => ids.map((id) => linkPathOf(site, id) ?? "").join(","), () => "");
    // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the list
    useEffect(() => {
        for (const id of ids)
            store.request(id);
    }, [key, store]);
    return (id) => linkPathOf(site, id);
}
/** Forgets every lookup of the site. For tests, which share the module. */
export function resetLinkTargets(site) {
    storeOf(site).reset();
}
/** Looks the entry up when it is not known yet or the lookup is old. Safe to call often: a lookup in progress is not repeated. */
export function requestLinkTarget(site, id) {
    storeOf(site).request(id);
}
/**
 * Where the link to this entry goes, looked up on first use and kept for the session. `null` for a link that is not to an entry.
 */
export function useLinkTarget(entryId) {
    const site = useSite();
    const store = storeOf(site);
    const state = useSyncExternalStore(store.subscribe, () => (entryId ? (store.cache.get(entryId)?.state ?? LOADING) : null), () => null);
    useEffect(() => {
        if (entryId)
            store.request(entryId);
    }, [entryId, store]);
    return state;
}
