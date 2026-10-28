import type { Site } from "@monti-cms/core/site";

/** What the compare screen sets against the server's copy: my input after an edit conflict, or the draft the browser kept. */
export type CompareMode = "conflict" | "draft";

/** The query name of the compare screen: it is the edit address with `?compare=conflict` or `?compare=draft`, so the editor and what it holds stay where they are. */
const PARAM = "compare";

/** The address of the compare screen of an entry. */
export const compareHref = (site: Pick<Site, "adminEntryEditHref">, entryId: string, mode: CompareMode): string =>
	`${site.adminEntryEditHref(entryId)}?${PARAM}=${mode}`;

/** The mode the address asks for, or `null` for the editor. */
export function compareModeOf(search: { get(name: string): string | null }): CompareMode | null {
	const value = search.get(PARAM);
	return value === "conflict" || value === "draft" ? value : null;
}
