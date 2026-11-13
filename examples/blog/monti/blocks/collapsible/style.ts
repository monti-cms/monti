/** The collapsible block's look, as CSS its site component loads with React's `<style href precedence>`: the site's own, change it here (doc 18). */
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

/* The collapsible's look. The site's own: change it as the site likes (doc 18). */
.monti-block-collapsible {
	margin: 1.5rem 0;
	border: 1px solid var(--monti-block-border);
	border-radius: 0.375rem;
}
.monti-block-collapsible-summary {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.5rem 0.75rem;
	border-radius: 0.375rem;
	font-size: 0.875rem;
	font-weight: 500;
	cursor: pointer;
	list-style: none;
}
.monti-block-collapsible-summary::-webkit-details-marker {
	display: none;
}
.monti-block-collapsible-summary::before {
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
.monti-block-collapsible[open] > .monti-block-collapsible-summary {
	background-color: var(--monti-block-muted);
}
.monti-block-collapsible[open] > .monti-block-collapsible-summary::before {
	transform: rotate(135deg);
}
.monti-block-collapsible-summary:hover {
	background-color: var(--monti-block-muted);
}
.monti-block-collapsible-summary:focus-visible {
	outline: 2px solid var(--monti-block-accent);
	outline-offset: -2px;
}
.monti-block-collapsible-body {
	padding: 0.5rem 0.75rem 0.75rem;
}
.monti-block-collapsible-body > :first-child {
	margin-top: 0;
}
.monti-block-collapsible-body > :last-child {
	margin-bottom: 0;
}
@media (prefers-reduced-motion: reduce) {
	.monti-block-collapsible-summary::before {
		transition: none;
	}
}
`;
