"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { useSite } from "@monti-cms/core/site";
import { useMemo } from "react";
import { AdminComponentsProvider } from "../admin-components.js";
import { AdminEventsProvider } from "../events.js";
import { SlotRegistryProvider } from "../slots/registry.js";
/** Applies one plugin's declaration around the admin: its `Provider` outside, then its `components`, its `on` and its `slots`. */
function PluginLayer({ plugin, children }) {
    const site = useSite();
    const { components, slots, Provider, on } = plugin;
    const resolved = useMemo(() => (typeof components === "function" ? components(site) : components), [components, site]);
    const events = useMemo(() => (typeof on === "function" ? on(site) : on), [on, site]);
    let inner = children;
    if (slots && slots.length > 0)
        inner = _jsx(SlotRegistryProvider, { sources: slots, children: inner });
    if (events)
        inner = _jsx(AdminEventsProvider, { on: events, children: inner });
    if (resolved)
        inner = _jsx(AdminComponentsProvider, { components: resolved, children: inner });
    return Provider ? _jsx(Provider, { children: inner }) : inner;
}
/**
 * The plugins' admin sides around the admin UI, in registration order (the first plugin outermost, so a later one's registration of the same name wins).
 * The host renders it on the server and the declarations are applied in the browser.
 */
export function AdminPluginScope({ plugins, children, }) {
    return plugins.reduceRight((inner, { name, plugin }) => plugin ? (_jsx(PluginLayer, { plugin: plugin, children: inner }, name)) : (inner), children);
}
