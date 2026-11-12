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
import { useRef, useState } from "react";
import { useAdmin } from "../operations/admin-context";
import { useOperation } from "../operations/use-operation";
import { holdsKeyboardFocus } from "../screens/frame/focus-hand-off";
import { pointingWords } from "../trash/use-trash";

const TRASH_KINDS = ["entry", "media", "folder"];

/**
 * Takes a write back, the one way every screen does (doc 13).
 *
 * - `run` undoes at once: a toast's "undo", a moment after the person did the thing, on what is in front of them. It is their safety net and
 *   asks nothing.
 * - `ask` is the activity log's: the line may be days old, and an undo leaves no line of its own, so it cannot be redone. It reads what the
 *   undo would do first and asks once (`dialog`): that what the line made is deleted for good, that published entries lose an item it puts in
 *   the trash (the sentence throwing it away by hand says), both when both are so, or else only that it cannot be redone. When the undo would
 *   refuse anyway, or what it would do cannot be read, it says so in place of the question: a question is never asked whose words may be false.
 *
 * The question gives the focus back to what opened it, as every question does; a control the undo then takes away hands that focus on by the
 * rule (`useFocusHandOff`). When the undo answers before the question has closed, that control is gone already and there is nothing to give
 * the focus back to: `ask` takes where it goes then (`gone`), and uses it only for an undo confirmed with the keyboard.
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
	const [asking, setAsking] = useState<{ id: string; words: string[]; danger: boolean } | null>(null);
	/** Where the focus goes when what opened the question is gone by the time it closes; `null` from it leaves the question's own way. */
	const gone = useRef<(() => HTMLElement | null) | null>(null);
	/** The question was answered with "undo" by a press that held the keyboard's focus. */
	const byKeys = useRef(false);
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
	const ask = async (id: string, whenGone?: () => HTMLElement | null) => {
		if (reading || asking) return;
		gone.current = whenGone ?? null;
		byKeys.current = false;
		setReading(true);
		try {
			const planned = await plan.run({ id });
			if (!planned.ok) return refused(planned.refusal.reason);
			const { removes, trashes, trashedCollections } = planned.body;
			const words: string[] = [];
			if (removes.length > 0) words.push(t("activity.undoRemoves"));
			const rows = trashes.filter((ref) => TRASH_KINDS.includes(ref.kind)) as TrashRef[];
			if (rows.length > 0) {
				const moved = await effects.run({ rows });
				// Whether published entries lose the items is not known: nothing is asked, since the question could not say it.
				if (!moved.ok) return refused(moved.refusal.reason);
				if (moved.body.pointing > 0) {
					// What the item is called, as the list that throws it away by hand calls it: its collection's name.
					const [only, ...more] = trashedCollections;
					const named = only !== undefined && more.length === 0 ? await schema.run({}) : null;
					const label = (named?.ok ? named.body.adminValues[only as string]?.label : undefined) ?? t("trash.item");
					words.push(pointingWords(t, { count: moved.body.pointing, one: rows.length === 1, label }));
				}
			}
			// With nothing lost that the row does not say, only that it cannot be redone.
			setAsking({ id, words: words.length > 0 ? words : [t("activity.undoOnce")], danger: removes.length > 0 });
		} finally {
			setReading(false);
		}
	};
	const dialog = (
		<AlertDialog open={asking !== null} onOpenChange={(open) => !open && setAsking(null)}>
			<AlertDialogContent finalFocus={() => (byKeys.current ? (gone.current?.() ?? null) : null)}>
				<AlertDialogHeader>
					<AlertDialogTitle>{t("activity.undoTitle")}</AlertDialogTitle>
					<AlertDialogDescription>{asking?.words.join(" ")}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{t("ui.cancel")}</AlertDialogCancel>
					<AlertDialogAction
						variant={asking?.danger ? "danger" : undefined}
						onClick={(event) => {
							const id = asking?.id;
							byKeys.current = holdsKeyboardFocus(event.currentTarget);
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
	// `pending` is the undo itself. While what it would do is read nothing has begun: the control that asked stays as it is.
	return { run, ask, dialog, pending: undo.pending };
}
