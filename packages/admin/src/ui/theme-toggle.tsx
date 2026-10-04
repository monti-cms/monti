"use client";

import { createTranslator } from "@monti-cms/core/client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import type { ComponentProps } from "react";
import { useHydrated } from "../lib/hooks/use-hydrated";
import { cn } from "../lib/utils/cn";
import { Button, buttonVariants } from "./button";
import { uiMessages } from "./messages";

const t = createTranslator(uiMessages);

/**
 * Toggle button for light and dark themes. On server render the current theme is unknown, and the button rendered on the server
 * gave the elements after it automatic IDs (useId) different from the browser's (hydration mismatch). So until hydration
 * finishes it renders a same-size placeholder, and afterwards the real button.
 */
export function ThemeToggle({
	className,
	labels = { toLight: t("theme.toLight"), toDark: t("theme.toDark") },
	...props
}: Omit<ComponentProps<typeof Button>, "onClick" | "children"> & {
	/** Button name. The public blog passes a message in its display language. */
	labels?: { toLight: string; toDark: string };
}) {
	const { resolvedTheme, setTheme } = useTheme();
	const hydrated = useHydrated();
	if (!hydrated) {
		return <span aria-hidden className={cn(buttonVariants({ variant: "ghost", size: "icon" }), className)} />;
	}
	const isDark = resolvedTheme === "dark";
	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			onClick={() => setTheme(isDark ? "light" : "dark")}
			aria-label={isDark ? labels.toLight : labels.toDark}
			className={className}
			{...props}
		>
			{isDark ? <Moon aria-hidden className="h-5 w-5" /> : <Sun aria-hidden className="h-5 w-5" />}
		</Button>
	);
}
