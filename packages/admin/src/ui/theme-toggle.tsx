"use client";

import { useTranslator } from "@monti-cms/core/site";
import { IconButton } from "@monti-cms/ui/internal";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useHydrated } from "../lib/hooks/use-hydrated";
import { uiMessages } from "./messages";

/**
 * Toggle button for light and dark themes. On server render the current theme is unknown, and the button rendered on the server
 * gave the elements after it automatic IDs (useId) different from the browser's (hydration mismatch). So until hydration
 * finishes it renders a same-size placeholder, and afterwards the real button.
 */
export function ThemeToggle({
	labels,
}: {
	/** Button name. A public site passes a message in its own display language (it then needs no site). */
	labels?: { toLight: string; toDark: string };
}) {
	return labels ? <ThemeToggleButton labels={labels} /> : <AdminThemeToggle />;
}

/** The toggle with the admin's own button names, which follow the admin language of the site. */
function AdminThemeToggle() {
	const t = useTranslator(uiMessages);
	return <ThemeToggleButton labels={{ toLight: t("theme.toLight"), toDark: t("theme.toDark") }} />;
}

function ThemeToggleButton({ labels }: { labels: { toLight: string; toDark: string } }) {
	const { resolvedTheme, setTheme } = useTheme();
	const hydrated = useHydrated();
	if (!hydrated) {
		return <span aria-hidden className="inline-flex size-monti-icon-button shrink-0" />;
	}
	const isDark = resolvedTheme === "dark";
	return (
		<IconButton label={isDark ? labels.toLight : labels.toDark} onClick={() => setTheme(isDark ? "light" : "dark")}>
			{isDark ? <Moon aria-hidden /> : <Sun aria-hidden />}
		</IconButton>
	);
}
