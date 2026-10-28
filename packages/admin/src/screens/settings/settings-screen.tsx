"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import { PageBody, PageColumn, PageHeader, PageToolbar } from "@monti-cms/ui";
import { useState } from "react";
import type { ChangedAreas } from "../schema/schema-model";
import { SchemaSettings } from "../schema/schema-screen";
import { AdminFrame } from "../shared/admin-frame";
import { settingsMessages } from "./messages";
import { useSettingsTab } from "./place";
import { SettingsTabBar } from "./settings-tab-bar";
import type { SchemaTab } from "./tabs";

/**
 * The Settings page: the title row (the editor's read-only badge on its right) over a row of tabs, each its own address (`<admin path>/settings/<tab>`).
 * The tabs are the schema file editor's: site, languages, collections and admin. They share one draft.
 */
export function SettingsScreen({ tab }: { tab: SchemaTab }) {
	return (
		<AdminFrame sidebar={{ activeNav: "settings" }}>
			<SettingsBody tab={tab} />
		</AdminFrame>
	);
}

function SettingsBody({ tab: renderedTab }: { tab: SchemaTab }) {
	const t = useTranslator(settingsMessages);
	// Moving between tabs changes the address in place: the page, and the draft in it, stay.
	const { tab, go } = useSettingsTab(renderedTab);
	const site = useSite();
	// The editor puts its read-only badge here.
	const [actions, setActions] = useState<HTMLElement | null>(null);
	// Where the draft differs from the saved file, for the marks on the tabs.
	const [changed, setChanged] = useState<ChangedAreas | null>(null);
	return (
		<PageColumn>
			<PageHeader title={t("title")}>
				<div ref={setActions} data-testid="settings-actions" />
			</PageHeader>
			<PageToolbar>
				<SettingsTabBar site={site} active={tab} onSchemaTab={go} changed={changed?.tabs} />
			</PageToolbar>
			<PageBody>
				<SchemaSettings tab={tab} actionsSlot={actions} onTab={go} onChanged={setChanged} />
			</PageBody>
		</PageColumn>
	);
}
