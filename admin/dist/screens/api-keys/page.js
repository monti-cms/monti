import { jsx as _jsx } from "react/jsx-runtime";
import { requireAdminPage } from "../require-admin.js";
import { ApiKeysPageScreen } from "./api-keys-page-screen.js";
/** `<admin path>/api-keys`: the central key store. */
export default async function AdminApiKeysPage({ cms, server }) {
    await requireAdminPage(cms, server);
    return _jsx(ApiKeysPageScreen, {});
}
