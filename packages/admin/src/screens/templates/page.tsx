import { requireAdminPage } from "../require-admin";
import { TemplateManager } from "./template-manager";

export default async function AdminTemplatesPage() {
	await requireAdminPage();
	return <TemplateManager />;
}
