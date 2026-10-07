import { createTranslator, SITE_NAME } from "@monti-cms/core/client";
import type { Cms } from "@monti-cms/core/runtime";
import type { ReactNode } from "react";
import { loadAdminPlugins } from "../plugins";
import { AdminFeaturesProvider } from "../screens/shared/admin-features";
import { AdminQueryProvider } from "../screens/shared/query-provider";
import { Toaster } from "../ui/sonner";
import { TooltipProvider } from "../ui/tooltip";
import { AdminThemeProvider } from "./admin-theme-provider";
import { layoutMessages } from "./messages";

const t = createTranslator(layoutMessages);

/**
 * Metadata of the admin pages (title, no indexing), in the shape the framework's metadata export expects (Next's `Metadata` accepts it as is).
 * A host package re-exports it as the admin layout's metadata.
 */
export const adminMetadata = {
	title: SITE_NAME ? t("titleWithSite", { site: SITE_NAME }) : t("title"),
	robots: { index: false, follow: false },
} as const;

export type AdminLayoutProps = {
	/** The CMS instance: the `cms` exported by the app's server file. */
	cms: Cms;
	children: ReactNode;
	/**
	 * Whether to render the admin UI's theme provider (`next-themes`). Default `true`. Set `false` if the site already has a theme provider.
	 * In that case the admin UI follows the `.dark` or `[data-theme="dark"]` the site puts on `html`.
	 */
	themeProvider?: boolean;
	/**
	 * localStorage key the admin UI's own theme is stored under. Default `monti-admin-theme`, so switching the admin theme does not change the site's theme.
	 * Only used with `themeProvider`.
	 */
	themeStorageKey?: string;
	/**
	 * Whether to render the admin UI's toast container (`sonner`'s `Toaster`). Default `true`. Set `false` if the site already has a `Toaster`.
	 * Admin UI toasts also appear in the site's `Toaster` (when using the same `sonner` package).
	 */
	toaster?: boolean;
};

/**
 * Admin UI layout, framework-neutral. A host package renders it inside the router provider (`CmsAdminLayout` of `@monti-cms/nextjs/admin` for Next.js). Styles (Tailwind, `cms-*` colors) come from the app's global CSS.
 * Supports both light and dark themes and, by default, renders the `next-themes` provider and the toast container.
 * If the site already has them, turn them off with `<AdminLayout cms={cms} themeProvider={false} toaster={false}>`.
 */
export async function AdminLayout({
	cms,
	children,
	themeProvider = true,
	themeStorageKey,
	toaster = true,
}: AdminLayoutProps) {
	const plugins = await loadAdminPlugins();
	// Plugin providers wrap from the outside in registration order, inside the server data cache.
	const content = plugins.reduceRight<ReactNode>(
		(inner, { name, Provider }) => (Provider ? <Provider key={name}>{inner}</Provider> : inner),
		<TooltipProvider>
			<div className="cms-admin min-h-screen bg-cms-background text-cms-foreground">{children}</div>
			{toaster ? <Toaster richColors closeButton position="bottom-right" /> : null}
		</TooltipProvider>,
	);
	const app = (
		<AdminQueryProvider>
			<AdminFeaturesProvider features={{ media: cms.isMediaConfigured }}>{content}</AdminFeaturesProvider>
		</AdminQueryProvider>
	);
	return themeProvider ? <AdminThemeProvider storageKey={themeStorageKey}>{app}</AdminThemeProvider> : app;
}
