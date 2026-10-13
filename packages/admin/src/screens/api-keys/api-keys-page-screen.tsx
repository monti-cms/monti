"use client";

import { useTranslator } from "@monti-cms/core/client";
import { AdminShell } from "../shared/admin-shell";
import { ApiKeysSettings } from "./api-keys-settings";
import { apiKeysMessages } from "./messages";

/** The API keys page: the shared frame (sidebar, title) around the key store. */
export function ApiKeysPageScreen() {
	const t = useTranslator(apiKeysMessages);
	return (
		<AdminShell title={t("title")} sidebar={{ activeNav: "api-keys" }}>
			<ApiKeysSettings />
		</AdminShell>
	);
}
