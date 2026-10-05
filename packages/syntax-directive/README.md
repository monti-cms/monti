# @monti-cms/syntax-directive

English | [한국어](README.ko.md)

Directive syntax extension for `@monti-cms/core`. It reads and writes the notation Monti used before standard MDX (`:::callout{…}`, `::image{…}`, `:u[text]`, `::::table`),
so a site with directive content keeps reading it, and can keep writing it or migrate to standard MDX as posts are saved.

Stored MDX is standard (CommonMark + GFM + MDX JSX) without this package. See "Body syntax" in the core README for what is written by default and how syntax extensions work.

## Installation

Not on npm yet. Until the public release, install the release bundle from the `release` branch by GitHub address (pnpm only), as described in the repository README.

```json
{
	"dependencies": {
		"@monti-cms/syntax-directive": "github:monti-cms/monti#release/v0.1.0&path:/syntax-directive"
	}
}
```

It needs `@monti-cms/core` as a peer dependency.

## Registration

List the extension in `mdx.syntax`. The order is the precedence for writing.

```ts
// cms.config.ts
import { defineConfig } from "@monti-cms/core";
import { directiveSyntax } from "@monti-cms/syntax-directive";

export default defineConfig({
	// …
	mdx: { syntax: [directiveSyntax()] }, // read and write directives
});
```

Read-only, which saves standard MDX and so migrates content a post at a time as it is saved:

```ts
mdx: { syntax: [directiveSyntax({ write: false })] },
```

| Option | Default | Meaning |
| --- | --- | --- |
| `write` | `true` | `true` writes directives where the notation can say the content. `false` only reads directives and writes standard MDX (JSX). Text that looks like a directive (`:u`) is still escaped (`\:u`) in both modes, because the extension still reads directives. |

The public renderer (`@monti-cms/core/render`) runs the extension's remark plugins too, so what the editor reads is what the site renders.

## What it covers

| Notation | Meaning | Example |
| --- | --- | --- |
| `:::name{attributes}` … `:::` | A container block. Use more colons for nesting (`::::tabs` around `:::tab`) | `:::callout{variant="tip"}` |
| `::name{attributes}` | A leaf block | `::image{mediaId="…" alt="…"}`, `::file{mediaId="…"}` |
| `:name[label]{attributes}` | A text decoration | `:u[text]`, `:sup[2]`, `:sub[i]`, `:untranslated[text]`, `:tooltip[term]{content="…"}` |
| `::::table` with `:::row` and `::cell[…]{header colspan=2}` | A table GFM cannot express (merged cells, column widths, non-GFM headers). Other tables stay GFM | |

- It covers every block of the site that has a directive name (`syntax: { kind: "container" | "leaf" | "text", directive: "name" }` in the block definition): the core blocks,
  blocks from plugins such as `@monti-cms/blocks`, and the site config's own `blocks`. Booleans are bare when true (`{open}`) and omitted when false.
- A `:name` that is not a registered block stays ordinary text (`openai/gpt-oss-120b:free를`, `1:1로`). An unregistered container or leaf is kept as the original source and written back unchanged.
- Line breaks are never written as `:br[]`; they are always `<br />`. `:br[]` is still read.
- Directives the extension reads are turned into the same MDX elements the standard notation produces, so reference collection and validation behave the same in both notations,
  and the content hash (which hashes the parsed body) does not change when a post is saved in the other notation.

## Upgrading

Before this package existed, `directiveSyntax` was exported by `@monti-cms/core/syntax`. It is now exported only by this package:

```diff
-import { directiveSyntax } from "@monti-cms/core/syntax";
+import { directiveSyntax } from "@monti-cms/syntax-directive";
```

Install the package next to the core package and change the import. Behavior and options are the same.

**A site that has directive content** must keep the extension in `mdx.syntax`. Without it, existing posts render directive text literally
and fail validation (`{…}` in `:::callout{…}` is read as an expression). Use `directiveSyntax({ write: false })` to migrate to standard MDX (`monti content:rewrite --apply` rewrites every stored body at once), and remove the extension once no stored body uses directives.

## Writing your own extension

This package is a reference implementation of the experimental `SyntaxExtension` interface of `@monti-cms/core/syntax`, and imports nothing else from core. See "Writing a syntax extension" in the core README.
