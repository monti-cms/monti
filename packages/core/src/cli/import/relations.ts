import type { Cms } from "../../cms";
import { slugify } from "../../core/slug";
import { CmsError } from "../../core/store";
import { STORED_DOCUMENT_VERSION } from "../../doc/stored-document";
import { describeError } from "./errors";
import { slugOf } from "./plan";

/**
 * Relation values. `tags: [web, "Next.js"]` names entries by slug (or by name, which is turned into a slug). Each is looked up in the target collection, and an
 * entry that does not exist is created when the mapping says so (a tag), or left out and reported.
 */

export interface RelationResolver {
	/** The entry id of a target, or why there is none. */
	resolve(to: string, value: string, create: boolean): Promise<{ id?: string; warning?: string }>;
	/** The targets created (or, in a dry run, that would be): collection → names. */
	readonly created: ReadonlyMap<string, readonly string[]>;
}

export function createRelationResolver(options: { readonly cms: Cms; readonly dryRun: boolean }): RelationResolver {
	const { cms, dryRun } = options;
	const cache = new Map<string, string | null>();
	const created = new Map<string, string[]>();

	async function find(to: string, slug: string): Promise<string | undefined> {
		const store = cms.store();
		const published = await store.getPublishedEntryBySlug({ collection: to, slug, includeBody: false });
		if (published.status !== "not_found") return published.entry.translationGroupId;
		const draft = await store.getWorkingEntryBySlug({ collection: to, slug });
		return draft?.translationGroupId;
	}

	return {
		created,
		async resolve(to, value, create) {
			const slugs = [...new Set([slugOf(value, true), slugify(value)].filter((slug) => slug !== ""))];
			if (slugs.length === 0) return { warning: `"${value}" cannot be turned into an address for ${to}` };
			const key = `${to}\u0000${slugs[0]}`;
			const cached = cache.get(key);
			if (cached) return { id: cached };
			if (cached === null)
				return dryRun ? {} : { warning: `${to} "${value}" could not be created earlier in this run` };
			for (const slug of slugs) {
				const id = await find(to, slug);
				if (id) {
					cache.set(key, id);
					return { id };
				}
			}
			if (!create) return { warning: `no ${to} has the address "${slugs[0]}", so "${value}" is left out` };
			const slug = slugs[0] as string;
			created.set(to, [...(created.get(to) ?? []), value]);
			if (dryRun) {
				cache.set(key, null);
				return {};
			}
			try {
				const titleName = cms.site.titleField(to).name;
				const entry = await cms.contentService().createDraft(
					{
						collection: to,
						slug,
						metadata: { [titleName]: value },
						doc: { type: "doc", version: STORED_DOCUMENT_VERSION, content: [] },
					} as never,
					cms.site.isItemCollection(to) ? undefined : { publishImmediately: false },
				);
				const id = (entry as { translationGroupId: string }).translationGroupId;
				cache.set(key, id);
				return { id };
			} catch (error) {
				cache.set(key, null);
				created.set(
					to,
					(created.get(to) ?? []).filter((name) => name !== value),
				);
				if (error instanceof CmsError && error.code === "conflict")
					return { warning: `${to} "${value}" already exists in another form` };
				return { warning: `${to} "${value}" could not be created: ${describeError(error)}` };
			}
		},
	};
}
