"use client";

import { type Site, useTranslator } from "@monti-cms/core/site";
import { Tabs, TabsList, TabsTrigger } from "@monti-cms/ui";
import { useEffect, useRef } from "react";
import { AdminLink as Link } from "../../router";
import { settingsMessages } from "./messages";
import { type SchemaTab, settingsTabs } from "./tabs";

/** The row of tabs under the Settings header. A tab changes the address in place when `onSchemaTab` is given, so the schema screen keeps its draft. */
export function SettingsTabBar({
	site,
	active,
	onSchemaTab,
	changed,
}: {
	site: Pick<Site, "adminHref">;
	active: SchemaTab;
	onSchemaTab?: (tab: SchemaTab) => void;
	/** The tabs that hold draft changes: each gets a dot. */
	changed?: Readonly<Record<SchemaTab, boolean>>;
}) {
	const t = useTranslator(settingsMessages);
	const tabs = settingsTabs(site);
	// On a narrow screen the tab bar scrolls sideways: keep the open tab in view.
	const activeLink = useRef<HTMLAnchorElement>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs when the open tab changes
	useEffect(() => {
		activeLink.current?.scrollIntoView?.({ inline: "center", block: "nearest" });
	}, [active]);

	return (
		<Tabs value={active}>
			<TabsList variant="bar" aria-label={t("tabs.label")}>
				{tabs.map((entry) => (
					<TabsTrigger
						key={entry.id}
						value={entry.id}
						dot={changed?.[entry.id] ? "warning" : undefined}
						dotLabel={t("changed")}
						nativeButton={false}
						render={
							<Link
								href={entry.href}
								// Moving between schema tabs is not a way out of the unsaved draft.
								data-unsaved-guard={onSchemaTab ? "off" : undefined}
								onClick={(event) => {
									if (!onSchemaTab) return;
									// A click that opens a new tab or window goes the way of a link.
									if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
									event.preventDefault();
									onSchemaTab(entry.id);
								}}
								ref={entry.id === active ? activeLink : undefined}
							/>
						}
					>
						{t(`tab.${entry.id}` as "tab.collections")}
					</TabsTrigger>
				))}
			</TabsList>
		</Tabs>
	);
}
