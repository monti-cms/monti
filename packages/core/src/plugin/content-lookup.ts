import type { ContentStore } from "../core/store/ports";

/**
 * Core content lookup for plugins (read-only). Plugins do not read core tables directly; they ask through this function.
 * Exported from `@monti-cms/core/plugin/server`.
 *
 * ```ts
 * const lookup = createContentLookup(cms);
 * await lookup.slugsInUse({ collection: "post", locale: "ko", slugs: ["hello"], excludeEntryId: id });
 * ```
 */

export interface SlugsInUseParams {
	readonly collection: string;
	readonly locale: string;
	/** Slugs to check. An empty array skips the query. */
	readonly slugs: readonly string[];
	/** Ignore slugs used by this entry (the entry being edited). */
	readonly excludeEntryId?: string;
}

export interface ContentLookup {
	/**
	 * Slugs that are already used in the same collection and language (current, reserved, former, and deleted-entry slugs). These are the
	 * same slugs that cause a slug conflict (`slug_conflict`) on save.
	 */
	slugsInUse(params: SlugsInUseParams): Promise<Set<string>>;
}

/** The lookup of one CMS instance (any object with its `store()` will do). */
export function createContentLookup(cms: { store(): Pick<ContentStore, "slugsInUse"> }): ContentLookup {
	return { slugsInUse: (params) => cms.store().slugsInUse(params) };
}
