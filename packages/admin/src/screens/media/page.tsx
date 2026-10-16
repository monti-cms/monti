import type { Cms } from "@monti-cms/core/server";
import { ImageOff } from "lucide-react";
import { mediaNotConfiguredMessage } from "../../api/error-message";
import type { AdminServer } from "../../host/server";
import { requireAdminPage } from "../require-admin";
import { ShellPage } from "../shared/admin-shell";
import { EmptyState } from "../shared/empty-state";
import { MediaLibrary } from "./media-library";
import { mediaMessages } from "./messages";

export default async function AdminMediaPage({ cms, server }: { cms: Cms; server: AdminServer }) {
	const { site } = cms;
	const t = site.createTranslator(mediaMessages);
	await requireAdminPage(cms, server);
	if (!cms.isMediaConfigured) {
		return (
			<ShellPage title={t("title")} nav="media">
				<EmptyState icon={ImageOff} title={mediaNotConfiguredMessage(site)} />
			</ShellPage>
		);
	}
	return <MediaLibrary />;
}
