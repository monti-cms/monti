"use client";

import { Upload } from "@carbon/icons-react";
import { useTranslator } from "@monti-cms/core/site";
import { Button, PageBody, PageColumn, PageHeader, SearchToggle, Stack, Text, TextButton } from "@monti-cms/ui";
import { useState } from "react";
import { AdminFrame } from "../shared/admin-frame";
import { mediaMessages } from "./messages";

/** Where the storage adapters are explained. */
export const STORAGE_DOCS_URL = "https://github.com/monti-cms/monti/tree/main/packages/storage-s3#readme";

/** The media page of a site without a storage adapter: the title and sidebar stay, the search stays, uploading is off, and the text says what is missing and links to how to connect it. */
export function MediaNotConfigured() {
	const t = useTranslator(mediaMessages);
	// The page keeps the same head as the library (the search and a dimmed upload); with no storage there is nothing to find.
	const [search, setSearch] = useState("");
	return (
		<AdminFrame sidebar={{ activeNav: "media" }}>
			<PageColumn width="list">
				<PageHeader title={t("title")}>
					<SearchToggle
						label={t("head.search")}
						aria-label={t("head.searchLabel")}
						placeholder={t("head.searchLabel")}
						value={search}
						onValueChange={setSearch}
					/>
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
