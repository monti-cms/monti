"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs.js";
import { SidePanelHeader } from "../shared/side-panel.js";
import { defaultTab, tabOf, tabOfGroup, tabsOf } from "./layout-groups.js";
import { entriesMessages } from "./messages.js";
import { RemovedFieldsNotice } from "./removed-fields-notice.js";
import { SchemaFields } from "./schema-fields.js";
import { useEntryFormSelector } from "./use-field.js";
const tabsFor = (site, collection) => site.isCollection(collection) ? tabsOf(site, collection) : [defaultTab(site)];
const tabFor = (site, collection, path) => site.isCollection(collection) ? tabOf(site, collection, path) : defaultTab(site);
/**
 * Properties panel on the right of the edit screen. Splits tabs by group/field `tab` and fixes the inner width so inputs
 * do not shift or overflow when it opens/closes or the window width changes.
 *
 * Reads the collection, issues, entry and disabled state from the `EntryFormProvider` above it (the entry editor provides one).
 */
export function InspectorPanel({ incomingReferences, isLoadingIncomingReferences, onRefreshIncomingReferences, onSlugChange, onRegenerateSlug, onClose, focusPath, onFocused, }) {
    const t = useTranslator(entriesMessages);
    const site = useSite();
    const collection = useEntryFormSelector((state) => state.collection);
    const disabled = useEntryFormSelector((state) => state.disabled);
    const publishIssues = useEntryFormSelector((state) => state.issues);
    const entry = useEntryFormSelector((state) => state.entry);
    const [tab, setTab] = useState(defaultTab(site));
    const tabs = useMemo(() => tabsFor(site, collection), [collection, site]);
    const issuesIn = (name) => publishIssues.filter((issue) => issue.path && tabFor(site, collection, issue.path) === name).length;
    useEffect(() => {
        if (focusPath)
            setTab(tabFor(site, collection, focusPath));
    }, [focusPath, collection, site]);
    // Move focus after the tab changes and the input is rendered.
    // biome-ignore lint/correctness/useExhaustiveDependencies: tab change re-runs the lookup
    useEffect(() => {
        if (!focusPath)
            return;
        const control = document.getElementById(`cms-${focusPath}`);
        if (control) {
            control.focus();
            onFocused?.();
        }
    }, [focusPath, tab]);
    const references = useMemo(() => ({ items: incomingReferences, loading: isLoadingIncomingReferences, refresh: onRefreshIncomingReferences }), [incomingReferences, isLoadingIncomingReferences, onRefreshIncomingReferences]);
    const fields = (include) => site.isCollection(collection) && (_jsx("fieldset", { disabled: disabled, className: "min-w-0 space-y-4 disabled:opacity-70", children: _jsx(SchemaFields, { omit: [site.titleField(collection).name], showDescriptions: false, include: include, sections: "plain", references: references, onSlugChange: onSlugChange, onRegenerateSlug: onRegenerateSlug }) }));
    return (_jsxs(Tabs, { value: tab, onValueChange: (value) => setTab(String(value)), "aria-label": t("tab.default"), className: "h-full w-full gap-0 overflow-hidden border-l bg-cms-background text-sm", children: [_jsx(SidePanelHeader, { onClose: onClose, children: _jsx(TabsList, { variant: "line", className: "h-full flex-1 justify-start gap-3", children: tabs.map((name) => (_jsxs(TabsTrigger, { value: name, className: "flex-none px-0 text-xs", children: [name, issuesIn(name) > 0 && _jsx("span", { "aria-hidden": true, className: "size-1.5 rounded-full bg-cms-destructive" })] }, name))) }) }), _jsxs("div", { className: "min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4", children: [_jsx(RemovedFieldsNotice, { collection: collection, metadata: entry?.working.metadata }), tabs.map((name) => (_jsx(TabsContent, { value: name, children: fields((group) => tabOfGroup(site, group) === name) }, name)))] })] }));
}
