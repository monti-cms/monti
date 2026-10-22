import { useSite, useTranslator } from "@monti-cms/core/site";
import { Box, Stack, Text } from "@monti-cms/ui";
import { entriesMessages } from "./messages";

/**
 * Read-only notice listing the values of fields the site has removed. The values are kept with the entry and saved back unchanged,
 * but no input edits them, so the author is told they exist. Renders nothing when there are none.
 */
export function RemovedFieldsNotice({
	collection,
	metadata,
}: {
	collection: string;
	metadata: Readonly<Record<string, unknown>> | undefined;
}) {
	const t = useTranslator(entriesMessages);
	const site = useSite();
	const keys = site.isCollection(collection) ? site.orphanedMetadataKeys(collection, metadata ?? {}) : [];
	if (keys.length === 0) return null;
	return (
		<Box paddingBottom="comfortable">
			<Box role="note" padding="normal" border="dashed" radius="md">
				<Stack gap="tight">
					<Text as="p" variant="caption" tone="muted" weight="medium">
						{t("inspector.removed.title")}
					</Text>
					<Text as="p" variant="caption" tone="muted">
						{t("inspector.removed.body", { keys: keys.join(", ") })}
					</Text>
				</Stack>
			</Box>
		</Box>
	);
}
