/** The code-explorer block's look, as CSS its site component loads with React's `<style href precedence>`: the site's own, change it here (doc 18). */
export const style = `/*
 * What the blocks' looks share: their accent colours, borders and the chart's series colours. 'each block's style starts with them'.
 * The dark theme is '.dark' or '[data-theme="dark"]' on 'html', or the system's when the page says neither.
 */
:where(:root) {
	--monti-callout-note: var(--monti-fg-muted, var(--muted-foreground));
	--monti-callout-tip: oklch(0.6 0.15 155);
	--monti-callout-info: oklch(0.6 0.14 240);
	--monti-callout-warning: var(--monti-fg-warning, var(--warning, oklch(0.7 0.16 70)));
	--monti-callout-danger: var(--monti-fg-danger, var(--destructive, oklch(0.58 0.22 27)));
	--chart-1: oklch(0.65 0.17 265);
	--chart-2: oklch(0.7 0.14 160);
	--chart-3: oklch(0.75 0.15 70);
	--chart-4: oklch(0.65 0.2 15);
	--chart-5: oklch(0.6 0.15 310);
}

:where(.dark, [data-theme="dark"]) {
	--chart-1: oklch(0.75 0.13 265);
	--chart-2: oklch(0.78 0.12 160);
	--chart-3: oklch(0.82 0.12 70);
	--chart-4: oklch(0.72 0.16 15);
	--chart-5: oklch(0.72 0.13 310);
}
@media (prefers-color-scheme: dark) {
	:where(:root:not(.light, [data-theme="light"])) {
		--chart-1: oklch(0.75 0.13 265);
		--chart-2: oklch(0.78 0.12 160);
		--chart-3: oklch(0.82 0.12 70);
		--chart-4: oklch(0.72 0.16 15);
		--chart-5: oklch(0.72 0.13 310);
	}
}

:where(:root) {
	--monti-block-border: color-mix(in srgb, currentColor 18%, transparent);
	--monti-block-muted: color-mix(in srgb, currentColor 6%, transparent);
	--monti-block-accent: oklch(0.6 0.14 250);
	--monti-block-tooltip-bg: oklch(0.21 0.03 265);
	--monti-block-tooltip-fg: oklch(0.98 0.005 265);
}
:where(.dark, [data-theme="dark"]) {
	--monti-block-tooltip-bg: oklch(0.96 0.005 265);
	--monti-block-tooltip-fg: oklch(0.21 0.03 265);
	--monti-block-accent: oklch(0.75 0.12 250);
}
@media (prefers-color-scheme: dark) {
	:where(:root:not(.light, [data-theme="light"])) {
		--monti-block-tooltip-bg: oklch(0.96 0.005 265);
		--monti-block-tooltip-fg: oklch(0.21 0.03 265);
		--monti-block-accent: oklch(0.75 0.12 250);
	}
}

/* The code explorer's look: the file tree on the left and the picked file's code on the right; in a narrow block the tree sits above the code behind a button that shows the current path. The site's own: change it as the site likes (doc 18). */
.monti-block-code-explorer {
	container-type: inline-size;
	margin: 1.5rem 0;
	border: 1px solid var(--monti-block-border);
	border-radius: 0.5rem;
	overflow: hidden;
}
.monti-block-code-explorer-layout {
	display: grid;
	grid-template-columns: minmax(10rem, 14rem) minmax(0, 1fr);
}
.monti-block-code-explorer[data-tree-only] > .monti-block-code-explorer-layout {
	grid-template-columns: minmax(0, 1fr);
}
.monti-block-code-explorer-nav {
	min-width: 0;
	padding: 0.5rem;
	border-right: 1px solid var(--monti-block-border);
	background-color: var(--monti-block-muted);
	font-size: 0.875rem;
}
.monti-block-code-explorer[data-tree-only] .monti-block-code-explorer-nav {
	border-right: 0;
}
.monti-block-code-explorer-toggle {
	display: none;
}
.monti-block-code-explorer-tree,
.monti-block-code-explorer-group {
	margin: 0;
	padding: 0;
	list-style: none;
}
.monti-block-code-explorer-group {
	padding-left: 0.875rem;
}
.monti-block-code-explorer-item {
	margin: 0;
	padding: 0;
	outline: none;
}
.monti-block-code-explorer-label {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.2rem 0.5rem;
	border-radius: 0.25rem;
	overflow-wrap: anywhere;
	cursor: pointer;
}
.monti-block-code-explorer-label::before {
	content: "";
	flex-shrink: 0;
	width: 0.4em;
	height: 0.4em;
}
.monti-block-code-explorer-item[data-kind="folder"] > .monti-block-code-explorer-label::before {
	border-top: 2px solid currentColor;
	border-right: 2px solid currentColor;
	opacity: 0.6;
	transform: rotate(45deg);
	transition: transform 150ms ease;
}
.monti-block-code-explorer-item[aria-expanded="true"] > .monti-block-code-explorer-label::before {
	transform: rotate(135deg);
}
.monti-block-code-explorer-item > .monti-block-code-explorer-label:hover {
	background-color: var(--monti-block-border);
}
.monti-block-code-explorer-item[aria-selected="true"] > .monti-block-code-explorer-label {
	background-color: color-mix(in srgb, var(--monti-block-accent) 20%, transparent);
	font-weight: 600;
}
.monti-block-code-explorer-item[aria-disabled="true"] > .monti-block-code-explorer-label {
	opacity: 0.55;
	cursor: default;
}
.monti-block-code-explorer-item[aria-disabled="true"] > .monti-block-code-explorer-label:hover {
	background: none;
}
.monti-block-code-explorer-item:focus-visible > .monti-block-code-explorer-label,
.monti-block-code-explorer-toggle:focus-visible {
	outline: 2px solid var(--monti-block-accent);
	outline-offset: -2px;
}
.monti-block-code-explorer-code {
	min-width: 0;
}
.monti-block-code-explorer-panel[hidden] {
	display: none;
}
.monti-block-code-explorer-panel > .monti-code {
	margin: 0;
	border: 0;
	border-radius: 0;
}
@container (max-width: 40rem) {
	.monti-block-code-explorer-layout {
		grid-template-columns: minmax(0, 1fr);
	}
	.monti-block-code-explorer-nav {
		padding: 0;
		border-right: 0;
		border-bottom: 1px solid var(--monti-block-border);
	}
	.monti-block-code-explorer-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		font-weight: 500;
		text-align: left;
		overflow-wrap: anywhere;
		cursor: pointer;
	}
	.monti-block-code-explorer-toggle::before {
		content: "";
		flex-shrink: 0;
		width: 0.45em;
		height: 0.45em;
		border-top: 2px solid currentColor;
		border-right: 2px solid currentColor;
		opacity: 0.6;
		transform: rotate(45deg);
		transition: transform 150ms ease;
	}
	.monti-block-code-explorer[data-nav-open] .monti-block-code-explorer-toggle::before {
		transform: rotate(135deg);
	}
	.monti-block-code-explorer:not([data-tree-only]) .monti-block-code-explorer-tree {
		display: none;
	}
	.monti-block-code-explorer[data-nav-open] .monti-block-code-explorer-tree {
		display: block;
		padding: 0 0.5rem 0.5rem;
	}
}
@media (prefers-reduced-motion: reduce) {
	.monti-block-code-explorer-label::before,
	.monti-block-code-explorer-toggle::before {
		transition: none;
	}
}

/* In the editor: a title typed in the block keeps the block's own letters. */
[data-slot="block-title"] {
	width: 100%;
	min-width: 0;
	padding: 0;
	border: 0;
	background: transparent;
	color: inherit;
	font: inherit;
	letter-spacing: inherit;
	outline: none;
}
[data-slot="block-title"]::placeholder {
	color: inherit;
	opacity: 0.5;
}
.monti-block-code-explorer-editor {
	display: grid;
	grid-template-columns: minmax(10rem, 13rem) minmax(0, 1fr);
	gap: 0.75rem;
	margin: 1.5rem 0;
	padding: 0.5rem;
	border: 1px solid var(--monti-block-border);
	border-radius: 0.5rem;
}
.monti-block-code-explorer-side {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	min-width: 0;
}
.monti-block-code-explorer-add {
	display: flex;
	gap: 0.25rem;
}
.monti-block-code-explorer-main {
	min-width: 0;
}
.monti-block-code-explorer-path {
	padding: 0.25rem 0.5rem;
	font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	font-size: 0.8125rem;
}
.monti-block-code-explorer-files > [data-node-view-content] > div > * {
	margin-top: 0;
}
`;
