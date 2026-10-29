"use client";

import type { IncomingReferenceItem } from "@monti-cms/core/site";
import { DEFAULT_TAB, type Site, useSite, useTranslator } from "@monti-cms/core/site";
import { FormFieldSet, PropertyPanel } from "@monti-cms/ui";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { tabLabel } from "./layout-groups";
import { entriesMessages } from "./messages";
import { PropertyFields } from "./property-fields";
import { RemovedFieldsNotice } from "./removed-fields-notice";
import { useEntryFormSelector } from "./use-field";

const tabsFor = (site: Site, collection: string) =>
	site.isCollection(collection) ? site.panelTabsOf(collection) : [DEFAULT_TAB];
const tabFor = (site: Site, collection: string, path: string) =>
	site.isCollection(collection) ? site.panelTabOf(collection, path) : DEFAULT_TAB;

interface InspectorPanelProps {
	incomingReferences: IncomingReferenceItem[];
	isLoadingIncomingReferences: boolean;
	onRefreshIncomingReferences: () => void;
	onSlugChange: (slug: string) => void;
	onRegenerateSlug: () => void;
	/** Opens this field for editing (jump to a publish problem). Calls `onFocused` once opened. */
	focusPath?: string | null;
	onFocused?: () => void;
	/** A head above the tab bar, for a pane that is not the editor's own (the preview in the settings). */
	title?: ReactNode;
	/** The pane's name, when it is not the editor's own. */
	label?: string;
	/** The head's ×, for a pane that can be closed (the preview in the settings). */
	onClose?: () => void;
}

/**
 * Properties pane on the right of the edit screen: the 300px pane the editor board draws, a tab bar at the top (the tabs of the group/field `tab`) with no head
 * and no close button, and under it the read list of the picked tab. A value opens for editing where it is.
 *
 * Reads the collection, issues, entry and disabled state from the `EntryFormProvider` above it (the entry editor provides one).
 */
export function InspectorPanel({
	incomingReferences,
	isLoadingIncomingReferences,
	onRefreshIncomingReferences,
	onSlugChange,
	onRegenerateSlug,
	focusPath,
	onFocused,
	title,
	label,
	onClose,
}: InspectorPanelProps) {
	const t = useTranslator(entriesMessages);
	const site = useSite();
	const collection = useEntryFormSelector((state) => state.collection);
	const disabled = useEntryFormSelector((state) => state.disabled);
	const publishIssues = useEntryFormSelector((state) => state.issues);
	const entry = useEntryFormSelector((state) => state.entry);
	const [tab, setTab] = useState(DEFAULT_TAB);
	const tabs = useMemo(() => tabsFor(site, collection), [collection, site]);
	const issuesIn = (name: string) =>
		publishIssues.filter((issue) => issue.path && tabFor(site, collection, issue.path) === name).length;

	// The tab of the field the page wants to bring up opens first; the field then opens in it.
	useEffect(() => {
		if (focusPath) setTab(tabFor(site, collection, focusPath));
	}, [focusPath, collection, site]);

	const references = useMemo(
		() => ({ items: incomingReferences, loading: isLoadingIncomingReferences, refresh: onRefreshIncomingReferences }),
		[incomingReferences, isLoadingIncomingReferences, onRefreshIncomingReferences],
	);

	return (
		<PropertyPanel
			title={title}
			label={label ?? t("panel.label")}
			onClose={onClose}
			value={tab}
			onValueChange={setTab}
			tabs={tabs.map((name) => ({
				value: name,
				label: tabLabel(site, name, collection),
				dot: issuesIn(name) > 0 ? ("warning" as const) : undefined,
			}))}
		>
			{site.isCollection(collection) && (
				<FormFieldSet density="flush" disabled={disabled}>
					<RemovedFieldsNotice collection={collection} metadata={entry?.working.metadata} />
					<PropertyFields
						include={(group) => group.tab === tab}
						references={references}
						onSlugChange={onSlugChange}
						onRegenerateSlug={onRegenerateSlug}
						focusPath={focusPath && tabFor(site, collection, focusPath) === tab ? focusPath : null}
						onFocused={onFocused}
					/>
				</FormFieldSet>
			)}
		</PropertyPanel>
	);
}
