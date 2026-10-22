"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import { Box, Heading, Inline, SidebarTrigger, Stack } from "@monti-cms/ui";
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
			<Stack as="header" gap="none" shrink={false} border="bottom" background="page" paddingX="wide" paddingTop="wide">
				<Inline wrap align="end" justify="between" gap="spacious">
					<Box minWidth={0}>
						<Inline wrap gap="condensed">
							<Box as="span" hideFrom="md">
								<SidebarTrigger aria-label={shared("shell.openSidebar")} />
							</Box>
							<Heading as="h1" variant="heading">
								{t("title")}
							</Heading>
							<Inline gap="condensed">
								<div ref={setFileLine} data-testid="settings-file-line" />
							</Inline>
						</Inline>
					</Box>
					<Inline gap="condensed">
						<div ref={setActions} data-testid="settings-actions" />
					</Inline>
				</Inline>
				<SettingsTabBar site={site} active={tab} onSchemaTab={go} changed={changed?.tabs} />
			</Stack>
			<Stack gap="none" grow minHeight={0} background="page">
				<SchemaSettings tab={tab} actionsSlot={actions} fileSlot={fileLine} onTab={go} onChanged={setChanged} />
			</Stack>
		</>
	);
}
