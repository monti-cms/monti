"use client";
import { COLLECTION_DEFINITIONS, cmsApiUrl, createTranslator, isCollection, taxonomyFieldsOf, } from "@monti-cms/core/client";
import { useQueries } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cmsFetch } from "../admin-api.js";
import { sharedMessages } from "./messages.js";
const t = createTranslator(sharedMessages);
const labelOf = (collection) => isCollection(collection) ? COLLECTION_DEFINITIONS[collection].label : collection;
/** All active (public) records. If over 100, reads the next page too. */
async function loadAll(collection) {
    const options = [];
    for (let page = 1; page < 50; page++) {
        const params = new URLSearchParams({
            collection,
            pageSize: "100",
            page: String(page),
            sortField: "title",
            sortDirection: "asc",
        });
        params.append("status", "published");
        const data = await cmsFetch(cmsApiUrl(`/v1/entries?${params.toString()}`));
        options.push(...data.items.map((item) => ({
            id: item.id,
            title: item.title || item.slug || t("taxonomy.unnamed"),
            slug: item.slug,
        })));
        if (options.length >= data.total || data.items.length === 0)
            break;
    }
    return options;
}
/**
 * Record options like tags and categories shared by the edit screen, bulk actions and list filters.
 * New items are created in the taxonomy add slot (`useRecordCreator`), and the created item is shown right away with `remember`.
 */
export function useTaxonomy(collection, enabled = true) {
    const [options, setOptions] = useState([]);
    const [error, setError] = useState(null);
    // Items added on this screen. Shown by name even if not yet in the refetched list (before list cache/search reflects them).
    const rememberedRef = useRef([]);
    const reload = useCallback(async () => {
        try {
            const loaded = await loadAll(collection);
            setOptions([
                ...loaded,
                ...rememberedRef.current.filter((option) => !loaded.some((item) => item.id === option.id)),
            ]);
            setError(null);
        }
        catch {
            setError(t("taxonomy.loadFailed", { label: labelOf(collection) }));
        }
    }, [collection]);
    useEffect(() => {
        if (enabled)
            void reload();
    }, [enabled, reload]);
    /** Puts the just-added item into the options so it shows by name even before a refetch. */
    const remember = useCallback((option) => {
        rememberedRef.current = [...rememberedRef.current, option];
        setOptions((current) => (current.some((item) => item.id === option.id) ? current : [...current, option]));
    }, []);
    return { options, error, reload, remember };
}
/**
 * Reads options of a collection's taxonomy fields (tags, categories, etc.) per field name. Used by list filters, bulk actions and row menus.
 * Fields pointing to the same collection are read only once.
 */
export function useTaxonomyOptions(collection, enabled = true) {
    const fields = useMemo(() => taxonomyFieldsOf(collection), [collection]);
    const targets = useMemo(() => [...new Set(fields.map((stored) => stored.to))], [fields]);
    const combine = useCallback((results) => Object.fromEntries(fields.map((stored) => [stored.name, results[targets.indexOf(stored.to)]?.data ?? []])), [fields, targets]);
    return useQueries({
        queries: targets.map((target) => ({
            // Place it under the list cache so it is refetched together when the list is refetched.
            queryKey: ["cms", "entries", "taxonomy", target],
            queryFn: () => loadAll(target),
            enabled,
        })),
        combine,
    });
}
