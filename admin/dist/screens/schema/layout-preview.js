"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { SiteProvider, useSite, useTranslator } from "@monti-cms/core/client";
import { Component, useMemo, useRef, useState } from "react";
import { emptyFormOf } from "../entries/entry-form.js";
import { InspectorPanel } from "../entries/inspector-panel.js";
import { SchemaFields } from "../entries/schema-fields.js";
import { EntryFormProvider } from "../entries/use-field.js";
import { draftSiteOf } from "./draft-site.js";
import { schemaFieldsMessages } from "./fields.messages.js";
/** Catches what the real components throw for a draft that is only half made, so one bad moment does not take the settings page down. */
class PreviewBoundary extends Component {
    state = { failed: false };
    static getDerivedStateFromError() {
        return { failed: true };
    }
    componentDidUpdate(previous) {
        if (this.state.failed && previous.resetKey !== this.props.resetKey)
            this.setState({ failed: false });
    }
    render() {
        return this.state.failed ? this.props.fallback : this.props.children;
    }
}
const noop = () => { };
/**
 * The form of a collection with nothing in it: the real panel on a local form, so typing, picking and the conditional fields that follow work, and nothing is
 * kept or sent. Documents use the properties panel of the edit screen, items the fields of the record panel.
 */
function PreviewPanel({ collection, onClose }) {
    const site = useSite();
    const [form, setForm] = useState(() => emptyFormOf(site, collection));
    const value = useMemo(() => ({
        collection,
        form,
        setForm: (patch) => setForm((current) => ({ ...current, ...patch })),
    }), [collection, form]);
    return (_jsx(EntryFormProvider, { value: value, children: site.isItemCollection(collection) ? (_jsx("div", { className: "min-h-0 flex-1 overflow-y-auto px-4 py-4", "data-testid": "layout-preview-record", children: _jsx(SchemaFields, {}) })) : (_jsx(InspectorPanel, { incomingReferences: [], isLoadingIncomingReferences: false, onRefreshIncomingReferences: noop, onSlugChange: (slug) => value.setForm({ slug }), onRegenerateSlug: noop, onClose: onClose })) }));
}
/**
 * The properties panel of the edit screen for the schema being edited, running for real: the same components on a site made from the draft, so tabs, groups,
 * required marks, options, help texts and conditional fields are what the editor will show. It is interactive and keeps nothing: writes are refused and nothing
 * is saved. It follows the tree and the sheets as the draft changes.
 */
export function LayoutPreview({ file, collection, codeCollections, onClose, }) {
    const t = useTranslator(schemaFieldsMessages);
    const site = useSite();
    const made = useMemo(() => draftSiteOf(site, file, codeCollections), [site, file, codeCollections]);
    // While the draft cannot be made (a half-typed name), the last one that could stays.
    const lastGood = useRef(null);
    if (made)
        lastGood.current = made;
    const draft = made ?? lastGood.current;
    const problem = _jsx("p", { className: "px-4 py-4 text-cms-muted-foreground text-xs", children: t("layout.previewUnavailable") });
    return (_jsxs("div", { className: "flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-cms-background", "data-testid": "layout-preview", children: [_jsx("p", { className: "shrink-0 border-b bg-cms-muted/50 px-4 py-1.5 text-cms-muted-foreground text-xs", children: t("layout.previewLabel") }), draft?.isCollection(collection) ? (_jsx(SiteProvider, { site: draft, children: _jsx(PreviewBoundary, { fallback: problem, resetKey: draft, children: _jsx(PreviewPanel, { collection: collection, onClose: onClose }, collection) }) })) : (problem)] }));
}
