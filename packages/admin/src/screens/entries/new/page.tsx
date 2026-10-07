import { isUuid } from "@monti-cms/core/client";
import type { Cms } from "@monti-cms/core/runtime";
import type { AdminServer } from "../../../host/server";
import { requireAdminPage } from "../../require-admin";
import { EntryEditorShell } from "../entry-editor-shell";

interface PageProps {
	cms: Cms;
	server: AdminServer;
	searchParams: Promise<{ collection?: string; folder?: string }>;
}

export default async function NewEntryPage({ cms, server, searchParams }: PageProps) {
	const { site } = cms;
	const auth = await requireAdminPage(cms, server);
	const { collection, folder } = await searchParams;

	return (
		<EntryEditorShell
			mode="new"
			collection={site.isCollection(collection) ? collection : site.DEFAULT_COLLECTION}
			adminId={auth.userId}
			folderId={isUuid(folder) ? folder : null}
		/>
	);
}
