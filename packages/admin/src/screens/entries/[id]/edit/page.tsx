import { requireAdminPage } from "../../../require-admin";
import { EntryEditorShell } from "../../entry-editor-shell";

interface PageProps {
	params: Promise<{ id: string }>;
}

export default async function EditEntryPage({ params }: PageProps) {
	const auth = await requireAdminPage();
	const { id } = await params;

	// Start a fresh editing state when switching between translations.
	return <EntryEditorShell key={id} mode="edit" initialEntryId={id} adminId={auth.userId} />;
}
