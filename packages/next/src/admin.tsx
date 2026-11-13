import "@monti-cms/admin/styles.css";
import type { AdminBlockDefinition, AdminPlugin } from "@monti-cms/admin";
import { AdminApp } from "./admin-app";

/**
 * The admin as a page of the site (`app/admin/page.tsx`, doc 16). The folder it sits in is the admin's address, and its API is `api` under it. It
 * brings the admin's own stylesheet, which touches nothing outside the admin, and tells search engines to stay out.
 */
export function AdminPage({
	siteName = "Monti",
	blocks,
	plugins,
}: {
	siteName?: string;
	/** The site's block definitions, from a `"use client"` module: their editor components draw the site's own blocks in the admin. */
	blocks?: AdminBlockDefinition[];
	/**
	 * The browser halves of the site's plugins (`defineAdminPlugin`), from `"use client"` modules: a field's own input, a view in the property
	 * panel, a tool page's screen (doc 14).
	 */
	plugins?: AdminPlugin[];
}) {
	return (
		<>
			<meta name="robots" content="noindex, nofollow" />
			<AdminApp siteName={siteName} blocks={blocks} plugins={plugins} />
		</>
	);
}
