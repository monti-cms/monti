import "@monti-cms/admin/styles.css";
import type { AdminBlockDefinition } from "@monti-cms/admin";
import { AdminApp } from "./admin-app";

/**
 * The admin as a page of the site (`app/admin/page.tsx`, doc 16). The folder it sits in is the admin's address, and its API is `api` under it. It
 * brings the admin's own stylesheet, which touches nothing outside the admin, and tells search engines to stay out.
 */
export function AdminPage({
	siteName = "Monti",
	blocks,
}: {
	siteName?: string;
	/** The site's block definitions, from a `"use client"` module: their editor components draw the site's own blocks in the admin. */
	blocks?: AdminBlockDefinition[];
}) {
	return (
		<>
			<meta name="robots" content="noindex, nofollow" />
			<AdminApp siteName={siteName} blocks={blocks} />
		</>
	);
}
