import { describe, expect, it } from "vitest";
import { type ImportMapping, parseMapping } from "../mapping";
import { formatForExtension, planFiles } from "../plan";
import { importSite, mdxRegistry, source } from "./helpers";

const site = importSite();
const formats = mdxRegistry();

const mapping = (
	fields: Record<string, string | { field: string; create?: boolean }>,
	extra: Partial<ImportMapping> = {},
) =>
	parseMapping(
		{
			version: 1,
			locale: { from: ["frontMatter", "filename", "folder"] },
			folders: { posts: { collection: "post", fields }, pages: { collection: null, fields: {} } },
			...extra,
		},
		"m",
	);

const FIELDS = {
	title: "title",
	slug: "@slug",
	date: "@publishedAt",
	draft: "@draft",
	lang: "@locale",
	summary: "summary",
	status: "status",
	tags: { field: "tagIds", create: true },
	category: { field: "categoryId", create: false },
	cover: "cover",
	author: "@skip",
};

const plan = (
	files: ReturnType<typeof source>[],
	fields: Record<string, string | { field: string; create?: boolean }> = FIELDS,
) => planFiles(files, { site, mapping: mapping(fields), formats });

describe("planning a file", () => {
	it("takes the title, summary, address and publish date from the front matter", () => {
		const [one] = plan([
			source(
				"posts/hello-world.mdx",
				"---\ntitle: Hello\nsummary: S\ndate: 2024-03-01\nslug: /blog/custom-slug/\n---\nBody\n",
			),
		]);
		expect(one).toMatchObject({
			collection: "post",
			locale: "en",
			slug: "custom-slug",
			values: { title: "Hello", summary: "S" },
			draft: false,
			format: "mdx",
		});
		expect(one?.publishedAt?.toISOString()).toBe("2024-03-01T00:00:00.000Z");
		expect(one?.errors).toEqual([]);
	});

	it("makes the address from the file name when the front matter has none", () => {
		expect(plan([source("posts/Hello World.mdx", "---\ntitle: H\n---\n")])[0]?.slug).toBe("hello-world");
		expect(plan([source("posts/hello/index.mdx", "---\ntitle: H\n---\n")])[0]?.slug).toBe("hello");
		expect(plan([source("posts/한글 제목.mdx", "---\ntitle: H\n---\n")])[0]?.slug).toBe("한글-제목");
	});

	it("tells drafts apart, and warns about a date that is not one", () => {
		const [draft, published, bad] = plan([
			source("posts/a.mdx", "---\ntitle: A\ndraft: true\n---\n"),
			source("posts/b.mdx", "---\ntitle: B\ndraft: false\n---\n"),
			source("posts/c.mdx", "---\ntitle: C\ndate: someday\n---\n"),
		]);
		expect([draft?.draft, published?.draft]).toEqual([true, false]);
		expect(bad?.publishedAt).toBeUndefined();
		expect(bad?.warnings.map((w) => w.kind)).toContain("date");
	});

	it("reads the language from the front matter, then the file name, then the folder", () => {
		const [fm, name, folder, none] = plan([
			source("posts/a.mdx", "---\ntitle: A\nlang: ko\n---\n"),
			source("posts/b.ko.mdx", "---\ntitle: B\n---\n"),
			source("ko/posts/c.mdx", "---\ntitle: C\n---\n"),
			source("posts/d.mdx", "---\ntitle: D\n---\n"),
		]);
		expect([fm?.locale, name?.locale, folder?.locale, none?.locale]).toEqual(["ko", "ko", "ko", "en"]);
		// The Korean files have no English source, which they need.
		expect(fm?.errors.map((e) => e.kind)).toContain("no_source");
	});

	it("fails a language the site does not have", () => {
		const [one] = plan([source("posts/a.mdx", "---\ntitle: A\nlang: fr\n---\n")]);
		expect(one?.errors[0]).toMatchObject({ kind: "unknown_locale" });
	});

	it("pairs a translation with its source and gives it the source's address", () => {
		const [en, ko] = plan([
			source("posts/hello.mdx", "---\ntitle: Hello\nslug: hello-there\n---\n"),
			source("posts/hello.ko.mdx", "---\ntitle: 안녕\n---\n"),
		]);
		expect(en?.errors).toEqual([]);
		expect(ko).toMatchObject({ locale: "ko", slug: "hello-there", errors: [] });
	});

	it("keeps only the fields a translation has per language", () => {
		const [, ko] = plan([
			source("posts/hello.mdx", "---\ntitle: Hello\ntags: [a]\n---\n"),
			source("posts/hello.ko.mdx", "---\ntitle: 안녕\ntags: [a]\nsummary: 요약\n---\n"),
		]);
		expect(ko?.relations).toEqual([]);
		expect(ko?.values).toEqual({ title: "안녕", summary: "요약" });
	});

	it("fails the second file for an address, and names the first", () => {
		const [a, b] = plan([
			source("posts/a.mdx", "---\ntitle: A\nslug: same\n---\n"),
			source("posts/b.mdx", "---\ntitle: B\nslug: same\n---\n"),
		]);
		expect(a?.errors).toEqual([]);
		expect(b?.errors[0]).toMatchObject({ kind: "duplicate_slug" });
		expect(b?.errors[0]?.message).toMatch(/posts\/a\.mdx/);
	});

	it("keeps a relation's values, a select's option and a media path, and skips what has no place", () => {
		const [one] = plan([
			source(
				"posts/a.mdx",
				"---\ntitle: A\ntags: [web, next]\ncategory: [x, y]\nstatus: Done\ncover: ./c.png\nauthor: me\nmood: calm\n---\n",
			),
		]);
		expect(one?.relations).toEqual([
			{ key: "tags", field: "tagIds", to: "tag", many: true, create: true, values: ["web", "next"] },
			{ key: "category", field: "categoryId", to: "category", many: false, create: false, values: ["x"] },
		]);
		expect(one?.values.status).toBe("done");
		expect(one?.mediaFields).toEqual([{ key: "cover", field: "cover", value: "./c.png" }]);
		expect(one?.skippedKeys).toEqual(["author", "mood"]);
		const kinds = one?.warnings.map((w) => w.kind);
		expect(kinds).toEqual(expect.arrayContaining(["unknown_field", "relation"]));
	});

	it("warns about a select value that is not an option", () => {
		const [one] = plan([source("posts/a.mdx", "---\ntitle: A\nstatus: maybe\n---\n")]);
		expect(one?.values.status).toBeUndefined();
		expect(one?.warnings.map((w) => w.kind)).toContain("invalid_value");
	});

	it("reports what is required and missing without failing the file", () => {
		const [one] = plan([source("posts/a.mdx", "---\nsummary: S\n---\n")]);
		expect(one?.errors).toEqual([]);
		expect(one?.warnings.find((w) => w.kind === "missing_required")?.message).toMatch(/title/);
	});

	it("fails a file whose front matter is not valid, and leaves a folder with no collection out", () => {
		const [bad, page] = plan([
			source("posts/a.mdx", "---\ntitle: [x\n---\n"),
			source("pages/about.mdx", "---\ntitle: A\n---\n"),
		]);
		expect(bad?.errors[0]).toMatchObject({ kind: "front_matter" });
		expect(page?.skip).toBe("its folder is not imported");
	});

	it("changes the hash when the file or its mapping changes", () => {
		const text = "---\ntitle: A\n---\nBody\n";
		const [a] = plan([source("posts/a.mdx", text)]);
		const [same] = plan([source("posts/a.mdx", text)]);
		const [edited] = plan([source("posts/a.mdx", `${text}More\n`)]);
		const [remapped] = plan([source("posts/a.mdx", text)], { ...FIELDS, summary: "@skip" });
		expect(same?.hash).toBe(a?.hash);
		expect(edited?.hash).not.toBe(a?.hash);
		expect(remapped?.hash).not.toBe(a?.hash);
	});

	it("only imports a language into an item collection when it is the default one", () => {
		const itemMapping = parseMapping(
			{
				version: 1,
				locale: { from: ["filename"] },
				folders: { tags: { collection: "tag", fields: { title: "title" } } },
			},
			"m",
		);
		const [ko] = planFiles([source("tags/a.ko.mdx", "---\ntitle: A\n---\n")], { site, mapping: itemMapping, formats });
		expect(ko?.errors.map((e) => e.kind)).toContain("translation");
	});
});

describe("choosing the format", () => {
	it("finds it by the file extension, and reads .md with the MDX format when nothing else claims it", () => {
		const base = { version: 1 as const, folders: {} };
		expect(formatForExtension(formats, "mdx", base, undefined)?.name).toBe("mdx");
		expect(formatForExtension(formats, "md", base, undefined)?.name).toBe("mdx");
		expect(formatForExtension(formats, "mdx", base, "nope")).toBeUndefined();
		expect(formatForExtension(formats, "md", { ...base, formats: { md: "mdx" } }, undefined)?.name).toBe("mdx");
	});

	it("fails the files when the site has no format for them", () => {
		const [one] = planFiles([source("posts/a.mdx", "---\ntitle: A\n---\n")], {
			site,
			mapping: mapping(FIELDS),
			formats: { get: () => undefined, list: () => [], info: () => [] },
		});
		expect(one?.errors[0]).toMatchObject({ kind: "no_format" });
		expect(one?.errors[0]?.message).toMatch(/mdx\(\)/);
	});
});
