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
import { createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/**
 * 번역 시험에 쓰는 언어·필드. 컬렉션·필드·언어 이름은 지금 설정에서 찾는다(`test/any-site.ts`).
 * 언어가 하나뿐인 설정이면 번역 시험을 건너뛰고, 세 번째 언어가 필요한 경우도 따로 건너뛴다.
 */
const second = secondLocale ?? "";
const thirdLocale = LOCALES.filter((code) => code !== defaultLocale)[1];
const unknownLocale = "zz";
const localized = (() => {
	const { own, inherit } = localizedFieldNames(contentCollection);
	return new Set([...own, ...inherit]);
})();
/** 제목 말고 언어별 값인 텍스트 필드. 첫째는 번역본도 채우고, 둘째는 원문만 채워 번역본에 섞이지 않는지 본다. */
const [translatedText, sourceOnlyText] = localizedFieldNames(contentCollection).own.filter((name) => {
	const stored = storedField(contentCollection, name);
	return name !== "title" && !stored?.when && stored?.field.kind === "text";
});
/** 번역 묶음이 같이 쓰는 선택 필드. 원문에 기본값이 아닌 값을 넣어 번역본 공개 값에 따라오는지 본다. */
const commonSelect = (() => {
	for (const { name, field, when } of storedFields(contentCollection)) {
		if (when || localized.has(name) || field.kind !== "select") continue;
		const value = Object.keys(field.options).find((key) => key !== field.defaultValue);
		if (value) return { name, value };
	}
	return undefined;
})();
/** 항목 컬렉션을 가리키는 공통 관계 필드(카테고리 같은 것). */
const relation = (() => {
	const found = recordRelationField(contentCollection);
	return found && !localized.has(found.name) ? found : undefined;
})();
/** 언어별 이름을 한 레코드 안에 두는 항목 컬렉션. */
const localizedRecord = COLLECTIONS.find((name) => recordLocalizedFields(name).length > 0);

/** v2 B4 다국어: 언어별 문서 + 번역 묶음. */
describe("번역 묶음(v2 B4)", () => {
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

	/** 대상 컬렉션의 새 공개 항목. 글마다 새로 만들어 관계로 거를 때 그 글만 나오게 한다. */
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

	/** 번역본이 저장하는 언어별 값(제목과 첫 언어별 텍스트). */
	const translatedMetadata = (title: string, text: string) => ({
		title,
		...(translatedText ? { [translatedText]: text } : {}),
	});

	const publish = (entry: Entry) => store.publishEntry({ id: entry.id, expectedVersion: entry.version });

	it("다시 이전해도 결과가 같다(열·기본 키)", async () => {
		await migrateContentStore(pool, { schema: schemaName });
		const pk = await pool.query<{ column_name: string }>(
			`SELECT column_name FROM information_schema.key_column_usage
			 WHERE table_schema = $1 AND constraint_name = 'content_addresses_pkey' ORDER BY ordinal_position`,
			[schemaName],
		);
		expect(pk.rows.map((row) => row.column_name)).toEqual(["collection", "locale", "slug"]);
	});

	describe.skipIf(!secondLocale)("번역본(언어가 둘 이상)", () => {
		it("번역본은 원문 주소를 같이 쓰고, 본문은 원문 글을 번역 안내로 감싼 틀에서 시작한다(v3)", async () => {
			const source = await createPost("copy-source");
			expect(source.locale).toBe(defaultLocale);
			expect(source.translationGroupId).toBe(source.id);

			const translation = await service.createTranslation({ sourceId: source.id, locale: second });
			expect(translation.locale).toBe(second);
			expect(translation.translationGroupId).toBe(source.id);
			expect(translation.status).toBe("draft");
			expect(translation.workingSlug).toBe("copy-source");
			expect(translation.working.mdx).toBe(":untranslated[한국어 본문]\n");
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

		it("같은 언어 번역본은 하나뿐이고, 설정에 없는 언어는 거부한다", async () => {
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

		it.skipIf(!thirdLocale)("번역본의 번역본은 원문에서 만든다", async () => {
			const source = await createPost("nested-source");
			const translation = await service.createTranslation({ sourceId: source.id, locale: second });
			const nested = await service.createTranslation({ sourceId: translation.id, locale: thirdLocale ?? "" });
			expect(nested.translationGroupId).toBe(source.id);
		});

		it.skipIf(!relation && !commonSelect)("번역본에 공통 필드를 저장하면 거부한다", async () => {
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

		it("번역본은 원문이 공개돼야 발행되고, 공개 조회는 원문의 공통 값과 합친다", async () => {
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
			// 번역본이 없는 언어는 찾지 못한다.
			if (thirdLocale) {
				const missing = await store.getPublishedEntryBySlug({
					collection: contentCollection,
					slug: "merge-source",
					locale: thirdLocale,
				});
				expect(missing.status).toBe("not_found");
			}

			// 원문이 공개에서 빠지면 번역본도 공개 계층에서 빠진다.
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

		it("번역 상태는 번역본만 저장하고, 보내지 않으면 저장된 값을 그대로 둔다(v3)", async () => {
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

			// 번역 상태만 바뀌어도(원문 변경 확인) 저장한다.
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

		it("주소는 언어마다 따로다", async () => {
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
			"원문을 휴지통으로 보내면 번역본도 함께 가고, 복원하면 함께 버린 번역본만 돌아온다(v3)",
			async () => {
				const source = await createPost("trash-group-source");
				const together = await service.createTranslation({ sourceId: source.id, locale: second });
				const apart = await service.createTranslation({ sourceId: source.id, locale: thirdLocale ?? "" });
				await store.trashEntry({ id: apart.id, expectedVersion: apart.version });

				const trashed = await store.trashEntry({ id: source.id, expectedVersion: source.version });
				expect(await statusOf(together.id)).toBe("trashed");
				// 열어 둔 번역본 편집 화면이 충돌로 알아차린다.
				expect(await versionOf(together.id)).toBe(together.version + 1);

				await expect(
					store.restoreEntry({ id: together.id, expectedVersion: await versionOf(together.id) }),
				).rejects.toMatchObject({ code: "source_trashed" });

				await store.restoreEntry({ id: source.id, expectedVersion: trashed.version });
				expect(await statusOf(source.id)).toBe("draft");
				expect(await statusOf(together.id)).toBe("draft");
				expect(await statusOf(apart.id)).toBe("trashed");

				// 원문이 살아 있으면 따로 지운 번역본도 복원된다.
				await store.restoreEntry({ id: apart.id, expectedVersion: await versionOf(apart.id) });
				expect(await statusOf(apart.id)).toBe("draft");
			},
		);

		it("원문 보관·보관 해제는 번역본에도 적용된다(v3)", async () => {
			const source = await createPost("archive-group-source");
			const translation = await service.createTranslation({ sourceId: source.id, locale: second });
			const archived = await store.archiveEntry({ id: source.id, expectedVersion: source.version });
			expect(await statusOf(translation.id)).toBe("archived");
			await store.unarchiveEntry({ id: source.id, expectedVersion: archived.version });
			expect(await statusOf(translation.id)).toBe("draft");

			// 번역본만 보관하면 원문은 그대로다.
			await store.archiveEntry({ id: translation.id, expectedVersion: await versionOf(translation.id) });
			expect(await statusOf(source.id)).toBe("draft");
		});

		it("원문을 영구 삭제하면 휴지통의 번역본도 함께 지우고, 휴지통 밖 번역본이 있으면 거부한다(v3)", async () => {
			const source = await createPost("delete-source");
			const translation = await service.createTranslation({ sourceId: source.id, locale: second });
			const trashed = await store.trashEntry({ id: source.id, expectedVersion: source.version });

			// 원문만 휴지통에 있고 번역본이 살아 있는 예전 데이터.
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

		it("묶음 보기 목록은 원문 한 줄에 언어별 콘텐츠를 딸려 보이고, 검색·언어 필터는 묶음 전체로 본다(v3)", async () => {
			const source = await createPost("group-list-source");
			const translation = await service.createTranslation({ sourceId: source.id, locale: second });
			await service.saveDraft(translation.id, {
				collection: contentCollection,
				slug: "group-list-source",
				metadata: { title: "Grouped English title" },
				mdx: "Body",
				expectedVersion: translation.version,
			} as never);
			// 휴지통의 번역본은 묶음 줄에도, "있는 언어"에도 치지 않는다.
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

		it.skipIf(!relation)("목록은 언어로 거르고 번역본의 태그·카테고리는 원문 값을 보여 준다", async () => {
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
		});

		it.skipIf(!localizedRecord)("record 컬렉션은 한 레코드 안에 언어별 이름을 둔다", async () => {
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
