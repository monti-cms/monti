# Write a custom format: Markdown in, Markdown out

Goal: plain Markdown as a format, so `format: "markdown"` works on the read and write APIs (`cms.read.getEntry`, `createDraft`, the HTTP API, export), plus a one-way `text` format. The same shape fits a JSON feed or a Hugo export.

The code below is the recipe's own files in [`src/markdown/`](src/markdown/), type checked in CI. It is a reduced version: a real Markdown parser is longer.

## What you need to know

1. **The stored document is the only source of a body.** A format only converts: `export(doc, ctx)` makes text, `import(text, ctx)` makes a document. Both are pure (no database, no network). A format with no `import` is one-way ("Formats" in the [core README](../../packages/core/README.md)).
2. **Core does the rest**: it resolves links and media before `export`, then validates, normalises and stores whatever `import` returns, so a format cannot get past a core rule. A text the format rejects (`ok: false`) is kept in a draft as an `unparsed` document with your issues.
3. **The document model**: nodes `paragraph`, `heading` (`attrs.level`), `bulletList` / `orderedList` > `listItem` > blocks, `text` with `marks` (`bold`, `italic`, `code`, `link` with `attrs.href`), `hardBreak`. A block of a plugin is a node named after the block.
4. **`ctx.link(entryId)`** is the address of the entry a link points to (`null` when it is gone or unpublished); `ctx.purpose` is `"read"` (for readers) or `"sync"` (it will be imported again, keep the ids); `ctx.report(issue)` says what the text could not keep.
5. **A plugin provides formats** through its server module: `formats` of `defineServerPlugin`, a function of the plugin's scope that returns a format or a list (a format that depends on the plugin's options reads them with `cms.site.pluginOptions(...)`).

## The code

Paragraphs and headings both ways, bold only, and a one-way text export:

<!-- src/markdown/formats.ts -->
```ts
import type { CmsNode } from "@monti-cms/core/document";
import { emptyStoredDocument } from "@monti-cms/core/document";
import { defineFormat } from "@monti-cms/core/format";
import { documentText } from "@monti-cms/core/site";

const inlineText = (nodes: readonly CmsNode[] | undefined): string =>
	(nodes ?? [])
		.map((node) => {
			if (node.type !== "text") return inlineText(node.content);
			const bold = node.marks?.some((mark) => mark.type === "bold");
			return bold ? `**${node.text}**` : (node.text ?? "");
		})
		.join("");

export const markdownFormat = defineFormat({
	name: "markdown",
	label: "Markdown",
	mimeType: "text/markdown",
	extension: "md",
	export: (doc, ctx) =>
		`${doc.content
			.map((node) => {
				if (node.type === "paragraph") return inlineText(node.content);
				if (node.type === "heading") return `${"#".repeat(Number(node.attrs?.level ?? 2))} ${inlineText(node.content)}`;
				// Say what the text could not keep. The API returns it as a warning of the export.
				ctx.report({
					code: "markdown_block_dropped",
					message: `A "${node.type}" block was left out.`,
					params: { block: node.type },
				});
				return "";
			})
			.filter(Boolean)
			.join("\n\n")}\n`,
	import: (text) => {
		const content = text
			.split(/\n{2,}/)
			.filter((part) => part.trim())
			.map((part): CmsNode => {
				const heading = /^(#{1,6}) (.*)$/.exec(part.trim());
				return heading
					? {
							type: "heading",
							attrs: { level: (heading[1] as string).length },
							content: [{ type: "text", text: heading[2] as string }],
						}
					: { type: "paragraph", content: [{ type: "text", text: part.trim() }] };
			});
		return { ok: true, doc: { ...emptyStoredDocument(), content } };
	},
});

/** A one-way format: it has no `import`, so a write with `format: "text"` is refused (`format_not_importable`). */
export const textFormat = defineFormat({
	name: "text",
	label: "Plain text",
	mimeType: "text/plain",
	extension: "txt",
	export: (doc, ctx) => documentText(ctx.site, doc, { code: true, media: false, hidden: false }),
});
```

The server module and the plugin (`plugins: [markdown()]` in `monti.config.ts`):

<!-- src/markdown/server.ts -->
```ts
import { defineServerPlugin } from "@monti-cms/core/server";
import { markdownFormat, textFormat } from "./formats";

// `formats` returns a format or a list of them. It is called once, when the instance first needs its formats.
export default defineServerPlugin({ formats: () => [markdownFormat, textFormat] });
```

<!-- src/markdown/index.ts -->
```ts
import { definePlugin } from "@monti-cms/core";

export const markdown = () => definePlugin({ name: "markdown", server: () => import("./server") });
```

## How it behaves

- `cms.read.getEntry({ collection: "post", slug, format: "markdown" })` returns `entry.body = { format, text }`. The public JSON API (`/api/monti/v1/public/entries/post/<slug>?format=markdown`, when `publicApi` is on) and the export do the same.
- Writing `{ body, format: "markdown" }` reads the text into the document. An address of this site in a link (`/posts/target`) becomes a link by entry id, and reads back as the address (core's job, not the format's).
- `format: "text"` reads, but a write with it fails with `format_not_importable`. An unknown name fails with `unknown_format`.
- Because `export` and `import` are pure, you can test a format with plain unit tests: round-trip a document and check that what `import` returns is real blocks and marks.
