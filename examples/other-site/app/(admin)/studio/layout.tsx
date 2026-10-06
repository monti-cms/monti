import { CmsAdminLayout } from "@monti-cms/admin/next";
import type { ReactNode } from "react";
import { cms } from "../../../cms.server";
import { SiteAdminComponents } from "./admin-components";

export { cmsAdminMetadata as metadata } from "@monti-cms/admin/next";

export default function AdminLayout({ children }: { children: ReactNode }) {
	return (
		<CmsAdminLayout cms={cms}>
			<SiteAdminComponents>{children}</SiteAdminComponents>
		</CmsAdminLayout>
	);
}
