"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId, useRef, useState } from "react";
/**
 * The switching part of the tab group. Renders the tab name row (`tablist`) and each tab's body (`tabpanel`). The server renders and passes the bodies, so here
 * only the visible tab is switched (the rest are `hidden`). Arrow keys, Home and End move between tabs, and only the selected tab is reachable with the Tab key.
 */
export function TabsView({ labels, panels, defaultIndex = 0, }) {
    const id = useId();
    const [active, setActive] = useState(defaultIndex);
    const buttons = useRef([]);
    const select = (index) => {
        const next = (index + labels.length) % labels.length;
        setActive(next);
        buttons.current[next]?.focus();
    };
    const onKeyDown = (event, index) => {
        const target = {
            ArrowRight: index + 1,
            ArrowDown: index + 1,
            ArrowLeft: index - 1,
            ArrowUp: index - 1,
            Home: 0,
            End: labels.length - 1,
        }[event.key];
        if (target === undefined)
            return;
        event.preventDefault();
        select(target);
    };
    return (_jsxs("div", { className: "cms-block-tabs", children: [_jsx("div", { className: "cms-block-tabs-list", role: "tablist", "aria-orientation": "horizontal", children: labels.map((label, index) => (_jsx("button", { ref: (element) => {
                        buttons.current[index] = element;
                    }, type: "button", role: "tab", id: `${id}-tab-${index}`, className: "cms-block-tabs-tab", "aria-selected": index === active, "aria-controls": `${id}-panel-${index}`, tabIndex: index === active ? 0 : -1, onClick: () => setActive(index), onKeyDown: (event) => onKeyDown(event, index), children: label }, index))) }), panels.map((panel, index) => (_jsx("div", { role: "tabpanel", id: `${id}-panel-${index}`, className: "cms-block-tabs-panel", "aria-labelledby": `${id}-tab-${index}`, hidden: index !== active, children: panel }, index)))] }));
}
