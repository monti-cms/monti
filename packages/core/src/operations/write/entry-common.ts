import type { Entry } from "../../core/store";
import { CmsError } from "../../core/store/errors";
import type { OperationContext, WritePlan } from "../define";

/** The entry as a write plans against it: it must exist and be out of the trash. */
export async function liveEntry(context: OperationContext, id: string): Promise<Entry> {
	const entry = await context.cms.store().getEntry(id);
	if (entry.deletedAt) throw new CmsError(`Entry ${id} is in the trash`, "invalid_status");
	return entry;
}

/** What an entry is called in a proposal: its title, its draft address and its collection. */
export const subjectOf = (context: OperationContext, entry: Entry): WritePlan["subject"] => ({
	title:
		(context.cms.site.isCollection(entry.collection)
			? context.cms.site.titleOfValues(entry.collection as never, entry.working.metadata as never)
			: null) ?? "",
	...(entry.workingSlug ? { path: `/${entry.workingSlug}` } : {}),
	collection: entry.collection,
});
