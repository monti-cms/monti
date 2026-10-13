"use client";

import { useSite, useTranslator } from "@monti-cms/core/client";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils/cn";
import { AdminLink as Link } from "../../router";
import { SidebarTrigger } from "../../ui/sidebar";
import { SchemaSettings } from "../schema/schema-screen";
import { AdminShell } from "../shared/admin-shell";
import { sharedMessages } from "../shared/messages";
import { settingsMessages } from "./messages";
import { type SettingsTabId, settingsTabs } from "./tabs";

/**
 * The Settings page: its own header (title, one line about where it is saved, the pending changes and the review button) over a row of tabs, each its own address
 * (`<admin path>/settings/<tab>`). The tabs are the schema file editor's: site, languages, collections, file and admin. They share one draft.
 */
export function SettingsScreen({ tab }: { tab: SettingsTabId }) {
	const t = useTranslator(settingsMessages);
	return (
		<AdminShell title={t("title")} sidebar={{ activeNav: "settings" }} bare>
			<SettingsBody tab={tab} />
		</AdminShell>
	);
}

function SettingsBody({ tab }: { tab: SettingsTabId }) {
	const site = useSite();
	const t = useTranslator(settingsMessages);
	const shared = useTranslator(sharedMessages);
	const tabs = settingsTabs(site);
	// The editor puts its pending-changes line and review button here.
	const [actions, setActions] = useState<HTMLElement | null>(null);
	// On a narrow screen the tab bar scrolls sideways: keep the open tab in view.
	const activeLink = useRef<HTMLAnchorElement>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs when the open tab changes
	useEffect(() => {
		activeLink.current?.scrollIntoView?.({ inline: "center", block: "nearest" });
	}, [tab]);

	return (
		<>
			<header className="shrink-0 border-b bg-cms-background px-4 pt-5 lg:px-10 lg:pt-6">
				<div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
					<div className="min-w-0">
						<div className="flex items-center gap-2">
							<SidebarTrigger
								aria-label={shared("shell.openSidebar")}
								className="-ml-1 text-cms-muted-foreground md:hidden"
							/>
							<h1 className="font-semibold text-[22px] leading-tight tracking-tight">{t("title")}</h1>
						</div>
						<p className="mt-1 text-cms-muted-foreground text-sm">{t("description")}</p>
					</div>
					<div ref={setActions} className="flex items-center gap-2.5" data-testid="settings-actions" />
				</div>
				<nav aria-label={t("tabs.label")} className="mt-4 -mb-px flex items-stretch gap-6 overflow-x-auto">
					{tabs.map((entry) => {
						const active = entry.id === tab;
						return (
							<Link
								key={entry.id}
								ref={active ? activeLink : undefined}
								href={entry.href}
								aria-current={active ? "page" : undefined}
								className={cn(
									"flex shrink-0 items-center whitespace-nowrap border-transparent border-b-2 py-2.5 text-cms-muted-foreground text-sm outline-hidden transition-colors hover:text-cms-foreground focus-visible:ring-2 focus-visible:ring-cms-ring/50 aria-[current=page]:border-cms-foreground aria-[current=page]:font-semibold aria-[current=page]:text-cms-foreground",
								)}
							>
								{t(`tab.${entry.id}` as "tab.collections")}
							</Link>
						);
					})}
				</nav>
			</header>
			<div className="flex min-h-0 flex-1 flex-col bg-cms-muted/50">
				<SchemaSettings tab={tab} actionsSlot={actions} />
			</div>
		</>
	);
}
