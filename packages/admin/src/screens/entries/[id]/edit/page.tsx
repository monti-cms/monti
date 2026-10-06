import type { Cms } from "@monti-cms/core/runtime";
import { requireAdminPage } from "../../../require-admin";
import { EntryEditorShell } from "../../entry-editor-shell";

interface PageProps {
	cms: Cms;
	params: Promise<{ id: string }>;
}

export default async function EditEntryPage({ cms, params }: PageProps) {
	const auth = await requireAdminPage(cms);
	const { id } = await params;

	// Start a fresh editing state when switching between translations.
	return <EntryEditorShell key={id} mode="edit" initialEntryId={id} adminId={auth.userId} />;
}
