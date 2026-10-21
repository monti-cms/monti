import { jsx as _jsx } from "react/jsx-runtime";
import { requireAdminPage } from "../require-admin.js";
import { DataScreen } from "./data-screen.js";
/** `<admin path>/data`: the site backup, the entry import and the backup restore. */
export default async function AdminDataPage({ cms, server }) {
    await requireAdminPage(cms, server);
    return _jsx(DataScreen, {});
}
