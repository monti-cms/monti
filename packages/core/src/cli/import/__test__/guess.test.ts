import { describe, expect, it } from "vitest";
import { defineCollection } from "../../../schema/collection";
import { fields } from "../../../schema/fields";
import { createSite, type Site } from "../../../site";
import { guessCollections, guessFieldMappings, resolveQuestions } from "../guess";
import { parseMapping } from "../mapping";
import { scriptedPrompter } from "../prompt";
import { importSite, source } from "./helpers";

const title = fields.text({ label: "Title", required: true });
const slug = fields.slug({ label: "Slug", from: "title", required: true });

const site = importSite();

const guess = async (files: ReturnType<typeof source>[], options: { collection?: string; answers?: string[] } = {}) => {
	const first = guessCollections(site, files, { rootName: "content", collection: options.collection });
	const prompter = options.answers ? scriptedPrompter(options.answers) : undefined;
	const skipped = await resolveQuestions(first.questions, prompter);
	const second = guessFieldMappings(site, files, first.mapping);
	skipped.push(...(await resolveQuestions(second.questions, prompter)));
	return { mapping: second.mapping, notes: [...first.notes, ...second.notes], skipped, prompter };
};

describe("guessing the collection of a folder", () => {
	it("matches a folder to a collection by name, singular or plural", async () => {
		const { mapping, prompter } = await guess([source("posts/a.mdx", "---\ntitle: A\n---\n")], { answers: [] });
		expect(mapping.folders["content/posts"]?.collection).toBe("post");
		expect(prompter?.asked).toEqual([]);
		expect(
			(await guess([source("notes/a.mdx", "---\ntitle: A\n---\n")])).mapping.folders["content/notes"]?.collection,
		).toBe("note");
	});

	it("asks when the name matches nothing, and offers to skip the folder", async () => {
		const { mapping, prompter } = await guess([source("writing/a.mdx", "---\ntitle: A\n---\n")], { answers: ["1"] });
		expect(prompter?.said.join("\n")).toMatch(/Which collection do the 1 file in "content\/writing" go to\?/);
		expect(prompter?.said.join("\n")).toMatch(/Do not import this folder/);
		expect(mapping.folders["content/writing"]?.collection).toBe("post");
	});

	it("leaves an unclear folder out when nobody can be asked, and says so", async () => {
		const { mapping, skipped } = await guess([source("writing/a.mdx", "---\ntitle: A\n---\n")]);
		expect(mapping.folders["content/writing"]?.collection).toBeNull();
		expect(skipped.join(" ")).toMatch(/--collection/);
	});

	it("uses the name of the scanned folder for the files directly in it", async () => {
		const { mapping } = await guess([source("a.mdx", "---\ntitle: A\n---\n")]);
		// The root is called "content": no collection of that name.
		expect(mapping.folders.content?.collection).toBeNull();
	});

	it("puts the folder that was pointed at in the only document collection when nobody can be asked, whatever it is called", async () => {
		const solo = createSite({
			collections: {
				post: defineCollection({ label: "Post", kind: "document", path: "/blog/:slug", fields: { title, slug } }),
				tag: defineCollection({ label: "Tag", kind: "item", fields: { title, slug } }),
			},
			locales: [{ code: "en", name: "English" }],
			defaultLocale: "en",
		} as never) as Site;
		const files = [source("a.mdx", "---\ntitle: A\n---\n", "/proj/content/blog")];
		const result = guessCollections(solo, files, { rootName: "blog" });
		await resolveQuestions(result.questions, undefined);
		expect(result.mapping.folders["content"]?.collection).toBe("post");
		// A subfolder of what was scanned is still left out, as is any folder when there are two document collections.
		const nested = guessCollections(solo, [source("pages/a.mdx", "---\ntitle: A\n---\n")], { rootName: "content" });
		await resolveQuestions(nested.questions, undefined);
		expect(nested.mapping.folders["content/pages"]?.collection).toBeNull();
	});

	it("--collection decides every folder, and must name a collection", async () => {
		const { mapping } = await guess([source("writing/a.mdx", ""), source("misc/b.mdx", "")], { collection: "note" });
		expect(Object.values(mapping.folders).map((folder) => folder.collection)).toEqual(["note", "note"]);
		expect(() => guessCollections(site, [source("a.mdx", "")], { rootName: "x", collection: "nope" })).toThrow(
			/no such collection/,
		);
	});

	it("keeps what a saved mapping decides", () => {
		const existing = parseMapping(
			{ version: 1, folders: { "content/posts": { collection: "note", fields: { title: "title" } } } },
			"monti.import.json",
		);
		const result = guessCollections(site, [source("posts/a.mdx", "---\ntitle: A\n---\n")], { rootName: "c", existing });
		expect(result.questions).toEqual([]);
		expect(result.mapping.folders["content/posts"]?.collection).toBe("note");
	});

	it("reads a mapping saved with folders relative to the scanned folder, and moves it to the real paths", () => {
		const existing = parseMapping(
			{ version: 1, folders: { posts: { collection: "note", fields: { title: "title" } } } },
			"monti.import.json",
		);
		const result = guessCollections(site, [source("posts/a.mdx", "---\ntitle: A\n---\n")], { rootName: "c", existing });
		expect(result.questions).toEqual([]);
		expect(Object.keys(result.mapping.folders)).toEqual(["content/posts"]);
		expect(result.mapping.folders["content/posts"]?.collection).toBe("note");
	});

	it("rejects a saved mapping that names a collection the site does not have", () => {
		const existing = parseMapping(
			{ version: 1, folders: { "content/posts": { collection: "gone", fields: {} } } },
			"m",
		);
		expect(() => guessCollections(site, [source("posts/a.mdx", "")], { rootName: "c", existing })).toThrow(/"gone"/);
	});

	it("reads the language from every place the files show it", () => {
		const files = [
			source("posts/a.mdx", ""),
			source("posts/a.ko.mdx", ""),
			source("ko/posts/b.mdx", "---\nlang: ko\n---\n"),
		];
		expect(guessCollections(site, files, { rootName: "c" }).mapping.locale?.from).toEqual([
			"frontMatter",
			"filename",
			"folder",
		]);
		expect(guessCollections(site, [source("posts/a.mdx", "")], { rootName: "c" }).mapping.locale?.from).toEqual([]);
	});
});

describe("guessing the fields of a folder", () => {
	const post = (front: string) => source("posts/a.mdx", `---\n${front}\n---\n`);

	it("maps the common keys without asking", async () => {
		const { mapping } = await guess(
			[
				post(
					"title: A\nslug: a\ndate: 2024-01-01\ndescription: d\ndraft: true\nstatus: done\ncover: c.png\nauthor: me",
				),
			],
			{ answers: ["", ""] },
		);
		expect(mapping.folders["content/posts"]?.fields).toEqual({
			title: "title",
			slug: "@slug",
			date: "@publishedAt",
			// the field with the summary role
			description: "summary",
			draft: "@draft",
			status: "status",
			cover: "cover",
			author: "@skip",
		});
	});

	it("maps tags and categories to relation fields and asks whether to create what is missing", async () => {
		const { mapping, prompter } = await guess([post("title: A\ntags: [a]\ncategories: [b]")], { answers: ["", "2"] });
		expect(prompter?.said.join("\n")).toMatch(/Create tag entries for "tags"/);
		// the first answer (Enter) takes the default: create tags; the second picks "No" for the category
		expect(mapping.folders["content/posts"]?.fields.tags).toEqual({ field: "tagIds", create: true });
		expect(mapping.folders["content/posts"]?.fields.categories).toEqual({ field: "categoryId", create: false });
	});

	it("asks which relation field a key means when no name matches", async () => {
		const { mapping, prompter } = await guess([post("title: A\nkeywords: [x]\nseries: s")], { answers: ["1", "", ""] });
		// keywords is a kind of tag, series matches no relation: the person is asked about it, and "skip" is the last choice
		expect(mapping.folders["content/posts"]?.fields.keywords).toEqual({ field: "tagIds", create: true });
		expect(prompter?.said.join("\n")).toMatch(/Which field does the front matter key "series" go to\?/);
		expect(mapping.folders["content/posts"]?.fields.series).toBe("@skip");
	});

	it("tells which language field and which date a boolean or a string means", async () => {
		const { mapping } = await guess([post("title: A\nlang: ko\npublished: false")]);
		expect(mapping.folders["content/posts"]?.fields.lang).toBe("@locale");
		expect(mapping.folders["content/posts"]?.fields.published).toBe("@published");
		const dated = await guess([post("title: A\npublished: 2024-01-01")]);
		expect(dated.mapping.folders["content/posts"]?.fields.published).toBe("@publishedAt");
		// A `lang` that is not a language of the site (a programming language) is just a key.
		const code = await guess([post("title: A\nlang: javascript")]);
		expect(code.mapping.folders["content/posts"]?.fields.lang).toBe("@skip");
	});

	it("maps two keys to one field only once", async () => {
		const { mapping } = await guess([post("title: A\nsummary: s\ndescription: d")]);
		expect(mapping.folders["content/posts"]?.fields).toMatchObject({ summary: "summary", description: "@skip" });
	});

	it("skips a key that appears after the mapping was saved, without asking", () => {
		const existing = parseMapping(
			{ version: 1, folders: { "content/posts": { collection: "post", fields: { title: "title" } } } },
			"m",
		);
		const first = guessCollections(site, [post("title: A\nmood: x")], { rootName: "c", existing });
		const second = guessFieldMappings(site, [post("title: A\nmood: x")], first.mapping);
		expect(second.questions).toEqual([]);
		expect(second.mapping.folders["content/posts"]?.fields.mood).toBe("@skip");
	});
});

describe("the mapping file", () => {
	it("rejects what it does not know, and says where", () => {
		expect(() => parseMapping({ version: 2, folders: {} }, "monti.import.json")).toThrow(
			/monti\.import\.json is not a valid import mapping/,
		);
		expect(() => parseMapping({ version: 1, folders: { a: { collection: 1, fields: {} } } }, "m")).toThrow(
			/folders\.a\.collection/,
		);
		expect(() => parseMapping({ version: 1, folders: {}, extra: true }, "m")).toThrow();
	});
});
