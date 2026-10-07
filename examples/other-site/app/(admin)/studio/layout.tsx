// The admin stylesheets are prebuilt (the admin file covers the mdx and seo screens): they need no Tailwind setup, and only the admin pages load them.
import "@monti-cms/admin/styles.css";
import "@monti-cms/blocks/styles.css";
import { CmsAdminLayout, cmsAdminMetadata } from "@monti-cms/nextjs/admin";
import type { ReactNode } from "react";
import { cms } from "../../../cms.server";
import { SiteAdminComponents } from "./admin-components";

export const generateMetadata = () => cmsAdminMetadata(cms);

export default function AdminLayout({ children }: { children: ReactNode }) {
	return (
		<CmsAdminLayout cms={cms}>
			<SiteAdminComponents>{children}</SiteAdminComponents>
		</CmsAdminLayout>
	);
}
