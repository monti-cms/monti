import { type ReactNode } from "react";
/**
 * Server data cache of the admin screen. Placed in the layout so the cache survives moving between list and edit screens.
 * The list is refetched on every entry (`staleTime: 0`), but still shows the previous rows while fetching.
 */
export declare function AdminQueryProvider({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
