/** The callout block's look, as CSS its site component loads with React's `<style href precedence>`: the site's own, change it here (doc 18). */
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

/* The callout's look. The site's own: change it as the site likes (doc 18). */
.monti-block-callout {
	--monti-block-callout-accent: var(--monti-callout-note, oklch(0.55 0.02 265));
	margin: 1.5rem 0;
	padding: 0.75rem 1rem;
	border: 1px solid color-mix(in oklab, var(--monti-block-callout-accent) 40%, transparent);
	border-left-width: 4px;
	border-radius: 0.5rem;
	background-color: color-mix(in oklab, var(--monti-block-callout-accent) 10%, transparent);
	font-size: 0.875rem;
}
.monti-block-callout[data-tone="tip"] {
	--monti-block-callout-accent: var(--monti-callout-tip, oklch(0.6 0.15 155));
}
.monti-block-callout[data-tone="info"] {
	--monti-block-callout-accent: var(--monti-callout-info, oklch(0.6 0.14 240));
}
.monti-block-callout[data-tone="warning"] {
	--monti-block-callout-accent: var(--monti-callout-warning, oklch(0.7 0.16 70));
}
.monti-block-callout[data-tone="danger"] {
	--monti-block-callout-accent: var(--monti-callout-danger, oklch(0.58 0.22 27));
}
.monti-block-callout-title {
	font-weight: 600;
	letter-spacing: -0.01em;
	color: var(--monti-block-callout-accent);
}
.monti-block-callout-body {
	margin-top: 0.5rem;
}
.monti-block-callout-body > :first-child {
	margin-top: 0;
}
.monti-block-callout-body > :last-child {
	margin-bottom: 0;
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
.monti-block-callout-head {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}
.monti-block-callout-head > svg {
	flex: none;
	width: 1rem;
	height: 1rem;
}
`;
