import type { UndoPlan } from "@monti-cms/core";
import { toast } from "@monti-cms/ui";
import { useAdmin } from "../operations/admin-context";
import { useOperation } from "../operations/use-operation";

/**
 * Takes a write back, the one way every screen does (doc 13): a toast's "undo" after a move to the trash or a change of relations, and a line of
 * the activity log. It does not ask first. What came back is on the screen, so success says nothing; it speaks only for what a person cannot see:
 * a record someone changed since stayed as it is, or nothing could be taken back at all. It answers whether anything was undone.
 */
export function useUndo() {
	const { t, wrote } = useAdmin();
	const undo = useOperation<{ output: UndoPlan }>("activity.undo");
	const run = async (id: string): Promise<boolean> => {
		const result = await undo.run({ id });
		if (!result.ok) {
			// Refused because the screen is behind (undone in another tab, changed since): what it shows reads again.
			wrote();
			toast.error(t(result.refusal.reason ?? "errors.unexpected"));
			return false;
		}
		const { skip, partly } = result.body.output;
		if (skip.length + partly.length > 0) toast(t("activity.undonePartly", { count: skip.length + partly.length }));
		return true;
	};
	return { run, pending: undo.pending };
}
