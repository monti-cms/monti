# Add your own block

Goal: a `notice` block (an info or warning box with a title and a body) that editors insert from the slash menu, edit with a view of your own, and readers see through your own component. A check warns when a warning notice has no title.

The snippets below are a sketch to adapt, not tested code.

## What you need to know

1. **A block is data first**: `defineBlock({ name, syntax, attributes, editor })`. The name, the stored notation (`container` here: `<Notice level="warn">…</Notice>` in MDX, `:::notice{level="warn"}` with the directive notation), the attributes and how the editor offers it all come from this one definition ("Body blocks" in the [core README](../../packages/core/README.md)).
2. **A plugin carries the block** and its two sides as lazy loaders: `blocks` (the definition), `admin` (the editor view, loaded only by the admin) and `render` (the public component, loaded only on the server). Neither reaches the other's bundle.
3. **`validate(node, ctx)`** on the definition runs on the server in the write pipeline for every use of the block. Its findings are warnings: shown under the block, returned as `warnings`, never blocking.
4. **The editor view** is a component registered in `blockViews` by block name. It takes no props: it reads and writes its block with `useBlockEditor()`, draws the editable body with `<Content />`, and wraps itself in `<BlockFrame>` (`@monti-cms/admin`).
5. **The public component** goes in `defineRender({ blocks })`, the default export of the `render` module: the components by block name, with the attributes as flat props typed from the definition (`BlockProps<typeof noticeBlock>`) and `ctx` (the page's `locale`). Pass a render module to `admin`, or an admin module to `render`, and type checking stops it.

## A sketch

The definition, with its `validate`:

```ts
import { defineBlock } from "@monti-cms/core";

export const noticeBlock = defineBlock({
	name: "notice",
	label: "Notice",
	syntax: { kind: "container", directive: "notice" },
	component: "Notice", // the JSX name in MDX
	attributes: {
		level: { type: "string", label: "Level", options: { info: "Info", warn: "Warning" }, defaultValue: "info" },
		title: { type: "string", label: "Title", translatable: true },
	},
	translateInside: true,
	editor: { view: "node", insertable: true, icon: "message-square", insert: { values: { level: "info" }, text: "Content" } },
	// Findings are warnings: they show under the block and come back as `warnings`, but never block the save.
	validate: (node) =>
		node.attributes.level === "warn" && !String(node.attributes.title ?? "").trim()
			? [{ code: "notice_warning_needs_title", message: "A warning notice needs a title." }]
			: [],
});
```

The plugin:

```ts
import { definePlugin } from "@monti-cms/core";

export const notice = () =>
	definePlugin({
		name: "notice",
		blocks: [noticeBlock],
		admin: () => import("./admin"),
		render: () => import("./render"),
	});
```

The admin module, a `"use client"` module with the editor view and its declaration (by block name):

```tsx
"use client";

import { BlockFrame, Content, defineAdminPlugin, useBlockEditor } from "@monti-cms/admin";

function NoticeView() {
	const block = useBlockEditor<{ level: string; title: string }>();
	const level = block.values.level === "warn" ? "warn" : "info";
	return (
		<BlockFrame>
			<div contentEditable={false}>
				<button type="button" onClick={() => block.setValue("level", level === "warn" ? "info" : "warn")}>
					{level}
				</button>
				<input aria-label="Title" value={block.values.title ?? ""} onChange={(e) => block.setValue("title", e.target.value)} />
			</div>
			<Content />
		</BlockFrame>
	);
}

export default defineAdminPlugin({ components: { blockViews: { notice: NoticeView } } }); // by block name
```

The public component, in the `render` module's default export:

```tsx
import { type BlockProps, defineRender } from "@monti-cms/core/render";

function Notice({ level, title, children }: BlockProps<typeof noticeBlock>) {
	return (
		<aside role={level === "warn" ? "alert" : "note"}>
			{title ? <strong>{title}</strong> : null}
			{children}
		</aside>
	);
}

export default defineRender({ blocks: { notice: Notice } });
```

In `monti.config.ts`, one line (and delete it to remove the block): `plugins: [notice()]`.

## How it behaves

- Saved as MDX, the block is a node of the stored document: `{ type: "notice", attrs: { level, title }, content: [...] }`.
- `validate` gives `notice_warning_needs_title` as a warning for `level="warn"` with no title, with the block's id in `position.blockId` (the editor puts it under the block).
- `<CmsContent cms={cms} entry={entry} />` draws it with `Notice`, with no change to the page. A site can still override it with its own `components={{ blocks: { notice } }}`.
- If a site registers `blockViews.notice` after this plugin, the site's view wins.
- Browser code cannot call `defineConfig` (it is server-only). Build the site with `createSite(defineSite({ schema, plugins }))` instead, as the admin does from the snapshot.
