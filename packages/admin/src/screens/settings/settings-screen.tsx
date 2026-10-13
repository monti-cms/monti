"use client";

import { useSite, useTranslator } from "@monti-cms/core/client";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils/cn";
import { AdminLink as Link } from "../../router";
import { Badge } from "../../ui/badge";
import { EventsScreen } from "../events/events-screen";
import { SchemaSettings } from "../schema/schema-screen";
import { AdminShell, useAdminNav } from "../shared/admin-shell";
import { NamedIcon } from "../shared/collection-icon";
import { TemplateManager } from "../templates/template-manager";
import { settingsMessages } from "./messages";
import { isSchemaTab, settingsTabs } from "./tabs";

/**
 * The Settings page: one frame (sidebar entry, title) with a row of tabs, each its own address (`<admin path>/settings/<tab>`).
 * The tabs are the schema file editor (collections, locales, site, admin, file), the body templates, the event log and one per plugin page.
 * `children` is the plugin page of the active plugin tab, rendered by the server.
 */
export function SettingsScreen({ tab, children }: { tab: string; children?: ReactNode }) {
	const t = useTranslator(settingsMessages);
	return (
		<AdminShell title={t("title")} sidebar={{ activeNav: "settings" }}>
			<SettingsBody tab={tab}>{children}</SettingsBody>
		</AdminShell>
	);
}

/** Inside the shell, which provides the failed-delivery count the Event log tab shows. */
function SettingsBody({ tab, children }: { tab: string; children?: ReactNode }) {
	const site = useSite();
	const t = useTranslator(settingsMessages);
	const { eventsCount } = useAdminNav();
	const tabs = settingsTabs(site);
	const schemaActive = isSchemaTab(tab);
	// The schema editor holds an unsaved draft shared by its tabs. Once opened it stays mounted (hidden) while another tab shows, so moving between tabs loses nothing.
	const [schemaOpened, setSchemaOpened] = useState(schemaActive);
	useEffect(() => {
		if (schemaActive) setSchemaOpened(true);
	}, [schemaActive]);

	// On a narrow screen the tab bar scrolls sideways: keep the open tab in view.
	const activeLink = useRef<HTMLAnchorElement>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs when the open tab changes
	useEffect(() => {
		activeLink.current?.scrollIntoView?.({ inline: "center", block: "nearest" });
	}, [tab]);

	const label = (id: string, fallback?: string) => fallback ?? t(`tab.${id}` as "tab.collections");

	return (
		<>
			<nav
				aria-label={t("tabs.label")}
				className="flex h-10 shrink-0 items-stretch gap-1 overflow-x-auto border-b px-4 lg:px-5"
			>
				{tabs.map((entry) => {
					const active = entry.id === tab;
					return (
						<Link
							key={entry.id}
							ref={active ? activeLink : undefined}
							href={entry.href}
							aria-current={active ? "page" : undefined}
							className={cn(
								"-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-transparent border-b-2 px-2.5 font-medium text-cms-muted-foreground text-sm outline-hidden transition-colors hover:text-cms-foreground focus-visible:ring-2 focus-visible:ring-cms-ring/50 aria-[current=page]:border-cms-foreground aria-[current=page]:text-cms-foreground [&_svg]:size-4",
							)}
						>
							{entry.kind === "plugin" && <NamedIcon name={entry.icon} />}
							{label(entry.id, entry.label)}
							{entry.id === "events" && eventsCount ? (
								<Badge variant="destructive" aria-label={t("tab.eventsBadge", { count: eventsCount })}>
									{eventsCount}
								</Badge>
							) : null}
						</Link>
					);
				})}
			</nav>
			{(schemaActive || schemaOpened) && (
				<div className={cn("min-h-0 flex-1 flex-col", schemaActive ? "flex" : "hidden")}>
					<SchemaSettings tab={schemaActive ? tab : "collections"} />
				</div>
			)}
			{tab === "templates" && <TemplateManager />}
			{tab === "events" && <EventsScreen />}
			{!schemaActive && tab !== "templates" && tab !== "events" && children}
		</>
	);
}
