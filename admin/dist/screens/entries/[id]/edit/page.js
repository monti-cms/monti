import { jsx as _jsx } from "react/jsx-runtime";
import { requireAdminPage } from "../../../require-admin.js";
import { EntryEditorShell } from "../../entry-editor-shell.js";
export default async function EditEntryPage({ cms, server, params }) {
    const auth = await requireAdminPage(cms, server);
    const { id } = await params;
    // Start a fresh editing state when switching between translations.
    return _jsx(EntryEditorShell, { mode: "edit", initialEntryId: id, adminId: auth.userId }, id);
}
