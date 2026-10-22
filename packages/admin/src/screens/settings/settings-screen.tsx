"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import { SidebarTrigger } from "@monti-cms/ui";
import { useState } from "react";
import type { ChangedAreas } from "../schema/schema-model";
import { SchemaSettings } from "../schema/schema-screen";
import { ShellPage } from "../shared/admin-shell";
import { sharedMessages } from "../shared/messages";
import { settingsMessages } from "./messages";
import { useSettingsTab } from "./place";
import { SettingsTabBar } from "./settings-tab-bar";
import type { SchemaTab } from "./tabs";

/**
 * The Settings page: its own header (title, the schema file chip, one line about where it is saved) over a row of tabs, each its own address
 * (`<admin path>/settings/<tab>`). The tabs are the schema file editor's: site, languages, collections and admin. They share one draft.
 */
export function SettingsScreen({ tab }: { tab: SchemaTab }) {
	const t = useTranslator(settingsMessages);
	return (
		<ShellPage title={t("title")} nav="settings" bare>
			<SettingsBody tab={tab} />
		</ShellPage>
	);
}

function SettingsBody({ tab: renderedTab }: { tab: SchemaTab }) {
	// Moving between tabs changes the address in place: the page, and the draft in it, stay.
	const { tab, go } = useSettingsTab(renderedTab);
	const site = useSite();
	const t = useTranslator(settingsMessages);
	const shared = useTranslator(sharedMessages);
	// The editor puts its read-only badge here.
	const [actions, setActions] = useState<HTMLElement | null>(null);
	// Where the draft differs from the saved file, for the marks on the tabs.
	const [changed, setChanged] = useState<ChangedAreas | null>(null);
	// ... and the line that names the schema file and its version.
	const [fileLine, setFileLine] = useState<HTMLElement | null>(null);
	return (
		<>
			<header className="shrink-0 border-b bg-monti-page px-comfortable pt-spacious lg:px-wide lg:pt-wide">
				<div className="flex flex-wrap items-end justify-between gap-x-spacious gap-y-normal">
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-condensed">
							<SidebarTrigger
								aria-label={shared("shell.openSidebar")}
								className="-ml-tight text-monti-muted md:hidden"
							/>
							<h1 className="text-monti-heading">{t("title")}</h1>
							<div
								ref={setFileLine}
								className="flex items-center gap-condensed empty:hidden"
								data-testid="settings-file-line"
							/>
						</div>
					</div>
					<div ref={setActions} className="flex items-center gap-condensed" data-testid="settings-actions" />
				</div>
				<SettingsTabBar site={site} active={tab} onSchemaTab={go} changed={changed?.tabs} />
			</header>
			<div className="flex min-h-0 flex-1 flex-col bg-monti-page">
				<SchemaSettings tab={tab} actionsSlot={actions} fileSlot={fileLine} onTab={go} onChanged={setChanged} />
			</div>
		</>
	);
}
