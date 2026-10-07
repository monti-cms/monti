// The admin stylesheets are prebuilt (the admin file covers the mdx and seo screens): they need no Tailwind setup, and only the admin pages load them.
import "@monti-cms/admin/styles.css";
import "@monti-cms/blocks/styles.css";
import { CmsAdminLayout } from "@monti-cms/nextjs/admin";
import type { ReactNode } from "react";
import { cms } from "../../../cms.server";
import { SiteAdminComponents } from "./admin-components";

export { cmsAdminMetadata as metadata } from "@monti-cms/nextjs/admin";

export default function AdminLayout({ children }: { children: ReactNode }) {
	return (
		<CmsAdminLayout cms={cms}>
			<SiteAdminComponents>{children}</SiteAdminComponents>
		</CmsAdminLayout>
	);
}
