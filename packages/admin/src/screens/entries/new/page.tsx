import { DEFAULT_COLLECTION, isCollection, isUuid } from "@monti-cms/core/client";
import type { Cms } from "@monti-cms/core/runtime";
import { requireAdminPage } from "../../require-admin";
import { EntryEditorShell } from "../entry-editor-shell";

interface PageProps {
	cms: Cms;
	searchParams: Promise<{ collection?: string; folder?: string }>;
}

export default async function NewEntryPage({ cms, searchParams }: PageProps) {
	const auth = await requireAdminPage(cms);
	const { collection, folder } = await searchParams;

	return (
		<EntryEditorShell
			mode="new"
			collection={isCollection(collection) ? collection : DEFAULT_COLLECTION}
			adminId={auth.userId}
			folderId={isUuid(folder) ? folder : null}
		/>
	);
}
