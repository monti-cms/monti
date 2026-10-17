import { type AdminFetchInit } from "./client.js";
/**
 * `adminFetch` for a component: the site comes from the admin it runs in, so a call names only the path.
 *
 * ```tsx
 * const adminFetch = useAdminFetch();
 * const stats = useQuery({ queryKey: ["post-stats"], queryFn: ({ signal }) => adminFetch<Stats>("/v1/post-stats/summary", { signal }) });
 * ```
 *
 * The site decides the language of error messages and refuses writes from a preview, so the same component is safe in the settings screen's preview.
 */
export declare function useAdminFetch(): <T = unknown>(path: string, init?: AdminFetchInit) => Promise<T>;
