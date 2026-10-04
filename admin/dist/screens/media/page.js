import { jsx as _jsx } from "react/jsx-runtime";
import { createTranslator } from "@monti-cms/core/client";
import { isCmsMediaConfigured } from "@monti-cms/core/runtime";
import { Empty, EmptyHeader, EmptyTitle } from "../../ui/empty.js";
import { MEDIA_NOT_CONFIGURED } from "../api-error-message.js";
import { requireAdminPage } from "../require-admin.js";
import { AdminShell } from "../shared/admin-shell.js";
import { MediaLibrary } from "./media-library.js";
import { mediaMessages } from "./messages.js";
const t = createTranslator(mediaMessages);
export default async function AdminMediaPage() {
    await requireAdminPage();
    if (!isCmsMediaConfigured()) {
        return (_jsx(AdminShell, { title: t("title"), sidebar: { activeNav: "media" }, children: _jsx(Empty, { className: "py-16", children: _jsx(EmptyHeader, { children: _jsx(EmptyTitle, { children: MEDIA_NOT_CONFIGURED }) }) }) }));
    }
    return _jsx(MediaLibrary, {});
}
