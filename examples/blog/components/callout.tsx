import type { calloutBlock } from "@monti-cms/blocks";
import type { BlockProps } from "@monti-cms/core/render";
import type { CSSProperties, ReactNode } from "react";

const ACCENT: Record<string, string> = {
	note: "#6b7280",
	tip: "#16a34a",
	info: "#2563eb",
	warning: "#d97706",
	danger: "#dc2626",
};

/**
 * The site's own callout. It has no hooks and no server code, so the public page (a server component) and the admin editor (a client component) both import it.
 * Plain inline styles on purpose: the admin does not load the site's Tailwind, so this looks the same on both sides.
 * `title` is a node, so the editor can hand it an input; the public page hands it text.
 */
export function SiteCallout({
	variant,
	title,
	children,
}: {
	variant?: string;
	title?: ReactNode;
	children?: ReactNode;
}) {
	const kind = variant && variant in ACCENT ? variant : "note";
	const accent = ACCENT[kind];
	const box: CSSProperties = {
		margin: "1.5rem 0",
		padding: "0.75rem 1rem",
		borderLeft: `6px solid ${accent}`,
		borderRadius: "0 0.5rem 0.5rem 0",
		background: `color-mix(in srgb, ${accent} 12%, transparent)`,
	};
	return (
		<aside data-site-callout={kind} style={box}>
			<strong style={{ display: "block", color: accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>
				{title || kind}
			</strong>
			{children}
		</aside>
	);
}

/** The public form: `<CmsContent components={{ blocks: { callout: PublicSiteCallout } }} />`. The props are typed by the block's definition. */
export function PublicSiteCallout({ variant, title, children }: BlockProps<typeof calloutBlock>) {
	return (
		<SiteCallout variant={variant} title={title}>
			{children}
		</SiteCallout>
	);
}
