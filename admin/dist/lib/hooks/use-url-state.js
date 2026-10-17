"use client";
import { PAGE_SIZES } from "@monti-cms/core/site";
import { useCallback, useMemo } from "react";
import { useAdminRouter } from "../../router/index.js";
/** A page number (1, 2, …); page 1 is left out of the address. */
export const pageParam = {
    parse: (raw) => {
        const value = Number(raw);
        return Number.isInteger(value) && value > 0 ? value : 1;
    },
    serialize: (value) => (value > 1 ? String(value) : null),
};
/** One of the page sizes the API accepts; the first is the default and is left out of the address. */
export const pageSizeParam = {
    parse: (raw) => PAGE_SIZES.find((size) => String(size) === raw) ?? PAGE_SIZES[0],
    serialize: (value) => (value === PAGE_SIZES[0] ? null : String(value)),
};
/** One of a fixed list of strings; the default is left out of the address. */
export const enumParam = (values, defaultValue) => ({
    parse: (raw) => values.find((value) => value === raw) ?? defaultValue,
    serialize: (value) => (value === defaultValue ? null : value),
});
/** Free text; empty is left out of the address. */
export const textParam = {
    parse: (raw) => raw ?? "",
    serialize: (value) => (value === "" ? null : value),
};
/**
 * Screen state kept in the address (page, page size, a filter, a search text), so a refresh keeps it, Back restores it and the address can be shared.
 * Returns the parsed values and `update(patch)`. A change to anything but `page` goes back to page 1 unless `resetPage: false`. Parameters
 * of the address that the screen does not declare are kept as they are.
 */
export function useUrlState(params) {
    const router = useAdminRouter();
    const pathname = router.usePathname();
    const search = router.useSearchParams();
    const searchText = search.toString();
    const state = useMemo(() => {
        const values = {};
        const query = new URLSearchParams(searchText);
        for (const [key, param] of Object.entries(params))
            values[key] = param.parse(query.get(key));
        return values;
    }, [params, searchText]);
    const update = useCallback((patch, options = {}) => {
        const next = { ...state, ...patch };
        const changesFilter = Object.keys(patch).some((key) => key !== "page");
        if ("page" in params && !("page" in patch) && changesFilter && options.resetPage !== false)
            next.page = 1;
        const query = new URLSearchParams(searchText);
        for (const [key, param] of Object.entries(params)) {
            const raw = param.serialize(next[key]);
            if (raw === null)
                query.delete(key);
            else
                query.set(key, raw);
        }
        const text = query.toString();
        router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
    }, [params, pathname, router, searchText, state]);
    return [state, update];
}
