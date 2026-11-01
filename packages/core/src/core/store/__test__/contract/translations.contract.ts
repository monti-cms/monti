import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, defaultLocale, requiredMetadata, secondLocale } from "../../../../../test/any-site";
import { testSite } from "../../../../../test/site";
import { contentOf, docOf } from "../../../../../test/stored-content";
import { readStoredDocument, type StoredDocument } from "../../../../doc/stored-document";
import { withTranslationHints } from "../../../translation/hints";
import type { ContentStore, Entry } from "../..";
import { duplicateDraft, publishDraft, restoreDraft, seedEntry } from "../seed";
import type { ContractSuite, StoreSession } from "./harness";
import {
	commonSelect,
	localizedRecord,
	relation,
	second,
	sourceOnlyText,
	thirdLocale,
	translatedMetadata,
	translationHelpers,
	unknownLocale,
} from "./translation-fixtures";

/** Contract of the translation groups of EntryStore/LifecycleStore: per-language documents and translation groups. */
export const translationsContract: ContractSuite = (factory) => {
	describe("translation groups", () => {
		let session: StoreSession;
		let store: ContentStore;
		let service: ReturnType<typeof translationHelpers>["service"];
		let createPost: ReturnType<typeof translationHelpers>["createPost"];
		let relationTarget: ReturnType<typeof translationHelpers>["relationTarget"];

		beforeAll(async () => {
			session = await factory.create();
			store = session.store;
			({ service, createPost, relationTarget } = translationHelpers(store));
		});

		afterAll(async () => {
			await session.close();
		});

		const publish = (entry: Entry) => publishDraft(testSite, store, { id: entry.id, expectedVersion: entry.version });

		describe.skipIf(!secondLocale)("translations (two or more languages)", () => {
			it("TRANS-N2 shares the source slug, and the body starts from a frame that wraps the source text in a translation notice", async () => {
				const source = await createPost("copy-source");
				expect(source.locale).toBe(defaultLocale);
				expect(source.translationGroupId).toBe(source.id);

				const translation = (await service.createTranslation({ sourceId: source.id, locale: second })).entry;
				expect(translation.locale).toBe(second);
				expect(translation.translationGroupId).toBe(source.id);
				expect(translation.status).toBe("draft");
				expect(translation.workingSlug).toBe("copy-source");
				expect(contentOf(translation.working.doc)).toEqual(
					contentOf(withTranslationHints(testSite, readStoredDocument(source.working.doc) as StoredDocument)),
				);
				expect(JSON.stringify(contentOf(translation.working.doc))).toContain("한국어 본문");
				expect(translation.working.metadata).toEqual({});
				// The confirmed source is the source's document, whose block ids pair the source's blocks across versions.
				expect(source.working.doc).not.toBeNull();
				expect(translation.working.translation).toEqual({ version: 4, baseDoc: source.working.doc });
				expect((await store.getEntry(translation.id)).working.translation).toEqual(translation.working.translation);
				expect(source.working.translation ?? null).toBeNull();

				const group = await store.getTranslationGroup({ entryId: translation.id });
				expect(group.groupId).toBe(source.id);
				expect(group.members.map((member) => [member.locale, member.isSource])).toEqual([
					[defaultLocale, true],
					[second, false],
				]);
			});

			it("TRANS-N1 allows only one translation per language and rejects a language not in the config", async () => {
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

			it("TRANS-N1 keeps the locale when duplicating a source in a non-default locale", async () => {
				const original = await seedEntry(store, {
					collection: contentCollection,
					slug: "locale-copy-source",
					metadata: { title: "English" },
					text: "Body\n",
					locale: second,
				});
				expect(original.locale).toBe(second);

				const copy = await duplicateDraft(testSite, store, { id: original.id });
				expect(copy.locale).toBe(second);
				expect(copy.translationGroupId).toBe(copy.id);
				expect(contentOf(copy.working.doc)).toEqual(contentOf(original.working.doc));
				expect(copy.working.translation ?? null).toBeNull();
			});

			it("TRANS-N1 refuses to duplicate a translation", async () => {
				const source = await createPost("duplicate-translation-source");
				const translation = (await service.createTranslation({ sourceId: source.id, locale: second })).entry;
				await expect(duplicateDraft(testSite, store, { id: translation.id })).rejects.toMatchObject({
					code: "invalid_input",
				});
			});

			it.skipIf(!thirdLocale)("TRANS-N1 creates a translation of a translation from the source", async () => {
				const source = await createPost("nested-source");
				const translation = (await service.createTranslation({ sourceId: source.id, locale: second })).entry;
				await service.saveDraft(translation.id, {
					collection: contentCollection,
					slug: translation.workingSlug,
					metadata: translatedMetadata("English title", "English summary"),
					format: "paragraphs",
					body: "Translated body",
					expectedVersion: translation.version,
				} as never);
				const nested = (await service.createTranslation({ sourceId: translation.id, locale: thirdLocale ?? "" })).entry;
				expect(nested.translationGroupId).toBe(source.id);
				// It starts from the source's text, not from the translation it was asked on.
				expect(contentOf(nested.working.doc)).toEqual(
					contentOf(withTranslationHints(testSite, readStoredDocument(source.working.doc) as StoredDocument)),
				);
			});

			it.skipIf(!relation && !commonSelect)("TRANS-N3 rejects saving a shared field on a translation", async () => {
				const source = await createPost("common-source");
				const [commonKey] = testSite.commonFieldKeys(contentCollection, source.working.metadata);
				const translation = (await service.createTranslation({ sourceId: source.id, locale: second })).entry;
				await expect(
					service.saveDraft(translation.id, {
						collection: contentCollection,
						slug: "common-source",
						metadata: { title: "English", [commonKey as string]: source.working.metadata[commonKey as string] },
						format: "paragraphs",
						body: "Body",
						expectedVersion: translation.version,
					} as never),
				).rejects.toMatchObject({ code: "invalid_input" });
			});

			it("TRANS-N4 publishes a translation only when the source is published, and public reads merge it with the source's shared values", async () => {
				const source = await createPost("merge-source");
				const translation = (await service.createTranslation({ sourceId: source.id, locale: second })).entry;
				const saved = (
					await service.saveDraft(translation.id, {
						collection: contentCollection,
						slug: "merge-source",
						metadata: translatedMetadata("English title", "English summary") as never,
						format: "paragraphs",
						body: "English body",
						expectedVersion: translation.version,
					})
				).entry;

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
					testSite.commonFieldKeys(contentCollection, sourceMetadata).map((key) => [key, sourceMetadata[key]]),
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

			it("TRANS-N9 stores the translation status only on translations, and keeps the stored value when it is not sent", async () => {
				const source = await createPost("state-source");
				const base = {
					collection: contentCollection,
					slug: "state-source",
					metadata: source.working.metadata as never,
					format: "paragraphs",
					body: "한국어 본문",
				};
				await expect(
					service.saveDraft(source.id, {
						...base,
						translation: { version: 3, baseSource: "", baseDoc: null } as never,
						expectedVersion: source.version,
					}),
				).rejects.toMatchObject({ code: "invalid_input" });

				const translation = (await service.createTranslation({ sourceId: source.id, locale: second })).entry;
				await expect(
					service.saveDraft(translation.id, {
						collection: contentCollection,
						slug: "state-source",
						metadata: { title: "T" },
						format: "paragraphs",
						body: "",
						translation: { version: 1, units: [] } as never,
						expectedVersion: translation.version,
					}),
				).rejects.toMatchObject({ code: "invalid_input" });

				const saved = (
					await service.saveDraft(translation.id, {
						collection: contentCollection,
						slug: "state-source",
						metadata: { title: "Only the title" },
						format: "paragraphs",
						body: "",
						expectedVersion: translation.version,
					})
				).entry;
				expect(saved.working.translation).toEqual(translation.working.translation);

				// Save even when only the translation status changes (acknowledging a source change).
				const ignored = (
					await service.saveDraft(translation.id, {
						collection: contentCollection,
						slug: "state-source",
						metadata: { title: "Only the title" },
						format: "paragraphs",
						body: "",
						translation: { version: 4, baseDoc: docOf("바뀐 기준") },
						expectedVersion: saved.version,
					})
				).entry;
				expect(ignored.version).toBe(saved.version + 1);
				expect(ignored.working.translation).toMatchObject({ version: 4 });
				expect(contentOf(ignored.working.translation?.baseDoc)).toEqual(contentOf(docOf("바뀐 기준")));
			});

			it("TRANS-N7 keeps slugs separate per language", async () => {
				const first = await createPost("shared-slug");
				await service.createTranslation({ sourceId: first.id, locale: second });
				await expect(createPost("shared-slug")).rejects.toMatchObject({ code: "slug_conflict" });
			});

			const statusOf = async (id: string) => (await store.getEntry(id)).status;
			const versionOf = async (id: string) => (await store.getEntry(id)).version;

			it.skipIf(!thirdLocale)(
				"TRASH-R2 trashing the source trashes its translations too, and restoring brings back only the translations trashed together",
				async () => {
					const source = await createPost("trash-group-source");
					const together = (await service.createTranslation({ sourceId: source.id, locale: second })).entry;
					const apart = (await service.createTranslation({ sourceId: source.id, locale: thirdLocale ?? "" })).entry;
					await store.trashEntry({ id: apart.id, expectedVersion: apart.version });

					const trashed = await store.trashEntry({ id: source.id, expectedVersion: source.version });
					expect(await statusOf(together.id)).toBe("trashed");
					// A translation editor left open notices it as a conflict.
					expect(await versionOf(together.id)).toBe(together.version + 1);

					await expect(
						restoreDraft(testSite, store, { id: together.id, expectedVersion: await versionOf(together.id) }),
					).rejects.toMatchObject({ code: "source_trashed" });

					await restoreDraft(testSite, store, { id: source.id, expectedVersion: trashed.version });
					expect(await statusOf(source.id)).toBe("draft");
					expect(await statusOf(together.id)).toBe("draft");
					expect(await statusOf(apart.id)).toBe("trashed");

					// While the source is alive, a translation trashed separately can also be restored.
					await restoreDraft(testSite, store, { id: apart.id, expectedVersion: await versionOf(apart.id) });
					expect(await statusOf(apart.id)).toBe("draft");
				},
			);

			it("TRANS-N8 applies archiving and unarchiving the source to its translations too", async () => {
				const source = await createPost("archive-group-source");
				const translation = (await service.createTranslation({ sourceId: source.id, locale: second })).entry;
				const archived = await store.archiveEntry({ id: source.id, expectedVersion: source.version });
				expect(await statusOf(translation.id)).toBe("archived");
				await store.unarchiveEntry({ id: source.id, expectedVersion: archived.version });
				expect(await statusOf(translation.id)).toBe("draft");

				// Archiving only a translation leaves the source as it is.
				await store.archiveEntry({ id: translation.id, expectedVersion: await versionOf(translation.id) });
				expect(await statusOf(source.id)).toBe("draft");
			});

			it("TRANS-L1 group-view lists attach per-language content to one source row, and search and language filters look at the whole group", async () => {
				const source = await createPost("group-list-source");
				const translation = (await service.createTranslation({ sourceId: source.id, locale: second })).entry;
				await service.saveDraft(translation.id, {
					collection: contentCollection,
					slug: "group-list-source",
					metadata: { title: "Grouped English title" },
					format: "paragraphs",
					body: "Body",
					expectedVersion: translation.version,
				} as never);
				// A trashed translation counts neither toward the group row nor toward the "existing languages".
				if (thirdLocale) {
					const trashedTranslation = (await service.createTranslation({ sourceId: source.id, locale: thirdLocale }))
						.entry;
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

			describe("the translation filter and its counts", () => {
				/** A source edited after its translation was confirmed: the translation is behind. */
				const editSource = async (source: Entry, body: string) => {
					const current = await store.getEntry(source.id);
					await service.saveDraft(source.id, {
						collection: contentCollection,
						slug: current.workingSlug,
						metadata: current.working.metadata,
						format: "paragraphs",
						body,
						expectedVersion: current.version,
					} as never);
				};

				const group = async (slug: string) => {
					const source = await createPost(slug);
					await service.createTranslation({ sourceId: source.id, locale: second });
					return source;
				};

				const idsFor = async (translations: ("none" | "changed" | "current")[]) =>
					(
						await store.listEntries({
							collection: contentCollection,
							groupTranslations: true,
							translations,
							pageSize: 100,
						})
					).items.map((item) => item.id);

				it("TRANS-L1 tells a group with no translation, one that is behind its source and one that is up to date apart", async () => {
					const alone = await createPost("tf-alone");
					const behind = await group("tf-behind");
					await editSource(behind, "A new paragraph of the source");
					const current = await group("tf-current");
					const none = await idsFor(["none"]);
					const changed = await idsFor(["changed"]);
					const upToDate = await idsFor(["current"]);
					expect([none.includes(alone.id), none.includes(behind.id), none.includes(current.id)]).toEqual([
						true,
						false,
						false,
					]);
					expect([changed.includes(alone.id), changed.includes(behind.id), changed.includes(current.id)]).toEqual([
						false,
						true,
						false,
					]);
					expect([upToDate.includes(alone.id), upToDate.includes(behind.id), upToDate.includes(current.id)]).toEqual([
						false,
						false,
						true,
					]);
				});

				it("TRANS-S1 does not count a change to the block ids alone as a change of the source", async () => {
					const source = await group("tf-ids-only");
					const current = await store.getEntry(source.id);
					await service.saveDraft(source.id, {
						collection: contentCollection,
						slug: current.workingSlug,
						metadata: current.working.metadata,
						doc: {
							...current.working.doc,
							content: (current.working.doc?.content ?? []).map((node, index) => ({ ...node, id: `ids0000${index}` })),
						},
						expectedVersion: current.version,
					} as never);
					expect(await idsFor(["current"])).toContain(source.id);
					expect(await idsFor(["changed"])).not.toContain(source.id);
				});

				it("TRANS-L1 takes several as OR", async () => {
					const alone = await createPost("tf-or-alone");
					const behind = await group("tf-or-behind");
					await editSource(behind, "Edited");
					const current = await group("tf-or-current");
					const ids = await idsFor(["none", "changed"]);
					expect(ids).toContain(alone.id);
					expect(ids).toContain(behind.id);
					expect(ids).not.toContain(current.id);
				});

				it("TRANS-L1 does not count a trashed translation", async () => {
					const source = await createPost("tf-trashed");
					const translation = (await service.createTranslation({ sourceId: source.id, locale: second })).entry;
					await store.trashEntry({ id: translation.id, expectedVersion: translation.version });
					expect(await idsFor(["none"])).toContain(source.id);
				});

				it("TRANS-L1 counts the groups of each state", async () => {
					const ask = () =>
						store.countListValues({ collection: contentCollection, facet: "translation", groupTranslations: true });
					const before = await ask();
					await createPost("tc-alone");
					await createPost("tc-alone-too");
					const behind = await group("tc-behind");
					await editSource(behind, "Edited");
					await group("tc-current");
					const after = await ask();
					expect(after.total - before.total).toBe(4);
					const grew = (key: string) => (after.values[key] ?? 0) - (before.values[key] ?? 0);
					expect([grew("none"), grew("changed"), grew("current")]).toEqual([2, 1, 1]);
				});

				it("TRANS-L1 is refused for a collection without translations", async () => {
					if (!localizedRecord) return;
					await expect(
						store.listEntries({ collection: localizedRecord, translations: ["none"] }),
					).rejects.toMatchObject({ code: "invalid_input" });
				});
			});

			it.skipIf(!relation)(
				"TRANS-N3 filters lists by language and shows the source's values for a translation's tags and categories",
				async () => {
					if (!relation) return;
					const source = await createPost("list-source");
					const translation = (await service.createTranslation({ sourceId: source.id, locale: second })).entry;
					const result = await store.listEntries({ collection: contentCollection, locales: [second], pageSize: 100 });
					const row = result.items.find((item) => item.id === translation.id);
					const relatedIds = [source.working.metadata[relation.name]].flat() as string[];
					expect(result.items.every((item) => item.locale === second)).toBe(true);
					expect(row?.translationGroupId).toBe(source.id);
					expect(row?.relations[relation.name]?.map((value) => value.id)).toEqual(relatedIds);
					const byRelation = await store.listEntries({
						collection: contentCollection,
						fields: { [relation.name]: relatedIds.map((value) => ({ kind: "is" as const, value })) },
						pageSize: 100,
					});
					expect(byRelation.items.map((item) => item.id).sort()).toEqual([source.id, translation.id].sort());
				},
			);

			it.skipIf(!localizedRecord)(
				"TRANS-N3 keeps per-language names inside a single record for a record collection",
				async () => {
					if (!localizedRecord) return;
					const names = testSite.recordLocalizedFields(localizedRecord);
					const field = names.includes("title") ? "title" : (names[0] as string);
					const commonField =
						testSite.storedFields(localizedRecord).find(({ name }) => !names.includes(name))?.name ?? "slug";
					const metadata = await requiredMetadata(localizedRecord, "에세이", relationTarget);
					const record = (
						await service.createDraft({
							collection: localizedRecord,
							slug: "essay",
							metadata: {
								...metadata,
								translations: {
									[second]: { [field]: " Essay " },
									...(thirdLocale ? { [thirdLocale]: { [field]: "" } } : {}),
								},
							},
							format: "paragraphs",
							body: "",
						} as never)
					).entry;
					expect(record.working.metadata.translations).toEqual({ [second]: { [field]: "Essay" } });
					await expect(
						service.createDraft({
							collection: localizedRecord,
							slug: "bad-locale",
							metadata: { ...metadata, translations: { [defaultLocale]: { [field]: "x" } } },
							format: "paragraphs",
							body: "",
						} as never),
					).rejects.toMatchObject({ code: "invalid_metadata_value" });
					await expect(
						service.createDraft({
							collection: localizedRecord,
							slug: "bad-field",
							metadata: { ...metadata, translations: { [second]: { [commonField]: "x" } } },
							format: "paragraphs",
							body: "",
						} as never),
					).rejects.toMatchObject({ code: "invalid_metadata_key" });
					await expect(
						service.createDraft({
							collection: contentCollection,
							slug: "post-translations",
							metadata: { title: "x", translations: { [second]: { title: "x" } } },
							format: "paragraphs",
							body: "",
						} as never),
					).rejects.toMatchObject({ code: "invalid_metadata_key" });
				},
			);
		});
	});
};
