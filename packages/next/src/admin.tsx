import "@monti-cms/admin/styles.css";
import type { AdminBlockDefinition, AdminMarkDefinition, AdminPlugin } from "@monti-cms/admin";
import { screenModeScript } from "@monti-cms/admin/screen-mode";
import { AdminApp } from "./admin-app";

/**
 * The admin as a page of the site (`app/admin/page.tsx`, doc 16). The folder it sits in is the admin's address, and its API is `api` under it. It
 * brings the admin's own stylesheet, which touches nothing outside the admin, and tells search engines to stay out.
 */
export function AdminPage({
	siteName = "Monti",
	blocks,
	marks,
	plugins,
}: {
	siteName?: string;
	/** The site's block definitions, from a `"use client"` module: their editor components draw the site's own blocks in the admin. */
	blocks?: AdminBlockDefinition[];
	/** The site's mark definitions, from the same module: their cards in the format bar. */
	marks?: AdminMarkDefinition[];
	/**
	 * The browser halves of the site's plugins (`defineAdminPlugin`), from `"use client"` modules: a field's own input, a view in the property
	 * panel, a tool page's screen (doc 14).
	 */
	plugins?: AdminPlugin[];
}) {
	return (
		<>
			<meta name="robots" content="noindex, nofollow" />
			{/* The mode before the first paint: the stored one, or the system's (the admin keeps it in the browser, which a server cannot read). */}
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: the admin's own script text, with no input in it */}
			<script dangerouslySetInnerHTML={{ __html: screenModeScript() }} />
			<AdminApp siteName={siteName} blocks={blocks} marks={marks} plugins={plugins} />
		</>
	);
}
