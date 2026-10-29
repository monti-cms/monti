"use client";

import { Upload } from "@carbon/icons-react";
import { useTranslator } from "@monti-cms/core/site";
import { Button, PageBody, PageColumn, PageHeader, Stack, Text, TextButton } from "@monti-cms/ui";
import { AdminFrame } from "../shared/admin-frame";
import { mediaMessages } from "./messages";

/** Where the storage adapters are explained. */
export const STORAGE_DOCS_URL = "https://github.com/monti-cms/monti/tree/main/packages/storage-s3#readme";

/** The media page of a site without a storage adapter: the title and sidebar stay, uploading is off, and the text says what is missing and links to how to connect it. */
export function MediaNotConfigured() {
	const t = useTranslator(mediaMessages);
	return (
		<AdminFrame sidebar={{ activeNav: "media" }}>
			<PageColumn width="list">
				<PageHeader title={t("title")}>
					<Button type="button" disabled>
						<Upload aria-hidden />
						{t("head.upload")}
					</Button>
				</PageHeader>
				<PageBody>
					<Stack gap={8} paddingY={48}>
						<Text as="span" weight="semibold">
							{t("notConfigured.title")}
						</Text>
						<Text as="span" variant="note" tone="subtle">
							{t("notConfigured.body")}{" "}
							<TextButton variant="underline" href={STORAGE_DOCS_URL} target="_blank" rel="noopener noreferrer">
								{t("notConfigured.link")}
							</TextButton>
						</Text>
					</Stack>
				</PageBody>
			</PageColumn>
		</AdminFrame>
	);
}
