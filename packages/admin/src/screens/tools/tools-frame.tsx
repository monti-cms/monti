"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import { Box, PageBody, PageColumn, PageHeader, PageToolbar, TabLink, TabLinks } from "@monti-cms/ui";
import type { ReactNode } from "react";
import { AdminLink as Link } from "../../router";
import { AdminFrame, useAdminNav } from "../shared/admin-frame";
import { toolsMessages } from "./messages";
import { type ToolsId, toolsTabs } from "./tools-tabs";

/** The header, the tabs and the body of the tools page. Apart from the frame so the failure count can be read inside it. */
function ToolsPage({
	tab,
	count,
	wide,
	actions,
	children,
}: {
	tab: ToolsId;
	count?: number;
	wide?: boolean;
	actions?: ReactNode;
	children: ReactNode;
}) {
	const site = useSite();
	const t = useTranslator(toolsMessages);
	const { eventsCount } = useAdminNav();
	return (
		<PageColumn width={wide ? "list" : "content"}>
			<PageHeader title={t("title")}>{actions}</PageHeader>
			<PageToolbar inset>
				<Box as="nav" aria-label={t("tabs.label")}>
					<TabLinks variant="toolbar">
						{toolsTabs(site).map((entry) => {
							const current = entry.id === tab;
							const failed = entry.id === "events" && eventsCount ? eventsCount : undefined;
							return (
								<TabLink
									key={entry.id}
									href={entry.href}
									current={current}
									render={<Link href={entry.href} />}
									{...(failed === undefined
										? { count: current ? count : undefined }
										: { count: failed, countTone: "warning", countLabel: t("failedCount", { count: failed }) })}
								>
									{entry.label}
								</TabLink>
							);
						})}
					</TabLinks>
				</Box>
			</PageToolbar>
			<PageBody>{children}</PageBody>
		</PageColumn>
	);
}

/**
 * The tools page: the title, the tabs (templates, data, the activity log, API keys, then a tab for each plugin page) and, under them, the open tab's
 * screen. Each screen draws it around itself: it knows the count of its own list (`count`, shown after its tab's name while it is open) and the action
 * of its page (`actions`, in the title row).
 */
export function ToolsFrame({
	tab,
	count,
	wide,
	actions,
	children,
}: {
	/** The open tab: a built-in page, or `tools:<path>` for a plugin's page. */
	tab: ToolsId;
	count?: number;
	/** The tab is a page of rows (templates, the activity log, API keys): its column grows on a wide window. Data, plugin pages and forms stay at the content width. */
	wide?: boolean;
	actions?: ReactNode;
	children: ReactNode;
}) {
	return (
		<AdminFrame sidebar={{ activeNav: tab }}>
			<ToolsPage tab={tab} count={count} wide={wide} actions={actions}>
				{children}
			</ToolsPage>
		</AdminFrame>
	);
}
