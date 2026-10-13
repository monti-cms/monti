"use client";

import { useSite, useTranslator } from "@monti-cms/core/client";
import { useEffect, useRef } from "react";
import { cn } from "../../lib/utils/cn";
import { AdminLink as Link } from "../../router";
import { SchemaSettings } from "../schema/schema-screen";
import { AdminShell } from "../shared/admin-shell";
import { settingsMessages } from "./messages";
import { type SchemaTab, settingsTabs } from "./tabs";

/**
 * The Settings page: one frame (sidebar entry, title) with a row of tabs, each its own address (`<admin path>/settings/<tab>`).
 * The tabs are the schema file editor's: collections, languages, site, admin and file. They share one draft.
 */
export function SettingsScreen({ tab }: { tab: SchemaTab }) {
	const t = useTranslator(settingsMessages);
	return (
		<AdminShell title={t("title")} sidebar={{ activeNav: "settings" }}>
			<SettingsBody tab={tab} />
		</AdminShell>
	);
}

function SettingsBody({ tab }: { tab: SchemaTab }) {
	const site = useSite();
	const t = useTranslator(settingsMessages);
	const tabs = settingsTabs(site);

	// On a narrow screen the tab bar scrolls sideways: keep the open tab in view.
	const activeLink = useRef<HTMLAnchorElement>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs when the open tab changes
	useEffect(() => {
		activeLink.current?.scrollIntoView?.({ inline: "center", block: "nearest" });
	}, [tab]);

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
							{t(`tab.${entry.id}` as "tab.collections")}
						</Link>
					);
				})}
			</nav>
			<div className="flex min-h-0 flex-1 flex-col">
				<SchemaSettings tab={tab} />
			</div>
		</>
	);
}
