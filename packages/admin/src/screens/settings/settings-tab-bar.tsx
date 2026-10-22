"use client";

import { type Site, useTranslator } from "@monti-cms/core/site";
import { cn } from "@monti-cms/ui";
import { useEffect, useRef } from "react";
import { AdminLink as Link } from "../../router";
import { settingsMessages } from "./messages";
import { type SchemaTab, settingsTabs } from "./tabs";

const linkClass =
	"flex shrink-0 items-center gap-2 whitespace-nowrap border-transparent border-b-2 py-2 text-monti-body text-monti-muted outline-hidden transition-colors hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-focus-soft aria-[current=page]:border-monti-accent aria-[current=page]:font-medium aria-[current=page]:text-monti-default";

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
		<nav aria-label={t("tabs.label")} className="mt-4 -mb-px flex items-stretch gap-6 overflow-x-auto">
			{tabs.map((entry) => {
				const isActive = entry.id === active;
				return (
					<Link
						key={entry.id}
						// Moving between schema tabs is not a way out of the unsaved draft.
						data-unsaved-guard={onSchemaTab ? "off" : undefined}
						onClick={(event) => {
							if (!onSchemaTab) return;
							// A click that opens a new tab or window goes the way of a link.
							if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
							event.preventDefault();
							onSchemaTab(entry.id);
						}}
						ref={isActive ? activeLink : undefined}
						href={entry.href}
						aria-current={isActive ? "page" : undefined}
						className={cn(linkClass)}
					>
						{t(`tab.${entry.id}` as "tab.collections")}
						{changed?.[entry.id] && (
							<span className="inline-flex items-center" data-testid={`tab-changed-${entry.id}`}>
								<span aria-hidden className="size-1.5 rounded-full bg-monti-accent-emphasis" />
								<span className="sr-only">{t("changed")}</span>
							</span>
						)}
					</Link>
				);
			})}
		</nav>
	);
}
