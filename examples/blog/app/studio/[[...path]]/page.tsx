import { CmsAdminPage, type CmsAdminPageProps } from "@monti-cms/nextjs/admin";
import { cms } from "@/monti.config";

// The admin is a per-request app (the session, the database, the current time), never an instant navigation: this keeps Next's instant validation
// (Cache Components, development) from checking it. A segment setting has to be written here; it cannot be re-exported from a package.
export const instant = false;

export default function StudioPage(props: CmsAdminPageProps) {
	return <CmsAdminPage cms={cms} {...props} />;
}
