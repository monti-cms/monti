import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { SiteProvider } from "@monti-cms/core/client";
import { loadAdminPlugins } from "../plugins.js";
import { AdminFeaturesProvider } from "../screens/shared/admin-features.js";
import { AdminQueryProvider } from "../screens/shared/query-provider.js";
import { Toaster } from "../ui/sonner.js";
import { TooltipProvider } from "../ui/tooltip.js";
import { AdminThemeProvider } from "./admin-theme-provider.js";
import { layoutMessages } from "./messages.js";
import { SetupProblemScreen, setupProblemOf } from "./setup-problem.js";
/**
 * Metadata of the admin pages of an instance (title, no indexing), in the shape the framework's metadata export expects (Next's `Metadata` accepts it as is).
 * The title follows the site name and the admin language of the instance's site. A host package calls it from the admin layout's `generateMetadata`.
 */
export function adminMetadata(cms) {
    const { site } = cms;
    const t = site.createTranslator(layoutMessages);
    return {
        title: site.SITE_NAME ? t("titleWithSite", { site: site.SITE_NAME }) : t("title"),
        robots: { index: false, follow: false },
    };
}
/**
 * Admin UI layout, framework-neutral. A host package renders it inside the router provider (`CmsAdminLayout` of `@monti-cms/nextjs/admin` for Next.js). Styles (Tailwind, `cms-*` colors) come from the app's global CSS.
 * Supports both light and dark themes and, by default, renders the `next-themes` provider and the toast container.
 * If the site already has them, turn them off with `<AdminLayout cms={cms} themeProvider={false} toaster={false}>`.
 */
export async function AdminLayout({ cms, children, themeProvider = true, themeStorageKey, toaster = true, }) {
    // A server whose login is not set up shows what to do, instead of an error page with the message hidden.
    if (setupProblemOf(cms) !== undefined)
        return _jsx(SetupProblemScreen, { cms: cms });
    const plugins = await loadAdminPlugins(cms.site);
    // Plugin providers wrap from the outside in registration order, inside the server data cache.
    const content = plugins.reduceRight((inner, { name, Provider }) => (Provider ? _jsx(Provider, { children: inner }, name) : inner), _jsxs(TooltipProvider, { children: [_jsx("div", { className: "cms-admin min-h-screen bg-cms-background text-cms-foreground", children: children }), toaster ? _jsx(Toaster, { richColors: true, closeButton: true, position: "bottom-right" }) : null] }));
    // The browser gets the site as data (collections, locales, blocks, addresses, admin language), never a config file.
    const app = (_jsx(SiteProvider, { config: cms.site.snapshot(), children: _jsx(AdminQueryProvider, { children: _jsx(AdminFeaturesProvider, { features: { media: cms.isMediaConfigured }, children: content }) }) }));
    return themeProvider ? _jsx(AdminThemeProvider, { storageKey: themeStorageKey, children: app }) : app;
}
