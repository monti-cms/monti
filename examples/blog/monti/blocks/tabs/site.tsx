import type { BlockProps } from "@monti-cms/core/render";
import { Children, type ReactNode } from "react";
import { TabsView } from "./tabs.client";

/** One tab: `Tabs` reads its name and draws its blocks as a panel, so on its own it is only its blocks. */
export function Tab({ children }: BlockProps & { children?: ReactNode }) {
	return <div className="monti-block-tabs-panel">{children}</div>;
}

/**
 * Tabs: the row of the tabs' names (`label`) and one panel per tab. The tab shown first is the one named by `defaultValue`, or the first. Every panel is
 * in the page's HTML (the hidden ones only hidden), so a reader without scripts, a search engine and a feed read them all; the switching is `TabsView`.
 */
export function Tabs({ block, attrs, children }: BlockProps & { children?: ReactNode }) {
	const panels = Children.toArray(children);
	const tabs = (block.children ?? []).flatMap((tab, index) =>
		tab.type === "tab"
			? [{ label: typeof tab.attrs?.label === "string" ? tab.attrs.label : "", panel: panels[index] }]
			: [],
	);
	if (tabs.length === 0) return <>{children}</>;
	const labels = tabs.map((tab) => tab.label);
	return (
		<TabsView
			labels={labels}
			panels={tabs.map((tab) => tab.panel)}
			defaultIndex={Math.max(0, labels.indexOf(typeof attrs.defaultValue === "string" ? attrs.defaultValue : ""))}
		/>
	);
}
