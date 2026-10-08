# Add your own block

Goal: a `notice` block (an info or warning box with a title and a body) that editors insert from the slash menu, edit with a view of your own, and readers see through your own component. A check warns when a warning notice has no title.

Code: [`examples/recipes/src/notice-block`](../../examples/recipes/src/notice-block). Tests: `notice-block.test.tsx` (server: stored, validated, drawn) and `notice-view.test.tsx` (the editor view, in a browser-like environment).

## What you need to know

1. **A block is data first**: `defineBlock({ name, syntax, attributes, editor })`. The name, the stored notation (`container` here: `<Notice level="warn">…</Notice>` in MDX, `:::notice{level="warn"}` with the directive notation), the attributes and how the editor offers it all come from this one definition ("Body blocks" in the [core README](../../packages/core/README.md)).
2. **A plugin carries the block** and its two sides as lazy loaders: `blocks` (the definition), `admin` (the editor view, loaded only by the admin) and `render` (the public component, loaded only on the server). Neither reaches the other's bundle.
3. **`validate(node, ctx)`** on the definition runs on the server in the write pipeline for every use of the block. Its findings are warnings: shown under the block, returned as `warnings`, never blocking.
4. **The editor view** is a component registered in `blockViews` by block name. It takes no props: it reads and writes its block with `useBlockEditor()`, draws the editable body with `<Content />`, and wraps itself in `<BlockFrame>` (`@monti-cms/admin/hooks`).
5. **The public component** is `documentComponents`, exported by the `render` module: the components by block name, with the attributes as flat props typed from the definition (`BlockProps<typeof noticeBlock>`).

## The code

The definition, with its `validate`:

<!-- source: examples/recipes/src/notice-block/definition.ts -->
```ts
import { defineBlock } from "@monti-cms/core";

/**
 * The block's data: its name, how it is stored, its attributes and how the editor offers it. Stored as MDX it is
 * `<Notice level="warn" title="Heads up">…</Notice>`, and with the directive notation `:::notice{level="warn"}`.
 */
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
	editor: {
		view: "node",
		insertable: true,
		icon: "message-square",
		insert: { values: { level: "info" }, text: "Content" },
	},
	// Runs on the server for every notice, on every create, save, publish and bulk change. Its findings are warnings: they show under the block
	// in the editor and come back as `warnings` in the response, but they never block the save.
	validate: (node) =>
		node.attributes.level === "warn" && !String(node.attributes.title ?? "").trim()
			? [
					{
						code: "notice_warning_needs_title",
						message: "A warning notice needs a title, so readers see what it is about.",
					},
				]
			: [],
});
```

The plugin:

<!-- source: examples/recipes/src/notice-block/index.ts -->
```ts
import { definePlugin } from "@monti-cms/core";
import { noticeBlock } from "./definition";

export { noticeBlock } from "./definition";

/**
 * The notice block as a plugin: `plugins: [notice()]`. The three loaders are read only where they are used: the admin loads `admin` (the
 * editor view), the public page `render` (the component), and neither reaches the other's bundle.
 */
export const notice = () =>
	definePlugin({
		name: "notice",
		options: {},
		blocks: [noticeBlock],
		admin: () => import("./admin"),
		render: () => import("./render"),
	});
```

The editor view and the provider that registers it:

<!-- source: examples/recipes/src/notice-block/view.tsx -->
```tsx
"use client";

import { BlockFrame, Content, useBlockEditor } from "@monti-cms/admin/hooks";

/** The editor view of a notice: the level is a button, the title an input, and `<Content />` is the editable body inside. A view takes no props. */
export function NoticeView() {
	const block = useBlockEditor<{ level: string; title: string }>();
	const level = block.values.level === "warn" ? "warn" : "info";
	return (
		<BlockFrame>
			<div data-notice-level={level} className="rounded-lg border p-3">
				<div contentEditable={false} className="flex gap-2">
					<button
						type="button"
						disabled={!block.editable}
						onClick={() => block.setValue("level", level === "warn" ? "info" : "warn")}
					>
						{level === "warn" ? "Warning" : "Info"}
					</button>
					<input
						aria-label="Title"
						value={block.values.title ?? ""}
						readOnly={!block.editable}
						onChange={(event) => block.setValue("title", event.target.value)}
					/>
				</div>
				<Content />
			</div>
		</BlockFrame>
	);
}
```

<!-- source: examples/recipes/src/notice-block/provider.tsx -->
```tsx
"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@monti-cms/admin";
import { MessageSquare } from "lucide-react";
import type { ReactNode } from "react";
import { NoticeView } from "./view";

const components: CmsAdminComponents = {
	blockViews: { notice: NoticeView }, // by block name
	icons: { "message-square": MessageSquare }, // the menu icon, when the name is not among the admin's own
};

/** Registers the notice's editor view and menu icon in the admin. */
export function NoticeProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
```

<!-- source: examples/recipes/src/notice-block/admin.ts -->
```ts
import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { NoticeProvider } from "./provider";

/** The admin side of the notice plugin: a provider that registers the editor view. */
export default defineAdminPlugin({ Provider: NoticeProvider });
```

The public component:

<!-- source: examples/recipes/src/notice-block/render.tsx -->
```tsx
import type { BlockProps, LooseDocumentComponents } from "@monti-cms/core/render";
import type { noticeBlock } from "./definition";

/** The public component. The block's attributes arrive as flat props, typed from the definition (`level` is `"info" | "warn"`). */
export function Notice({ level, title, children }: BlockProps<typeof noticeBlock>) {
	return (
		<aside data-notice-level={level} role={level === "warn" ? "alert" : "note"}>
			{title ? <strong>{title}</strong> : null}
			{children}
		</aside>
	);
}

/** What `renderDocument` and `<CmsContent />` read from a plugin's `render` module: the components by block name. */
export const documentComponents = (): LooseDocumentComponents => ({ blocks: { notice: Notice } });
```

In `monti.config.ts`, one line (and delete it to remove the block):

```ts
plugins: [notice()],
```

## How it behaves

- Saved as MDX, the block is a node of the stored document: `{ type: "notice", attrs: { level, title }, content: [...] }`. The test reads it back through `createDraft`.
- `validate` gives `notice_warning_needs_title` as a warning for `level="warn"` with no title, with the block's id in `position.blockId` (the editor puts it under the block) and the block's name in `params.block`.
- `<CmsContent cms={cms} entry={entry} />` draws it with `Notice`, with no change to the page. A site can still override it with its own `components={{ blocks: { notice } }}`.
- The editor test mounts the real editor extensions built from the same definition, clicks the level button, types a title, and reads the stored document back: the view writes the attributes, not text.
- If a site registers `blockViews.notice` after this plugin, the site's view wins.

## Found while writing it

- The plugin sketch in the README did not show `render`, so the way a block reaches the public page was found in the blocks package. Fixed in the README.
- A browser test cannot call `defineConfig` (it is server-only and refuses to run where `window` exists). The recipe builds the site with `createSite(defineSite({ schema, plugins }))` instead, as the admin does from the snapshot. Documented here.
