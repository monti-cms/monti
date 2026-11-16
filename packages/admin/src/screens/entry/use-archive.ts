import { toast } from "@monti-cms/ui";
import { useUndo } from "../../activity/use-undo";
import { useAdmin } from "../../operations/admin-context";
import { reasonOf, useOperation } from "../../operations/use-operation";

type Archived = { activityId?: string | null };

/**
 * Archives entries and takes them out of the archive, the one way the editor and the list do (doc 02). Archiving takes a published entry off
 * the site, and out of the list's usual view: the toast says it was done and takes it back, as the move to the trash does (`useTrashMove`).
 * Unarchiving gives a draft, not what was published: the same toast, the same way back. A refusal says why. Each answers whether it went through.
 */
export function useArchive() {
	const { t } = useAdmin();
	const archive = useOperation<Archived>("entries.archive");
	const unarchive = useOperation<Archived>("entries.unarchive");
	const undo = useUndo();

	const told = (result: Awaited<ReturnType<typeof archive.run>>, words: "entry.archived" | "entry.unarchived") => {
		if (!result.ok) {
			toast.error(t(reasonOf(result.refusal)));
			return false;
		}
		const activity = result.body.activityId;
		toast(t(words), {
			action: activity ? { label: t("common.undo"), onClick: () => void undo.run(activity) } : undefined,
		});
		return true;
	};

	return {
		archive: async (ids: string[]) => told(await archive.run({ ids }), "entry.archived"),
		unarchive: async (ids: string[]) => told(await unarchive.run({ ids }), "entry.unarchived"),
		archiving: archive.pending,
		unarchiving: unarchive.pending,
	};
}
