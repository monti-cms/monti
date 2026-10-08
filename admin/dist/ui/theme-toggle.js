"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useHydrated } from "../lib/hooks/use-hydrated.js";
import { cn } from "../lib/utils/cn.js";
import { Button, buttonVariants } from "./button.js";
import { uiMessages } from "./messages.js";
/**
 * Toggle button for light and dark themes. On server render the current theme is unknown, and the button rendered on the server
 * gave the elements after it automatic IDs (useId) different from the browser's (hydration mismatch). So until hydration
 * finishes it renders a same-size placeholder, and afterwards the real button.
 */
export function ThemeToggle({ labels, ...props }) {
    return labels ? _jsx(ThemeToggleButton, { labels: labels, ...props }) : _jsx(AdminThemeToggle, { ...props });
}
/** The toggle with the admin's own button names, which follow the admin language of the site. */
function AdminThemeToggle(props) {
    const t = useTranslator(uiMessages);
    return _jsx(ThemeToggleButton, { labels: { toLight: t("theme.toLight"), toDark: t("theme.toDark") }, ...props });
}
function ThemeToggleButton({ className, labels, ...props }) {
    const { resolvedTheme, setTheme } = useTheme();
    const hydrated = useHydrated();
    if (!hydrated) {
        return _jsx("span", { "aria-hidden": true, className: cn(buttonVariants({ variant: "ghost", size: "icon" }), className) });
    }
    const isDark = resolvedTheme === "dark";
    return (_jsx(Button, { type: "button", variant: "ghost", size: "icon", onClick: () => setTheme(isDark ? "light" : "dark"), "aria-label": isDark ? labels.toLight : labels.toDark, className: className, ...props, children: isDark ? _jsx(Moon, { "aria-hidden": true, className: "h-5 w-5" }) : _jsx(Sun, { "aria-hidden": true, className: "h-5 w-5" }) }));
}
