import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import { Children, isValidElement } from "react";
import { TabsView } from "./render.client.js";
/** One tab. `Tabs` reads its name and body, so when used on its own only the body is rendered. */
export function Tab({ children }) {
    return _jsx("div", { className: "cms-block-tabs-panel", children: children });
}
/**
 * Tab group. Builds the tab row from the child `Tab` names (`label`) and each tab's panel from its body. The initially open tab (`defaultValue`) is a tab name,
 * or the first tab if it is absent or matches no tab. Switching is done by a client component (`TabsView`).
 */
export function Tabs({ defaultValue, children }) {
    const tabs = Children.toArray(children).filter((child) => isValidElement(child) && typeof child.props.label === "string");
    if (tabs.length === 0)
        return _jsx(_Fragment, { children: children });
    const labels = tabs.map((tab) => tab.props.label);
    return (_jsx(TabsView, { labels: labels, panels: tabs.map((tab) => tab.props.children), defaultIndex: Math.max(0, labels.indexOf(defaultValue ?? "")) }));
}
/**
 * Tab group of the JSON renderer. It reads the tabs from the block's `items` (the stored `tab` nodes and what each renders to), not from the props of
 * child elements: the tab names are the `label` attributes and each panel is the content of its tab.
 */
export function DocumentTabs({ defaultValue, items, children }) {
    const tabs = items.filter((item) => item.node.type === "tab" && typeof item.node.attrs?.label === "string");
    if (tabs.length === 0)
        return _jsx(_Fragment, { children: children });
    const labels = tabs.map((tab) => String(tab.node.attrs?.label));
    return (_jsx(TabsView, { labels: labels, panels: tabs.map((tab) => tab.children), defaultIndex: Math.max(0, labels.indexOf(defaultValue ?? "")) }));
}
/** Public components for tabs in the JSON renderer (`renderDocument`): the blocks `tabs` and `tab`. */
export const documentComponents = (_context) => ({
    blocks: {
        tabs: DocumentTabs,
        tab: ({ children }) => _jsx(Tab, { children: children }),
    },
});
