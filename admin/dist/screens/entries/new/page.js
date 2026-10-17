import { jsx as _jsx } from "react/jsx-runtime";
import { isUuid } from "@monti-cms/core/site";
import { requireAdminPage } from "../../require-admin.js";
import { EntryEditorShell } from "../entry-editor-shell.js";
export default async function NewEntryPage({ cms, server, searchParams }) {
    const { site } = cms;
    const auth = await requireAdminPage(cms, server);
    const { collection, folder } = await searchParams;
    const target = site.isCollection(collection) ? collection : site.DEFAULT_COLLECTION;
    return (_jsx(EntryEditorShell, { mode: "new", collection: target, adminId: auth.userId, 
        // A folder from the address only where the collection uses folders; the server would refuse the create otherwise.
        folderId: site.foldersEnabled(target) && isUuid(folder) ? folder : null }));
}
