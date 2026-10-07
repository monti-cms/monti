import type { Cms } from "@monti-cms/core/runtime";
import type { AdminServer } from "../../../../host/server";
import { requireAdminPage } from "../../../require-admin";
import { EntryEditorShell } from "../../entry-editor-shell";

interface PageProps {
	cms: Cms;
	server: AdminServer;
	params: Promise<{ id: string }>;
}

export default async function EditEntryPage({ cms, server, params }: PageProps) {
	const auth = await requireAdminPage(cms, server);
	const { id } = await params;

	// Start a fresh editing state when switching between translations.
	return <EntryEditorShell key={id} mode="edit" initialEntryId={id} adminId={auth.userId} />;
}
