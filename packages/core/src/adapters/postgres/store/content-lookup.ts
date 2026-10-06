import type { Pool } from "pg";

/**
 * Core content lookup for plugins (read-only). Plugins do not read core tables directly; they ask through this function.
 * Exported from `@monti-cms/core/plugin/server`.
 *
 * ```ts
 * const lookup = createContentLookup(cms.database());
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

export function createContentLookup({ pool, schema }: { readonly pool: Pool; readonly schema: string }): ContentLookup {
	return {
		slugsInUse: async ({ collection, locale, slugs, excludeEntryId }) => {
			if (slugs.length === 0) return new Set();
			const res = await pool.query<{ slug: string }>(
				`SELECT slug FROM "${schema}".content_addresses
				 WHERE collection = $1 AND locale = $2 AND slug = ANY($3::text[])
				   AND ($4::uuid IS NULL OR entry_id IS DISTINCT FROM $4::uuid)`,
				[collection, locale, [...slugs], excludeEntryId ?? null],
			);
			return new Set(res.rows.map((row) => row.slug));
		},
	};
}
