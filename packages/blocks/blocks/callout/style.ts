/** The callout block's look, as CSS its site component loads with React's `<style href precedence>`: the site's own, change it here (doc 18). */
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
 * The callout's look. The site's own: change it as the site likes (doc 18). Its kind shows in the bar down its left side and in the icon before its
 * title (never by colour alone); the title, the body and the box are the page's own text colour and size.
 */
.monti-block-callout {
	--monti-block-callout-accent: var(--monti-callout-note);
	margin: 1.5rem 0;
	padding: 0.75rem 1rem;
	border-left: 4px solid var(--monti-block-callout-accent);
	background-color: color-mix(in oklab, var(--monti-block-callout-accent) 10%, transparent);
}
.monti-block-callout[data-tone="note"] {
	--monti-block-callout-accent: var(--monti-callout-note);
	--monti-block-callout-icon: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='currentColor'%20stroke-width='2'%20stroke-linecap='round'%20stroke-linejoin='round'%3E%3Cpath%20d='M6%203h9l4%204v14H6z'/%3E%3Cpath%20d='M9%2012h7M9%2016h7'/%3E%3C/svg%3E");
}
.monti-block-callout[data-tone="tip"] {
	--monti-block-callout-accent: var(--monti-callout-tip);
	--monti-block-callout-icon: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='currentColor'%20stroke-width='2'%20stroke-linecap='round'%20stroke-linejoin='round'%3E%3Cpath%20d='M9%2018h6M10%2021h4'/%3E%3Cpath%20d='M12%203a6%206%200%200%200-4%2010.5c.7.7%201%201.5%201%202.5h6c0-1%20.3-1.8%201-2.5A6%206%200%200%200%2012%203z'/%3E%3C/svg%3E");
}
.monti-block-callout[data-tone="info"] {
	--monti-block-callout-accent: var(--monti-callout-info);
	--monti-block-callout-icon: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='currentColor'%20stroke-width='2'%20stroke-linecap='round'%20stroke-linejoin='round'%3E%3Ccircle%20cx='12'%20cy='12'%20r='9'/%3E%3Cpath%20d='M12%2011v6M12%207.5v.01'/%3E%3C/svg%3E");
}
.monti-block-callout[data-tone="warning"] {
	--monti-block-callout-accent: var(--monti-callout-warning);
	--monti-block-callout-icon: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='currentColor'%20stroke-width='2'%20stroke-linecap='round'%20stroke-linejoin='round'%3E%3Cpath%20d='M12%203l10%2018H2z'/%3E%3Cpath%20d='M12%2010v5M12%2018v.01'/%3E%3C/svg%3E");
}
.monti-block-callout[data-tone="danger"] {
	--monti-block-callout-accent: var(--monti-callout-danger);
	--monti-block-callout-icon: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='currentColor'%20stroke-width='2'%20stroke-linecap='round'%20stroke-linejoin='round'%3E%3Ccircle%20cx='12'%20cy='12'%20r='9'/%3E%3Cpath%20d='M9%209l6%206M15%209l-6%206'/%3E%3C/svg%3E");
}
.monti-block-callout-title {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	font-weight: 600;
	color: inherit;
}
.monti-block-callout-title::before {
	content: "";
	flex: none;
	width: 1.125em;
	height: 1.125em;
	background-color: var(--monti-block-callout-accent);
	mask: var(--monti-block-callout-icon) center / contain no-repeat;
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
/* In the editor the blocks sit one level deeper (the editor's content holder): the first and the last have no space outside the box either. */
.monti-block-callout-body [data-node-view-content-react] > :first-child {
	margin-top: 0;
}
.monti-block-callout-body [data-node-view-content-react] > :last-child {
	margin-bottom: 0;
}
/* A code box inside is the callout's ground with no frame of its own: one box, not boxes in boxes. */
.monti-block-callout-body figure[data-code] {
	border-color: transparent;
	background-color: var(--monti-block-muted);
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
`;
