"use client";

// The loading and load-error states of the entry editor screen.

import { useSite, useTranslator } from "@monti-cms/core/site";
import { Box, Button, Stack, Text } from "@monti-cms/ui";
import { AdminLink as Link } from "../../router";
import { LoadErrorAlert } from "../shared/load-error-alert";
import { entryEditorShellMessages } from "./entry-editor-shell.messages";

/** The editor while the entry loads: a quiet line in the middle of the page, with nothing drawn in the shape of what will come. */
export function EntryEditorLoading() {
	const t = useTranslator(entryEditorShellMessages);
	return (
		<Stack height="screen" align="center" justify="center" background="page" aria-busy="true">
			<Text as="p" tone="subtle" role="status">
				{t("loadingDocument")}
			</Text>
		</Stack>
	);
}

export function EntryEditorLoadError({ message }: { message: string }) {
	const site = useSite();
	const t = useTranslator(entryEditorShellMessages);
	return (
		<Stack gap={12} padding={32}>
			<LoadErrorAlert message={message} />
			<Box>
				<Button variant="secondary" nativeButton={false} render={<Link role="link" href={site.adminHref()} />}>
					{t("backToList")}
				</Button>
			</Box>
		</Stack>
	);
}
