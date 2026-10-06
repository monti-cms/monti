import { isCollection, orphanedMetadataKeys } from "@monti-cms/core/client";
import { t } from "./translate";

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
	const keys = isCollection(collection) ? orphanedMetadataKeys(collection, metadata ?? {}) : [];
	if (keys.length === 0) return null;
	return (
		<div role="note" className="mb-4 space-y-1 rounded-md border border-dashed p-3 text-cms-muted-foreground text-xs">
			<p className="font-medium">{t("inspector.removed.title")}</p>
			<p className="break-words">{t("inspector.removed.body", { keys: keys.join(", ") })}</p>
		</div>
	);
}
