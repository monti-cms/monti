import { createHash } from "node:crypto";
import { createFormatRegistry } from "../../../format/registry";
import { defineFormat } from "../../../format/types";
import { parseFile } from "../../../front-matter";
import { defineCollection } from "../../../schema/collection";
import { fields } from "../../../schema/fields";
import { createSite, type Site } from "../../../site";
import type { ParsedSource } from "../source";

/** A site of its own, so these tests do not depend on the config the suite runs against. */
const title = fields.text({ label: "Title", required: true, localized: true });
const slug = fields.slug({ label: "Slug", from: "title", required: true, localized: "inherit" });

export const importSite = (): Site =>
	createSite({
		collections: {
			post: defineCollection({
				label: "Post",
				kind: "document",
				path: "/posts/:slug",
				fields: {
					title,
					slug,
					summary: fields.text({ label: "Summary", localized: true, role: "summary" }),
					status: fields.select({
						label: "Status",
						options: { idea: "Idea", done: "Done" },
						defaultValue: "idea",
					}),
					cover: fields.media({ label: "Cover" }),
					tagIds: fields.relation({ label: "Tags", to: "tag", many: true }),
					categoryId: fields.relation({ label: "Category", to: "category" }),
				},
			}),
			note: defineCollection({
				label: "Note",
				kind: "document",
				path: "/notes/:slug",
				fields: { title, slug },
			}),
			tag: defineCollection({
				label: "Tag",
				kind: "item",
				fields: {
					title: fields.text({ label: "Name", required: true }),
					slug: fields.slug({ label: "Slug", from: "title" }),
				},
			}),
			category: defineCollection({
				label: "Category",
				kind: "item",
				fields: {
					title: fields.text({ label: "Name", required: true }),
					slug: fields.slug({ label: "Slug", from: "title" }),
				},
			}),
		},
		locales: [
			{ code: "en", name: "English" },
			{ code: "ko", name: "한국어" },
		],
		defaultLocale: "en",
	} as never) as Site;

/** A source file that was "read": `rel` is its path under the scanned folder. */
export function source(rel: string, text: string, root = "/proj/content"): ParsedSource {
	const parsed = parseFile(text);
	const ok = parsed.ok;
	return {
		abs: `${root}/${rel}`,
		rel,
		key: `content/${rel}`,
		ext: rel.endsWith(".md") ? "md" : "mdx",
		text,
		hash: createHash("sha256").update(text).digest("hex"),
		front: ok ? parsed.data : {},
		body: ok ? parsed.body : "",
		bodyLineOffset: 0,
		...(ok ? {} : { error: parsed.message }),
	};
}

/** A registry with one importable format that reads `.mdx`. */
export const mdxRegistry = () =>
	createFormatRegistry([
		defineFormat({
			name: "mdx",
			label: "MDX",
			mimeType: "text/mdx",
			extension: "mdx",
			export: () => "",
			import: () => ({ ok: true, doc: { type: "doc", version: 3, content: [] } }),
		}),
	]);
