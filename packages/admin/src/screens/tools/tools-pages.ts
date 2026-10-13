import type { Site } from "@monti-cms/core/client";

/** A plugin's page in the Tools group of the sidebar (`nav` item of the plugin definition). */
export interface ToolsPage {
	/** Single-segment address: `<admin path>/tools/<path>`. */
	readonly path: string;
	readonly href: string;
	readonly label: string;
	/** Icon name (lucide). */
	readonly icon?: string;
}

/** The Tools pages of a site's plugins, in plugin order. */
export function toolsPages(site: Pick<Site, "adminHref" | "plugins" | "createTranslator">): readonly ToolsPage[] {
	return site.plugins.flatMap((entry) =>
		(entry.nav ?? []).map(
			(item): ToolsPage => ({
				path: item.path.replace(/^\/+|\/+$/g, ""),
				href: site.adminHref(`/tools/${item.path.replace(/^\/+|\/+$/g, "")}`),
				label: typeof item.label === "function" ? item.label(site) : item.label,
				icon: item.icon,
			}),
		),
	);
}
