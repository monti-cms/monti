"use client";

import { useTranslator } from "@monti-cms/core/site";
import { SidebarScreenMode } from "@monti-cms/ui";
import { useTheme } from "next-themes";
import { useHydrated } from "../lib/hooks/use-hydrated";
import { uiMessages } from "./messages";

/** The screen modes a person can pick, in the order they are offered. The admin follows the system until one is picked. */
export const THEME_MODES = ["system", "light", "dark"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

/** The mode a stored theme means: anything but light and dark follows the system. */
export const themeMode = (theme: string | undefined): ThemeMode =>
	theme === "light" || theme === "dark" ? theme : "system";

/**
 * The screen mode in the sidebar's last row, kept in this browser. Until hydration the mode is unknown (the server cannot know it), so a same-height
 * placeholder stands in.
 */
export function ScreenModeSwitch() {
	const t = useTranslator(uiMessages);
	const { theme, setTheme } = useTheme();
	const hydrated = useHydrated();
	if (!hydrated) return <span aria-hidden className="inline-flex size-monti-icon-button shrink-0" />;
	return (
		<SidebarScreenMode
			value={themeMode(theme)}
			onValueChange={setTheme}
			labels={{ label: t("theme.label"), system: t("theme.system"), light: t("theme.light"), dark: t("theme.dark") }}
		/>
	);
}
