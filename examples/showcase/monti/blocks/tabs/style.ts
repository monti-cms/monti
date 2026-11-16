/** The tabs block's look, as CSS its site component loads with React's `<style href precedence>`: the site's own, change it here (doc 18). */
export const style = `/*
 * What the blocks' looks share: their accent colours, borders and the chart's series colours. 'each block's style starts with them'.
 * The dark theme is '.dark' or '[data-theme="dark"]' on 'html', or the system's when the page says neither.
 */
:where(:root) {
	--monti-callout-note: var(--monti-fg-muted, var(--muted-foreground, oklch(0.55 0.02 265)));
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
	/* The page's own ground, which a block that joins it takes (the open tab); a site names its own. */
	--monti-block-ground: var(--monti-bg-page, Canvas);
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

/*
 * The tabs' look: the owner's folder tabs (doc 18, the owner: the open tab has no line under it), the same in the editor (FolderTabs of the admin) and on the site. The open tab has the
 * page's own ground and no line under it, so it joins the box under the tabs; the others are closed and grey. The box has one frame (the tab's words are
 * not in a second box), and its top-left corner is square where the open tab joins it. The tabs of a full row shrink first, never wider than their names and never under the least of their own width and 4.5rem (a name ends in an ellipsis and is said whole by the title), and only when even the shrunk tabs do not fit does the row scroll
 * sideways, and never up and down. The site's own: change it as the site likes (doc 18); --monti-block-ground is the page's ground, which the open tab and its joint take.
 */
:where(.dark, [data-theme="dark"]) .monti-block-tabs {
	color-scheme: dark;
}
@media (prefers-color-scheme: dark) {
	:where(:root:not(.light, [data-theme="light"])) .monti-block-tabs {
		color-scheme: dark;
	}
}
.monti-block-tabs {
	margin: 1.5rem 0;
}
.monti-block-tabs-list {
	position: relative;
	z-index: 1;
	display: flex;
	align-items: flex-end;
	gap: 0.25rem;
	margin-bottom: -1px;
	overflow-x: auto;
	overflow-y: hidden;
}
.monti-block-tabs-tab {
	display: inline-flex;
	flex: 0 1 auto;
	align-items: center;
	height: 2.25rem;
	padding: 0 1rem 0 0.75rem;
	border: 1px solid var(--monti-block-border);
	border-radius: 0.5rem 0.5rem 0 0;
	background-color: var(--monti-block-muted);
	color: color-mix(in srgb, currentColor 75%, transparent);
	font: inherit;
	font-size: 0.9375em;
	white-space: nowrap;
	cursor: pointer;
}
/* The name's cell: the name, and a hidden copy at most 4.5rem wide that is the narrowest the cell goes. A tab is never wider than its name. */
.monti-block-tabs-name {
	display: grid;
}
.monti-block-tabs-name::after {
	content: attr(data-name);
	grid-area: 1 / 1;
	height: 0;
	max-width: 4.5rem;
	overflow: clip;
	visibility: hidden;
	white-space: nowrap;
}
.monti-block-tabs-text {
	grid-area: 1 / 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
}
.monti-block-tabs-tab:hover {
	color: inherit;
}
.monti-block-tabs-tab[aria-selected="true"] {
	border-bottom-color: var(--monti-block-ground);
	background-color: var(--monti-block-ground);
	color: inherit;
	font-weight: 600;
}
.monti-block-tabs-tab:focus-visible,
.monti-block-tabs-panel:focus-visible {
	outline: 2px solid var(--monti-block-accent);
	outline-offset: -2px;
}
.monti-block-tabs-panel {
	padding: 0.75rem 1rem;
	border: 1px solid var(--monti-block-border);
	border-radius: 0 0.5rem 0.5rem 0.5rem;
}
.monti-block-tabs-panel[hidden] {
	display: none;
}
.monti-block-tabs-panel > :first-child,
.monti-block-tabs-pane > :first-child {
	margin-top: 0;
}
.monti-block-tabs-panel > :last-child,
.monti-block-tabs-pane > :last-child {
	margin-bottom: 0;
}

/* In the editor, while the tabs' own view loads, the site's drawing stands in: its one pane holds every tab, so only the first tab shows. */
.monti-block-tabs [role="tabpanel"] [data-node-view-content-react] > :not(:first-child) {
	display: none;
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
.monti-block-tabs-content {
	padding: 0.75rem 1rem;
}
`;
