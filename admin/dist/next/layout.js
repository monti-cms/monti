import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createTranslator, SITE_NAME } from "@monti-cms/core/client";
import { isCmsMediaConfigured } from "@monti-cms/core/runtime";
import { loadAdminPlugins } from "../plugins.js";
import { AdminFeaturesProvider } from "../screens/shared/admin-features.js";
import { AdminQueryProvider } from "../screens/shared/query-provider.js";
import { Toaster } from "../ui/sonner.js";
import { TooltipProvider } from "../ui/tooltip.js";
import { AdminThemeProvider } from "./admin-theme-provider.js";
import { nextMessages } from "./messages.js";
const t = createTranslator(nextMessages);
/** Admin UI metadata. Use it in the app's admin layout as `export const metadata = cmsAdminMetadata;`. */
export const cmsAdminMetadata = {
    title: SITE_NAME ? t("titleWithSite", { site: SITE_NAME }) : t("title"),
    robots: { index: false, follow: false },
};
/**
 * Admin UI layout. Rendered by the app's `app/(admin)/admin/layout.tsx`. Styles (Tailwind, `cms-*` colors) come from the app's global CSS.
 * Supports both light and dark themes and, by default, renders the `next-themes` provider and the toast container.
 * If the site already has them, turn them off with `<CmsAdminLayout themeProvider={false} toaster={false}>`.
 */
export async function CmsAdminLayout({ children, themeProvider = true, toaster = true }) {
    const plugins = await loadAdminPlugins();
    // Plugin providers wrap from the outside in registration order, inside the server data cache.
    const content = plugins.reduceRight((inner, { name, Provider }) => (Provider ? _jsx(Provider, { children: inner }, name) : inner), _jsxs(TooltipProvider, { children: [_jsx("div", { className: "cms-admin min-h-screen bg-cms-background text-cms-foreground", children: children }), toaster ? _jsx(Toaster, { richColors: true, closeButton: true, position: "bottom-right" }) : null] }));
    const app = (_jsx(AdminQueryProvider, { children: _jsx(AdminFeaturesProvider, { features: { media: isCmsMediaConfigured() }, children: content }) }));
    return themeProvider ? _jsx(AdminThemeProvider, { children: app }) : app;
}
