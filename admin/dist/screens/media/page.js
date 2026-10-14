import { jsx as _jsx } from "react/jsx-runtime";
import { ImageOff } from "lucide-react";
import { mediaNotConfiguredMessage } from "../../api/error-message.js";
import { requireAdminPage } from "../require-admin.js";
import { ShellPage } from "../shared/admin-shell.js";
import { EmptyState } from "../shared/empty-state.js";
import { MediaLibrary } from "./media-library.js";
import { mediaMessages } from "./messages.js";
export default async function AdminMediaPage({ cms, server }) {
    const { site } = cms;
    const t = site.createTranslator(mediaMessages);
    await requireAdminPage(cms, server);
    if (!cms.isMediaConfigured) {
        return (_jsx(ShellPage, { title: t("title"), nav: "media", children: _jsx(EmptyState, { icon: ImageOff, title: mediaNotConfiguredMessage(site) }) }));
    }
    return _jsx(MediaLibrary, {});
}
