"use client";
import { cmsApiUrl, useSite, useTranslator } from "@monti-cms/core/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cmsFetch } from "../admin-api.js";
import { entriesMessages } from "./messages.js";
/** The picker waits this long after the last keystroke before it asks the server. */
export const RELATION_SEARCH_DEBOUNCE_MS = 250;
/** Ids looked up in one request (the ids are in the URL). */
const LOOKUP_CHUNK = 50;
/**
 * The entries of a relation picker, searched on the server: only the entries it shows are loaded, never the whole collection.
 * `search(text)` asks for the best title matches (debounced; the empty text shows the first entries by title). The entries the field
 * already holds (`selected`) are looked up by id once, so they keep their titles whatever the search finds, and an entry the user just
 * created is added with `remember`.
 */
export function useRelationSearch({ collection, publishedOnly = false, limit, selected = [], enabled = true, }) {
    const site = useSite();
    const t = useTranslator(entriesMessages);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [refreshes, setRefreshes] = useState(0);
    // Every entry seen so far (results, lookups, created ones) by id, and the ids a lookup already answered for.
    const [known, setKnown] = useState(new Map());
    const [resolved, setResolved] = useState(new Set());
    const knownRef = useRef(known);
    knownRef.current = known;
    const resolvedRef = useRef(resolved);
    resolvedRef.current = resolved;
    const toEntry = useCallback((item) => ({
        id: item.id,
        title: item.title || t("untitled"),
        slug: item.slug,
        status: item.status,
    }), [t]);
    const remember = useCallback((entries) => {
        setKnown((current) => {
            const next = new Map(current);
            for (const entry of entries)
                next.set(entry.id, entry);
            return next;
        });
    }, []);
    // `refreshes` asks for the same search again (an entry was created).
    // biome-ignore lint/correctness/useExhaustiveDependencies: refreshes is the trigger
    useEffect(() => {
        if (!enabled)
            return;
        let cancelled = false;
        setLoading(true);
        const run = async () => {
            const params = new URLSearchParams({ collection });
            if (query.trim())
                params.set("query", query.trim());
            if (publishedOnly)
                params.set("publishedOnly", "true");
            if (limit !== undefined)
                params.set("limit", String(limit));
            try {
                const data = await cmsFetch(site, cmsApiUrl(`/v1/entries/search?${params}`));
                if (cancelled)
                    return;
                const found = data.items.map(toEntry);
                setResults(found);
                remember(found);
                setError(false);
            }
            catch {
                if (!cancelled)
                    setError(true);
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        };
        // The first entries (no text) are asked for at once; typing waits for a pause.
        const timer = setTimeout(run, query.trim() ? RELATION_SEARCH_DEBOUNCE_MS : 0);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [enabled, site, collection, publishedOnly, limit, query, refreshes, toEntry, remember]);
    const selectedKey = selected.join(",");
    // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the selected ids
    useEffect(() => {
        if (!enabled)
            return;
        const missing = selected.filter((id) => !knownRef.current.has(id) && !resolvedRef.current.has(id));
        if (missing.length === 0)
            return;
        let cancelled = false;
        const lookup = async () => {
            const found = [];
            try {
                for (let from = 0; from < missing.length; from += LOOKUP_CHUNK) {
                    const params = new URLSearchParams({ collection });
                    for (const id of missing.slice(from, from + LOOKUP_CHUNK))
                        params.append("id", id);
                    const data = await cmsFetch(site, cmsApiUrl(`/v1/entries/search?${params}`));
                    found.push(...data.items.map(toEntry));
                }
            }
            catch {
                // The ids stay unresolved, so the rows keep saying they are loading; the next change of the selection asks again.
                return;
            }
            if (cancelled)
                return;
            remember(found);
            setResolved((current) => new Set([...current, ...missing]));
        };
        void lookup();
        return () => {
            cancelled = true;
        };
    }, [enabled, site, collection, selectedKey, toEntry, remember]);
    return {
        /** The best matches of the text typed so far. `null` until the first answer. */
        options: results,
        /** Whether an answer for the latest text is on its way. */
        loading,
        /** Whether the last search failed. */
        error,
        /** Sets the text to search for (debounced). */
        search: setQuery,
        /** The entry with this id if it was seen, by search, lookup or `remember`. */
        entryOf: (id) => known.get(id),
        /** Whether the id was looked up and no entry answered (it was deleted, trashed or belongs to another collection). */
        isMissing: (id) => resolved.has(id) && !known.has(id),
        /** Every entry seen so far, so a picker can name its selected values. */
        known: useMemo(() => [...known.values()], [known]),
        /** Shows an entry by name right away (one the user just created) and searches again. */
        remember: (entry) => {
            remember([entry]);
            setRefreshes((count) => count + 1);
        },
        /** Searches the same text again. */
        reload: () => setRefreshes((count) => count + 1),
    };
}
