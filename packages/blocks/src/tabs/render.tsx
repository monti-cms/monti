import type { BlockProps, DocumentComponentsContext, LooseDocumentComponents } from "@monti-cms/core/render";
import { Children, isValidElement, type PropsWithChildren, type ReactElement } from "react";
import type { tabBlock, tabsBlock } from "./definition";
import { TabsView } from "./render.client";

type TabElement = ReactElement<PropsWithChildren<{ label: string }>>;

/** One tab. `Tabs` reads its name and body, so when used on its own only the body is rendered. */
export function Tab({ children }: PropsWithChildren<{ label?: string }>) {
	return <div className="cms-block-tabs-panel">{children}</div>;
}

/**
 * Tab group. Builds the tab row from the child `Tab` names (`label`) and each tab's panel from its body. The initially open tab (`defaultValue`) is a tab name,
 * or the first tab if it is absent or matches no tab. Switching is done by a client component (`TabsView`).
 */
export function Tabs({ defaultValue, children }: PropsWithChildren<{ defaultValue?: string }>) {
	const tabs = Children.toArray(children).filter(
		(child): child is TabElement =>
			isValidElement(child) && typeof (child.props as { label?: unknown }).label === "string",
	);
	if (tabs.length === 0) return <>{children}</>;
	const labels = tabs.map((tab) => tab.props.label);
	return (
		<TabsView
			labels={labels}
			panels={tabs.map((tab) => tab.props.children)}
			defaultIndex={Math.max(0, labels.indexOf(defaultValue ?? ""))}
		/>
	);
}

/**
 * Tab group of the JSON renderer. It reads the tabs from the block's `items` (the stored `tab` nodes and what each renders to), not from the props of
 * child elements: the tab names are the `label` attributes and each panel is the content of its tab.
 */
export function DocumentTabs({ defaultValue, items, children }: BlockProps<typeof tabsBlock>) {
	const tabs = items.filter((item) => item.node.type === "tab" && typeof item.node.attrs?.label === "string");
	if (tabs.length === 0) return <>{children}</>;
	const labels = tabs.map((tab) => String(tab.node.attrs?.label));
	return (
		<TabsView
			labels={labels}
			panels={tabs.map((tab) => tab.children)}
			defaultIndex={Math.max(0, labels.indexOf(defaultValue ?? ""))}
		/>
	);
}

/** Public components for tabs in the JSON renderer (`renderDocument`): the blocks `tabs` and `tab`. */
export const documentComponents = (_context: DocumentComponentsContext): LooseDocumentComponents => ({
	blocks: {
		tabs: DocumentTabs,
		tab: ({ children }: BlockProps<typeof tabBlock>) => <Tab>{children}</Tab>,
	},
});
