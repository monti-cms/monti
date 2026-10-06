import type { Cms } from "@monti-cms/core/runtime";
import { requireAdminPage } from "../require-admin";
import { TemplateManager } from "./template-manager";

export default async function AdminTemplatesPage({ cms }: { cms: Cms }) {
	await requireAdminPage(cms);
	return <TemplateManager />;
}
