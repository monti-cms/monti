import { createTranslator } from "@monti-cms/core/client";
import type { Cms } from "@monti-cms/core/runtime";
import type { AdminServer } from "../../host/server";
import { Empty, EmptyHeader, EmptyTitle } from "../../ui/empty";
import { MEDIA_NOT_CONFIGURED } from "../api-error-message";
import { requireAdminPage } from "../require-admin";
import { AdminShell } from "../shared/admin-shell";
import { MediaLibrary } from "./media-library";
import { mediaMessages } from "./messages";

const t = createTranslator(mediaMessages);

export default async function AdminMediaPage({ cms, server }: { cms: Cms; server: AdminServer }) {
	await requireAdminPage(cms, server);
	if (!cms.isMediaConfigured) {
		return (
			<AdminShell title={t("title")} sidebar={{ activeNav: "media" }}>
				<Empty className="py-16">
					<EmptyHeader>
						<EmptyTitle>{MEDIA_NOT_CONFIGURED}</EmptyTitle>
					</EmptyHeader>
				</Empty>
			</AdminShell>
		);
	}
	return <MediaLibrary />;
}
