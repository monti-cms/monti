# @monti-cms/syntax-shiki

English | [한국어](README.ko.md)

Shiki code notation extension for `@monti-cms/core`. Posts written for Shiki mark code lines with comments such as `const a = 1 // [!code ++]`
(see the [Shiki transformers](https://shiki.style/packages/transformers)). This package reads that notation when a body is parsed and turns it into Monti's own
code annotations (`// @line plus`, see "Code block line effects" in the core README).

**It only reads.** The Shiki notation is converted on import and never written: a body is always stored with Monti's annotation comments,
so a post migrates as it is saved, and the written MDX needs no extension to be read.

## Installation

Not on npm yet. Until the public release, install the release bundle from the `release` branch by GitHub address (pnpm only), as described in the repository README.

```json
{
	"dependencies": {
		"@monti-cms/syntax-shiki": "github:monti-cms/monti#release/v0.1.0&path:/syntax-shiki"
	}
}
```

It needs `@monti-cms/core` as a peer dependency.

## Registration

List the extension in `mdx.syntax`.

```ts
// cms.config.ts
import { defineConfig } from "@monti-cms/core";
import { shikiNotation } from "@monti-cms/syntax-shiki";

export default defineConfig({
	// …
	mdx: { syntax: [shikiNotation()] },
});
```

| Option | Default | Meaning |
| --- | --- | --- |
| `word` | `"strong"` | The text effect `[!code word:…]` becomes (`"strong"`, `"em"`, `"del"` or `"u"`). `false` leaves `word` notation as it is. |

The public renderer (`@monti-cms/core/render`) runs the extension's remark plugins before it reads the code annotations, so a post that still has Shiki notation renders correctly before it is saved.

## What is converted

| Shiki | Monti |
| --- | --- |
| `// [!code ++]` | `// @line plus` |
| `// [!code --]` | `// @line minus` |
| `// [!code highlight]`, `// [!code hl]` | `// @line highlight` |
| `// [!code error]`, `// [!code warning]` | `// @line error`, `// @line warning` |
| `// [!code focus]` | `// @line focus` if the site defines a `focus` line effect in `codeBlock.lineEffects`, otherwise `// @line highlight` |
| `// [!code info]` | `// @line info` if the site defines an `info` line effect, otherwise left as it is |
| `[!code ++:3]` (any line effect with a count) | `// @line plus {2-4}`: this line and the next two, as a closed range of code line numbers (0-based) |
| `[!code word:foo]` | `// @char strong {re:/foo/g}`, a regex text rule (see below) |

```ts
const a = 1
const b = 2 // [!code --]
const b = 3 // [!code ++]
```

becomes

```ts
const a = 1
// @line minus
const b = 2
// @line plus
const b = 3
```

- **Where the notation is read.** In a trailing comment of the code fence's language, found outside quotes: `//` and `/* … */` (the default), `#` (python, yaml, toml, bash, sh, zsh, ruby, perl, r, dockerfile, makefile, powershell, …),
  `--` (sql, lua, haskell) and `<!-- … -->` (html, xml, svg, vue, svelte, astro, markdown). Text that only looks like notation, such as a `[!code ++]` inside a string, is left alone, and so is a notation Shiki does not know.
  A string that spans several lines is not tracked, so a trailing comment after one may be missed.
- **Trailing and whole-line comments.** The notation and its comment are removed; if other comment text is left, it stays. A trailing notation applies to its own line.
  A comment that holds only the notation is removed with its line and applies to the next code line. Several notations stack on the same line.
- **Counts.** `:N` covers N code lines. Line numbers count code lines only: removed notation lines and Monti annotation lines are not counted. A count past the end of the code is clipped.
  Line ranges (`{a-b}`) are absolute, so do not mix them with Monti annotations that use ranges in the same code block.
- **Indentation.** The annotation comment takes the indentation of the line it applies to.
- **`word`.** Monti has no highlighted-word effect, so the closest text effect is used (bold by default, set with the `word` option). The word becomes a regex rule: `[!code word:foo]` without a count covers every line from its line to the end
  (a whole-code `@document` rule when it is on the first line), and `[!code word:foo:2]` covers that many lines.
- **`focus`.** Monti has no focus effect by default. Add one with `codeBlock.lineEffects` (a line effect named `focus`) to get it; without one, focus lines are highlighted.
- Code without notation is not touched.

## Writing your own extension

This package is a small `SyntaxExtension` with only `remarkPlugins` (no writers). It imports only from `@monti-cms/core/syntax`. See "Writing a syntax extension" in the core README.
