import type { Cms } from "@monti-cms/core/server";
import { isUuid } from "@monti-cms/core/site";
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
	const target = site.isCollection(collection) ? collection : site.DEFAULT_COLLECTION;

	return (
		<EntryEditorShell
			mode="new"
			collection={target}
			adminId={auth.userId}
			// A folder from the address only where the collection uses folders; the server would refuse the create otherwise.
			folderId={site.foldersEnabled(target) && isUuid(folder) ? folder : null}
		/>
	);
}
