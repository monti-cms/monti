import type { Site } from "@monti-cms/core/site";
import { toolsMessages } from "./messages";

/** A built-in page of the tools page. */
export type BuiltInToolsId = "templates" | "data" | "events" | "api-keys";

/** The address segments of the built-in pages, in tab order. A plugin page cannot take one of them. */
export const BUILT_IN_TOOLS: readonly BuiltInToolsId[] = ["templates", "data", "events", "api-keys"];

/** What the rail marks as the current place: a built-in page by its segment, a plugin page as `tools:<path>`. */
export type ToolsId = BuiltInToolsId | `tools:${string}`;

/** One tab of the tools page. */
export interface ToolsTab {
	readonly id: ToolsId;
	/** The one address segment after `<admin path>/tools/`. */
	readonly path: string;
	readonly href: string;
	readonly label: string;
	/** The plugin whose `nav` item this is, and whose admin side draws the page (`pages[path]`). Built-in tabs have none. */
	readonly plugin?: string;
}

type SiteForTools = Pick<Site, "adminHref" | "plugins" | "createTranslator" | "ADMIN_TEMPLATES">;

/**
 * The tabs of the tools page, in order: templates (unless the site turns them off), data, the activity log and API keys, then a tab for each plugin
 * `nav` item in plugin order.
 */
export function toolsTabs(site: SiteForTools): readonly ToolsTab[] {
	const t = site.createTranslator(toolsMessages);
	const href = (path: string) => site.adminHref(`/tools/${path}`);
	const builtIn: ToolsTab[] = [
		{ id: "templates", path: "templates", href: href("templates"), label: t("tab.templates") },
		{ id: "data", path: "data", href: href("data"), label: t("tab.data") },
		{ id: "events", path: "events", href: href("events"), label: t("tab.events") },
		{ id: "api-keys", path: "api-keys", href: href("api-keys"), label: t("tab.apiKeys") },
	];
	const plugins = site.plugins.flatMap((entry) =>
		(entry.nav ?? []).flatMap((item): ToolsTab[] => {
			const path = item.path.replace(/^\/+|\/+$/g, "");
			if ((BUILT_IN_TOOLS as readonly string[]).includes(path)) return [];
			return [
				{
					id: `tools:${path}`,
					path,
					href: href(path),
					label: typeof item.label === "function" ? item.label(site as Site) : item.label,
					plugin: entry.name,
				},
			];
		}),
	);
	return [...builtIn.filter((tab) => tab.id !== "templates" || site.ADMIN_TEMPLATES), ...plugins];
}

/** The address of the tools page: its first tab. */
export const toolsHref = (site: SiteForTools): string => toolsTabs(site)[0]?.href ?? site.adminHref("/tools/data");

/** Whether a sidebar nav id is a page of the tools page. */
export const isToolsNav = (nav: string): nav is ToolsId =>
	(BUILT_IN_TOOLS as readonly string[]).includes(nav) || nav.startsWith("tools:");
