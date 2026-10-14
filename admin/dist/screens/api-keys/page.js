import { jsx as _jsx } from "react/jsx-runtime";
import { requireAdminPage } from "../require-admin.js";
import { ShellPage } from "../shared/admin-shell.js";
import { ApiKeysSettings } from "./api-keys-settings.js";
import { apiKeysMessages } from "./messages.js";
/** `<admin path>/api-keys`: the central key store. */
export default async function AdminApiKeysPage({ cms, server }) {
    const t = cms.site.createTranslator(apiKeysMessages);
    await requireAdminPage(cms, server);
    return (_jsx(ShellPage, { title: t("title"), nav: "api-keys", children: _jsx(ApiKeysSettings, {}) }));
}
