import { Children, isValidElement, type PropsWithChildren, type ReactElement } from "react";
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

/** Public component for tabs (called by `@monti-cms/core/render`). */
export default () => ({ Tabs, Tab });
