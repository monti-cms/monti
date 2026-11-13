import type { PluginRow } from "@monti-cms/core";
import { PageBody, PageColumn, PageHeader, PageToolbar, TabLink, TabLinks } from "@monti-cms/ui";
import type { ReactNode } from "react";
import { useAdmin } from "../../operations/admin-context";
import { useRead } from "../../operations/use-operation";
import { linkTo, type Route } from "../../route";
import { useFocusHandOff } from "../frame/focus-hand-off";

/** A plugin's tool page: which plugin, and the page's id there. */
export type ToolPageRef = { plugin: string; id: string };

/**
 * The tool pages the plugins add (doc 14, `toolPages`), each with its name: only the ones whose screen the plugin's browser half brings. A
 * page with no screen would be an empty tab.
 */
function usePluginPages(): (ToolPageRef & { label: string })[] {
	const { toolPages } = useAdmin();
	const plugins = useRead<{ plugins: PluginRow[] }>("plugins.list", {}, { skip: toolPages.size === 0 });
	return (plugins.data?.plugins ?? []).flatMap((plugin) =>
		plugin.toolPages
			.filter((page) => toolPages.has(`${plugin.name}/${page.id}`))
			.map((page) => ({ plugin: plugin.name, id: page.id, label: page.label })),
	);
}

/**
 * The tools' tab row (tools.md, the tools frame): one tab is one page, and each is a link with its own address. The templates (unless they
 * are turned off), the keys, then the plugins' pages. With one tab there is no row.
 *
 * A tab pressed with the keyboard opens another page, which draws this row anew: the focus the pressed tab held goes to the same tab in the
 * new row, now the open one, as on a page whose tab row stays (settings). Decided while building, 2026-11-13.
 */
export function ToolsTabs({
	current,
	go,
}: {
	current: "templates" | "data" | "keys" | ToolPageRef;
	go: (route: Route) => void;
}) {
	const { t, templates } = useAdmin();
	const pages = usePluginPages();
	const handOff = useFocusHandOff(
		() => () =>
			// A frame on: the page that takes this one's place draws its row with it.
			requestAnimationFrame(() => {
				if (document.activeElement !== document.body) return;
				document.querySelector<HTMLElement>('[data-slot=tab-links] [aria-current="page"]')?.focus();
			}),
	);
	return (
		<PageToolbar inset>
			<TabLinks ref={handOff} variant="toolbar">
				{templates ? (
					<TabLink current={current === "templates"} {...linkTo({ screen: "place", place: "tools" }, go)}>
						{t("tools.templates")}
					</TabLink>
				) : null}
				<TabLink current={current === "data"} {...linkTo({ screen: "place", place: "tools", tab: "data" }, go)}>
					{t("tools.data")}
				</TabLink>
				<TabLink current={current === "keys"} {...linkTo({ screen: "place", place: "tools", tab: "keys" }, go)}>
					{t("tools.keys")}
				</TabLink>
				{pages.map((page) => (
					<TabLink
						key={`${page.plugin}/${page.id}`}
						current={typeof current === "object" && current.plugin === page.plugin && current.id === page.id}
						{...linkTo({ screen: "place", place: "tools", page: { plugin: page.plugin, id: page.id } }, go)}
					>
						{page.label}
					</TabLink>
				))}
			</TabLinks>
		</PageToolbar>
	);
}

/** A plugin's tool page inside the tools' frame: the tools' title and tabs, and under them the screen the plugin's browser half brings. */
export function ToolPageScreen({ page, tabs }: { page: ToolPageRef; tabs: ReactNode }) {
	const { t, toolPages } = useAdmin();
	const Screen = toolPages.get(`${page.plugin}/${page.id}`);
	return (
		<PageColumn width="content">
			<PageHeader title={t("tools.title")} />
			{tabs}
			<PageBody>{Screen ? <Screen /> : null}</PageBody>
		</PageColumn>
	);
}
