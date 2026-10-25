import { z } from "zod";
import { formatNameSchema } from "../../core/api";
import { tellIssues } from "../../core/issue-text";
import type { StoredDocument } from "../../doc/stored-document";
import { createBodyExporter } from "../../services/body-export";
import { translationsOf } from "../../services/translations";
import { defineOperation } from "../define";

const entryId = z.uuid().describe("The id of the entry");
const bodyFormat = formatNameSchema
	.optional()
	.describe("Name of a body format (`site.describe` lists them). Adds the body as text in that format");

export const listEntries = defineOperation({
	name: "entries.list",
	kind: "read",
	describe:
		"List the entries of one collection with filters, sorting and paging; the way to answer questions like 'which posts have no tag' or 'what changed this week'. " +
		"`search` matches word by word: every word must appear in the title or slug (or the body with includeBody), in any order, so use one or two distinctive words. " +
		"Filters combine with AND. Returns the page of entries (id, title, slug, status, locale, metadata) and the total.",
	input: (site) => site.api.listEntriesQuerySchema,
	run: async (query, { cms }) => {
		const range = (from?: Date, to?: Date) => (from || to ? { from, to } : undefined);
		return cms.store().listEntries({
			collection: query.collection,
			search: query.search,
			includeBody: query.includeBody,
			titleContains: query.titleContains?.trim() || undefined,
			slugContains: query.slugContains?.trim() || undefined,
			statuses: query.status,
			locales: query.locale,
			groupTranslations: query.group === "translation",
			folderId: query.folderId,
			includeDescendants: query.includeDescendants,
			relations: query.relation,
			hasUnpublishedChanges: query.hasChanges,
			createdAt: range(query.createdFrom, query.createdTo),
			updatedAt: range(query.updatedFrom, query.updatedTo),
			publishedAt: range(query.publishedFrom, query.publishedTo),
			sort: query.sortField ? { field: query.sortField, direction: query.sortDirection ?? "desc" } : undefined,
			page: query.page,
			pageSize: query.pageSize,
		});
	},
});

export const findEntries = defineOperation({
	name: "entries.find",
	kind: "read",
	describe:
		"Quick lookup of entries in one collection by title or slug, best matches first, at most 50. Use it to turn a name into an id; use entries.list to filter or count. " +
		"Returns id, title, slug and status of each hit.",
	input: (site) => site.api.searchEntriesQuerySchema,
	run: async (query, { cms }) => ({
		items: await cms.store().searchEntries({
			collection: query.collection,
			...(query.query === undefined ? {} : { query: query.query }),
			...(query.locale === undefined ? {} : { locale: query.locale }),
			...(query.publishedOnly === undefined ? {} : { publishedOnly: query.publishedOnly }),
			...(query.limit === undefined ? {} : { limit: query.limit }),
			...(query.id === undefined ? {} : { ids: query.id }),
		}),
	}),
});

export const getEntry = defineOperation({
	name: "entries.get",
	kind: "read",
	describe:
		"Read one entry: its draft (`working`), its published version if any, its translations and, for a translation, its source. " +
		"Pass `format` to get the body as text, which is what you should read; without it the body is a stored document.",
	input: () => z.object({ id: entryId, format: bodyFormat }),
	run: async ({ id, format }, { cms }) => {
		const store = cms.store();
		const entry = await store.getEntry(id);
		// With a format `body` is added to `working`, `published` and the source: the document as text in that format, written to be imported again (`sync`).
		const exporter = format === undefined ? undefined : await createBodyExporter(cms, { format });
		const bodyOf = async <B extends { readonly doc: StoredDocument }>(
			body: B,
			locale: string,
		): Promise<B & { body?: string }> => (exporter ? { ...body, body: await exporter.text(body.doc, locale) } : body);
		const translations = await translationsOf(cms, entry);
		const source =
			entry.translationGroupId !== entry.id ? await store.getEntry(entry.translationGroupId).catch(() => null) : null;
		return {
			...entry,
			working: await bodyOf(entry.working, entry.locale),
			...(entry.published ? { published: await bodyOf(entry.published, entry.locale) } : {}),
			translations,
			...(source
				? {
						source: {
							id: source.id,
							locale: source.locale,
							status: source.status,
							workingSlug: source.workingSlug,
							metadata: source.working.metadata,
							// The stored document carries the block ids that pair this version's blocks with the confirmed one's.
							doc: source.working.doc,
							...(exporter ? { body: await exporter.text(source.working.doc, source.locale) } : {}),
						},
					}
				: {}),
		};
	},
});

export const entryUsages = defineOperation({
	name: "entries.usages",
	kind: "read",
	describe:
		"Where an entry is used: the other entries whose fields or body refer to it, in their draft and in their published version. Use it before trashing or changing an entry.",
	input: () => z.object({ id: entryId }),
	run: async ({ id }, { cms }) => {
		const store = cms.store();
		await store.getEntry(id);
		const relations = await store.getIncomingReferences({ targetId: id });
		return { targetId: id, incomingReferences: relations, total: relations.length };
	},
});

export const entryTranslations = defineOperation({
	name: "entries.translations",
	kind: "read",
	describe: "The translation group of an entry: the source and its translations, with the language and status of each.",
	input: () => z.object({ id: entryId }),
	run: ({ id }, { cms }) => cms.store().getTranslationGroup({ entryId: id }),
});

export const checkPublishEntry = defineOperation({
	name: "entries.checkPublish",
	kind: "read",
	describe:
		"What publishing the saved draft of an entry would find, without publishing: `issues` block a publish, `warnings` do not. Use it to tell whether an entry is ready.",
	input: () => z.object({ id: entryId }),
	run: async ({ id }, { cms }) => {
		const { issues, warnings } = await cms.contentService().checkPublish({ id });
		return { issues: tellIssues(cms.site, issues), warnings: tellIssues(cms.site, warnings) };
	},
});
