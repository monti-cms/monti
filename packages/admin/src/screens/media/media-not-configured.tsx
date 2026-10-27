"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import { mediaNotConfiguredMessage } from "../../api/error-message";
import { AdminShell } from "../shared/admin-shell";
import { EmptyState } from "../shared/empty-state";
import { mediaMessages } from "./messages";

/** The media page of a site without a storage adapter: says what is missing and what to add to turn the library on. */
export function MediaNotConfigured() {
	const site = useSite();
	const t = useTranslator(mediaMessages);
	return (
		<AdminShell title={t("title")} sidebar={{ activeNav: "media" }}>
			<EmptyState title={mediaNotConfiguredMessage(site)} description={t("notConfigured.hint")} />
		</AdminShell>
	);
}
