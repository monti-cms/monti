import { jsx as _jsx } from "react/jsx-runtime";
import { requireAdminPage } from "../require-admin.js";
import { SchemaScreen } from "./schema-screen.js";
export default async function AdminSchemaPage({ cms, server }) {
    await requireAdminPage(cms, server);
    return _jsx(SchemaScreen, {});
}
