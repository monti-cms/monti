"use client";

import type { LayoutGroup } from "@monti-cms/core/client";
import { adminEntryEditHref, isCollection, localeLabel } from "@monti-cms/core/client";
import type { IncomingReferenceItem } from "@monti-cms/core/runtime";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import type { CmsIssue } from "../api-error-message";
import { SidePanelHeader } from "../shared/side-panel";
import { type EntryData, type EntryForm, type EntryFormPatch, formFromSourceMetadata } from "./entry-form";
import { DEFAULT_TAB, tabOf, tabOfGroup, tabsOf } from "./layout-groups";
import { SchemaFields } from "./schema-fields";
import { t } from "./translate";

const tabsFor = (collection: string) => (isCollection(collection) ? tabsOf(collection) : [DEFAULT_TAB]);
const tabFor = (collection: string, path: string) => (isCollection(collection) ? tabOf(collection, path) : DEFAULT_TAB);

interface InspectorPanelProps {
	collection: string;
	form: EntryForm;
	disabled: boolean;
	publishIssues?: CmsIssue[];
	entry: EntryData | null;
	incomingReferences: IncomingReferenceItem[];
	isLoadingIncomingReferences: boolean;
	onRefreshIncomingReferences: () => void;
	onSlugChange: (slug: string) => void;
	onRegenerateSlug: () => void;
	onChange: (patch: EntryFormPatch) => void;
	onClose: () => void;
	/** Moves focus to this field (jump to a publish problem). Calls `onFocused` once moved. */
	focusPath?: string | null;
	onFocused?: () => void;
}

/**
 * Properties panel on the right of the edit screen. Splits tabs by group/field `tab` and fixes the inner width so inputs
 * do not shift or overflow when it opens/closes or the window width changes.
 */
export function InspectorPanel({
	collection,
	form,
	disabled,
	publishIssues = [],
	entry,
	incomingReferences,
	isLoadingIncomingReferences,
	onRefreshIncomingReferences,
	onSlugChange,
	onRegenerateSlug,
	onChange,
	onClose,
	focusPath,
	onFocused,
}: InspectorPanelProps) {
	const [tab, setTab] = useState(DEFAULT_TAB);
	const tabs = useMemo(() => tabsFor(collection), [collection]);
	const issuesIn = (name: string) =>
		publishIssues.filter((issue) => issue.path && tabFor(collection, issue.path) === name).length;

	useEffect(() => {
		if (focusPath) setTab(tabFor(collection, focusPath));
	}, [focusPath, collection]);
	// Move focus after the tab changes and the input is rendered.
	// biome-ignore lint/correctness/useExhaustiveDependencies: tab change re-runs the lookup
	useEffect(() => {
		if (!focusPath) return;
		const control = document.getElementById(`cms-${focusPath}`);
		if (control) {
			control.focus();
			onFocused?.();
		}
	}, [focusPath, tab]);

	const fields = (include: (group: LayoutGroup) => boolean) =>
		isCollection(collection) && (
			<fieldset disabled={disabled} className="min-w-0 space-y-4 disabled:opacity-70">
				<SchemaFields
					collection={collection}
					form={form}
					issues={publishIssues}
					context={{
						entryId: entry?.id,
						locale: entry?.locale,
						groupId: entry?.translationGroupId,
						disabled,
						incomingReferences: incomingReferences,
						incomingReferencesLoading: isLoadingIncomingReferences,
						refreshIncomingReferences: onRefreshIncomingReferences,
						entry,
					}}
					omit={["title"]}
					showDescriptions={false}
					include={include}
					sections="plain"
					onChange={onChange}
					onSlugChange={onSlugChange}
					onRegenerateSlug={onRegenerateSlug}
					locked={
						entry?.source
							? {
									values: formFromSourceMetadata(collection, entry.source.metadata),
									note: (
										<>
											{t("inspector.source", { locale: localeLabel(entry.source.locale) })}{" "}
											<Link
												href={adminEntryEditHref(entry.source.id) as Route}
												className="text-cms-primary underline-offset-2 hover:underline"
											>
												{t("inspector.sourceLink")}
											</Link>
										</>
									),
								}
							: undefined
					}
				/>
			</fieldset>
		);

	return (
		<Tabs
			value={tab}
			onValueChange={(value) => setTab(String(value))}
			aria-label={t("tab.default")}
			className="h-full w-full gap-0 overflow-hidden border-l bg-cms-background text-sm"
		>
			<SidePanelHeader onClose={onClose}>
				<TabsList variant="line" className="h-full flex-1 justify-start gap-3">
					{tabs.map((name) => (
						<TabsTrigger key={name} value={name} className="flex-none px-0 text-xs">
							{name}
							{issuesIn(name) > 0 && <span aria-hidden className="size-1.5 rounded-full bg-cms-destructive" />}
						</TabsTrigger>
					))}
				</TabsList>
			</SidePanelHeader>

			<div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4">
				{tabs.map((name) => (
					<TabsContent key={name} value={name}>
						{fields((group) => tabOfGroup(group) === name)}
					</TabsContent>
				))}
			</div>
		</Tabs>
	);
}
