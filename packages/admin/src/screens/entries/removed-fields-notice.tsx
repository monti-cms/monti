import { useSite, useTranslator } from "@monti-cms/core/site";
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
		<div
			role="note"
			className="mb-comfortable space-y-tight rounded-md border border-monti-muted border-dashed p-normal text-monti-caption text-monti-muted"
		>
			<p className="font-medium">{t("inspector.removed.title")}</p>
			<p className="break-words">{t("inspector.removed.body", { keys: keys.join(", ") })}</p>
		</div>
	);
}
