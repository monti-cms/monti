"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import { SidebarTrigger } from "../../ui/sidebar";
import { ExportButton, ExportFields, ExportProgressLine } from "../export/export-fields";
import { exportMessages } from "../export/messages";
import { useExportForm } from "../export/use-export-form";
import { ShellPage } from "../shared/admin-shell";
import { sharedMessages } from "../shared/messages";
import { PageBody } from "../shared/page-body";
import { Section } from "../shared/section";
import { settingsMessages } from "./messages";
import { SettingsTabBar } from "./settings-tab-bar";

/**
 * The Data page of Settings (`<admin path>/settings/data`): what is kept in the site rather than in its schema file. It is a page of its own and shares nothing with the
 * schema tabs' draft, so it has no save bar. Today it holds the Site backup card.
 */
export function DataScreen() {
	const t = useTranslator(settingsMessages);
	return (
		<ShellPage title={t("title")} nav="settings" bare>
			<DataBody />
		</ShellPage>
	);
}

function DataBody() {
	const t = useTranslator(settingsMessages);
	const te = useTranslator(exportMessages);
	const shared = useTranslator(sharedMessages);
	const site = useSite();
	const form = useExportForm();
	return (
		<>
			<header className="shrink-0 border-b bg-monti-background px-4 pt-5 lg:px-10 lg:pt-6">
				<div className="flex flex-wrap items-center gap-2.5">
					<SidebarTrigger
						aria-label={shared("shell.openSidebar")}
						className="-ml-1 text-monti-muted-foreground md:hidden"
					/>
					<h1 className="font-semibold text-[22px] leading-tight tracking-tight">{t("title")}</h1>
				</div>
				<p className="mt-1 text-monti-muted-foreground text-sm">{t("data.description")}</p>
				<SettingsTabBar site={site} active="data" />
			</header>
			<div className="min-h-0 flex-1 overflow-y-auto bg-monti-muted/50">
				<PageBody>
					<Section wide title={te("data.title")} description={te("data.description")} testId="site-backup">
						<ExportFields form={form} />
						<ExportProgressLine phase={form.phase} />
						<div>
							<ExportButton form={form} label={te("action.all")} />
						</div>
					</Section>
				</PageBody>
			</div>
		</>
	);
}
