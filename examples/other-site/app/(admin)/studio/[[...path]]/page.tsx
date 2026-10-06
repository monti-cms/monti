import { CmsAdminPage, type CmsAdminPageProps } from "@monti-cms/admin/next";
import { cms } from "../../../../cms.server";

export default function StudioPage(props: CmsAdminPageProps) {
	return <CmsAdminPage cms={cms} {...props} />;
}
