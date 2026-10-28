"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import { PageBody, PageColumn, PageHeader } from "@monti-cms/ui";
import { mediaNotConfiguredMessage } from "../../api/error-message";
import { AdminFrame } from "../shared/admin-frame";
import { EmptyState } from "../shared/empty-state";
import { mediaMessages } from "./messages";

/** The media page of a site without a storage adapter: says what is missing and what to add to turn the library on. */
export function MediaNotConfigured() {
	const site = useSite();
	const t = useTranslator(mediaMessages);
	return (
		<AdminFrame sidebar={{ activeNav: "media" }}>
			<PageColumn>
				<PageHeader title={t("title")} />
				<PageBody>
					<EmptyState title={mediaNotConfiguredMessage(site)} description={t("notConfigured.hint")} />
				</PageBody>
			</PageColumn>
		</AdminFrame>
	);
}
