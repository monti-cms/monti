import { jsx as _jsx } from "react/jsx-runtime";
import { DEFAULT_COLLECTION, isCollection, isUuid } from "@monti-cms/core/client";
import { requireAdminPage } from "../../require-admin.js";
import { EntryEditorShell } from "../entry-editor-shell.js";
export default async function NewEntryPage({ searchParams }) {
    const auth = await requireAdminPage();
    const { collection, folder } = await searchParams;
    return (_jsx(EntryEditorShell, { mode: "new", collection: isCollection(collection) ? collection : DEFAULT_COLLECTION, adminId: auth.userId, folderId: isUuid(folder) ? folder : null }));
}
