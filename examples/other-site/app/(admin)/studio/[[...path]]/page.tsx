import { CmsAdminPage, type CmsAdminPageProps } from "@monti-cms/nextjs/admin";
import { cms } from "../../../../cms.server";

export default function StudioPage(props: CmsAdminPageProps) {
	return <CmsAdminPage cms={cms} {...props} />;
}
