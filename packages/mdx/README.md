# @monti-cms/mdx

English | [한국어](README.ko.md)

Monti's MDX plugin: reads `.md` and `.mdx` files (with `:::directive` blocks) into the body on import, and writes a body back as MDX.

```ts
// monti.config.ts
import { defineConfig } from "@monti-cms/core";
import { mdx } from "@monti-cms/mdx";

export default defineConfig({
	// …
	plugins: [mdx()],
});
```

```tsx
// app/admin/page.tsx
import { mdxAdmin } from "@monti-cms/mdx/admin";
import { AdminPage } from "@monti-cms/next/admin";

export default function Page() {
	return <AdminPage plugins={[mdxAdmin]} />;
}
```

The first is the plugin's server half: with it, the import of a collection's list ("+ New ▾ › Import") reads `.md` and `.mdx` files, alone
or in a zip with their pictures. The second is its half in the browser: "View as MDX" in the editors' ⋯. `npx monti init` writes both when
the package is installed.

Monti keeps a body as a JSON document. MDX is read into it once, on import; it is not what is stored.

## What is read

| In the file | In the body |
|---|---|
| Front matter | The file's keys, matched to the collection's fields in the import sheet |
| Headings | Heading blocks, levels 2 to 4 (a `#` is level 2) |
| Paragraphs, bold, italic, strike, inline code, links, `<u>`, `<sup>`, `<sub>`, line breaks | Paragraphs with those marks |
| Lists, task lists, quotes, tables, rules, footnotes | Their blocks |
| A fenced code block | A code block: its text as written, the rest of the fence line kept in its language |
| A picture on a line of its own | A picture block. A picture the upload carries goes to the media library |
| `:::callout{tone="warn"}` naming a block of the site | That block, with the attributes given |
| A component (`<Tweet />`), an unknown directive, a chunk of HTML | Kept as written in a code block (language `mdx-kept` or `html-kept`), with a to-do "Unknown component Tweet" on the entry (it does not block publishing) |
| `import` and `export` lines of an `.mdx` file | Left out |

A link by the name of an address the file defines (`[docs][d]`) gets that address; a script address is no link.

A highlighter's line notations (`// [!code ++]`) stay in the code as text, in and out: nothing is lost, and nothing is drawn from them yet.

## Writing

```ts
import { readMarkdown, toMdx } from "@monti-cms/mdx";

const text = toMdx(doc, { values: { title: "Hello" }, mediaUrl: (id) => `/files/${id}` });
const { values, doc: again, unknown } = readMarkdown(text, { mdx: true });
```

`toMdx` writes a body as MDX: the site's own blocks as directives, what was kept as written exactly as it was, `values` first as front
matter. What is read and written back reads as the same body.

## Options

```ts
mdx({ language: "en" }); // the language of the to-do's words; Korean when left out, as the admin is
```
