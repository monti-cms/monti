/** The columns block's look, as CSS its site component loads with React's `<style href precedence>`: the site's own, change it here (doc 18). */
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

/* The columns' look: stacked on a narrow screen, side by side by '--monti-columns' (their widths) on a wide one. The site's own: change it as the site likes (doc 18). */
.monti-block-columns {
	display: flex;
	flex-direction: column;
	gap: 1rem;
	margin: 1.5rem 0;
}
.monti-block-columns > * {
	min-width: 0;
}
@media (min-width: 48rem) {
	.monti-block-columns {
		display: grid;
		grid-template-columns: var(--monti-columns);
		align-items: start;
		gap: 1.5rem;
	}
}
.monti-block-column {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}
.monti-block-column > * {
	margin: 0;
}
.monti-block-column img {
	max-width: 100%;
}

/* In the editor: the columns are the grid's cells through the editor's own wrappers; the table's tools stand over them. */
.monti-block-columns-editor {
	position: relative;
}
.monti-block-columns-content,
.monti-block-columns-content > div {
	display: contents;
}
.monti-block-columns-editor > .monti-block-columns-content > div > .node-column {
	min-width: 0;
}
.monti-block-columns-tools {
	position: absolute;
	inset: 0;
	pointer-events: none;
}
.monti-block-columns-border {
	position: absolute;
	top: 0;
	bottom: 0;
	width: 9px;
	transform: translateX(-50%);
	pointer-events: auto;
}
.monti-block-columns-grip {
	position: absolute;
	top: -6px;
	transform: translateX(-50%);
	pointer-events: auto;
	opacity: 0;
}
.monti-block-columns-grip[data-shown],
.monti-block-columns-grip:focus-within {
	opacity: 1;
}
.monti-block-columns-add {
	position: absolute;
	top: 0;
	right: -20px;
	bottom: 0;
	width: 12px;
	pointer-events: auto;
	opacity: 0;
}
.monti-block-columns-editor:hover .monti-block-columns-add,
.monti-block-columns-add:focus-within {
	opacity: 1;
}
`;
