import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { defineSite } from "../../config/define";
import { parseFile } from "../../front-matter";
import { createSite } from "../../site";
import { mdxRegistry } from "../import/__test__/helpers";
import { guessCollections, guessFieldMappings, resolveQuestions } from "../import/guess";
import { planFiles } from "../import/plan";
import type { ParsedSource } from "../import/source";
import type { ContentFolder, FrontMatterKey } from "../init-detect";
import { schemaTemplate, starterCollections } from "../templates";

/**
 * `monti init` shapes the starter schema from the front matter of the posts the app already has, and `monti import` guesses its mapping from the same
 * front matter. These tests make the two meet: the schema init writes is the schema import is run against, and nothing import would drop is left unfilled.
 */

const key = (name: string, type: FrontMatterKey["type"] = "string"): FrontMatterKey => ({ name, type, count: 3 });

const FOLDER: ContentFolder = {
	dir: "content/blog",
	files: 3,
	keys: [
		key("title"),
		key("date", "date"),
		key("description"),
		key("tags", "list"),
		key("category"),
		key("cover"),
		key("draft", "boolean"),
		key("author"),
	],
};

const siteOf = (folder: ContentFolder, locales = ["en"]) => {
	const text = schemaTemplate(
		{ adminPath: "/studio", locales, timeZone: "UTC", blogTheme: false },
		{ siteName: "blog", folder },
	);
	return createSite(defineSite({ schema: JSON.parse(text) } as never) as never);
};

const post = (rel: string, text: string): ParsedSource => {
	const parsed = parseFile(text);
	if (!parsed.ok) throw new Error(parsed.message);
	return {
		abs: `/proj/content/blog/${rel}`,
		rel,
		key: `content/blog/${rel}`,
		ext: "md",
		text,
		hash: createHash("sha256").update(text).digest("hex"),
		front: parsed.data,
		body: parsed.body,
		bodyLineOffset: 0,
	};
};

describe("the starter schema of monti init", () => {
	it("makes the tag and category collections and the relation fields for the keys that name terms", () => {
		const { collections } = starterCollections(FOLDER.keys, false);
		expect(Object.keys(collections)).toEqual(["post", "tag", "category"]);
		expect(collections.tag).toMatchObject({ kind: "item" });
		expect(collections.category).toMatchObject({ kind: "item" });
		expect(collections.post?.fields.tagIds).toMatchObject({ kind: "relation", to: "tag", many: true });
		const categoryId = collections.post?.fields.categoryId;
		expect(categoryId).toMatchObject({ kind: "relation", to: "category" });
		expect(categoryId).not.toHaveProperty("many");
	});

	it("gives a category list a field that holds many, and treats keywords and topics as tags", () => {
		const { collections, notes } = starterCollections(
			[key("categories", "list"), key("keywords", "list"), key("topics", "list")],
			false,
		);
		expect(collections.post?.fields.categoryIds).toMatchObject({ kind: "relation", to: "category", many: true });
		expect(collections.post?.fields.tagIds).toMatchObject({ to: "tag", many: true });
		// The second key for tags has no field of its own; the report says so.
		expect(notes.join("\n")).toMatch(/"topics" also means tag/);
	});

	it("gives no field to the publish date, the draft flag or the language, and makes the description the summary field", () => {
		const fields = starterCollections(
			[key("pubDate", "date"), key("publishDate", "date"), key("draft", "boolean"), key("lang"), key("excerpt")],
			false,
		).collections.post?.fields as Record<string, Record<string, unknown>>;
		expect(Object.keys(fields)).toEqual(["title", "slug", "excerpt"]);
		expect(fields.excerpt).toMatchObject({ kind: "text", role: "summary" });
	});

	it("keeps a date that is not the publish date as a text field", () => {
		const fields = starterCollections([key("updated", "date")], false).collections.post?.fields as Record<
			string,
			unknown
		>;
		expect(fields.updated).toMatchObject({ kind: "text" });
	});

	it("leaves a project without front matter with the starter post and no extra collections", () => {
		const { collections } = starterCollections([], false);
		expect(Object.keys(collections)).toEqual(["post"]);
		expect(Object.keys(collections.post?.fields ?? {})).toEqual(["title", "slug", "summary"]);
	});

	it("localizes the title of the new collections only for a site with several languages", () => {
		expect(starterCollections([key("tags", "list")], true).collections.tag?.fields.title).toMatchObject({
			localized: true,
		});
		expect(starterCollections([key("tags", "list")], false).collections.tag?.fields.title).not.toHaveProperty(
			"localized",
		);
	});

	it("the path follows the content folder, which is where the blog theme serves the posts", () => {
		const text = schemaTemplate(
			{ adminPath: "/studio", locales: ["en"], timeZone: "UTC", blogTheme: true },
			{ folder: FOLDER },
		);
		expect(JSON.parse(text).collections.post.path).toBe("/blog/:slug");
	});
});

describe("the mapping import guesses for the schema init wrote", () => {
	const guess = async (files: ParsedSource[], locales = ["en"]) => {
		const site = siteOf(FOLDER, locales);
		const first = guessCollections(site, files, { rootName: "blog" });
		await resolveQuestions(first.questions, undefined);
		const second = guessFieldMappings(site, files, first.mapping);
		const skipped = await resolveQuestions(second.questions, undefined);
		return { site, mapping: second.mapping, skipped };
	};

	const files = [
		post(
			"a.md",
			"---\ntitle: A\ndate: 2024-05-01\ndescription: About A\ntags: [web, next]\ncategory: guides\ncover: /a.png\ndraft: false\nauthor: Me\n---\n\nBody of A.\n",
		),
		post(
			"b.md",
			"---\ntitle: B\ndate: 2024-06-01\ndescription: About B\ntags: [web]\ncategory: notes\ndraft: true\n---\n\nBody of B.\n",
		),
	];

	it("sends the folder to post, the date to the publish date, and fills the relations and the summary", async () => {
		const { mapping } = await guess(files);
		expect(mapping.folders["content/blog"]).toEqual({
			collection: "post",
			fields: {
				title: "title",
				date: "@publishedAt",
				description: "description",
				tags: { field: "tagIds", create: true },
				category: { field: "categoryId", create: true },
				cover: "cover",
				draft: "@draft",
				author: "author",
			},
		});
	});

	it("leaves no key unknown to the schema: every front matter key lands somewhere", async () => {
		const { site, mapping } = await guess(files);
		const plans = planFiles(files, { site, mapping, formats: mdxRegistry() });
		for (const plan of plans) {
			expect(plan.errors).toEqual([]);
			expect(plan.collection).toBe("post");
			// Every tag is set, as a relation to the tag collection.
			expect(plan.relations.filter((use) => use.field === "tagIds")).toHaveLength(1);
			expect(plan.relations.find((use) => use.field === "categoryId")?.to).toBe("category");
			// The date is the publish date, not a value in some field.
			expect(plan.publishedAt).toBeInstanceOf(Date);
			expect(plan.values).not.toHaveProperty("date");
			expect(plan.skippedKeys).toEqual([]);
			expect(plan.values.description).toMatch(/^About /);
			expect(plan.warnings).toEqual([]);
		}
		expect(plans[0]?.relations.find((use) => use.field === "tagIds")?.values).toEqual(["web", "next"]);
		expect(plans[0]?.publishedAt?.toISOString().slice(0, 10)).toBe("2024-05-01");
	});
});
