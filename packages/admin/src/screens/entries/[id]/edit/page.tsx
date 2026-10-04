import { requireAdminPage } from "../../../require-admin";
import { EntryEditorShell } from "../../entry-editor-shell";

interface PageProps {
	params: Promise<{ id: string }>;
}

export default async function EditEntryPage({ params }: PageProps) {
	const auth = await requireAdminPage();
	const { id } = await params;

	// 번역본 사이를 오갈 때(v2 B4) 편집 상태를 새로 시작한다.
	return <EntryEditorShell key={id} mode="edit" initialEntryId={id} adminId={auth.userId} />;
}
