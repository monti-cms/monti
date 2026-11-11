import { sql } from "kysely";
import { beforeEach, describe, expect, it } from "vitest";
import { testDatabase } from "../__test__/database";
import { slugify } from "../entries/paths";
import { createReader, type SiteEntry } from "../entries/reader";
import { createMonti } from "../monti";
import { migrateContent } from "../schema/apply";
import { checkSchema, defineSchema, type Schema } from "../schema/define";
import { unlinkTargetGroup } from "./sync";

const db = await testDatabase();

const schema = defineSchema({
	locales: {
		source: "ko",
		list: [
			{ code: "ko", name: "한국어" },
			{ code: "en", name: "English" },
		],
		prefix: "never",
	},
	collections: {
		post: {
			kind: "document",
			path: "/posts/:slug",
			fields: {
				title: { kind: "text", required: true },
				slug: { kind: "slug", required: true, from: "title" },
				category: { kind: "relation", to: "category" },
				tags: { kind: "relation", to: "tag", many: true, createMissing: true },
				series: { kind: "relation", to: "series", via: "posts" },
				related: { kind: "relation", to: "post", many: true, ordered: true },
			},
		},
		category: {
			kind: "item",
			path: "/categories/:slug",
			fields: {
				title: { kind: "text", required: true },
				slug: { kind: "slug", required: true },
				description: { kind: "text" },
			},
		},
		tag: {
			kind: "item",
			path: "/tags/:slug",
			fields: {
				title: { kind: "text", required: true },
				slug: { kind: "slug", required: true },
			},
		},
		series: {
			kind: "document",
			path: "/series/:slug",
			fields: {
				title: { kind: "text", required: true },
				slug: { kind: "slug", required: true },
				posts: { kind: "relation", to: "post", many: true, ordered: true },
			},
		},
	},
});

const SECRET = "relations-test-secret";
let clock = new Date("2026-10-01T09:00:00Z");
const site = (currentSchema: Schema = schema) =>
	createMonti({ db, schema: currentSchema, secret: SECRET, now: () => clock });
const reader = (currentSchema: Schema = schema) =>
	createReader({ db, schema: currentSchema, secret: SECRET, now: () => clock });

type Written<Output> = { output: Output; activityId: string; versions: Record<string, number | null> };
const write = async <Output = { id: string }>(name: string, input: unknown, monti = site()) =>
	(await monti.run(name, input, { actor: "admin" })) as Written<Output>;
const read = <Output>(name: string, input: unknown, monti = site()) =>
	monti.run(name, input, { actor: "admin" }) as Promise<Output>;

type Got = {
	entry: {
		id: string;
		version: number;
		slug: string;
		status: string;
		translationGroup: string;
		values: Record<string, unknown>;
	};
	state: string;
	published: { slug: string; publishedAt: Date; values: Record<string, unknown> } | null;
};
const get = (id: string, monti = site()) => read<Got>("entries.get", { id }, monti);
const version = async (id: string) => (await get(id)).entry.version;

async function newPost(title: string, values: Record<string, unknown> = {}, locale = "ko", slug?: string) {
	const res = await write<{ id: string }>("entries.create", {
		collection: "post",
		locale,
		title,
		slug: slug ?? slugify(title),
		values,
	});
	return res.output.id;
}

async function newTag(title: string, slug?: string) {
	const res = await write<{ id: string }>("entries.create", {
		collection: "tag",
		locale: "ko",
		title,
		slug: slug ?? slugify(title),
		values: {},
	});
	const entry = (await get(res.output.id)).entry;
	return { id: res.output.id, group: entry.translationGroup };
}

async function newCategory(title: string, slug?: string) {
	const res = await write<{ id: string }>("entries.create", {
		collection: "category",
		locale: "ko",
		title,
		slug: slug ?? slugify(title),
		values: {},
	});
	const entry = (await get(res.output.id)).entry;
	return { id: res.output.id, group: entry.translationGroup };
}

async function newSeries(title: string, slug?: string) {
	const res = await write<{ id: string }>("entries.create", {
		collection: "series",
		locale: "ko",
		title,
		slug: slug ?? slugify(title),
		values: {},
	});
	const entry = (await get(res.output.id)).entry;
	return { id: res.output.id, group: entry.translationGroup };
}

beforeEach(async () => {
	clock = new Date("2026-10-01T09:00:00Z");
	await sql`drop view if exists monti_post, monti_category, monti_tag, monti_series`.execute(db);
	for (const table of [
		"entries",
		"entry_published",
		"entry_links",
		"monti_proposal_item",
		"monti_proposal",
		"monti_activity",
		"monti_delivery",
		"schema_state",
		"schema_changes",
	] as const) {
		await db.deleteFrom(table).execute();
	}
	await migrateContent(db, schema, []);
});

describe("08-1 taxonomy flows and operations", () => {
	it("08-1 relations.usage and relations.options report usage counts, unused items, and option filters", async () => {
		const tagReact = await newTag("리액트", "react");
		const tagTS = await newTag("타입스크립트", "typescript");
		const tagVue = await newTag("뷰", "vue");

		await newPost("Post 1", { tags: [tagReact.group, tagTS.group] });
		await newPost("Post 2", { tags: [tagReact.group] });
		await newPost("Post 3", { tags: [tagReact.group] });

		// Check usage for tag collection
		const tagUsage = await read<{ items: { group: string; usageCount: number }[] }>("relations.usage", {
			collection: "tag",
		});
		const byGroup = new Map(tagUsage.items.map((u) => [u.group, u.usageCount]));
		expect(byGroup.get(tagReact.group)).toBe(3);
		expect(byGroup.get(tagTS.group)).toBe(1);
		expect(byGroup.get(tagVue.group)).toBe(0);

		// Check options with search
		const searchExact = await read<{
			options: { group: string; title: string }[];
			exactMatch: boolean;
			canCreate: boolean;
		}>("relations.options", {
			collection: "post",
			field: "tags",
			search: "리액트",
		});
		expect(searchExact.exactMatch).toBe(true);
		expect(searchExact.options.some((o) => o.group === tagReact.group)).toBe(true);

		const searchMissing = await read<{
			options: { group: string; title: string }[];
			exactMatch: boolean;
			canCreate: boolean;
		}>("relations.options", {
			collection: "post",
			field: "tags",
			search: "스벨트",
		});
		expect(searchMissing.exactMatch).toBe(false);
		expect(searchMissing.canCreate).toBe(true);
		expect(searchMissing.options).toHaveLength(0);
	});

	it("08-1 relations.edit bulk adds and removes relations across multiple entries", async () => {
		const tagReact = await newTag("리액트", "react");
		const tagTS = await newTag("타입스크립트", "typescript");

		const p1 = await newPost("Post 1", { tags: [tagReact.group] });
		const p2 = await newPost("Post 2", { tags: [tagReact.group] });
		const p3 = await newPost("Post 3", { tags: [] });

		// Bulk add tagTS to p2 and p3
		await write("relations.edit", {
			collection: "post",
			field: "tags",
			entryIds: [p2, p3],
			add: [tagTS.group],
		});

		expect((await get(p2)).entry.values.tags).toEqual([tagReact.group, tagTS.group]);
		expect((await get(p3)).entry.values.tags).toEqual([tagTS.group]);

		// Bulk remove tagReact from p1 and p2
		await write("relations.edit", {
			collection: "post",
			field: "tags",
			entryIds: [p1, p2],
			remove: [tagReact.group],
		});

		expect((await get(p1)).entry.values.tags).toEqual([]);
		expect((await get(p2)).entry.values.tags).toEqual([tagTS.group]);

		// Check entry_links table
		const links = await db.selectFrom("entry_links").selectAll().execute();
		const p2Entry = (await get(p2)).entry;
		const p2Links = links.filter((l) => l.from_group === p2Entry.translationGroup);
		expect(p2Links).toHaveLength(1);
		expect(p2Links[0].to_group).toBe(tagTS.group);
	});

	it("08-1 relations.merge previews and merges items, dedupes tags, trashes duplicate, and activity.undo restores", async () => {
		const tagReact = await newTag("리액트", "react");
		const tagReactEn = await newTag("React", "react-en");

		const p1 = await newPost("Post 1", { tags: [tagReactEn.group] });
		const p2 = await newPost("Post 2", { tags: [tagReactEn.group, tagReact.group] });
		const p3 = await newPost("Post 3", { tags: [tagReact.group] });

		// Preview merge via proposal
		const monti = site();
		const proposalId = await monti.proposals.create("c1", "merge tags preview");
		const { preview } = (await monti.proposals.add(proposalId, "relations.merge", {
			collection: "tag",
			intoGroup: tagReact.group,
			fromGroups: [tagReactEn.group],
		})) as unknown as {
			preview: {
				intoGroup: string;
				intoTitle: string;
				affectedCount: number;
				trashedItems: { group: string; title: string; slugs: string[] }[];
				removedUrls: string[];
			};
		};

		expect(preview.intoGroup).toBe(tagReact.group);
		expect(preview.intoTitle).toBe("리액트");
		expect(preview.affectedCount).toBe(2);
		expect(preview.trashedItems).toHaveLength(1);
		expect(preview.removedUrls).toContain("/tags/react-en");

		// Run merge
		const mergeRes = await write<{
			intoGroup: string;
			intoTitle: string;
			affectedCount: number;
			trashedItems: { group: string; title: string; slugs: string[] }[];
			removedUrls: string[];
		}>("relations.merge", {
			collection: "tag",
			intoGroup: tagReact.group,
			fromGroups: [tagReactEn.group],
		});

		expect(mergeRes.output.affectedCount).toBe(2);
		expect(mergeRes.output.trashedItems).toHaveLength(1);

		// Post 1 now has tagReact
		expect((await get(p1)).entry.values.tags).toEqual([tagReact.group]);
		// Post 2 had BOTH, now only has ONE tagReact (deduplicated!)
		expect((await get(p2)).entry.values.tags).toEqual([tagReact.group]);
		// Post 3 still has tagReact
		expect((await get(p3)).entry.values.tags).toEqual([tagReact.group]);

		// tagReactEn is in trash and removed from entry_published
		const trashedTagRow = await db
			.selectFrom("entries")
			.selectAll()
			.where("id", "=", tagReactEn.id)
			.executeTakeFirstOrThrow();
		expect(trashedTagRow.trashed_at).not.toBeNull();
		const publishedTag = await db
			.selectFrom("entry_published")
			.selectAll()
			.where("entry_id", "=", tagReactEn.id)
			.executeTakeFirst();
		expect(publishedTag).toBeUndefined();

		// Undo merge
		await write("activity.undo", { id: mergeRes.activityId });

		// Restored!
		const restoredTagRow = await db
			.selectFrom("entries")
			.selectAll()
			.where("id", "=", tagReactEn.id)
			.executeTakeFirstOrThrow();
		expect(restoredTagRow.trashed_at).toBeNull();

		expect((await get(p1)).entry.values.tags).toEqual([tagReactEn.group]);
		expect((await get(p2)).entry.values.tags).toEqual([tagReactEn.group, tagReact.group]);
	});

	it("08-1 items.saveGroup manages multilingual titles and creates missing locale rows", async () => {
		// Create new item group with ko and en
		const saved = await write<{
			id: string;
			group: string;
			locales: Record<string, { id: string; title: string; slug: string }>;
		}>("items.saveGroup", {
			collection: "category",
			locales: {
				ko: { title: "디자인", slug: "design" },
				en: { title: "Design", slug: "design-en" },
			},
		});

		expect(saved.output.locales.ko.title).toBe("디자인");
		expect(saved.output.locales.en.title).toBe("Design");

		// Both are immediately published (T27)
		const publishedKo = await db
			.selectFrom("entry_published")
			.selectAll()
			.where("entry_id", "=", saved.output.locales.ko.id)
			.executeTakeFirst();
		expect(publishedKo).toBeDefined();

		const publishedEn = await db
			.selectFrom("entry_published")
			.selectAll()
			.where("entry_id", "=", saved.output.locales.en.id)
			.executeTakeFirst();
		expect(publishedEn).toBeDefined();
	});

	it("08-1 assistant proposal combines items.saveGroup and relations.edit referencing new item via $item", async () => {
		const monti = site();
		const p1 = await newPost("Propose Post");

		const proposalId = await monti.proposals.create("c1", "create tag and assign to post");

		const saveGroupItem = await monti.proposals.add(proposalId, "items.saveGroup", {
			collection: "tag",
			locales: {
				ko: { title: "인공지능", slug: "ai" },
			},
		});

		await monti.proposals.add(proposalId, "relations.edit", {
			collection: "post",
			field: "tags",
			entryIds: [p1],
			add: [{ $item: saveGroupItem.itemId }],
		});

		// Before applying, nothing exists in entries table for "인공지능"
		const beforeRows = await db.selectFrom("entries").selectAll().where("title", "=", "인공지능").execute();
		expect(beforeRows).toHaveLength(0);

		// Apply proposal
		const results = await monti.proposals.apply(proposalId);
		expect(results.every((r) => r.state === "applied")).toBe(true);

		// Tag exists now
		const tagRow = await db.selectFrom("entries").selectAll().where("title", "=", "인공지능").executeTakeFirstOrThrow();
		expect(tagRow.status).toBe("published");

		// Post 1 has tagRow.translation_group
		expect((await get(p1)).entry.values.tags).toEqual([tagRow.translation_group]);
	});
});

describe("08-2 reader resolution and localization", () => {
	it("08-2 Korean and English entries share category, and reader shows each locale's name", async () => {
		// Category with ko and en
		const cat = await write<{
			id: string;
			group: string;
			locales: Record<string, { id: string; title: string; slug: string }>;
		}>("items.saveGroup", {
			collection: "category",
			locales: {
				ko: { title: "개발", slug: "dev" },
				en: { title: "Development", slug: "development" },
			},
		});

		// Create Korean post with category
		const koPostId = await newPost("첫 번째 글", { category: cat.output.group }, "ko", "first-post-ko");
		await write("entries.publish", { ids: [koPostId] });

		// Create English translation of post
		const enPostId = (
			await write<{ id: string }>("translations.create", {
				source: koPostId,
				locale: "en",
			})
		).output.id;

		await write("entries.save", {
			id: enPostId,
			version: await version(enPostId),
			title: "First Post",
			slug: "first-post-en",
		});
		await write("entries.publish", { ids: [enPostId] });

		// Read Korean site
		const koSiteEntry = (await reader().entry({
			collection: "post",
			locale: "ko",
			slug: "first-post-ko",
		})) as { entry: SiteEntry };
		expect(koSiteEntry).not.toBeNull();
		const koCatRelation = koSiteEntry.entry.relations?.category as {
			title: string;
			locale: string;
			slug: string;
		};
		expect(koCatRelation).toMatchObject({
			title: "개발",
			locale: "ko",
			slug: "dev",
		});

		// Read English site
		const enSiteEntry = (await reader().entry({
			collection: "post",
			locale: "en",
			slug: "first-post-en",
		})) as { entry: SiteEntry };
		expect(enSiteEntry).not.toBeNull();
		const enCatRelation = enSiteEntry.entry.relations?.category as {
			title: string;
			locale: string;
			slug: string;
		};
		expect(enCatRelation).toMatchObject({
			title: "Development",
			locale: "en",
			slug: "development",
		});
	});

	it("08-2 relation falls back to source locale name when translation does not exist", async () => {
		// Tag only has Korean title
		const tagReact = await newTag("리액트", "react");

		const koPostId = await newPost("리액트 글", { tags: [tagReact.group] }, "ko", "react-post-ko");
		await write("entries.publish", { ids: [koPostId] });

		const enPostId = (
			await write<{ id: string }>("translations.create", {
				source: koPostId,
				locale: "en",
			})
		).output.id;

		await write("entries.save", {
			id: enPostId,
			version: await version(enPostId),
			title: "React Post",
			slug: "react-post-en",
		});
		await write("entries.publish", { ids: [enPostId] });

		// Read English site: tag should fall back to Korean title "리액트"
		const enSiteEntry = (await reader().entry({
			collection: "post",
			locale: "en",
			slug: "react-post-en",
		})) as { entry: SiteEntry };
		expect(enSiteEntry).not.toBeNull();
		const tagsRelation = enSiteEntry.entry.relations?.tags as {
			title: string;
			locale: string;
			fallback: boolean;
		}[];
		expect(tagsRelation).toHaveLength(1);
		expect(tagsRelation[0]).toMatchObject({
			title: "리액트",
			locale: "ko",
			fallback: true,
		});
	});

	it("08-2 T27 item collections are live on save without separate publish step", async () => {
		// Create item without slug
		const tagRes = await write<{ id: string }>("entries.create", {
			collection: "tag",
			locale: "ko",
			title: "클라우드",
			values: {},
		});

		const tag = (await get(tagRes.output.id)).entry;
		expect(tag.status).toBe("published");
		expect(tag.slug).not.toBe("");

		// Immediately visible to reader!
		const siteItem = (await reader().entry({ collection: "tag", locale: "ko", slug: tag.slug })) as {
			entry: SiteEntry;
		};
		expect(siteItem).not.toBeNull();
		expect(siteItem.entry.title).toBe("클라우드");

		// Saving changes updates published copy immediately
		await write("entries.save", {
			id: tag.id,
			version: await version(tag.id),
			title: "클라우드 컴퓨팅",
		});

		const updatedSiteItem = (await reader().entry({
			collection: "tag",
			locale: "ko",
			slug: tag.slug,
		})) as { entry: SiteEntry };
		expect(updatedSiteItem.entry.title).toBe("클라우드 컴퓨팅");
	});

	it("08-2 trashed target item is hidden from site reader while relation value remains in entry", async () => {
		const cat = await newCategory("도구", "tools");
		const p1 = await newPost("도구 소개", { category: cat.group }, "ko", "dogu-sogae");
		await write("entries.publish", { ids: [p1] });

		// Site shows relation
		const beforeTrash = (await reader().entry({
			collection: "post",
			locale: "ko",
			slug: "dogu-sogae",
		})) as { entry: SiteEntry };
		expect(beforeTrash.entry.relations?.category).toMatchObject({ title: "도구" });

		// Trash the category item
		await db.updateTable("entries").set({ trashed_at: clock }).where("id", "=", cat.id).execute();

		// Value is still in entry.values
		expect((await get(p1)).entry.values.category).toBe(cat.group);

		// But site hides it!
		const afterTrash = (await reader().entry({
			collection: "post",
			locale: "ko",
			slug: "dogu-sogae",
		})) as { entry: SiteEntry };
		expect(afterTrash.entry.relations?.category).toBeNull();

		// reader.entries also excludes trashed item
		const catEntries = await reader().entries({ collection: "category", locale: "ko" });
		expect(catEntries.some((i) => i.id === cat.id)).toBe(false);
	});
});

describe("08-3 entry_links, ordering, and via relations", () => {
	it("08-3 relations usage, query filtering, and permanent unlinking all derive from entry_links", async () => {
		const tagReact = await newTag("리액트", "react");

		const p1 = await newPost("Post 1", { tags: [tagReact.group] });
		const p2 = await newPost("Post 2", { tags: [tagReact.group] });
		await newPost("Post 3", { tags: [] });

		// Filter by relation in entries.query
		const reactPosts = await read<{ total: number; rows: { id: string }[] }>("entries.query", {
			collection: "post",
			filters: [{ on: "relation", field: "tags", any: [tagReact.group] }],
		});
		expect(reactPosts.total).toBe(2);

		// Filter by empty relation
		const noTagPosts = await read<{ total: number; rows: { id: string }[] }>("entries.query", {
			collection: "post",
			filters: [{ on: "empty", field: "tags" }],
		});
		expect(noTagPosts.total).toBe(1);

		// Permanent unlinking of tagReact via unlinkTargetGroup
		const unlinkRes = await unlinkTargetGroup(db, schema, tagReact.group, new Date());
		expect(unlinkRes.unlinkedCount).toBe(2);

		// Verify entry_links are gone
		const linksAfter = await db.selectFrom("entry_links").selectAll().where("to_group", "=", tagReact.group).execute();
		expect(linksAfter).toHaveLength(0);

		// Verify values.tags no longer has tagReact
		expect((await get(p1)).entry.values.tags).toEqual([]);
		expect((await get(p2)).entry.values.tags).toEqual([]);
	});

	it("08-3 T74 ordered relation preserves manual order in entry_links and values", async () => {
		const p1 = await newPost("Post 1");
		const p2 = await newPost("Post 2");
		const p3 = await newPost("Post 3");
		const p4 = await newPost("Post 4");

		const g1 = (await get(p1)).entry.translationGroup;
		const g2 = (await get(p2)).entry.translationGroup;
		const g3 = (await get(p3)).entry.translationGroup;
		const g4 = (await get(p4)).entry.translationGroup;

		// Save related with specific order [g4, g2, g3]
		await write("entries.save", {
			id: p1,
			version: await version(p1),
			values: { related: [g4, g2, g3] },
		});

		expect((await get(p1)).entry.values.related).toEqual([g4, g2, g3]);

		// Verify positions in entry_links
		const links = await db
			.selectFrom("entry_links")
			.selectAll()
			.where("from_group", "=", g1)
			.where("field", "=", "related")
			.orderBy("position", "asc")
			.execute();

		expect(links.map((l) => l.to_group)).toEqual([g4, g2, g3]);
		expect(links.map((l) => l.position)).toEqual([0, 1, 2]);

		// Reorder to [g2, g3, g4]
		await write("entries.save", {
			id: p1,
			version: await version(p1),
			values: { related: [g2, g3, g4] },
		});

		const reorderedLinks = await db
			.selectFrom("entry_links")
			.selectAll()
			.where("from_group", "=", g1)
			.where("field", "=", "related")
			.orderBy("position", "asc")
			.execute();

		expect(reorderedLinks.map((l) => l.to_group)).toEqual([g2, g3, g4]);
		expect(reorderedLinks.map((l) => l.position)).toEqual([0, 1, 2]);
	});

	it("08-3 T74 via relation field updates target collection many relation and entry_links", async () => {
		const s1 = await newSeries("Series 1", "series-1");
		const s2 = await newSeries("Series 2", "series-2");

		// Post 1 sets series to S1
		const p1 = await newPost("Post 1", { series: s1.group });
		const g1 = (await get(p1)).entry.translationGroup;

		// S1.posts now contains g1!
		const s1Entry1 = (await get(s1.id)).entry;
		expect(s1Entry1.values.posts).toEqual([g1]);

		// entry_links from S1.group has g1
		const s1Links1 = await db
			.selectFrom("entry_links")
			.selectAll()
			.where("from_group", "=", s1.group)
			.where("field", "=", "posts")
			.execute();
		expect(s1Links1.map((l) => l.to_group)).toEqual([g1]);

		// Post 2 sets series to S1
		const p2 = await newPost("Post 2", { series: s1.group });
		const g2 = (await get(p2)).entry.translationGroup;

		const s1Entry2 = (await get(s1.id)).entry;
		expect(s1Entry2.values.posts).toEqual([g1, g2]);

		// Change Post 1's series from S1 to S2
		await write("entries.save", {
			id: p1,
			version: await version(p1),
			values: { series: s2.group },
		});

		// S1 only has g2
		const s1Entry3 = (await get(s1.id)).entry;
		expect(s1Entry3.values.posts).toEqual([g2]);

		// S2 has g1
		const s2Entry = (await get(s2.id)).entry;
		expect(s2Entry.values.posts).toEqual([g1]);
	});

	it("08-3 checkSchema catches invalid via definitions", () => {
		// via points to non-existent field
		const badSchema1 = defineSchema({
			...schema,
			collections: {
				...schema.collections,
				post: {
					...schema.collections.post,
					fields: {
						...schema.collections.post.fields,
						series: { kind: "relation", to: "series", via: "non_existent" },
					},
				},
			},
		});
		expect(checkSchema(badSchema1)).toContainEqual(
			expect.objectContaining({ collection: "post", field: "series", code: "invalidVia" }),
		);

		// via points to field that is not many
		const badSchema2 = defineSchema({
			...schema,
			collections: {
				...schema.collections,
				series: {
					...schema.collections.series,
					fields: {
						...schema.collections.series.fields,
						posts: { kind: "relation", to: "post", many: false },
					},
				},
			},
		});
		expect(checkSchema(badSchema2)).toContainEqual(
			expect.objectContaining({ collection: "post", field: "series", code: "invalidVia" }),
		);
	});
});

describe("08-4 inline item creation", () => {
	it("08-4 relations.options reports canCreate for missing item and unsaved inline creation leaves no item in database", async () => {
		const options = await read<{
			options: unknown[];
			canCreate: boolean;
			exactMatch: boolean;
		}>("relations.options", {
			collection: "post",
			field: "tags",
			search: "웹퍼포먼스",
		});

		expect(options.canCreate).toBe(true);
		expect(options.exactMatch).toBe(false);

		// No item created in tag collection
		const tagRows = await db.selectFrom("entries").selectAll().where("collection", "=", "tag").execute();
		expect(tagRows).toHaveLength(0);
	});

	it("08-4 saving entry with inline new tag creates item atomically in source locale and links it", async () => {
		// Create post with inline new tag "new:웹퍼포먼스"
		const p1 = await newPost("성능 최적화", { tags: ["new:웹퍼포먼스"] });

		// Verify tag created in database
		const tagRows = await db.selectFrom("entries").selectAll().where("collection", "=", "tag").execute();
		expect(tagRows).toHaveLength(1);
		const createdTag = tagRows[0];
		expect(createdTag.title).toBe("웹퍼포먼스");
		expect(createdTag.status).toBe("published");
		expect(createdTag.locale).toBe("ko");

		// Post 1 has createdTag.translation_group
		const p1Entry = (await get(p1)).entry;
		expect(p1Entry.values.tags).toEqual([createdTag.translation_group]);

		// entry_links is synced
		const links = await db
			.selectFrom("entry_links")
			.selectAll()
			.where("from_group", "=", p1Entry.translationGroup)
			.execute();
		expect(links.map((l) => l.to_group)).toEqual([createdTag.translation_group]);

		// Creating another post with the same new tag reuses the existing one!
		const p2 = await newPost("성능 팁", { tags: ["new:웹퍼포먼스"] });
		const p2Entry = (await get(p2)).entry;
		expect(p2Entry.values.tags).toEqual([createdTag.translation_group]);

		// No second tag created!
		const allTags = await db.selectFrom("entries").selectAll().where("collection", "=", "tag").execute();
		expect(allTags).toHaveLength(1);
	});
});
