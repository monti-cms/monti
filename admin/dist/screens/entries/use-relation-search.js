"use client";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { entriesKeys, searchEntries } from "../../api/entries.js";
import { commonMessages } from "../../lib/common.messages.js";
import { useDebounced } from "../shared/use-debounced.js";
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
    const tc = useTranslator(commonMessages);
    const [query, setQuery] = useState("");
    // Every entry seen so far (results, lookups, created ones) by id, and the ids a lookup already answered for.
    const [known, setKnown] = useState(new Map());
    const [resolved, setResolved] = useState(new Set());
    const knownRef = useRef(known);
    knownRef.current = known;
    const resolvedRef = useRef(resolved);
    resolvedRef.current = resolved;
    const toEntry = useCallback((item) => ({
        id: item.id,
        title: item.title || tc("untitled"),
        slug: item.slug,
        status: item.status,
    }), [tc]);
    const remember = useCallback((entries) => {
        setKnown((current) => {
            const next = new Map(current);
            for (const entry of entries)
                next.set(entry.id, entry);
            return next;
        });
    }, []);
    // The first entries (no text) are asked for at once; typing waits for a pause.
    const text = query.trim();
    const debouncedText = useDebounced(text, RELATION_SEARCH_DEBOUNCE_MS);
    const searchText = text === "" ? "" : debouncedText;
    const params = new URLSearchParams({ collection });
    if (searchText)
        params.set("query", searchText);
    if (publishedOnly)
        params.set("publishedOnly", "true");
    if (limit !== undefined)
        params.set("limit", String(limit));
    const searchQuery = useQuery({
        queryKey: entriesKeys.search(params.toString()),
        queryFn: ({ signal }) => searchEntries(site, params, signal),
        enabled,
        retry: false,
        placeholderData: keepPreviousData,
    });
    const results = useMemo(() => searchQuery.data?.items.map(toEntry) ?? null, [searchQuery.data, toEntry]);
    useEffect(() => {
        if (results)
            remember(results);
    }, [results, remember]);
    // The entries the field holds are looked up by id once per selection, so they keep their titles whatever the search finds.
    const selectedKey = selected.join(",");
    const lookupQuery = useQuery({
        queryKey: entriesKeys.search(`lookup:${collection}:${selectedKey}`),
        queryFn: async ({ signal }) => {
            const missing = selected.filter((id) => !knownRef.current.has(id) && !resolvedRef.current.has(id));
            const entries = [];
            for (let from = 0; from < missing.length; from += LOOKUP_CHUNK) {
                const chunk = new URLSearchParams({ collection });
                for (const id of missing.slice(from, from + LOOKUP_CHUNK))
                    chunk.append("id", id);
                entries.push(...(await searchEntries(site, chunk, signal)).items.map(toEntry));
            }
            return { ids: missing, entries };
        },
        enabled: enabled && selected.length > 0,
        // The ids stay unresolved on a failure, so the rows keep saying they are loading; the next change of the selection asks again.
        retry: false,
    });
    useEffect(() => {
        const answer = lookupQuery.data;
        if (!answer || answer.ids.length === 0)
            return;
        remember(answer.entries);
        setResolved((current) => new Set([...current, ...answer.ids]));
    }, [lookupQuery.data, remember]);
    return {
        /** The best matches of the text typed so far. `null` until the first answer. */
        options: results,
        /** Whether an answer for the latest text is on its way. */
        loading: searchQuery.isFetching || text !== searchText,
        /** Whether the last search failed. */
        error: searchQuery.isError,
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
            void searchQuery.refetch();
        },
        /** Searches the same text again. */
        reload: () => void searchQuery.refetch(),
    };
}
