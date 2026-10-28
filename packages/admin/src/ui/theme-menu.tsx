"use client";

import { Asleep, Light, Screen } from "@carbon/icons-react";
import { useTranslator } from "@monti-cms/core/site";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
	IconButton,
} from "@monti-cms/ui";
import { useTheme } from "next-themes";
import { useHydrated } from "../lib/hooks/use-hydrated";
import { uiMessages } from "./messages";

/** The screen modes a person can pick, in the order of the menu. The admin follows the system until one is picked. */
export const THEME_MODES = ["system", "light", "dark"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

const ICONS = { system: Screen, light: Light, dark: Asleep } as const;

/** The mode a stored theme means: anything but light and dark follows the system. */
export const themeMode = (theme: string | undefined): ThemeMode =>
	theme === "light" || theme === "dark" ? theme : "system";

/**
 * One icon button for the screen mode, whose icon shows the current mode. It opens a small menu upward with the three modes and a ✓ on the current
 * one. Until hydration the mode is unknown (the server cannot know it), so a same-size placeholder stands in.
 */
export function ThemeMenu() {
	const t = useTranslator(uiMessages);
	const { theme, setTheme } = useTheme();
	const hydrated = useHydrated();
	if (!hydrated) return <span aria-hidden className="inline-flex size-monti-icon-button shrink-0" />;
	const mode = themeMode(theme);
	const Icon = ICONS[mode];
	return (
		<DropdownMenu>
			<IconButton label={t("theme.label")} side="right" trigger={(button) => <DropdownMenuTrigger render={button} />}>
				<Icon aria-hidden />
			</IconButton>
			<DropdownMenuContent side="top" align="start">
				<DropdownMenuRadioGroup value={mode} onValueChange={(next) => setTheme(String(next))}>
					{THEME_MODES.map((option) => (
						<DropdownMenuRadioItem key={option} value={option}>
							{t(`theme.${option}`)}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
