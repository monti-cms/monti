import { type PageSize } from "@monti-cms/core/client";
/** One value kept in the address: how to read it (`null` = absent) and how to write it (`null` = leave it out, it is the default). */
export interface UrlParam<T> {
    parse: (raw: string | null) => T;
    serialize: (value: T) => string | null;
}
/** A page number (1, 2, …); page 1 is left out of the address. */
export declare const pageParam: UrlParam<number>;
/** One of the page sizes the API accepts; the first is the default and is left out of the address. */
export declare const pageSizeParam: UrlParam<PageSize>;
/** One of a fixed list of strings; the default is left out of the address. */
export declare const enumParam: <T extends string>(values: readonly T[], defaultValue: T) => UrlParam<T>;
/** Free text; empty is left out of the address. */
export declare const textParam: UrlParam<string>;
type AnyParams = Record<string, UrlParam<any>>;
type ParamValues<S extends AnyParams> = {
    [K in keyof S]: S[K] extends UrlParam<infer T> ? T : never;
};
/**
 * Screen state kept in the address (page, page size, a filter, a search text), so a refresh keeps it, Back restores it and the address can be shared.
 * Returns the parsed values and `update(patch)`. A change to anything but `page` goes back to page 1 unless `resetPage: false`. Parameters
 * of the address that the screen does not declare are kept as they are.
 */
export declare function useUrlState<S extends AnyParams>(params: S): readonly [
    state: ParamValues<S>,
    update: (patch: Partial<ParamValues<S>>, options?: {
        resetPage?: boolean;
    }) => void
];
export {};
