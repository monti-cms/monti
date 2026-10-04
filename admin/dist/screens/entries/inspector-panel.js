"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { adminEntryEditHref, isCollection, localeLabel } from "@monti-cms/core/client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs.js";
import { SidePanelHeader } from "../shared/side-panel.js";
import { formFromSourceMetadata } from "./entry-form.js";
import { DEFAULT_TAB, tabOf, tabOfGroup, tabsOf } from "./layout-groups.js";
import { SchemaFields } from "./schema-fields.js";
import { t } from "./translate.js";
const tabsFor = (collection) => (isCollection(collection) ? tabsOf(collection) : [DEFAULT_TAB]);
const tabFor = (collection, path) => (isCollection(collection) ? tabOf(collection, path) : DEFAULT_TAB);
/**
 * Properties panel on the right of the edit screen. Splits tabs by group/field `tab` and fixes the inner width so inputs
 * do not shift or overflow when it opens/closes or the window width changes.
 */
export function InspectorPanel({ collection, form, disabled, publishIssues = [], entry, incomingReferences, isLoadingIncomingReferences, onRefreshIncomingReferences, onSlugChange, onRegenerateSlug, onChange, onClose, focusPath, onFocused, }) {
    const [tab, setTab] = useState(DEFAULT_TAB);
    const tabs = useMemo(() => tabsFor(collection), [collection]);
    const issuesIn = (name) => publishIssues.filter((issue) => issue.path && tabFor(collection, issue.path) === name).length;
    useEffect(() => {
        if (focusPath)
            setTab(tabFor(collection, focusPath));
    }, [focusPath, collection]);
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
    const fields = (include) => isCollection(collection) && (_jsx("fieldset", { disabled: disabled, className: "min-w-0 space-y-4 disabled:opacity-70", children: _jsx(SchemaFields, { collection: collection, form: form, issues: publishIssues, context: {
                entryId: entry?.id,
                locale: entry?.locale,
                groupId: entry?.translationGroupId,
                disabled,
                incomingReferences: incomingReferences,
                incomingReferencesLoading: isLoadingIncomingReferences,
                refreshIncomingReferences: onRefreshIncomingReferences,
                entry,
            }, omit: ["title"], showDescriptions: false, include: include, sections: "plain", onChange: onChange, onSlugChange: onSlugChange, onRegenerateSlug: onRegenerateSlug, locked: entry?.source
                ? {
                    values: formFromSourceMetadata(collection, entry.source.metadata),
                    note: (_jsxs(_Fragment, { children: [t("inspector.source", { locale: localeLabel(entry.source.locale) }), " ", _jsx(Link, { href: adminEntryEditHref(entry.source.id), className: "text-cms-primary underline-offset-2 hover:underline", children: t("inspector.sourceLink") })] })),
                }
                : undefined }) }));
    return (_jsxs(Tabs, { value: tab, onValueChange: (value) => setTab(String(value)), "aria-label": t("tab.default"), className: "h-full w-full gap-0 overflow-hidden border-l bg-cms-background text-sm", children: [_jsx(SidePanelHeader, { onClose: onClose, children: _jsx(TabsList, { variant: "line", className: "h-full flex-1 justify-start gap-3", children: tabs.map((name) => (_jsxs(TabsTrigger, { value: name, className: "flex-none px-0 text-xs", children: [name, issuesIn(name) > 0 && _jsx("span", { "aria-hidden": true, className: "size-1.5 rounded-full bg-cms-destructive" })] }, name))) }) }), _jsx("div", { className: "min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4", children: tabs.map((name) => (_jsx(TabsContent, { value: name, children: fields((group) => tabOfGroup(group) === name) }, name))) })] }));
}
