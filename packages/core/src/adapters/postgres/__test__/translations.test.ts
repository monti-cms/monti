import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	contentCollection,
	defaultLocale,
	recordRelationField,
	requiredMetadata,
	secondLocale,
} from "../../../../test/any-site";
import { COLLECTIONS, type Collection } from "../../../core/collections";
import { LOCALES } from "../../../core/locales";
import {
	commonFieldKeys,
	localizedFieldNames,
	recordLocalizedFields,
	storedField,
	storedFields,
} from "../../../schema/derive";
import { createContentService } from "../../../services/content-service";
import { type ContentStore, createContentStore, type Entry, migrateContentStore } from "../content-store";
import { seedEntry } from "./seed";
import { createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/**
 * Languages and fields used by translation tests. Collection, field, and language names are looked up in the current config (`test/any-site.ts`).
 * For a config with only one language the translation tests are skipped, and cases that need a third language are skipped separately.
 */
const second = secondLocale ?? "";
const thirdLocale = LOCALES.filter((code) => code !== defaultLocale)[1];
const unknownLocale = "zz";
const localized = (() => {
	const { own, inherit } = localizedFieldNames(contentCollection);
	return new Set([...own, ...inherit]);
})();
/** Per-language text fields other than the title. The first is also filled on translations; the second is filled only on the source to check it does not leak into translations. */
const [translatedText, sourceOnlyText] = localizedFieldNames(contentCollection).own.filter((name) => {
	const stored = storedField(contentCollection, name);
	return name !== "title" && !stored?.when && stored?.field.kind === "text";
});
/** Select field shared by a translation group. Sets a non-default value on the source to check it carries over to the translation's published values. */
const commonSelect = (() => {
	for (const { name, field, when } of storedFields(contentCollection)) {
		if (when || localized.has(name) || field.kind !== "select") continue;
		const value = Object.keys(field.options).find((key) => key !== field.defaultValue);
		if (value) return { name, value };
	}
	return undefined;
})();
/** Shared relation field that points at an item collection (like categories). */
const relation = (() => {
	const found = recordRelationField(contentCollection);
	return found && !localized.has(found.name) ? found : undefined;
})();
/** Item collection that keeps per-language names inside a single record. */
const localizedRecord = COLLECTIONS.find((name) => recordLocalizedFields(name).length > 0);

/** Multilingual: per-language documents + translation groups. */
describe("translation groups", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;
	let service: ReturnType<typeof createContentService<Entry>>;
	let sequence = 0;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		service = createContentService<Entry>(store);
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
	});

	/** A new published item of the target collection. Created fresh for each entry so that only that entry appears when filtering by relation. */
	const relationTarget = async (to: Collection): Promise<string> => {
		const metadata = await requiredMetadata(to, "에세이", relationTarget);
		const draft = await service.createDraft({ collection: to, slug: `${to}-${++sequence}`, metadata, mdx: "" });
		if (draft.status === "published") return draft.id;
		return (await store.publishEntry({ id: draft.id, expectedVersion: draft.version })).id;
	};

	const createPost = async (slug: string) => {
		const metadata: Record<string, unknown> = await requiredMetadata(contentCollection, "한국어 제목", relationTarget);
		if (translatedText) metadata[translatedText] = "한국어 요약";
		if (sourceOnlyText) metadata[sourceOnlyText] = "검색 제목";
		if (commonSelect) metadata[commonSelect.name] = commonSelect.value;
		if (relation && metadata[relation.name] === undefined) {
			const id = await relationTarget(relation.to);
			metadata[relation.name] = relation.many ? [id] : id;
		}
		return service.createDraft({
			collection: contentCollection,
			slug,
			metadata: metadata as never,
			mdx: "한국어 본문",
		});
	};

	/** Per-language values a translation stores (title and the first per-language text). */
	const translatedMetadata = (title: string, text: string) => ({
		title,
		...(translatedText ? { [translatedText]: text } : {}),
	});

	const publish = (entry: Entry) => store.publishEntry({ id: entry.id, expectedVersion: entry.version });

	it("gives the same result when migrated again (columns and primary key)", async () => {
		await migrateContentStore(pool, { schema: schemaName });
		const pk = await pool.query<{ column_name: string }>(
			`SELECT column_name FROM information_schema.key_column_usage
			 WHERE table_schema = $1 AND constraint_name = 'content_addresses_pkey' ORDER BY ordinal_position`,
			[schemaName],
		);
		expect(pk.rows.map((row) => row.column_name)).toEqual(["collection", "locale", "slug"]);
	});

	describe.skipIf(!secondLocale)("translations (two or more languages)", () => {
		it("shares the source slug, and the body starts from a frame that wraps the source text in a translation notice", async () => {
			const source = await createPost("copy-source");
			expect(source.locale).toBe(defaultLocale);
			expect(source.translationGroupId).toBe(source.id);

			const translation = await service.createTranslation({ sourceId: source.id, locale: second });
			expect(translation.locale).toBe(second);
			expect(translation.translationGroupId).toBe(source.id);
			expect(translation.status).toBe("draft");
			expect(translation.workingSlug).toBe("copy-source");
			expect(translation.working.mdx).toBe("<Untranslated>한국어 본문</Untranslated>\n");
			expect(translation.working.metadata).toEqual({});
			expect(translation.working.translation).toEqual({ version: 2, baseSource: "한국어 본문" });
			expect(source.working.translation ?? null).toBeNull();

			const group = await store.getTranslationGroup({ entryId: translation.id });
			expect(group.groupId).toBe(source.id);
			expect(group.members.map((member) => [member.locale, member.isSource])).toEqual([
				[defaultLocale, true],
				[second, false],
			]);
		});

		it("allows only one translation per language and rejects a language not in the config", async () => {
			const source = await createPost("unique-source");
			await service.createTranslation({ sourceId: source.id, locale: second });
			await expect(service.createTranslation({ sourceId: source.id, locale: second })).rejects.toMatchObject({
				code: "translation_exists",
			});
			await expect(service.createTranslation({ sourceId: source.id, locale: defaultLocale })).rejects.toMatchObject({
				code: "translation_exists",
			});
			await expect(service.createTranslation({ sourceId: source.id, locale: unknownLocale })).rejects.toMatchObject({
				code: "invalid_input",
			});
		});

		it("keeps the locale when duplicating a source in a non-default locale", async () => {
			const original = await seedEntry(store, {
				collection: contentCollection,
				slug: "locale-copy-source",
				metadata: { title: "English" },
				mdx: "Body",
				locale: second,
			});
			expect(original.locale).toBe(second);

			const copy = await store.duplicateEntry({ id: original.id });
			expect(copy.locale).toBe(second);
			expect(copy.translationGroupId).toBe(copy.id);
			expect(copy.working.mdx).toBe("Body");
			expect(copy.working.translation ?? null).toBeNull();
		});

		it("refuses to duplicate a translation", async () => {
			const source = await createPost("duplicate-translation-source");
			const translation = await service.createTranslation({ sourceId: source.id, locale: second });
			await expect(store.duplicateEntry({ id: translation.id })).rejects.toMatchObject({ code: "invalid_input" });
		});

		it.skipIf(!thirdLocale)("creates a translation of a translation from the source", async () => {
			const source = await createPost("nested-source");
			const translation = await service.createTranslation({ sourceId: source.id, locale: second });
			const nested = await service.createTranslation({ sourceId: translation.id, locale: thirdLocale ?? "" });
			expect(nested.translationGroupId).toBe(source.id);
		});

		it.skipIf(!relation && !commonSelect)("rejects saving a shared field on a translation", async () => {
			const source = await createPost("common-source");
			const [commonKey] = commonFieldKeys(contentCollection, source.working.metadata);
			const translation = await service.createTranslation({ sourceId: source.id, locale: second });
			await expect(
				service.saveDraft(translation.id, {
					collection: contentCollection,
					slug: "common-source",
					metadata: { title: "English", [commonKey as string]: source.working.metadata[commonKey as string] },
					mdx: "Body",
					expectedVersion: translation.version,
				} as never),
			).rejects.toMatchObject({ code: "invalid_input" });
		});

		it("publishes a translation only when the source is published, and public reads merge it with the source's shared values", async () => {
			const source = await createPost("merge-source");
			const translation = await service.createTranslation({ sourceId: source.id, locale: second });
			const saved = await service.saveDraft(translation.id, {
				collection: contentCollection,
				slug: "merge-source",
				metadata: translatedMetadata("English title", "English summary") as never,
				mdx: "English body",
				expectedVersion: translation.version,
			});

			await expect(publish(saved)).rejects.toMatchObject({
				code: "publish_validation_failed",
				issues: [expect.objectContaining({ code: "source_not_published" })],
			});

			await publish(source);
			const publishedTranslation = await publish(await store.getEntry(translation.id));
			expect(publishedTranslation.status).toBe("published");
			expect(publishedTranslation.publishedSlug).toBe("merge-source");

			const sourceMetadata = source.working.metadata as Record<string, unknown>;
			const common = Object.fromEntries(
				commonFieldKeys(contentCollection, sourceMetadata).map((key) => [key, sourceMetadata[key]]),
			);
			const listed = await store.listPublishedEntries({ collections: [contentCollection], locale: second });
			const row = listed.find((entry) => entry.id === translation.id);
			expect(row?.metadata).toMatchObject({ ...translatedMetadata("English title", "English summary"), ...common });
			if (commonSelect) expect(row?.metadata[commonSelect.name]).toBe(commonSelect.value);
			if (sourceOnlyText) expect(row?.metadata[sourceOnlyText]).toBeUndefined();
			expect(listed.some((entry) => entry.id === source.id)).toBe(false);

			const lookup = await store.getPublishedEntryBySlug({
				collection: contentCollection,
				slug: "merge-source",
				locale: second,
			});
			expect(lookup.status === "current" && lookup.entry.id).toBe(translation.id);
			const original = await store.getPublishedEntryBySlug({ collection: contentCollection, slug: "merge-source" });
			expect(original.status === "current" && original.entry.id).toBe(source.id);
			// A language with no translation is not found.
			if (thirdLocale) {
				const missing = await store.getPublishedEntryBySlug({
					collection: contentCollection,
					slug: "merge-source",
					locale: thirdLocale,
				});
				expect(missing.status).toBe("not_found");
			}

			// When the source leaves the public layer, its translations leave it too.
			const archived = await store.archiveEntry({
				id: source.id,
				expectedVersion: (await store.getEntry(source.id)).version,
			});
			expect(archived.status).toBe("archived");
			const afterArchive = await store.getPublishedEntryBySlug({
				collection: contentCollection,
				slug: "merge-source",
				locale: second,
			});
			expect(afterArchive.status).toBe("not_found");
		});

		it("stores the translation status only on translations, and keeps the stored value when it is not sent", async () => {
			const source = await createPost("state-source");
			const base = {
				collection: contentCollection,
				slug: "state-source",
				metadata: source.working.metadata as never,
				mdx: "한국어 본문",
			};
			await expect(
				service.saveDraft(source.id, {
					...base,
					translation: { version: 2, baseSource: "" },
					expectedVersion: source.version,
				}),
			).rejects.toMatchObject({ code: "invalid_input" });

			const translation = await service.createTranslation({ sourceId: source.id, locale: second });
			await expect(
				service.saveDraft(translation.id, {
					collection: contentCollection,
					slug: "state-source",
					metadata: { title: "T" },
					mdx: "",
					translation: { version: 1, units: [] } as never,
					expectedVersion: translation.version,
				}),
			).rejects.toMatchObject({ code: "invalid_input" });

			const saved = await service.saveDraft(translation.id, {
				collection: contentCollection,
				slug: "state-source",
				metadata: { title: "Only the title" },
				mdx: "",
				expectedVersion: translation.version,
			});
			expect(saved.working.translation).toEqual(translation.working.translation);

			// Save even when only the translation status changes (acknowledging a source change).
			const ignored = await service.saveDraft(translation.id, {
				collection: contentCollection,
				slug: "state-source",
				metadata: { title: "Only the title" },
				mdx: "",
				translation: { version: 2, baseSource: "바뀐 기준" },
				expectedVersion: saved.version,
			});
			expect(ignored.version).toBe(saved.version + 1);
			expect(ignored.working.translation?.baseSource).toBe("바뀐 기준");
		});

		it("keeps slugs separate per language", async () => {
			const first = await createPost("shared-slug");
			await service.createTranslation({ sourceId: first.id, locale: second });
			await expect(createPost("shared-slug")).rejects.toMatchObject({ code: "slug_conflict" });
		});

		const statusOf = async (id: string) =>
			(await pool.query<{ status: string }>(`SELECT status FROM "${schemaName}".entries WHERE id = $1`, [id])).rows[0]
				?.status;
		const versionOf = async (id: string) =>
			(await pool.query<{ version: number }>(`SELECT version FROM "${schemaName}".entries WHERE id = $1`, [id])).rows[0]
				?.version as number;

		it.skipIf(!thirdLocale)(
			"trashing the source trashes its translations too, and restoring brings back only the translations trashed together",
			async () => {
				const source = await createPost("trash-group-source");
				const together = await service.createTranslation({ sourceId: source.id, locale: second });
				const apart = await service.createTranslation({ sourceId: source.id, locale: thirdLocale ?? "" });
				await store.trashEntry({ id: apart.id, expectedVersion: apart.version });

				const trashed = await store.trashEntry({ id: source.id, expectedVersion: source.version });
				expect(await statusOf(together.id)).toBe("trashed");
				// A translation editor left open notices it as a conflict.
				expect(await versionOf(together.id)).toBe(together.version + 1);

				await expect(
					store.restoreEntry({ id: together.id, expectedVersion: await versionOf(together.id) }),
				).rejects.toMatchObject({ code: "source_trashed" });

				await store.restoreEntry({ id: source.id, expectedVersion: trashed.version });
				expect(await statusOf(source.id)).toBe("draft");
				expect(await statusOf(together.id)).toBe("draft");
				expect(await statusOf(apart.id)).toBe("trashed");

				// While the source is alive, a translation trashed separately can also be restored.
				await store.restoreEntry({ id: apart.id, expectedVersion: await versionOf(apart.id) });
				expect(await statusOf(apart.id)).toBe("draft");
			},
		);

		it("applies archiving and unarchiving the source to its translations too", async () => {
			const source = await createPost("archive-group-source");
			const translation = await service.createTranslation({ sourceId: source.id, locale: second });
			const archived = await store.archiveEntry({ id: source.id, expectedVersion: source.version });
			expect(await statusOf(translation.id)).toBe("archived");
			await store.unarchiveEntry({ id: source.id, expectedVersion: archived.version });
			expect(await statusOf(translation.id)).toBe("draft");

			// Archiving only a translation leaves the source as it is.
			await store.archiveEntry({ id: translation.id, expectedVersion: await versionOf(translation.id) });
			expect(await statusOf(source.id)).toBe("draft");
		});

		it("permanently deleting the source also deletes trashed translations, and is rejected if a translation outside the trash exists", async () => {
			const source = await createPost("delete-source");
			const translation = await service.createTranslation({ sourceId: source.id, locale: second });
			const trashed = await store.trashEntry({ id: source.id, expectedVersion: source.version });

			// Legacy data where only the source is in the trash and the translation is alive.
			await pool.query(`UPDATE "${schemaName}".entries SET status = 'draft', trashed_at = NULL WHERE id = $1`, [
				translation.id,
			]);
			await expect(
				store.permanentDeleteEntry({ id: source.id, expectedVersion: trashed.version }),
			).rejects.toMatchObject({ code: "has_translations" });

			await store.trashEntry({ id: translation.id, expectedVersion: await versionOf(translation.id) });
			await store.permanentDeleteEntry({ id: source.id, expectedVersion: trashed.version });
			expect(await statusOf(source.id)).toBeUndefined();
			expect(await statusOf(translation.id)).toBeUndefined();
		});

		it("group-view lists attach per-language content to one source row, and search and language filters look at the whole group", async () => {
			const source = await createPost("group-list-source");
			const translation = await service.createTranslation({ sourceId: source.id, locale: second });
			await service.saveDraft(translation.id, {
				collection: contentCollection,
				slug: "group-list-source",
				metadata: { title: "Grouped English title" },
				mdx: "Body",
				expectedVersion: translation.version,
			} as never);
			// A trashed translation counts neither toward the group row nor toward the "existing languages".
			if (thirdLocale) {
				const trashedTranslation = await service.createTranslation({ sourceId: source.id, locale: thirdLocale });
				await store.trashEntry({ id: trashedTranslation.id, expectedVersion: trashedTranslation.version });
			}
			const lonely = await createPost("group-list-lonely");

			const all = await store.listEntries({ collection: contentCollection, groupTranslations: true, pageSize: 100 });
			const ids = all.items.map((item) => item.id);
			expect(ids).toContain(source.id);
			expect(ids).toContain(lonely.id);
			expect(ids).not.toContain(translation.id);
			const row = all.items.find((item) => item.id === source.id);
			expect(row?.translations?.map((member) => [member.locale, member.isSource, member.status])).toEqual([
				[defaultLocale, true, "draft"],
				[second, false, "draft"],
			]);
			expect(all.items.find((item) => item.id === lonely.id)?.translations?.map((member) => member.locale)).toEqual([
				defaultLocale,
			]);

			const byTranslatedTitle = await store.listEntries({
				collection: contentCollection,
				groupTranslations: true,
				search: "Grouped English",
				pageSize: 100,
			});
			expect(byTranslatedTitle.items.map((item) => item.id)).toEqual([source.id]);

			const withSecond = await store.listEntries({
				collection: contentCollection,
				groupTranslations: true,
				locales: [second],
				pageSize: 100,
			});
			expect(withSecond.items.map((item) => item.id)).toContain(source.id);
			expect(withSecond.items.map((item) => item.id)).not.toContain(lonely.id);
			if (thirdLocale) {
				const withThird = await store.listEntries({
					collection: contentCollection,
					groupTranslations: true,
					locales: [thirdLocale],
					pageSize: 100,
				});
				expect(withThird.items.map((item) => item.id)).not.toContain(source.id);
			}
		});

		it.skipIf(!relation)(
			"filters lists by language and shows the source's values for a translation's tags and categories",
			async () => {
				if (!relation) return;
				const source = await createPost("list-source");
				const translation = await service.createTranslation({ sourceId: source.id, locale: second });
				const result = await store.listEntries({ collection: contentCollection, locales: [second], pageSize: 100 });
				const row = result.items.find((item) => item.id === translation.id);
				const relatedIds = [source.working.metadata[relation.name]].flat() as string[];
				expect(result.items.every((item) => item.locale === second)).toBe(true);
				expect(row?.translationGroupId).toBe(source.id);
				expect(row?.relations[relation.name]?.map((value) => value.id)).toEqual(relatedIds);
				const byRelation = await store.listEntries({
					collection: contentCollection,
					relations: { [relation.name]: relatedIds },
					pageSize: 100,
				});
				expect(byRelation.items.map((item) => item.id).sort()).toEqual([source.id, translation.id].sort());
			},
		);

		it.skipIf(!localizedRecord)("keeps per-language names inside a single record for a record collection", async () => {
			if (!localizedRecord) return;
			const names = recordLocalizedFields(localizedRecord);
			const field = names.includes("title") ? "title" : (names[0] as string);
			const commonField = storedFields(localizedRecord).find(({ name }) => !names.includes(name))?.name ?? "slug";
			const metadata = await requiredMetadata(localizedRecord, "에세이", relationTarget);
			const record = await service.createDraft({
				collection: localizedRecord,
				slug: "essay",
				metadata: {
					...metadata,
					translations: {
						[second]: { [field]: " Essay " },
						...(thirdLocale ? { [thirdLocale]: { [field]: "" } } : {}),
					},
				},
				mdx: "",
			} as never);
			expect(record.working.metadata.translations).toEqual({ [second]: { [field]: "Essay" } });
			await expect(
				service.createDraft({
					collection: localizedRecord,
					slug: "bad-locale",
					metadata: { ...metadata, translations: { [defaultLocale]: { [field]: "x" } } },
					mdx: "",
				} as never),
			).rejects.toMatchObject({ code: "invalid_metadata_value" });
			await expect(
				service.createDraft({
					collection: localizedRecord,
					slug: "bad-field",
					metadata: { ...metadata, translations: { [second]: { [commonField]: "x" } } },
					mdx: "",
				} as never),
			).rejects.toMatchObject({ code: "invalid_metadata_key" });
			await expect(
				service.createDraft({
					collection: contentCollection,
					slug: "post-translations",
					metadata: { title: "x", translations: { [second]: { title: "x" } } },
					mdx: "",
				} as never),
			).rejects.toMatchObject({ code: "invalid_metadata_key" });
		});
	});
});
