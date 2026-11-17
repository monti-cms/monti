# @monti-cms/blocks

Monti's blocks and marks, as source a site copies in and then owns: callout, tabs, columns, collapsible, code explorer, math, Mermaid diagram,
chart, tooltip and text colour (design: `docs/design/features/18-blocks-package.md`).

A site does not import this package. Install it, then add what you want:

```sh
pnpm add -D @monti-cms/blocks
pnpm monti add callout math
```

`monti add` copies each block's folder into the site's `monti/blocks/` and, the first time, wires the site: `monti.config.ts` gets `blocks` and
`marks`, the admin page gets the blocks, the site's root layouts get `blocks.css`, and the calls to `renderDocument` get `blocks` and `marks`. A
folder already there is never written over: the site may have changed it. Run `monti add` with no name to list what can be added.

| Name | What | Needs |
|---|---|---|
| `callout` | A box for a note, a tip, information, a warning or a danger | |
| `tabs` | The same thing a few ways, one at a time | |
| `columns` | Blocks side by side | |
| `collapsible` | A part a reader opens by its title | |
| `code-explorer` | Files of a project as a tree with their code | |
| `math` | A formula in LaTeX, drawn on the server by KaTeX | `katex` |
| `mermaid` | A Mermaid diagram, drawn in the reader's browser | `mermaid` |
| `chart` | A table's numbers as bars, lines, areas or a pie | |
| `tooltip` (mark) | A note on some words | |
| `color` (mark) | Words in a colour, or on one | |

Each block's words for readers (a callout's kind, "Show more") are in its `site.tsx` in English, Korean and Japanese, picked by the entry's
`locale` that the site hands to `renderDocument`. Its look is its `.css` file, on the variables of `base.css`.
