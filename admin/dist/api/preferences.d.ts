import { type PreferencesBody, type Site } from "@monti-cms/core/client";
export declare const preferencesKeys: {
    all: readonly ["cms", "preferences"];
};
/** `GET /v1/preferences` (the signed-in user's saved list settings). */
export declare const getPreferences: (site: Site, signal?: AbortSignal) => Promise<{
    collections?: Partial<Record<string, {
        columns?: {
            order?: string[] | undefined;
            visibility?: Record<string, boolean> | undefined;
            sizes?: Record<string, number> | undefined;
        } | undefined;
        pageSize?: 25 | 50 | 100 | undefined;
        sort?: {
            field: "createdAt" | "publishedAt" | "slug" | "title" | "updatedAt";
            direction: "asc" | "desc";
        } | undefined;
    }>> | undefined;
    editor?: {
        inspectorOpen?: boolean | undefined;
    } | undefined;
}>;
/** `PUT /v1/preferences` (only the given part changes). */
export declare const savePreferences: (site: Site, body: PreferencesBody) => Promise<unknown>;
