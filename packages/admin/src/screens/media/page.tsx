import type { Cms } from "@monti-cms/core/server";
import type { AdminServer } from "../../host/server";
import { requireAdminPage } from "../require-admin";
import { MediaLibrary } from "./media-library";
import { MediaNotConfigured } from "./media-not-configured";

export default async function AdminMediaPage({ cms, server }: { cms: Cms; server: AdminServer }) {
	await requireAdminPage(cms, server);
	if (!cms.isMediaConfigured) return <MediaNotConfigured />;
	return <MediaLibrary />;
}
