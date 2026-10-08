import { jsx as _jsx } from "react/jsx-runtime";
import { Empty, EmptyHeader, EmptyTitle } from "../../ui/empty.js";
import { mediaNotConfiguredMessage } from "../api-error-message.js";
import { requireAdminPage } from "../require-admin.js";
import { AdminShell } from "../shared/admin-shell.js";
import { MediaLibrary } from "./media-library.js";
import { mediaMessages } from "./messages.js";
export default async function AdminMediaPage({ cms, server }) {
    const { site } = cms;
    const t = site.createTranslator(mediaMessages);
    await requireAdminPage(cms, server);
    if (!cms.isMediaConfigured) {
        return (_jsx(AdminShell, { title: t("title"), sidebar: { activeNav: "media" }, children: _jsx(Empty, { className: "py-16", children: _jsx(EmptyHeader, { children: _jsx(EmptyTitle, { children: mediaNotConfiguredMessage(site) }) }) }) }));
    }
    return _jsx(MediaLibrary, {});
}
