import { type SchemaTab } from "./tabs.js";
/** The tab named by the last segment of `pathname`, if it is one. */
export declare function tabOfPath(pathname: string): SchemaTab | undefined;
/** The address of `tab`: the current one with its last segment replaced, so a base path or a changed admin path carries over. The query stays, so the collection that was open is still open when the writer comes back. */
export declare function addressOfTab(pathname: string, search: string, tab: SchemaTab): string;
/** The tab being shown: the one in the address, which moves without a navigation; `fallback` (the tab the page was rendered for) until the browser is there. */
export declare function useSettingsTab(fallback: SchemaTab): {
    tab: SchemaTab;
    go: (tab: SchemaTab) => void;
};
/** One query value of the address, and a setter that changes it in place (no new history entry: choosing a collection is not a page). `undefined` removes it. */
export declare function useSettingsParam(name: string): [string | undefined, (value: string | undefined) => void];
/** Notes how far the page is scrolled, for the page that opens after the reload that follows a save. */
export declare function rememberScroll(top: number): void;
/** The scroll position a save left for this very address, once. */
export declare function takeScroll(): number | null;
