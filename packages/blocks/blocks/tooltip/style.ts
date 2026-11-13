/** The tooltip block's look, as CSS its site component loads with React's `<style href precedence>`: the site's own, change it here (doc 18). */
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

/* The tooltip's look. The site's own: change it as the site likes (doc 18). */
.monti-block-tooltip {
	position: relative;
}
.monti-block-tooltip-trigger {
	text-decoration: underline dotted;
	text-decoration-color: color-mix(in srgb, currentColor 40%, transparent);
	text-underline-offset: 0.2em;
	cursor: help;
	border-radius: 0.125rem;
}
.monti-block-tooltip-trigger:focus-visible {
	outline: 2px solid var(--monti-block-accent);
	outline-offset: 2px;
}
.monti-block-tooltip-content {
	position: absolute;
	bottom: calc(100% + 0.375rem);
	left: 50%;
	z-index: 50;
	width: max-content;
	max-width: min(20rem, calc(100vw - 2rem));
	padding: 0.375rem 0.625rem;
	border-radius: 0.375rem;
	background-color: var(--monti-block-tooltip-bg);
	color: var(--monti-block-tooltip-fg);
	font-size: 0.875rem;
	font-weight: 400;
	line-height: 1.5;
	text-align: start;
	text-decoration: none;
	transform: translateX(-50%);
	visibility: hidden;
	opacity: 0;
	pointer-events: none;
	transition: opacity 120ms ease;
}
.monti-block-tooltip[data-open] > .monti-block-tooltip-content {
	visibility: visible;
	opacity: 1;
}
.monti-block-tooltip-note {
	display: none;
	margin-left: 0.125rem;
	font-size: 0.7em;
	font-weight: 600;
	color: var(--monti-block-accent);
}
@media (hover: none), (pointer: coarse) {
	.monti-block-tooltip-note {
		display: inline;
	}
}
@media (prefers-reduced-motion: reduce) {
	.monti-block-tooltip-content {
		transition: none;
	}
}
`;
