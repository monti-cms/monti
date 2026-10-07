import { describe, expect, it } from "vitest";
import type { StoredDocument } from "../../../doc/stored-document";
import { buildLinkIndex, decideLink, rewriteLinks } from "../links";
import { parseMapping } from "../mapping";
import { type FilePlan, planFiles } from "../plan";
import { importSite, mdxRegistry, source } from "./helpers";

const site = importSite();

const mapping = parseMapping(
	{
		version: 1,
		locale: { from: ["filename", "folder"] },
		folders: {
			posts: { collection: "post", fields: { title: "title", slug: "@slug" } },
			notes: { collection: "note", fields: { title: "title" } },
		},
	},
	"m",
);

const build = (files: [string, string][]) => {
	const plans = planFiles(
		files.map(([rel, text]) => source(rel, `---\ntitle: ${rel}\n${text}---\n`)),
		{ site, mapping, formats: mdxRegistry() },
	);
	return { plans, index: buildLinkIndex(site, plans) };
};

const { plans, index } = build([
	["posts/hello.mdx", "slug: hello-world\n"],
	["posts/hello.ko.mdx", ""],
	["posts/other.mdx", ""],
	["posts/deep/guide/index.mdx", ""],
	["notes/hello.mdx", ""],
]);
const [hello, helloKo, other, guide, note] = plans as [FilePlan, FilePlan, FilePlan, FilePlan, FilePlan];

const target = (href: string, from: FilePlan = hello) => {
	const decision = decideLink(href, from, index);
	return decision.kind === "entry" ? decision.target.source.rel : decision;
};

describe("links by relative path", () => {
	it("finds a file with or without its extension, and a folder's index", () => {
		expect(target("./other.mdx")).toBe("posts/other.mdx");
		expect(target("other")).toBe("posts/other.mdx");
		expect(target("./other/")).toBe("posts/other.mdx");
		expect(target("deep/guide")).toBe("posts/deep/guide/index.mdx");
		expect(target("../notes/hello.mdx")).toBe("notes/hello.mdx");
		expect(target("./deep/guide/index.mdx")).toBe("posts/deep/guide/index.mdx");
	});

	it("goes to the same language when the post has several", () => {
		expect(target("./hello")).toBe("posts/hello.mdx");
		expect(target("./hello", helloKo)).toBe("posts/hello.ko.mdx");
		expect(target("../../hello.mdx", guide)).toBe("posts/hello.mdx");
	});

	it("ignores the #section and ?query when looking", () => {
		expect(target("./other.mdx#top")).toBe("posts/other.mdx");
		expect(target("./other?x=1")).toBe("posts/other.mdx");
	});

	it("leaves other files and outside links alone, and names a post that is not there", () => {
		expect(target("./image.png")).toEqual({ kind: "keep" });
		expect(target("https://example.com/a")).toEqual({ kind: "keep" });
		expect(target("mailto:a@b.c")).toEqual({ kind: "keep" });
		expect(target("#top")).toEqual({ kind: "keep" });
		expect(target("./missing.mdx")).toMatchObject({ kind: "unresolved" });
	});
});

describe("links by the address of the site", () => {
	it("follows the path of the new site's collection", () => {
		expect(target("/posts/other")).toBe("posts/other.mdx");
		expect(target("/notes/hello")).toBe("notes/hello.mdx");
		// with a language prefix
		expect(target("/ko/posts/other")).toBe("posts/other.mdx");
	});

	it("finds a post of an old site by the last part, when one post has that address", () => {
		expect(target("/blog/2024/other/")).toBe("posts/other.mdx");
		expect(target("/blog/hello-world.html")).toBe("posts/hello.mdx");
		expect(target("/about")).toEqual({ kind: "keep" });
	});

	it("uses the folder to tell two posts with one address apart, and gives up when it cannot", () => {
		// `posts/hello` has the address hello-world and `notes/hello` the address hello: no clash here.
		expect(target("/notes/hello")).toBe("notes/hello.mdx");
		const clash = build([
			["posts/same.mdx", ""],
			["notes/same.mdx", ""],
		]);
		const from = clash.plans[0] as FilePlan;
		const named = decideLink("/notes/same", from, clash.index);
		expect(named.kind === "entry" && named.target.source.rel).toBe("notes/same.mdx");
		expect(decideLink("/elsewhere/same", from, clash.index)).toMatchObject({ kind: "unresolved" });
	});
});

describe("rewriting a document", () => {
	const doc: StoredDocument = {
		type: "doc",
		version: 3,
		content: [
			{
				type: "paragraph",
				content: [
					{ type: "text", text: "a", marks: [{ type: "link", attrs: { href: "./other.mdx#x" } }] },
					{ type: "text", text: "b", marks: [{ type: "link", attrs: { href: "./hello-not.mdx" } }] },
					{ type: "text", text: "c", marks: [{ type: "link", attrs: { href: "https://example.com" } }] },
					{ type: "text", text: "d", marks: [{ type: "link", attrs: { href: "../notes/hello.mdx" } }] },
				],
			},
		],
	};

	it("turns links into entry ids and keeps the rest", () => {
		const ids = new Map([
			[other.source.key, "id-other"],
			[note.source.key, "id-note"],
		]);
		const result = rewriteLinks(doc, hello, index, (plan) => ids.get(plan.source.key));
		const marks = (result.doc.content[0]?.content ?? []).map((node) => node.marks?.[0]?.attrs);
		expect(marks).toEqual([
			{ entryId: "id-other" },
			{ href: "./hello-not.mdx" },
			{ href: "https://example.com" },
			{ entryId: "id-note" },
		]);
		expect(result).toMatchObject({ resolved: 2, droppedFragments: 1 });
		expect(result.unresolved).toHaveLength(1);
		expect(result.pending.size).toBe(0);
	});

	it("lists the files that have no entry yet, and leaves their links as written", () => {
		const result = rewriteLinks(doc, hello, index, (plan) => (plan === other ? undefined : "id"));
		expect([...result.pending].map((plan) => plan.source.rel)).toEqual(["posts/other.mdx"]);
		expect(result.doc.content[0]?.content?.[0]?.marks?.[0]?.attrs).toEqual({ href: "./other.mdx#x" });
	});
});
