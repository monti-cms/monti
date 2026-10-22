"use client";

import { type Site, useTranslator } from "@monti-cms/core/site";
import { Box, Inline, StatusIndicator, Text } from "@monti-cms/ui";
import { useEffect, useRef } from "react";
import { AdminLink as Link } from "../../router";
import { settingsMessages } from "./messages";
import { type SchemaTab, settingsTabs } from "./tabs";

// design-system: needs a link variant of PageTabs (underline tab that is a router link with aria-current)
const linkClass =
	"flex shrink-0 items-center gap-condensed whitespace-nowrap border-transparent border-b-2 py-condensed text-monti-body text-monti-muted outline-hidden transition-colors hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-focus-soft aria-[current=page]:border-monti-accent aria-[current=page]:font-medium aria-[current=page]:text-monti-default";

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
		<Box paddingTop="comfortable">
			<Inline as="nav" aria-label={t("tabs.label")} align="stretch" gap="spacious" overflow="x">
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
							// design-system: needs a link variant of PageTabs (see linkClass)
							className={linkClass}
						>
							{t(`tab.${entry.id}` as "tab.collections")}
							{changed?.[entry.id] && (
								<Inline as="span" data-testid={`tab-changed-${entry.id}`}>
									<StatusIndicator tone="strong" size="xs" />
									<Text srOnly>{t("changed")}</Text>
								</Inline>
							)}
						</Link>
					);
				})}
			</Inline>
		</Box>
	);
}
