"use client";

import { useTranslator } from "@monti-cms/core/client";
import { AdminShell } from "../shared/admin-shell";
import { templatesMessages } from "./messages";
import { TemplateManager } from "./template-manager";

/** The body templates page: the shared frame (sidebar, title) around the template manager. */
export function TemplatesScreen() {
	const t = useTranslator(templatesMessages);
	return (
		<AdminShell title={t("title")} sidebar={{ activeNav: "templates" }}>
			<TemplateManager />
		</AdminShell>
	);
}
