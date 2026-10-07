import type { Cms } from "@monti-cms/core/runtime";
import type { AdminServer } from "../../host/server";
import { requireAdminPage } from "../require-admin";
import { SchemaScreen } from "./schema-screen";

export default async function AdminSchemaPage({ cms, server }: { cms: Cms; server: AdminServer }) {
	await requireAdminPage(cms, server);
	return <SchemaScreen />;
}
