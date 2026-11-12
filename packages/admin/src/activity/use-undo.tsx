import type { TrashEffects, TrashRef, UndoPlan, UndoPlanned } from "@monti-cms/core";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	toast,
} from "@monti-cms/ui";
import { useState } from "react";
import { useAdmin } from "../operations/admin-context";
import { useOperation } from "../operations/use-operation";
import { pointingWords } from "../trash/use-trash";

const TRASH_KINDS = ["entry", "media", "folder"];

/**
 * Takes a write back, the one way every screen does (doc 13).
 *
 * - `run` undoes at once: a toast's "undo", a moment after the person did the thing, on what is in front of them. It is their safety net and
 *   asks nothing.
 * - `ask` is the activity log's: the line may be days old, and an undo leaves no line of its own, so it cannot be redone. It reads what the
 *   undo would do first and asks once (`dialog`): that what the line made is deleted for good, that published entries lose an item it puts in
 *   the trash (the sentence throwing it away by hand says), or else only that it cannot be redone. When the undo would refuse anyway, it says
 *   why in place of the question.
 *
 * Success says nothing: what came back is on the screen. A toast speaks only for what a person cannot see: a record someone changed since stayed
 * as it is, or nothing could be taken back at all. `run` answers whether anything was undone.
 */
export function useUndo() {
	const { t, wrote } = useAdmin();
	const undo = useOperation<{ output: UndoPlan }>("activity.undo");
	const plan = useOperation<UndoPlanned>("activity.undoPlan");
	const effects = useOperation<TrashEffects>("trash.checkMove");
	const schema = useOperation<{ adminValues: Record<string, { label?: string }> }>("schema.read");
	const [asking, setAsking] = useState<{ id: string; words: string; danger: boolean } | null>(null);
	const [reading, setReading] = useState(false);

	/** Refused because the screen is behind (undone in another tab, changed since): it says why, and what the screen shows reads again. */
	const refused = (reason: Parameters<typeof t>[0] | null) => {
		wrote();
		toast.error(t(reason ?? "errors.unexpected"));
	};
	const run = async (id: string): Promise<boolean> => {
		const result = await undo.run({ id });
		if (!result.ok) {
			refused(result.refusal.reason);
			return false;
		}
		const { skip, partly } = result.body.output;
		if (skip.length + partly.length > 0) toast(t("activity.undonePartly", { count: skip.length + partly.length }));
		return true;
	};
	const ask = async (id: string) => {
		if (reading || asking) return;
		setReading(true);
		try {
			const planned = await plan.run({ id });
			if (!planned.ok) return refused(planned.refusal.reason);
			const { removes, trashes, trashedCollections } = planned.body;
			if (removes.length > 0) return setAsking({ id, words: t("activity.undoRemoves"), danger: true });
			const rows = trashes.filter((ref) => TRASH_KINDS.includes(ref.kind)) as TrashRef[];
			if (rows.length > 0) {
				const moved = await effects.run({ rows });
				if (moved.ok && moved.body.pointing > 0) {
					// What the item is called, as the list that throws it away by hand calls it: its collection's name.
					const [only, ...more] = trashedCollections;
					const named = only !== undefined && more.length === 0 ? await schema.run({}) : null;
					const label = (named?.ok ? named.body.adminValues[only as string]?.label : undefined) ?? t("trash.item");
					return setAsking({
						id,
						words: pointingWords(t, { count: moved.body.pointing, one: rows.length === 1, label }),
						danger: false,
					});
				}
			}
			setAsking({ id, words: t("activity.undoOnce"), danger: false });
		} finally {
			setReading(false);
		}
	};
	const dialog = (
		<AlertDialog open={asking !== null} onOpenChange={(open) => !open && setAsking(null)}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t("activity.undoTitle")}</AlertDialogTitle>
					<AlertDialogDescription>{asking?.words}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{t("ui.cancel")}</AlertDialogCancel>
					<AlertDialogAction
						variant={asking?.danger ? "danger" : undefined}
						onClick={() => {
							const id = asking?.id;
							setAsking(null);
							if (id) void run(id);
						}}
					>
						{t("activity.undo")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
	return { run, ask, dialog, pending: undo.pending || reading };
}
