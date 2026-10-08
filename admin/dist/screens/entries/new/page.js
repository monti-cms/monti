import { jsx as _jsx } from "react/jsx-runtime";
import { isUuid } from "@monti-cms/core/client";
import { requireAdminPage } from "../../require-admin.js";
import { EntryEditorShell } from "../entry-editor-shell.js";
export default async function NewEntryPage({ cms, server, searchParams }) {
    const { site } = cms;
    const auth = await requireAdminPage(cms, server);
    const { collection, folder } = await searchParams;
    return (_jsx(EntryEditorShell, { mode: "new", collection: site.isCollection(collection) ? collection : site.DEFAULT_COLLECTION, adminId: auth.userId, folderId: isUuid(folder) ? folder : null }));
}
